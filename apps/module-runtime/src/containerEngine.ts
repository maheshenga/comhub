import { spawn } from 'node:child_process';

import {
  type ModuleAppSandboxOutcome,
  recordModuleAppSandboxCleanupFailure,
  recordModuleAppSandboxInvocation,
} from '@lobechat/observability-otel/modules/module-app';

const MAX_LOG_BYTES = 64 * 1024;
const CLEANUP_RETRY_DELAYS_MS = [50, 100, 200, 400, 800, 800] as const;

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

type ModuleAppContainerMetrics = {
  recordCleanupFailure: () => void;
  recordInvocation: (input: {
    durationMs: number;
    outcome: ModuleAppSandboxOutcome;
    runtime: 'node22' | 'python312';
  }) => void;
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
    const result = await runDocker(['rm', '--force', containerName], { timeoutMs: 15_000 });
    if (result.exitCode !== 0 || result.stderr.includes('No such container')) {
      throw new Error('MODULE_APP_RUNTIME_CLEANUP_FAILED');
    }
  },
  run: ({ args, input, timeoutMs }) => runDocker(args, { input, timeoutMs }),
};

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

export const buildDockerRunArgs = (input: ModuleAppContainerRunInput) => {
  if (!/^(?:sha256:|.+@sha256:)[a-f0-9]{64}$/.test(input.imageDigest)) {
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
  private readonly metrics: ModuleAppContainerMetrics;
  private readonly runner: DockerRunner;

  constructor(options: { metrics?: ModuleAppContainerMetrics; runner?: DockerRunner } = {}) {
    this.metrics = options.metrics ?? {
      recordCleanupFailure: recordModuleAppSandboxCleanupFailure,
      recordInvocation: recordModuleAppSandboxInvocation,
    };
    this.runner = options.runner ?? defaultRunner;
  }

  run = async (input: ModuleAppContainerRunInput) => {
    const startedAt = Date.now();
    let outcome: ModuleAppSandboxOutcome = 'failed';
    try {
      const result = await this.runner.run({
        args: buildDockerRunArgs(input),
        input: JSON.stringify(input.input),
        timeoutMs: input.limits.timeoutMs,
      });
      if (result.exitCode === 137) {
        outcome = 'oom';
        throw new Error('MODULE_APP_RUNTIME_OOM');
      }
      if (result.exitCode !== 0) throw new Error('MODULE_APP_RUNTIME_PROCESS_FAILED');
      outcome = 'succeeded';
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'MODULE_APP_RUNTIME_TIMEOUT') {
        outcome = 'timeout';
      } else if (error instanceof Error && error.message === 'MODULE_APP_RUNTIME_OOM') {
        outcome = 'oom';
      }
      let cleaned = false;
      for (const retryDelayMs of [0, ...CLEANUP_RETRY_DELAYS_MS]) {
        if (retryDelayMs > 0) await wait(retryDelayMs);
        try {
          await this.runner.remove(input.containerName);
          cleaned = true;
          break;
        } catch {
          // Docker may finish creating the named container after its CLI process times out.
        }
      }
      if (!cleaned) {
        this.metrics.recordCleanupFailure();
      }
      throw error;
    } finally {
      this.metrics.recordInvocation({
        durationMs: Date.now() - startedAt,
        outcome,
        runtime: input.runtime,
      });
    }
  };
}
