// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopReleaseDispatchError, dispatchDesktopReleaseWorkflow } from './github';

describe('dispatchDesktopReleaseWorkflow', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('dispatches the fixed workflow with the frozen release id', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await dispatchDesktopReleaseWorkflow(
      { channel: 'stable', releaseId: 'release-1', releaseNotes: 'notes', version: '2.4.0' },
      { fetcher, token: 'secret' },
    );

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/maheshenga/comhub/actions/workflows/comhub-desktop-release.yml/dispatches',
      expect.objectContaining({
        body: JSON.stringify({
          inputs: {
            channel: 'stable',
            release_id: 'release-1',
            release_notes: 'notes',
            version: '2.4.0',
          },
          ref: 'main',
        }),
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': 'Bearer secret',
          'Content-Type': 'application/json',
          'User-Agent': 'comhub-desktop-release-dispatcher',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        method: 'POST',
      }),
    );
  });

  it('uses configured repository and ref overrides', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await dispatchDesktopReleaseWorkflow(
      { channel: 'canary', releaseId: 'release-1', releaseNotes: '', version: '2.4.0' },
      { fetcher, ref: 'release-branch', repository: 'owner/repo', token: 'secret' },
    );

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/actions/workflows/comhub-desktop-release.yml/dispatches',
      expect.objectContaining({ body: expect.stringContaining('"ref":"release-branch"') }),
    );
  });

  it('requires the configured GitHub token without exposing it', async () => {
    vi.stubEnv('DESKTOP_RELEASE_GITHUB_TOKEN', '');

    await expect(
      dispatchDesktopReleaseWorkflow({
        channel: 'stable',
        releaseId: 'release-1',
        releaseNotes: 'notes',
        version: '2.4.0',
      }),
    ).rejects.toMatchObject({
      code: 'github-token-missing',
      message: 'Desktop release dispatch is unavailable.',
    });
  });

  it('aborts and clears the timeout when the dispatch exceeds ten seconds', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const dispatch = dispatchDesktopReleaseWorkflow(
      { channel: 'stable', releaseId: 'release-1', releaseNotes: 'notes', version: '2.4.0' },
      { fetcher: fetcher as typeof fetch, token: 'secret' },
    );
    const rejection = expect(dispatch).rejects.toMatchObject({ code: 'github-dispatch-timeout' });

    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns a bounded redacted summary for GitHub failures', async () => {
    const token = 'super-secret-token';
    const releaseNotes = 'private release notes';
    const rawBody = `${token} ${releaseNotes} ${'x'.repeat(2_000)}`;
    const fetcher = vi.fn().mockResolvedValue(new Response(rawBody, { status: 500 }));

    await expect(
      dispatchDesktopReleaseWorkflow(
        { channel: 'stable', releaseId: 'release-1', releaseNotes, version: '2.4.0' },
        { fetcher, token },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(DesktopReleaseDispatchError);
      expect((error as DesktopReleaseDispatchError).code).toBe('github-dispatch-failed');
      expect((error as DesktopReleaseDispatchError).summary).toBe('GitHub dispatch failed (500).');
      expect((error as DesktopReleaseDispatchError).summary).not.toContain(token);
      expect((error as DesktopReleaseDispatchError).summary).not.toContain(releaseNotes);
      return true;
    });
  });
});
