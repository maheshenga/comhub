# Module App Production Gate Hardening

## Goal

Close three production correctness gaps before any Module App mutation control is enabled:

1. Prevent Alipay computer-website payments from accepting an order currency that the provider flow cannot settle.
2. Enforce reviewed outbound hosts and bounded HTTP behavior for API Actions.
3. Make action billing snapshots follow `chargeMode` and make non-AI charges match real credit-ledger settlement.

## Invariants

- Keep all eight Module App production controls disabled.
- Preserve the independent Compose Worker deployment boundary.
- Resolve payer identity, workspace scope, prices, billing policy, and runtime permissions only on the server.
- Reserve credits before privileged execution and settle or release the reservation after execution.
- Never charge the same AI usage through both the AI adapter and the action-level credit adapter.

## Payment Contract

`ModuleAppPaymentAdapter.create` receives the immutable order-snapshot currency. The Alipay adapter accepts only `CNY` and rejects every other currency before generating or signing a provider form. Generic commerce remains provider-neutral.

## API Action Contract

The reviewed runtime manifest is authoritative for outbound hosts. API Actions must reject a rendered URL outside that allowlist, deny redirects, reject forbidden transport headers, bound request headers and body, and stop reading responses after 1 MiB. Legacy actions may use the literal configured URL host as their reviewed host, but a templated host requires an explicit manifest allowlist.

## Billing Contract

Charge components are selected by mode:

| `chargeMode`   | Fixed fee | External API fee | AI usage |
| -------------- | --------: | ---------------: | -------: |
| `free`         |        no |               no |       no |
| `fixed`        |       yes |               no |       no |
| `external_api` |        no |              yes |       no |
| `ai_usage`     |        no |               no |      yes |
| `hybrid`       |       yes |              yes |      yes |

The action runner reserves the maximum enabled non-AI amount before execution. It settles the actual amount after execution and releases a zero-value reservation. AI usage continues through the existing AI credit adapter only when the mode enables AI charging.

`freeQuotaCredits` and plan `discountPercent` remain descriptive in this tranche. They must not be presented as enforced until a durable, concurrency-safe accounting design is implemented.

## Verification

- Confirm each new regression test fails before implementation.
- Run focused payment, API Action, runtime wiring, AI, billing, and database suites.
- Run ESLint on changed TypeScript files, repository type checking, Module App production-control and Compose Worker policy tests, and `git diff --check`.
- Review the final diff against the repository review checklist before committing.
