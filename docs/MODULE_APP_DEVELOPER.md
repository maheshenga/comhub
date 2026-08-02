# Module App Developer Guide

## Lifecycle

1. Open `/apps/developer` and submit a publisher profile.
2. Wait for an administrator to verify the publisher.
3. Create and validate a project with the LobeHub CLI.
4. Preview the project with the local SDK bridge.
5. Package and submit the ZIP for review.
6. Follow scan, review, build, and publication state in the developer console.

An approved package can update only an application owned by the same verified publisher. Application slugs are globally unique and cannot be transferred through package submission.

## CLI

```bash
lh module-app init my-app --display-name "My App"
lh module-app validate my-app
lh module-app dev my-app
lh module-app pack my-app
lh module-app submit my-app/my-app-0.1.0.zip
```

`module-app.yaml` is validated against the same schema used by the server. `pack` excludes `.git`, `node_modules`, and platform metadata; rejects symbolic links, unsupported entries, and oversized content; and creates a bounded ZIP archive. `submit` accepts only a stable, regular ZIP file within the server upload limit.

## Manifest

Executable packages use a root `module-app.yaml` manifest with `manifestVersion: 2`. The supported build profiles are `node22-static` and `python312-assets`. Runtime functions, permissions, outbound hosts, data tables, workflows, pages, and actions must all be declared in the reviewed manifest.

Legacy manifest-only packages may use a root `manifest.json` with `manifestVersion: 1`. A package cannot contain both manifest formats.

### Outbound host review

Declare every external hostname in `runtime.outboundHosts`. During package approval, an administrator classifies each hostname as `general`, `ai`, or `payment`. Only `general` hosts are available to `http.fetch`, legacy `api_action` actions, and workflow HTTP nodes. AI and payment hosts are recorded for review but cannot be called directly; use the platform AI and payment SDK methods instead.

The runtime fails closed when the approved classification is missing, malformed, or does not cover the declared host list. Packages approved before host classification was introduced must submit a new reviewed version before direct external HTTP access is restored.

## SDK

Install `@lobechat/module-app-sdk` in the application frontend. Wait for the signed host launch message before creating the SDK client. Runtime access is limited to the capability and installation scope issued by the host.

The local `dev` bridge supplies an in-memory data store and basic task responses. It is intended for UI and SDK integration checks; production authorization and container isolation remain server-side acceptance requirements.

## Platform AI

Module AI calls use the platform gateway only. Declare `ai.models.read` and `ai.chat` in the reviewed runtime permissions, then call the SDK:

```ts
const models = await sdk.ai.listModels();
const model = models[0];
if (!model) throw new Error('No platform AI model is available');

const result = await sdk.ai.chat({
  messages: [{ content: 'Summarize this document.', role: 'user' }],
  model: model.id,
  temperature: 0.2,
});
```

The platform selects an enabled model route from the administrator-managed QuantumNous/new-api integration, applies the end user's plan rules, reserves and settles credits, and records usage. Modules cannot provide a provider name, base URL, API key, or other provider credential. Chat responses are non-streaming; `result.text` contains the completed response.

Legacy `content_generation` actions are also routed through the same managed `newapi` provider. A module cannot use a user BYOK setting or another provider for module AI execution.

## Platform Payments

Module checkout uses the platform payment layer only. Declare the permissions required by the SDK surface you use:

- `payments.methods.read`
- `payments.catalog.read`
- `payments.checkout`
- `payments.orders.read`

```ts
const [methods, catalog] = await Promise.all([
  sdk.payments.listMethods(),
  sdk.payments.listCatalog(),
]);
const product = catalog.find((item) => item.amount > 0);
if (!product) throw new Error('No purchasable module product is available');

const checkout = await sdk.payments.createCheckout({
  idempotencyKey: purchaseIntentId,
  method: methods[0]?.id,
  productId: product.productId,
});

const status = await sdk.payments.getOrderStatus({ orderId: checkout.orderId });
```

`purchaseIntentId` must be a UUID that remains stable when the same user retries the same purchase. The platform namespaces it by installation before creating an order, so one module cannot collide with another module's order key. Checkout results contain only a redirect, QR-code, or form action for the user; merchant keys, callback verification, settlement, refunds, reconciliation, and payment credentials never enter the module runtime.

Available methods are controlled by platform administrators and may include Alipay, WeChat Pay, Z-Pay Alipay, and Z-Pay WeChat. A public callback origin and enabled module payments are required. Workspace purchases require a workspace owner or administrator.
