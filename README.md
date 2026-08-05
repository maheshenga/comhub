# ComHub

ComHub is an independently maintained AI workspace based on
[LobeHub](https://github.com/lobehub/lobehub). It provides a unified product
surface for assistants, conversations, mobile workspaces, design, community,
applications, and administration. ComHub is not an official LobeHub release.

## Features

- Assistant and conversation workspaces for multi-model AI workflows.
- A mobile-first workspace with recent activity, design, discovery, and apps.
- Design, community, application, and administration surfaces maintained for
  the ComHub deployment.
- Commercial controls for plans, membership, model configuration, and billing.

## Quick Start

Install dependencies and start the full local development environment:

```bash
pnpm install --no-frozen-lockfile
bun run dev
```

For SPA-only development:

```bash
bun run dev:spa
```

## GitHub Delivery

GitHub Actions validates pull requests, builds commit-tagged images in GHCR,
and keeps production deployment manual. Deployment resolves image digests so
the selected artifact is immutable. Production workflows are dispatched from
protected branches only. AI and payment provider configuration is managed in
the application administration center instead of GitHub Actions. Existing
server environment fallbacks remain migration-only compatibility and are
reported to administrators until equivalent backend settings are saved.
Repository secrets, server details, and payment credentials are not stored in source control.

## Contribution

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
Changes target `main` and must pass the repository checks. Do not include
credentials, production data, or private infrastructure details in issues,
pull requests, or logs.

## Security

Report vulnerabilities privately through the
[ComHub Security Advisory form](https://github.com/maheshenga/comhub/security/advisories/new).
See [SECURITY.md](SECURITY.md) for scope and disclosure guidance.

## Upstream Sync

ComHub tracks LobeHub as an upstream dependency. Upstream changes are brought
in through reviewable sync branches and pull requests rather than copied
directly into production.

## License

ComHub is distributed under the [MIT License](LICENSE).
