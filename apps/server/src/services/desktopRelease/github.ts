import type { DesktopReleaseChannel } from '@lobechat/types';

const DESKTOP_RELEASE_DISPATCH_TIMEOUT_MS = 10_000;
const DESKTOP_RELEASE_WORKFLOW_FILE = 'comhub-desktop-release.yml';
const DEFAULT_GITHUB_REF = 'main';
const DEFAULT_GITHUB_REPOSITORY = 'maheshenga/comhub';

type DispatchInput = {
  channel: DesktopReleaseChannel;
  releaseId: string;
  releaseNotes: string;
  version: string;
};

type DispatchOptions = {
  fetcher?: typeof fetch;
  ref?: string;
  repository?: string;
  token?: string;
};

export class DesktopReleaseDispatchError extends Error {
  constructor(
    public readonly code:
      'github-dispatch-failed' | 'github-dispatch-timeout' | 'github-token-missing',
    public readonly summary: string,
  ) {
    super(summary);
    this.name = 'DesktopReleaseDispatchError';
  }
}

const getToken = (options: DispatchOptions) =>
  options.token ?? process.env.DESKTOP_RELEASE_GITHUB_TOKEN;

export const dispatchDesktopReleaseWorkflow = async (
  input: DispatchInput,
  options: DispatchOptions = {},
): Promise<void> => {
  const token = getToken(options);
  if (!token) {
    throw new DesktopReleaseDispatchError(
      'github-token-missing',
      'Desktop release dispatch is unavailable.',
    );
  }

  const repository =
    options.repository ??
    process.env.DESKTOP_RELEASE_GITHUB_REPOSITORY ??
    DEFAULT_GITHUB_REPOSITORY;
  const ref = options.ref ?? process.env.DESKTOP_RELEASE_GITHUB_REF ?? DEFAULT_GITHUB_REF;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, DESKTOP_RELEASE_DISPATCH_TIMEOUT_MS);

  try {
    const response = await (options.fetcher ?? fetch)(
      `https://api.github.com/repos/${repository}/actions/workflows/${DESKTOP_RELEASE_WORKFLOW_FILE}/dispatches`,
      {
        body: JSON.stringify({
          inputs: {
            channel: input.channel,
            release_id: input.releaseId,
            release_notes: input.releaseNotes,
            version: input.version,
          },
          ref,
        }),
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'comhub-desktop-release-dispatcher',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        method: 'POST',
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new DesktopReleaseDispatchError(
        'github-dispatch-failed',
        `GitHub dispatch failed (${response.status}).`,
      );
    }
  } catch (error) {
    if (error instanceof DesktopReleaseDispatchError) throw error;
    if (timedOut || controller.signal.aborted) {
      throw new DesktopReleaseDispatchError(
        'github-dispatch-timeout',
        'GitHub dispatch timed out.',
      );
    }
    throw new DesktopReleaseDispatchError('github-dispatch-failed', 'GitHub dispatch failed.');
  } finally {
    clearTimeout(timeout);
  }
};
