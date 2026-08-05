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
    expect(source).toContain("'Upstash-Cron': TASK_SCHEDULE_CRON");
    expect(source).not.toContain("'Upstash-Cron': '*/10 * * * *'");
  });

  it('targets the authenticated central task dispatcher', () => {
    expect(source).toContain('/api/workflows/task/schedule-dispatch');
    expect(source).toContain("'Upstash-Schedule-Id': 'lobe-task-schedule-dispatch'");
  });
});
