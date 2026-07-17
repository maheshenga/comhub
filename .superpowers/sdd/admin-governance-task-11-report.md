# Admin Governance Task 11 Report

## Scope

Task 11 starts the progressive split of `packages/database/src/models/commercial.ts` by extracting the complete top-up ownership slice into `packages/database/src/models/commercial/topUp.ts`.

The extracted slice owns:

- auto top-up settings reads and writes;
- active top-up package listing and custom package validation;
- top-up order creation, cancellation, settlement, and history listing;
- the redemption-only payment guard;
- settlement-side credit-account and credit-ledger writes.

`CommercialModel` keeps its existing public method names and explicit public types. It constructs one `CommercialTopUpModel` and delegates the extracted methods, so existing routers and services require no migration.

## Maintenance Result

| File | Lines |
| --- | ---: |
| Previous `commercial.ts` | 2540 |
| Current `commercial.ts` | 2229 |
| New `commercial/topUp.ts` | 355 |

The first extraction removes 311 lines from the main model and gives the top-up domain a single owner. The remaining model is still above the repository's 800-line hotspot threshold and should be split progressively by credit-ledger, subscription, and referral ownership in later slices.

## Preserved Invariants

- Online platform payment remains closed. `createTopUpOrder` rejects every source except `redemption` with `ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE`.
- Cancel and settle operations also reject non-redemption orders.
- Settlement remains one database transaction covering the guarded order transition, credit-account update, and ledger insert.
- `CommercialModel` retains the original signatures for all extracted methods.
- Subscription, referral, AI usage pricing, Module App payment, Worker, deployment, and server operations are unchanged.

## Verification

- `commercial.topup.test.ts`: 5/5 passed. The suite covers redemption order creation, rejection of Alipay even for a paid user, settlement balance plus ledger writes, cancellation, and validation-before-plan-resolution ordering.
- `bun run type-check`: PASS (`tsgo --noEmit`, exit 0).
- Targeted ESLint for `commercial.ts` and `commercial/topUp.ts`: PASS.
- `git diff --check`: PASS.
- Independent review found the auto top-up validation-order regression and missing ledger assertions. Both Important findings were resolved before commit.

## Residual Risk

- The full database test suite, full ESLint, browser/E2E checks, and production database integration were not run.
- The remaining `CommercialModel` still coordinates credit, subscription, and referral workflows; future extractions must preserve their transaction and lock boundaries.
