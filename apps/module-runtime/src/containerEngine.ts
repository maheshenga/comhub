import { spawn } from 'node:child_process';

const MAX_LOG_BYTES = 64 * 1024;

export type ModuleAppContainerRunInput = {
  artifactDirectory: string;
  containerName: string;
  entry: string;
  imageDigest: string;
  input: Record<string, unknown>;
  limits: {
    cpu: number;
    memoryBytes: number;
    pids: number;
    timeoutMs: number;
  };
  runtime: 'node22' | 'python312';
};

export interface ModuleAppContainerEngine {
  run: (input: ModuleAppContainerRunInput) => Promise<{
    exitCode: number;
    stderr: string;
    stdout: string;
  }>;
}

type DockerRunner = {
  remove: (containerName: string) => Promise<void>;
  run: (input: { args: string[]; input: string; timeoutMs: number }) => Promise<{
    exitCode: number;
    stderr: string;
    stdout: string;
  }>;
};

const boundedAppend = (current: string, chunk: string) =>
  current.length >= MAX_LOG_BYTES
    ? current
    : `${current}${chunk}`.slice(0, MAX_LOG_BYTES);

const runDocker = (
  args: string[],
  options: { input?: string; timeoutMs: number },
): Promise<{ exitCode: number; stderr: string; stdout: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    let stdout = '';
    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      handler();
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() => reject(new Error('MODULE_APP_RUNTIME_TIMEOUT')));
    }, options.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = boundedAppend(stdout, chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = boundedAppend(stderr, chunk);
    });
    child.once('error', (error) => {
      finish(() => reject(new Error('MODULE_APP_RUNTIME_LAUNCH_FAILED', { cause: error })));
    });
    child.once('exit', (code) => {
      finish(() => resolve({ exitCode: code ?? -1, stderr, stdout }));
    });
    child.stdin.end(options.input ?? '');
  });

const defaultRunner: DockerRunner = {
  remove: async (containerName) => {
    await runDocker(['rm', '--force', containerName], { timeoutMs: 15_000 }).catch(
      () => undefined,
    );
  },
  run: ({ args, input, timeoutMs }) => runDocker(args, { input, timeoutMs }),
};

export const buildDockerRunArgs = (input: ModuleAppContainerRunInput) => {
  if (!/^.+@sha256:[a-f0-9]{64}$/.test(input.imageDigest)) {
    throw new Error('MODULE_APP_RUNTIME_IMAGE_INVALID');
  }

  return [
    'run',
    '--rm',
    '--name',
    input.containerName,
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
    String(input.limits.pids),
    '--memory',
    String(input.limits.memoryBytes),
    '--cpus',
    String(input.limits.cpu),
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
  ];
};

export class DockerCliModuleAppContainerEngine implements ModuleAppContainerEngine {
  private readonly runner: DockerRunner;

  constructor(options: { runner?: DockerRunner } = {}) {
    this.runner = options.runner ?? defaultRunner;
  }

  run = async (input: ModuleAppContainerRunInput) => {
    try {
      const result = await this.runner.run({
        args: buildDockerRunArgs(input),
        input: JSON.stringify(input.input),
        timeoutMs: input.limits.timeoutMs,
      });
      if (result.exitCode !== 0) throw new Error('MODULE_APP_RUNTIME_PROCESS_FAILED');
      return result;
    } catch (error) {
      await this.runner.remove(input.containerName);
      throw error;
    }
  };
}
