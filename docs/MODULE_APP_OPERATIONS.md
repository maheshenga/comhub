# Module App Operations

This runbook defines the production identity, service levels, and alert response for the Module App platform. Runtime, payment, workflow, schedule, payout, and public-execution feature flags remain disabled until their separate release gates pass.

## Correlation IDs

Use the durable domain identifier first; never search logs by user secrets or object-storage keys.

| Operation              | Correlation identity                            | Source                                                 |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Runtime action         | `module_app_runs.id`                            | Runtime response, run administration page, audit event |
| Durable workflow       | `module_app_workflow_runs.id`                   | Workflow status API and persisted node rows            |
| Package review         | `module_app_packages.id`                        | Review queue and module audit log                      |
| Executable build       | `module_app_builds.id`                          | Worker claim, build history, artifact promotion logs   |
| Artifact deletion      | `module_app_artifact_cleanup_jobs.id`           | Maintenance result and cleanup job row                 |
| Admin setting conflict | `errorData.correlationId`                       | TRPC conflict response                                 |
| Desktop release        | Desktop release ID plus immutable GitHub run ID | Desktop control center and release callback            |

## Service Levels

| Surface              | Objective                                                                          | Measurement                                                                   |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Sandbox runtime      | 99% successful invocations over 30 days; p95 below 15 seconds                      | `module_app_sandbox_invocations_total`, `module_app_sandbox_duration_ms`      |
| Build worker         | At least 95% terminal builds become ready; no eligible build waits over 10 minutes | `module_app_worker_build_outcomes_total`, queue age metrics                   |
| Workflow dispatcher  | p95 dispatcher backlog below 100 jobs                                              | `module_app_workflow_backlog`                                                 |
| Artifact cleanup     | 100% eventually released; zero terminal cleanup failures                           | `module_app_artifact_cleanup_total` and cleanup job status                    |
| Payment verification | Zero signature, amount, currency, or provider mismatches                           | `module_app_payment_verification_failures_total`                              |
| Admin settings       | Zero silent overwrites                                                             | Mandatory section revision compare-and-swap and conflict audit correlation ID |

Prometheus rules live in `docker-compose/production/grafana/prometheus/module-app-alerts.yml`. Configure Alertmanager routing in the deployment environment; the repository rules intentionally contain no destination credentials.

## Response

1. Capture the alert labels, time window, deployment SHA, and the correlation identity from the table above.
2. Keep privileged feature flags closed while investigating runtime, payment, workflow, or cleanup integrity failures.
3. For cleanup retries, verify S3 health and run `POST /api/admin/maintenance` with the normal cron bearer token. Never delete keys manually unless the cleanup row and generated namespace have both been verified.
4. For settings conflicts, reload through the UI action, compare retained local edits with the latest revision, and save again. Do not bypass the expected revision contract.
5. Record remediation and rollback evidence in the audit trail before reopening a disabled production gate.
