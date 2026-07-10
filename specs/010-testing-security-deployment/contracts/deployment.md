# Contract: Deployment (Bunny Magic Containers)

Authoritative outline + inventory for `docs/deployment.md` and the `infra/bunny/`
config produced in tasks. Bunny-specific facts are cited to the official docs
(fetched 2026-07-09); items the docs did not confirm are marked **VERIFY** and MUST
be checked against the live Bunny docs/dashboard at implementation time, never
invented (FR-030).

## Deliverables

- `docs/deployment.md` — the human, repeatable procedure.
- `infra/bunny/api.Dockerfile`, `infra/bunny/web.Dockerfile` — `linux/amd64` images
  (Dockerfiles may alternatively sit beside each app; either way they are net-new
  build config, not product source).
- `infra/bunny/magic-containers.md` — platform config notes (endpoints/ports/
  registry) with citations.

## Verified Bunny facts (cited)

- Private container registry (GitHub or Docker) must be configured first —
  [registry integration](https://docs.bunny.net/docs/magic-containers-how-to-configure-private-container-registry-integration).
- Images must be **`linux/amd64`**.
- Create app: Dashboard → **Magic Containers → Add App**, name it, choose deployment
  option **Magic** / **Single Region** / **Advanced** (base vs enabled regions, min/
  max instances, max 10 per region) —
  [deploy your app](https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app).
- Container: **Add Container** → select image + tag; configure **Endpoints** (unique
  name; CDN or Anycast; define **container port**; SSL for CDN).
- Multiple containers can share one pod and talk over `localhost`.
- Trial requires a payment card; trial limited to 5 regions / 2 instances per region —
  [getting started](https://docs.bunny.net/docs/magic-containers-getting-started).

## VERIFY-at-implementation (docs did not confirm in fetched pages)

- Exact **environment variable / secret** configuration mechanism in the Bunny
  dashboard/API.
- Image **tag selection** specifics and any CLI/manifest form.

## Required configuration inventory (grounded in the codebase)

Backend `apps/api` (container env):

| Name | Secret | Source |
|------|--------|--------|
| `SUPABASE_URL` | no | hosted Supabase project URL |
| `SUPABASE_DB_URL` | **yes** | hosted Supabase Postgres connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | hosted Supabase service role key |
| `SUPABASE_JWT_SECRET` | **yes** | hosted Supabase JWT secret (or JWKS) |
| `CORS_ALLOW_ORIGINS` | no | production web origin(s) |
| `APP_ENV` | no | `production` |

Frontend `apps/web` (build/runtime env, all public by design):

| Name | Secret | Source |
|------|--------|--------|
| `NEXT_PUBLIC_API_URL` | no | public URL of the deployed api |
| `NEXT_PUBLIC_SUPABASE_URL` | no | hosted Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | hosted Supabase anon key |

BYOK AI keys are per-workspace user secrets in Supabase Vault (Phase 7) — **not**
deploy-time env. No secret value is ever committed to the repo (FR-029).

External services: Supabase Auth, Postgres, Vault, Storage (hosted project).

## Repeatable procedure (outline for docs/deployment.md)

1. **Prerequisites**: hosted Supabase project provisioned; private container registry
   configured in Bunny; production secrets available in the Bunny secret store.
2. **Build images** (`linux/amd64`) for api and web; tag; push to the private
   registry.
3. **Apply database migrations** to the hosted Supabase Postgres from
   `supabase/migrations/` as a documented, ordered, repeatable step (pin the exact
   command, e.g. linked-project `supabase db push`) — FR-031.
4. **Create/Update the Bunny app**: Add App → choose deployment option → Add
   Container(s) → select pushed image+tag → configure endpoint(s) + container port(s)
   → set environment variables/secrets (**VERIFY** exact mechanism).
5. **Configure env/secrets** per the inventory above (secrets via Bunny's secret
   mechanism, never committed).
6. **Deploy / confirm** and record the endpoint URL(s); update
   `NEXT_PUBLIC_API_URL` / `CORS_ALLOW_ORIGINS` to the real origins and redeploy if
   needed.
7. **Post-deploy smoke check**: health endpoint reachable; sign-in works; a confirmed
   income/expense reflects in totals.

## Phase scope note (FR-030a)

This phase delivers the documentation + committed config and validates it by
review/dry-run. Executing a live production deploy is **not required** within this
phase; the procedure must be complete enough that a release engineer who did not
write it can follow it with no undocumented steps (SC-009).
