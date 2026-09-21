import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'startServer.js'),
  'utf8',
);

describe('server launcher schedule bootstrap', () => {
  it('keeps the production dispatcher aligned with minute-resolution cron schedules', () => {
    expect(source).toContain("const TASK_SCHEDULE_CRON = '* * * * *';");
    expect(source).toContain('cron: TASK_SCHEDULE_CRON');
    expect(source).toContain("cron: '*/5 * * * *'");
    expect(source).toContain("'Upstash-Cron': schedule.cron");
  });

  it('targets the authenticated central task dispatcher', () => {
    expect(source).toContain('/api/workflows/task/schedule-dispatch');
    expect(source).toContain("id: 'lobe-task-schedule-dispatch'");
    expect(source).toContain("'Upstash-Schedule-Id': schedule.id");
    expect(source).toContain("'Authorization': `Bearer ${QSTASH_TOKEN}`");
    expect(source).toContain("path: '/api/workflows/goal/sweep'");
    expect(source).toContain("id: 'lobe-goal-sweep'");
  });
});
