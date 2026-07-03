# NewAPI Instance Sync Design

## Goal

Strengthen the admin-managed NewAPI instance feature so administrators can test an instance, synchronize its upstream model catalog, review the imported models, and manually enable only the models that should be exposed to users.

## Current Context

The project already has a multi-instance NewAPI foundation:

- `admin_newapi_instances` stores upstream NewAPI deployments with base URL, API key, enabled state, priority, and metadata.
- `admin_newapi_instance_models` stores per-instance model IDs grouped by model type.
- The admin page at `settings/admin/newapi-providers` supports instance CRUD and manual model registration.
- Runtime routing can resolve NewAPI instances by `(modelId, modelType)`, but image and video generation paths do not yet pass the model type into runtime initialization.
- NewAPI runtime code can fetch `/v1/models` and pricing data from `/api/pricing`, but the admin UI has no synchronization workflow.

## Product Behavior

Administrators manage NewAPI instances from the existing `settings/admin/newapi-providers` page.

Each instance should support:

- Test connection: validate Base URL and API Key, report whether `/v1/models` is reachable, how many models were returned, and whether `/api/pricing` was readable.
- Sync models: fetch the upstream model catalog and import/update local model rows for that instance.
- Manual enablement: synchronized models are disabled by default. Users will not see or use synchronized models until an administrator enables them.
- Existing enabled state preservation: if a model already exists locally, synchronization must not disable or enable it automatically.

The model drawer should make synchronized model review practical:

- Show source metadata when available, including endpoint detection, pricing availability, and whether the model type was inferred.
- Allow administrators to adjust model type by moving/re-adding entries if automatic classification is wrong.
- Keep manual bulk add for cases where upstream metadata is incomplete.

## Model Classification

Synchronization should classify each upstream model using the following priority:

1. `supported_endpoint_types` from `/v1/models` or `/api/pricing`.
2. Known endpoint/type fields if a NewAPI-compatible response includes them.
3. Model ID heuristics.

Classification rules:

- `image`: endpoint mentions `image`, `images`, `image_generation`, or model ID includes `image`, `dall-e`, `flux`, `sd`, `stable-diffusion`, or `imagen`.
- `video`: endpoint mentions `video`, `videos`, `video_generation`, or model ID includes `video`, `sora`, `wan`, `hailuo`, `seedance`, `kling`, or `veo`.
- `embedding`: endpoint or model ID clearly indicates embeddings.
- otherwise: `chat`.

Image/video models synchronized without a known parameter schema should receive a generic default schema so frontend model selection can initialize safely.

## Runtime Behavior

Image and video calls must resolve NewAPI instances by their actual usage type:

- Image generation initializes NewAPI runtime with `{ model, modelType: 'image' }`.
- Video generation submission initializes NewAPI runtime with `{ model, modelType: 'video' }`.
- Video polling initializes NewAPI runtime with `{ model, modelType: 'video' }` when model context is available.

This allows the same model ID to exist in different categories and ensures image/video traffic uses the instance that the administrator enabled for that type.

NewAPI image/video execution remains OpenAI-compatible only:

- Image uses OpenAI-compatible image endpoints or chat-image models with the `:image` suffix.
- Video uses OpenAI-compatible `/v1/videos` and `/v1/videos/{id}` style endpoints.
- Non-compatible upstream video providers require separate provider adapters.

## Error Handling

Connection test and sync should return structured admin-facing results:

- `ok`: true or false.
- `modelsCount`: number of fetched models when available.
- `pricingCount`: number of pricing rows when available.
- `warnings`: non-fatal issues such as pricing unavailable or unknown endpoint metadata.
- `error`: connection, authentication, or response parsing message when failed.

Sync should be idempotent:

- Re-running sync updates metadata and display names.
- Re-running sync preserves `enabled`.
- Re-running sync does not delete local models that disappeared upstream.

## Testing

Coverage should include:

- Classification from endpoint metadata.
- Classification fallback from model ID.
- Sync inserts new models as disabled.
- Sync preserves existing enabled state.
- Runtime image/video paths pass the correct `modelType`.
- Admin service exposes test/sync methods.

## Deployment Notes

This change requires a local build and package upload for deployment. The server must not build the app.
