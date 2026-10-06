import { z } from 'zod';

const MAX_USAGE_DATE_RANGE_DAYS = 366;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const validateUsageDateRange = (
  { endAt, startAt }: { endAt: string; startAt: string },
  ctx: z.RefinementCtx,
) => {
  const startTime = Date.parse(`${startAt}T00:00:00.000Z`);
  const endTime = Date.parse(`${endAt}T00:00:00.000Z`);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return;

  if (endTime < startTime) {
    ctx.addIssue({
      code: 'custom',
      message: 'endAt must be on or after startAt',
      path: ['endAt'],
    });
    return;
  }

  if ((endTime - startTime) / MILLISECONDS_PER_DAY > MAX_USAGE_DATE_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      message: `Date range cannot exceed ${MAX_USAGE_DATE_RANGE_DAYS} days`,
      path: ['endAt'],
    });
  }
};

/** Date-range usage query input (optional agent filter) with ordering + span validation. */
export const usageDateRangeInput = z
  .object({
    agentId: z.string().optional(),
    endAt: z.iso.date(),
    startAt: z.iso.date(),
  })
  .superRefine(validateUsageDateRange);

/** Per-agent usage stats input with granularity + the same date-range validation. */
export const agentUsageStatsInput = z
  .object({
    agentId: z.string(),
    endAt: z.iso.date(),
    granularity: z.enum(['day', 'week']).default('day'),
    startAt: z.iso.date(),
  })
  .superRefine(validateUsageDateRange);
