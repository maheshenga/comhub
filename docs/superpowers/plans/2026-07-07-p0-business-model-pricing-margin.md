# Business Model Pricing Margin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small, pure model-pricing transform that can apply the business profit margin to display pricing without changing billing transactions.

**Architecture:** Keep the existing hook API intact and implement the logic behind `applyBusinessModelPricing`. The first slice only transforms a `model-bank` `Pricing` object in memory, preserving the original shape and avoiding mutation. Actual billing ledger deduction, admin UI wiring, and provider price importing stay out of scope for this commit.

**Tech Stack:** TypeScript, Vitest, `model-bank` pricing types.

## Global Constraints

- Work in `E:\code\comhub\ci-verify-3bbf64f`.
- Do not use subagents for this task; the user asked to execute directly.
- Do not touch production billing transactions in this slice.
- Preserve the public hook API: `useBusinessModelPricing()` must still return `applyBusinessModelPricing`.
- Use TDD: write and run the failing test before implementation.
- Keep docs in sync: update `docs/CHANGELOG_INTERNAL.md` and `docs/FEATURE_REGISTRY.md`.

---

### Task 1: Pricing Margin Transform

**Files:**
- Modify: `src/business/client/hooks/useBusinessModelPricing.ts`
- Create: `src/business/client/hooks/useBusinessModelPricing.test.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: `Pricing` from `model-bank`.
- Produces: `applyBusinessModelPricing(params: BusinessModelPricingParams): Pricing | undefined`
- Produces: optional params `profitMarginRate?: number` and `priceMultiplier?: number`.

- [x] **Step 1: Write the failing test**

Create `src/business/client/hooks/useBusinessModelPricing.test.ts`:

```ts
import type { Pricing } from 'model-bank';
import { describe, expect, it } from 'vitest';

import { applyBusinessModelPricing } from './useBusinessModelPricing';

describe('applyBusinessModelPricing', () => {
  it('returns undefined pricing unchanged', () => {
    expect(applyBusinessModelPricing({ pricing: undefined })).toBeUndefined();
  });

  it('returns the same pricing object when no margin or multiplier is provided', () => {
    const pricing: Pricing = {
      currency: 'USD',
      units: [{ name: 'textInput', rate: 1, strategy: 'fixed', unit: 'millionTokens' }],
    };

    expect(applyBusinessModelPricing({ pricing })).toBe(pricing);
  });

  it('applies a 35 percent profit margin to known price fields without mutating input', () => {
    const pricing: Pricing = {
      approximatePricePerImage: 0.02,
      approximatePricePerVideo: 0.5,
      currency: 'USD',
      units: [
        {
          name: 'textInput',
          originalRate: 2,
          rate: 1,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          strategy: 'tiered',
          tiers: [
            { rate: 3, upTo: 128_000 },
            { rate: 6, upTo: 'infinity' },
          ],
          unit: 'millionTokens',
        },
        {
          lookup: {
            prices: {
              high: 0.08,
              low: 0.04,
            },
            pricingParams: ['quality'],
          },
          name: 'imageGeneration',
          strategy: 'lookup',
          unit: 'image',
        },
      ],
    };

    const result = applyBusinessModelPricing({ pricing, profitMarginRate: 0.35 });

    expect(result).toEqual({
      approximatePricePerImage: 0.027,
      approximatePricePerVideo: 0.675,
      currency: 'USD',
      units: [
        {
          name: 'textInput',
          originalRate: 2.7,
          rate: 1.35,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
        {
          name: 'textOutput',
          strategy: 'tiered',
          tiers: [
            { rate: 4.05, upTo: 128_000 },
            { rate: 8.1, upTo: 'infinity' },
          ],
          unit: 'millionTokens',
        },
        {
          lookup: {
            prices: {
              high: 0.108,
              low: 0.054,
            },
            pricingParams: ['quality'],
          },
          name: 'imageGeneration',
          strategy: 'lookup',
          unit: 'image',
        },
      ],
    });
    expect(pricing.units[0]).toEqual({
      name: 'textInput',
      originalRate: 2,
      rate: 1,
      strategy: 'fixed',
      unit: 'millionTokens',
    });
  });

  it('lets an explicit multiplier override the margin rate', () => {
    const pricing: Pricing = {
      currency: 'USD',
      units: [{ name: 'textOutput', rate: 10, strategy: 'fixed', unit: 'millionTokens' }],
    };

    expect(applyBusinessModelPricing({ priceMultiplier: 2, pricing, profitMarginRate: 0.35 })).toEqual(
      {
        currency: 'USD',
        units: [{ name: 'textOutput', rate: 20, strategy: 'fixed', unit: 'millionTokens' }],
      },
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/business/client/hooks/useBusinessModelPricing.test.ts"
```

Expected: FAIL because `profitMarginRate` and `priceMultiplier` are not implemented.

- [x] **Step 3: Write minimal implementation**

In `src/business/client/hooks/useBusinessModelPricing.ts`, implement:

```ts
const DEFAULT_RATE_DECIMALS = 12;

const multiplyPrice = (value: number | undefined, multiplier: number) =>
  typeof value === 'number' ? Number((value * multiplier).toFixed(DEFAULT_RATE_DECIMALS)) : value;
```

Then clone only known price-bearing fields:

- `Pricing.approximatePricePerImage`
- `Pricing.approximatePricePerVideo`
- fixed `rate` and `originalRate`
- tiered `tiers[].rate`
- lookup `lookup.prices[key]`

Return the original object when no margin or multiplier is provided.

- [x] **Step 4: Run test to verify it passes**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/business/client/hooks/useBusinessModelPricing.test.ts"
```

Expected: PASS.

- [x] **Step 5: Update governance docs**

Append `GOV-033` to `docs/CHANGELOG_INTERNAL.md`.

Append a row to `docs/FEATURE_REGISTRY.md` under `Governance Execution Notes`:

```md
| 2026-07-07 | Model Pricing Margin Foundation | active | GOV-033 adds a pure business pricing margin transform for model-bank pricing objects, covering fixed, tiered, lookup, and approximate media price fields without mutating source pricing or changing billing transactions. |
```

- [x] **Step 6: Verify changed files**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/business/client/hooks/useBusinessModelPricing.test.ts"
git diff --check
bunx eslint "src/business/client/hooks/useBusinessModelPricing.ts" "src/business/client/hooks/useBusinessModelPricing.test.ts"
```

Expected: all commands exit 0.

- [x] **Step 7: Commit**

Run:

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-business-model-pricing-margin.md
git add src/business/client/hooks/useBusinessModelPricing.ts src/business/client/hooks/useBusinessModelPricing.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":moneybag: add business model pricing margin transform" -m "Constraint: keep P0-04 scoped to a pure pricing display transform; no billing transaction changes." -m "Tested: bunx vitest run --silent=passed-only src/business/client/hooks/useBusinessModelPricing.test.ts" -m "Tested: git diff --check" -m "Tested: bunx eslint src/business/client/hooks/useBusinessModelPricing.ts src/business/client/hooks/useBusinessModelPricing.test.ts"
```
