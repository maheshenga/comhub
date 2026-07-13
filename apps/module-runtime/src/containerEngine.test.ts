import { describe, expect, it, vi } from 'vitest';

import {
  buildDockerRunArgs,
  DockerCliModuleAppContainerEngine,
} from './containerEngine';

const input = {
  artifactDirectory: '/runtime/artifacts/' + 'a'.repeat(64),
  containerName: 'module-app-invocation-1',
  entry: 'server/search.js',
  imageDigest: `ghcr.io/comhub/module-app-node22@sha256:${'b'.repeat(64)}`,
  input: { query: 'jobs' },
  limits: {
    cpu: 1,
    memoryBytes: 256 * 1024 * 1024,
    pids: 64,
    timeoutMs: 10_000,
  },
  runtime: 'node22' as const,
};

describe('buildDockerRunArgs', () => {
  it('builds a fixed isolated container command', () => {
    expect(buildDockerRunArgs(input)).toEqual([
      'run',
      '--rm',
      '--name',
      'module-app-invocation-1',
      '--network',
      'none',
      '--read-only',
      '--user',
      '10001:10001',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--pids-limit',
      '64',
      '--memory',
      String(256 * 1024 * 1024),
      '--cpus',
      '1',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=67108864',
      '--mount',
      `type=bind,src=${input.artifactDirectory},dst=/runtime/artifact,readonly`,
      '--workdir',
      '/runtime/artifact',
      '--env',
      'HOME=/tmp',
      '--env',
      'TMPDIR=/tmp',
      '--env',
      'LANG=C.UTF-8',
      '--env',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      '--interactive',
      input.imageDigest,
      input.entry,
    ]);
  });

  it('rejects an image that is not pinned by sha256 digest', () => {
    expect(() =>
      buildDockerRunArgs({ ...input, imageDigest: 'ghcr.io/comhub/module-app-node22:latest' }),
    ).toThrow('MODULE_APP_RUNTIME_IMAGE_INVALID');
  });

  it('accepts an immutable local Docker image id for verification probes', () => {
    expect(
      buildDockerRunArgs({ ...input, imageDigest: `sha256:${'c'.repeat(64)}` }),
    ).toContain(`sha256:${'c'.repeat(64)}`);
  });
});

describe('DockerCliModuleAppContainerEngine', () => {
  it('passes bounded JSON input to the fixed Docker command', async () => {
    const runner = {
      remove: vi.fn(),
      run: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '{"ok":true}' }),
    };
    const engine = new DockerCliModuleAppContainerEngine({ runner });

    await expect(engine.run(input)).resolves.toEqual({
      exitCode: 0,
      stderr: '',
      stdout: '{"ok":true}',
    });
    expect(runner.run).toHaveBeenCalledWith({
      args: buildDockerRunArgs(input),
      input: JSON.stringify(input.input),
      timeoutMs: 10_000,
    });
  });

  it('force-removes the named container when command execution fails', async () => {
    const runner = {
      remove: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockRejectedValue(new Error('MODULE_APP_RUNTIME_TIMEOUT')),
    };
    const engine = new DockerCliModuleAppContainerEngine({ runner });

    await expect(engine.run(input)).rejects.toThrow('MODULE_APP_RUNTIME_TIMEOUT');
    expect(runner.remove).toHaveBeenCalledWith('module-app-invocation-1');
  });

  it('retries cleanup when container creation races command timeout', async () => {
    const runner = {
      remove: vi
        .fn()
        .mockRejectedValueOnce(new Error('MODULE_APP_RUNTIME_CLEANUP_FAILED'))
        .mockResolvedValue(undefined),
      run: vi.fn().mockRejectedValue(new Error('MODULE_APP_RUNTIME_TIMEOUT')),
    };
    const engine = new DockerCliModuleAppContainerEngine({ runner });

    await expect(engine.run(input)).rejects.toThrow('MODULE_APP_RUNTIME_TIMEOUT');
    expect(runner.remove).toHaveBeenCalledTimes(2);
    expect(runner.remove).toHaveBeenNthCalledWith(2, 'module-app-invocation-1');
  });

  it('records bounded success, timeout, OOM, and cleanup outcomes', async () => {
    const metrics = {
      recordCleanupFailure: vi.fn(),
      recordInvocation: vi.fn(),
    };
    const successRunner = {
      remove: vi.fn(),
      run: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '{}' }),
    };
    await new DockerCliModuleAppContainerEngine({ metrics, runner: successRunner }).run(input);
    expect(metrics.recordInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'succeeded', runtime: 'node22' }),
    );

    const oomRunner = {
      remove: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue({ exitCode: 137, stderr: 'Killed', stdout: '' }),
    };
    await expect(
      new DockerCliModuleAppContainerEngine({ metrics, runner: oomRunner }).run(input),
    ).rejects.toThrow('MODULE_APP_RUNTIME_OOM');
    expect(metrics.recordInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'oom', runtime: 'node22' }),
    );

    const timeoutRunner = {
      remove: vi.fn().mockRejectedValue(new Error('cleanup failed')),
      run: vi.fn().mockRejectedValue(new Error('MODULE_APP_RUNTIME_TIMEOUT')),
    };
    await expect(
      new DockerCliModuleAppContainerEngine({ metrics, runner: timeoutRunner }).run(input),
    ).rejects.toThrow('MODULE_APP_RUNTIME_TIMEOUT');
    expect(metrics.recordCleanupFailure).toHaveBeenCalledOnce();
    expect(metrics.recordInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'timeout', runtime: 'node22' }),
    );
  });
});
