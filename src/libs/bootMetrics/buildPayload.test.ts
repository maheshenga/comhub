import { describe, expect, it } from 'vitest';

import { buildBootMetricsPayload } from './buildPayload';

const baseDimensions = {
  appVersion: '1.0.0',
  cold: true,
  isLogin: false,
  platform: 'web' as const,
};

const emptySnapshot = { marks: {}, spans: [] };

describe('buildBootMetricsPayload', () => {
  it('uses first-paint mark as totalMs when present', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      snapshot: { marks: { 'first-paint': 420 }, spans: [] },
    });

    expect(result.totalMs).toBe(420);
  });

  it('falls back to max span end when first-paint is absent', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      snapshot: {
        marks: {},
        spans: [
          { durMs: 100, name: 'a', startMs: 50 },
          { durMs: 200, name: 'b', startMs: 0 },
        ],
      },
    });

    expect(result.totalMs).toBe(200);
  });

  it('returns 0 when no marks and no spans exist', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      snapshot: emptySnapshot,
    });

    expect(result.totalMs).toBe(0);
  });

  it('rounds totalMs and span timings to integers', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      snapshot: {
        marks: { 'first-paint': 1746.4000000059605 },
        spans: [{ durMs: 1415.2, name: 'bundle', startMs: 46.7000000029 }],
      },
    });

    expect(result.totalMs).toBe(1746);
    expect(result.spans[0]).toEqual({ durMs: 1415, name: 'bundle', startMs: 47 });
  });

  it('propagates all dimensions', () => {
    const result = buildBootMetricsPayload({
      dimensions: {
        anonId: 'a123',
        appVersion: '2.0.0',
        cold: false,
        isLogin: true,
        platform: 'desktop',
        userId: 'u42',
      },
      snapshot: emptySnapshot,
    });

    expect(result).toMatchObject({
      anonId: 'a123',
      appVersion: '2.0.0',
      cold: false,
      isLogin: true,
      platform: 'desktop',
      userId: 'u42',
    });
  });

  it('keeps existing spans and derives ttfb/doc/bundle/store-gate/fcp spans', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      fcpMs: 900.5,
      htmlMarkMs: 200,
      navResponseStartMs: 23.9,
      snapshot: {
        marks: {
          'app-ready': 500,
          'bundle-eval': 350,
          'first-paint': 650,
        },
        spans: [{ durMs: 10, name: 'core-init', startMs: 5 }],
      },
    });

    expect(result.spans).toContainEqual({ durMs: 10, name: 'core-init', startMs: 5 });
    expect(result.spans).toContainEqual({ durMs: 24, name: 'ttfb', startMs: 0 });
    expect(result.spans).toContainEqual({ durMs: 200, name: 'doc', startMs: 0 });
    expect(result.spans).toContainEqual({ durMs: 150, name: 'bundle', startMs: 200 });
    expect(result.spans).toContainEqual({ durMs: 150, name: 'store-gate', startMs: 500 });
    expect(result.spans).toContainEqual({ durMs: 901, name: 'fcp', startMs: 0 });
  });

  it('omits derived spans with missing, duplicate, negative, or non-finite durations', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      fcpMs: -1,
      htmlMarkMs: 400,
      navResponseStartMs: Number.POSITIVE_INFINITY,
      resourceTimings: [
        { durMs: -5, name: 'fetch:user-state', startMs: 10 },
        { durMs: 50, name: 'cache-hydration', startMs: 0 },
      ],
      snapshot: {
        marks: { 'app-ready': 700, 'bundle-eval': 300, 'first-paint': 600 },
        spans: [{ durMs: 30, name: 'cache-hydration', startMs: 5 }],
      },
    });

    expect(result.spans.find((s) => s.name === 'ttfb')).toBeUndefined();
    expect(result.spans.find((s) => s.name === 'bundle')).toBeUndefined();
    expect(result.spans.find((s) => s.name === 'store-gate')).toBeUndefined();
    expect(result.spans.find((s) => s.name === 'fcp')).toBeUndefined();
    expect(result.spans.find((s) => s.name === 'fetch:user-state')).toBeUndefined();
    expect(result.spans.filter((s) => s.name === 'cache-hydration')).toHaveLength(1);
  });

  it('appends valid resource timings', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      resourceTimings: [{ durMs: 120, name: 'fetch:server-config', startMs: 10 }],
      snapshot: emptySnapshot,
    });

    expect(result.spans).toContainEqual({ durMs: 120, name: 'fetch:server-config', startMs: 10 });
  });

  it('caps spans at 64', () => {
    const manySpans = Array.from({ length: 70 }, (_, i) => ({
      durMs: 1,
      name: `span-${i}`,
      startMs: i,
    }));
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      snapshot: { marks: {}, spans: manySpans },
    });

    expect(result.spans).toHaveLength(64);
  });

  it('omits NaN derived durations', () => {
    const result = buildBootMetricsPayload({
      dimensions: baseDimensions,
      navResponseStartMs: Number.NaN,
      snapshot: emptySnapshot,
    });

    expect(result.spans.find((s) => s.name === 'ttfb')).toBeUndefined();
  });
});
