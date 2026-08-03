# Deploy To Bunny Magic Containers

This guide deploys the Smart Expense API and web app as separate `linux/amd64`
containers. It is a production procedure, not a local-development guide. No
credential value belongs in this repository, image, Dockerfile, build argument,
shell history, or log.

## Prerequisites

- A hosted Supabase project with Auth, Postgres, Vault, and Storage available.
- Docker with a logged-in private GitHub Container Registry or Docker Hub registry.
- Supabase CLI authenticated and linked to the hosted project.
- Bunny account access to Magic Containers and the private registry credential.
- The reviewed API and web public endpoint names, plus the production Supabase
  values listed below.

Bunny requires `linux/amd64` images and supports Docker Hub and GitHub registries.
Connect a private registry from **Magic Containers > Image Registries > Add Image
Registry** before creating the app. See Bunny's [Image Registries](https://docs.bunny.net/magic-containers/image-registries)
documentation.

## Configuration Inventory

Configure the API values on the API container only. Values marked secret must be
entered only through the verified Bunny container configuration flow and never used
as Docker build arguments.

| Scope | Name | Secret | Source | Notes |
|-------|------|--------|--------|-------|
| API runtime | `SUPABASE_URL` | no | Hosted Supabase project URL | Used by auth and storage paths. |
| API runtime | `SUPABASE_DB_URL` | yes | Hosted Supabase Postgres connection string | Server-only RLS-aware database connection. |
| API runtime | `SUPABASE_SERVICE_ROLE_KEY` | yes | Hosted Supabase service-role key | Server-only; used by storage paths. The liveness endpoint never reads it. |
| API runtime | `SUPABASE_JWT_SECRET` | yes | Hosted Supabase JWT secret | Legacy HS256 fallback; preserve if the hosted project requires it. |
| API runtime | `CORS_ALLOW_ORIGINS` | no | Final web origin(s) | Comma-separated exact HTTPS web origins. |
| API runtime | `APP_ENV` | no | `production` | Required explicit production identity; disables API docs and diagnostic disclosure. |
| Web build and runtime | `NEXT_PUBLIC_API_URL` | no | Final public API URL | Public browser value; set during image build and in Bunny container config. |
| Web build and runtime | `NEXT_PUBLIC_SUPABASE_URL` | no | Hosted Supabase project URL | Public browser value. |
| Web build and runtime | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Hosted Supabase anon key | Public, RLS-constrained browser credential; never a service-role key. |

The web image accepts the three `NEXT_PUBLIC_*` values as build arguments because
Next.js embeds public values into browser bundles during `next build`. Rebuild the
web image whenever one changes. Supplying the same three public values in Bunny's
runtime configuration keeps server-side rendering aligned with the build; it does
not replace the required rebuild for browser code.

BYOK AI keys are workspace-specific Supabase Vault secrets. They are not deployment
environment variables and must not be copied into Bunny.

External services are Supabase Auth, Postgres, Vault, and Storage; a private image
registry; and Bunny Magic Containers. No managed database, object store, or AI key
is provided by the container images.

Every deployed API container must set `APP_ENV=production` explicitly. An unset,
empty, or unrecognized value now fails closed by disabling `/docs`, `/redoc`,
`/openapi.json`, and diagnostic error detail, but leaving the value unset is not
recommended because an explicit environment identity is operationally clearer.
Recognized development/test values (`dev`, `development`, `local`, `test`, and
`testing`) are for non-production environments only. `APP_ENV` controls these
surfaces; it is not by itself a complete security boundary.

## Apply Migrations

Apply the committed migrations before sending traffic to a new API release:

```bash
supabase link --project-ref <hosted-project-ref>
supabase db push
```

Run these commands from the repository root. Confirm the target project is the
intended production project before `supabase db push`; it applies the tracked files
under `supabase/migrations/` to that linked project.

## Build And Push Images

Choose a reviewed, immutable release tag according to the connected registry's
policy. Set only public browser values as build arguments:

```bash
export REGISTRY=<registry-host-and-namespace>
export TAG=<reviewed-release-tag>

docker build --platform linux/amd64 \
  -f infra/bunny/api.Dockerfile \
  -t "$REGISTRY/smart-expense-api:$TAG" \
  .

docker build --platform linux/amd64 \
  -f infra/bunny/web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.<domain> \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key> \
  -t "$REGISTRY/smart-expense-web:$TAG" \
  .

docker push "$REGISTRY/smart-expense-api:$TAG"
docker push "$REGISTRY/smart-expense-web:$TAG"
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public. Do not pass
`SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_JWT_SECRET` with
`--build-arg`.

## Configure Bunny

1. In Bunny Dashboard, go to **Magic Containers > Add App**. Start with **Single
   region** and select the approved region; Bunny documents Magic, Single region,
   and Advanced deployment options in its [deployment guide](https://docs.bunny.net/magic-containers/deploy).
2. Add the `smart-expense-api:$TAG` container on port `8000`, then add the
   `smart-expense-web:$TAG` container on port `3000`.
3. For each container, open **Container Settings > Edit > Environment Variables**
   and enter the applicable values from the inventory. Bunny documents this
   dashboard workflow in [Environment Variables](https://docs.bunny.net/magic-containers/environment-variables).
4. Add unique CDN endpoints for the web and API containers. Bunny endpoints require
   the container's listening port: `3000` for web and `8000` for API. Use HTTP in
   each container and leave "SSL for origin" disabled. See [Endpoints](https://docs.bunny.net/magic-containers/endpoints).
5. Set `NEXT_PUBLIC_API_URL` to the final API endpoint URL and
   `CORS_ALLOW_ORIGINS` to the final web endpoint URL. Rebuild and redeploy the web
   image if its public API or Supabase values changed.
6. Confirm and create the app, then wait for Bunny to report the deployment as
   healthy.

## Verify Before Production

- Confirm current Bunny dashboard handling for secret values. Its documentation
  describes environment-variable entry but does not state a separate secret-store,
  value-masking, or encryption-at-rest guarantee. Limit dashboard access, verify
  the current behavior, and never paste secrets into an image or repository file.
- Confirm the connected registry exposes the reviewed tag and whether Bunny supports
  an immutable tag or digest selection. Bunny documents image-and-tag selection,
  but not a digest-pinning policy; do not assume one.
- Verify both images were built for `linux/amd64` and are selected from the intended
  private registry.

## Post-Deploy Smoke Check

1. Request `https://<api-endpoint>/health`; expect exactly `{"status":"ok"}` as a
   lightweight process-liveness signal. It intentionally makes no database or
   external-service connectivity claim.
2. Open the web endpoint and complete sign-in through the hosted Supabase project.
3. In a test workspace, create a confirmed income and expense, then verify the
   dashboard and report totals agree.
4. Confirm browser requests to the API succeed from the web endpoint, proving
   `CORS_ALLOW_ORIGINS` and `NEXT_PUBLIC_API_URL` match the deployed endpoints.

## Phase 18 Security Operations

Phase 18 creates a `private` PostgreSQL schema for privileged callable routines,
including the `workspace_role_for` and `is_workspace_member` RLS helpers. Never add
`private` to Supabase's exposed schemas. The target exposed-schema list must remain
`public, graphql_public`, and this hosted setting must be verified before release.

Set `APP_ENV=production` explicitly on every deployed API instance. If `APP_ENV` is
absent or unrecognized, documentation/OpenAPI routes and diagnostic error detail fail
closed; the safe fallback does not replace the operational clarity of an explicit
production setting.

Rate-limit counters and allowances are local to each application instance. Restarting
an instance resets its counters, multiple instances multiply the effective allowance,
and a fixed-window boundary can permit up to twice the configured allowance in a short
interval. Strict global enforcement would require a shared Redis/database limiter.

The reviewed emergency reversal artifact is
`specs/018-security-remediation-hardening/rollback.sql`. Test the selected target on a
disposable database before any operational use. The file requires an explicit target and
executes exactly one per invocation; there is no whole-file mode, and a missing or
unrecognized target exits non-zero without changing the database.

```bash
psql "$DB_URL" -v rollback_target=phase3         -f .../rollback.sql   # reverse Phase 3 relocation
psql "$DB_URL" -v rollback_target=identity_guard -f .../rollback.sql   # reverse Phase 4 guard
```

`phase3` returns the four privileged routines to `public` and retains the Phase 4 identity
guard. **It requires a coordinated application deployment**: the current application calls
these routines private-qualified and will not work unchanged against that database state.
Schedule the database target and a compatible public-calling application revision in the
same change window.

`identity_guard` removes only the Phase 4 guard, leaves all four routines in `private`, and
requires no application change.

Neither target reverses Phase 9; `workspace_role_for` and `is_workspace_member` remain in
`private` under both, and `phase3` requires Phase 9 to stay in place because the
relocated-to-`public` `get_workspace_ai_key_for_extraction` body still calls
`private.workspace_role_for` by name.

Earlier revisions of this file allowed running both sections in one pass. That composition
produced an invalid duplicate state — a guarded `public` copy alongside an unguarded
`private` copy of `ensure_personal_workspace` — and was never a valid procedure. It is now
structurally impossible.

The hosted exposed-schema check (T092) and deployed ordinary-user PostgREST smoke check
(T093) remain mandatory release gates whenever their evidence has not yet been captured.
Local catalog or test results are not substitutes for those checks.

## Phase Scope

This phase provides committed Dockerfiles, cited configuration guidance, and a
local image build/start dry-run. It does not perform a live production deployment.
