# ParadeDB production manifest

This directory is the source of truth for
`comhub-prod:/www/docker/paradedb/docker-compose.yml`.

- Keep the image pinned by digest.
- Keep the Compose project name `paradedb`; the Module App worker joins the
  resulting external network `paradedb_default`.
- Keep `.env` and `data/` on the production host. Never commit either path.
- Syncing this manifest must not recreate the database automatically. Apply
  container changes only in a maintenance window after checking the image,
  bind mount, and database readiness.

Validate the production copy with:

```bash
docker compose --project-directory /www/docker/paradedb \
  -f /www/docker/paradedb/docker-compose.yml config --quiet
```
