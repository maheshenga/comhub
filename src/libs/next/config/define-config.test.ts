import { describe, expect, it } from 'vitest';

import { defineConfig } from './define-config';
import { dockerCanvasTracingIncludes } from './dockerCanvasTracingIncludes';

describe('defineConfig redirects', () => {
  it('leaves legacy discover paths to the user-agent-aware proxy', async () => {
    const redirects = await defineConfig({}).redirects!();

    expect(redirects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: '/discover' }),
        expect.objectContaining({ source: '/discover/:path*' }),
      ]),
    );
  });
});

describe('defineConfig', () => {
  it('disables Next.js agent rule injection', () => {
    expect(defineConfig({}).agentRules).toBe(false);
  });
});

describe('dockerCanvasTracingIncludes', () => {
  it('keeps Docker canvas tracing away from pnpm symlink directories', () => {
    expect(dockerCanvasTracingIncludes).toContain('node_modules/@napi-rs/canvas/**/*');
    expect(dockerCanvasTracingIncludes).toContain('node_modules/@napi-rs/canvas-*/package.json');
    expect(dockerCanvasTracingIncludes).toContain('node_modules/@napi-rs/canvas-*/*.node');
    expect(dockerCanvasTracingIncludes).toContain(
      'node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/package.json',
    );
    expect(dockerCanvasTracingIncludes).toContain(
      'node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/*.node',
    );
    expect(dockerCanvasTracingIncludes).not.toContain('node_modules/@napi-rs/canvas-*/**/*');
    expect(dockerCanvasTracingIncludes).not.toContain('node_modules/.pnpm/@napi-rs+canvas*/**/*');
    expect(dockerCanvasTracingIncludes).not.toContain('node_modules/.pnpm/@napi-rs+canvas-*/**/*');
  });
});
