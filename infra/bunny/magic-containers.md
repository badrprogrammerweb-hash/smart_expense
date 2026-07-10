# Bunny Magic Containers Configuration Notes

Reviewed against Bunny's official documentation on 2026-07-10. This is
deployment configuration guidance for the two images in this directory; it does
not contain credentials or a live app configuration.

## Image Registry

Use a private GitHub Container Registry or Docker Hub registry for the production
API and web images. In Bunny Dashboard, open **Magic Containers > Image
Registries**, click **Add Image Registry**, select GitHub or Docker, and provide a
read-only registry credential. Bunny documents both supported registry types and
requires `linux/amd64` images for Magic Containers.

Sources:

- [Image Registries](https://docs.bunny.net/magic-containers/image-registries)
- [Deploy](https://docs.bunny.net/magic-containers/deploy)

Build and push both images from the repository root with an explicit platform:

```bash
docker build --platform linux/amd64 -f infra/bunny/api.Dockerfile -t <registry>/smart-expense-api:<tag> .
docker build --platform linux/amd64 -f infra/bunny/web.Dockerfile -t <registry>/smart-expense-web:<tag> .
docker push <registry>/smart-expense-api:<tag>
docker push <registry>/smart-expense-web:<tag>
```

## App And Endpoints

Create a Magic Containers app from **Magic Containers > Add App**. For the
initial production rollout, use **Single region** and select the approved region.
Bunny documents Single region as the no-autoscaling option; use Magic or Advanced
only after the operational owner chooses the needed scaling and regional behavior.

Add two containers to the app from the private registry:

| Container | Image | Container port | Public endpoint |
|-----------|-------|----------------|-----------------|
| API | `smart-expense-api` | `8000` | CDN endpoint such as `api` |
| Web | `smart-expense-web` | `3000` | CDN endpoint such as `app` |

For each public endpoint, Bunny requires a unique name, endpoint type, and the
port that the application listens on inside the container. Choose CDN for the
browser-facing HTTP(S) endpoints; do not enable "SSL for origin" because these
images serve HTTP inside the container. Configure the API endpoint first, then
use its final public URL in `NEXT_PUBLIC_API_URL` and the web URL in
`CORS_ALLOW_ORIGINS`.

Sources:

- [Deploy](https://docs.bunny.net/magic-containers/deploy)
- [Endpoints](https://docs.bunny.net/magic-containers/endpoints)

## Verify Before Production

1. **Environment variables and secrets**: Bunny's current documentation confirms
   the dashboard path **Magic Containers > container > Container Settings > Edit
   > Environment Variables** for adding name/value pairs. It does not describe a
   separate secret-store, encryption-at-rest, or masking guarantee. Before entering
   `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_JWT_SECRET`, verify
   the current dashboard's access controls and secret-handling behavior. Never put
   these values in an image, Dockerfile, repository file, build argument, or log.
   Source: [Environment Variables](https://docs.bunny.net/magic-containers/environment-variables)
2. **Image tag selection**: Bunny's deployment documentation says to select an
   image and tag, but does not state an immutable-tag or digest-pinning policy.
   Before deployment, verify the available tags in the connected registry and the
   current dashboard's tag/digest behavior; select a reviewed release tag rather
   than assuming a platform-specific default.
