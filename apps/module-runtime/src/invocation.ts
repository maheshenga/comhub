import { spawn } from 'node:child_process';
import path from 'node:path';

import type { ModuleAppInvocation } from '@lobechat/types';

import { assertModuleAppRuntimePolicy } from './policy';

const MODULE_APP_RUNTIME_MAX_LOG_BYTES = 64 * 1024;
const MODULE_APP_RUNTIME_ARTIFACT_ROOT = '/runtime/artifacts';

type LauncherResult = {
  output?: unknown;
  stderr?: string;
  stdout?: string;
};

export type ModuleAppRuntimeLauncher = {
  invoke: (input: ModuleAppInvocation) => Promise<LauncherResult>;
};

const boundLog = (value = '') => value.slice(0, MODULE_APP_RUNTIME_MAX_LOG_BYTES);

export class ModuleAppRuntimeInvoker {
  private readonly launcher: ModuleAppRuntimeLauncher;

  constructor(options: { launcher: ModuleAppRuntimeLauncher }) {
    this.launcher = options.launcher;
  }

  invoke = async (rawInput: unknown) => {
    const input = assertModuleAppRuntimePolicy(rawInput);
    const result = await this.launcher.invoke(input);

    return {
      invocationId: input.invocationId,
      output: result.output,
      status: 'succeeded' as const,
      stderr: boundLog(result.stderr),
      stdout: boundLog(result.stdout),
    };
  };
}

export class FixedProcessModuleAppLauncher implements ModuleAppRuntimeLauncher {
  constructor(private readonly artifactRoot = MODULE_APP_RUNTIME_ARTIFACT_ROOT) {}

  invoke = async (input: ModuleAppInvocation): Promise<LauncherResult> => {
    const artifactDirectory = path.resolve(this.artifactRoot, input.artifactSha256);
    const entry = path.resolve(artifactDirectory, input.entry);
    if (!entry.startsWith(`${artifactDirectory}/`)) {
      throw new Error('MODULE_APP_RUNTIME_POLICY_DENIED');
    }

    const executable = input.runtime === 'node22' ? 'node' : 'python3';
    const child = spawn(executable, [entry], {
      cwd: artifactDirectory,
      detached: true,
      env: {
        HOME: '/tmp',
        LANG: 'C.UTF-8',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        TMPDIR: '/tmp',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(JSON.stringify(input.input));

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < MODULE_APP_RUNTIME_MAX_LOG_BYTES) stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < MODULE_APP_RUNTIME_MAX_LOG_BYTES) stderr += chunk;
    });

    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
        reject(new Error('MODULE_APP_RUNTIME_TIMEOUT'));
      }, input.timeoutMs);

      child.once('error', (error) => {
        clearTimeout(timer);
        reject(new Error('MODULE_APP_RUNTIME_LAUNCH_FAILED', { cause: error }));
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error('MODULE_APP_RUNTIME_PROCESS_FAILED'));
          return;
        }

        let output: unknown;
        try {
          output = stdout.trim() ? JSON.parse(stdout) : undefined;
        } catch {
          output = undefined;
        }
        resolvePromise({ output, stderr: boundLog(stderr), stdout: boundLog(stdout) });
      });
    });
  };
}
