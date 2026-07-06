# Commercial Page Boundaries

Date: 2026-07-07

Purpose: keep membership, plan, credit, billing, usage, and referral features from drifting into overlapping pages.

## Page Ownership

| Page | Primary responsibility | Should not own |
| --- | --- | --- |
| `/settings/plans` | plan catalog, benefits, billing cycle choices, discount labels, FAQ, upgrade entry | ledger rows, real payment settlement, admin-only price editing |
| `/settings/credits` | available credits, subscription credits, top-up packages, redemption entry, credit ledger | plan comparison, billing statements, usage charts |
| `/settings/billing` | current plan snapshot, cycle amount, change requests, order summary language | credit package selection, model-level usage rows |
| `/settings/usage` | consumption totals, token/amount breakdowns, usage trend presentation | top-up purchasing, referral binding |
| `/settings/referral` | referral code, referral link, binding, reward status, referral history | plan pricing, credit ledger, billing cycle management |
| admin commercial pages | authoritative editing of catalog, subscriptions, orders, credits, redemption, recommendations | user-facing marketing layout decisions |

## Data Source Rules

- Plan benefits come from plan catalog snapshots.
- Credit balances and ledgers come from spend/credit APIs.
- Billing page values are display snapshots unless a real payment provider is explicitly integrated.
- Referral rewards are growth data and should not be mixed into subscription credit totals without a named field.
- Formatter helpers must live in focused files such as `plansDisplay.ts`, `ledgerDisplay.ts`, `billingPresentation.ts`, or page-specific `*Display.ts` helpers.

## UI Rules

- Do not nest card-like containers inside already filled `FormGroup`/collapse bodies.
- Keep summary rows, action rows, and tables visually separated.
- A page can link to another commercial page, but should not duplicate the target page's data table.
- Use one display unit for credits on a page; convert raw credits at the ViewModel/formatter boundary.

## Current Guardrails

- `plansDisplay.test.ts` protects plan cycle and discount presentation.
- `billingPresentation.test.ts` protects plan FAQ and top-up promotion metadata.
- `ledgerDisplay.test.ts` protects readable provider/model ledger descriptions.
- `referralDisplay.test.ts` protects referral code input parsing outside React component state.

## Next Safe Refactor Slice

Extract small page ViewModel helpers, one page at a time:

1. `Credits` balance/ledger display model.
2. `Billing` current-cycle display model.
3. `Usage` summary metrics display model.
4. `Referral` action-row display model.

Each slice should add tests first and keep API responses unchanged.
