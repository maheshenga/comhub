# Admin Runtime Layout and Provider Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the main application panel throughout the admin console, correct the displaced search label, and make runtime model selection automatically show and persist a read-only provider.

**Architecture:** `NavPanelShell` owns cross-platform suppression of the main application panel by reading the existing active-location abstraction. Runtime model normalization and serialization live in a pure helper module, while a reusable form-row component owns model selection and provider display. `AdminDefaultSettingsPage` supplies type-filtered catalog options and composes the rows without duplicating selection logic.

**Tech Stack:** React 19, TypeScript, React Router, antd Form/AutoComplete/Input, `@lobehub/ui`, Vitest, Testing Library, SWR-backed admin settings.

## Global Constraints

- Hide only the main application `NavPanelShell`; keep the dedicated admin navigation and its responsive sheet.
- Use `sharedHealth.enabledNewapiModels` as the selectable model source.
- Filter chat and Embedding rows by their real catalog type.
- Use the complete enabled catalog for Reranker because the current model type contract has no `rerank` category.
- Persist raw model IDs and provider IDs through the existing app-setting keys.
- Display a human-readable provider label, but do not make provider independently editable.
- Preserve saved out-of-catalog model/provider pairs and clear the provider when the model is cleared.
- Do not change provider credentials, enablement, synchronized catalog data, pricing, database schemas, or production state.
- Do not push, merge, deploy, or mutate production as part of this plan.

---

### Task 1: Admin Navigation Shell and Search Regression

**Files:**

- Modify: `src/features/NavPanel/index.test.tsx`
- Modify: `src/features/NavPanel/Shell.tsx`
- Create: `src/features/Admin/AdminSidebar.test.tsx`
- Modify: `src/features/Admin/AdminSidebar.tsx`

**Interfaces:**

- Consumes: `useActiveLocation(): Location` from `@/hooks/useActiveLocation`.

- Produces: `isAdminConsolePath(pathname: string): boolean` and a `NavPanelShell` that renders `null` on admin paths.

- Preserves: `AdminSidebar` search input `aria-label`, placeholder, icon, filtering, navigation, and footer action.

- [ ] **Step 1: Write failing navigation-shell tests**

Add the admin-path regression to `src/features/NavPanel/index.test.tsx`:

```tsx
it.each(['/settings/admin', '/settings/admin/ai-runtime-defaults'])(
  'does not mount the main application panel on %s',
  (adminPath) => {
    pathname = adminPath;

    render(<NavPanelShell />);

    expect(screen.queryByTestId('nav-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Home sidebar')).not.toBeInTheDocument();
  },
);

it('keeps the main application panel on ordinary settings routes', async () => {
  pathname = '/settings/profile';

  render(<NavPanelShell />);

  await waitFor(() => expect(screen.getByTestId('nav-panel')).toBeInTheDocument());
});
```

- [ ] **Step 2: Write the failing accessible-search test**

Create `src/features/Admin/AdminSidebar.test.tsx` with a `MemoryRouter`, an admin-role user-store mock, and these assertions:

```tsx
render(
  <MemoryRouter initialEntries={['/settings/admin']}>
    <AdminSidebar />
  </MemoryRouter>,
);

expect(screen.getByRole('searchbox', { name: '搜索管理功能' })).toBeInTheDocument();
expect(screen.queryByText('搜索管理功能')).not.toBeInTheDocument();
```

The first assertion proves the input retains its accessible name. The second fails against the current duplicate `span.sr-only` node.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
bun run check --test "src/features/NavPanel/index.test.tsx" "src/features/Admin/AdminSidebar.test.tsx"
```

Expected: failure because `NavPanelShell` still mounts on admin paths and the duplicate search text is still visible.

- [ ] **Step 4: Implement shared shell suppression**

Update `src/features/NavPanel/Shell.tsx`:

```tsx
import { useActiveLocation } from '@/hooks/useActiveLocation';

export const isAdminConsolePath = (pathname: string) =>
  pathname === '/settings/admin' || pathname.startsWith('/settings/admin/');

const NavPanelShell = memo(() => {
  const { pathname } = useActiveLocation();

  if (isAdminConsolePath(pathname)) return null;

  return (
    <>
      <HomeNavPanelPortal />
      <NavPanel />
    </>
  );
});
```

This automatically uses React Router on web and the active Electron tab URL in desktop builds.

- [ ] **Step 5: Remove the duplicate visible search node**

Delete only this line from `src/features/Admin/AdminSidebar.tsx`:

```tsx
<span className="sr-only">{t('admin.navigation.search', '搜索管理功能')}</span>
```

Retain the input's existing `aria-label` and placeholder.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run the Step 3 command again.

Expected: both test files pass; ordinary routes still render the panel and admin routes do not.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- "src/features/NavPanel/index.test.tsx" "src/features/NavPanel/Shell.tsx" "src/features/Admin/AdminSidebar.test.tsx" "src/features/Admin/AdminSidebar.tsx"
git commit -m "🐛 fix: isolate admin navigation shell"
```

---

### Task 2: Runtime Model Pair Contracts and Field Component

**Files:**

- Create: `src/features/Admin/adminRuntimeModelSettings.ts`
- Create: `src/features/Admin/adminRuntimeModelSettings.test.ts`
- Create: `src/features/Admin/components/RuntimeModelFieldPair.tsx`
- Create: `src/features/Admin/components/RuntimeModelFieldPair.test.tsx`

**Interfaces:**

- Consumes: `DefaultModelOption` and `resolveModelProviderLabel` from `adminSettingsForm.ts`; existing `APP_SETTING_KEYS`.
- Produces: `normalizeRuntimeModelFields(modelValue, providerValue, options)` returning `{ model: string; provider: string }`.
- Produces: `buildRuntimeSettingUpdates({ values, chatOptions, embeddingOptions, rerankerOptions })` returning the existing `{ key, value }[]` batch contract.
- Produces: `RuntimeModelFieldPair` accepting `form`, `modelField`, `providerField`, `modelLabel`, `providerLabel`, `extra`, `options`, and `placeholder`.

Use these exact public types in `adminRuntimeModelSettings.ts`:

```ts
export interface RuntimeModelFormValues {
  memoryEmbeddingModel: string;
  memoryEmbeddingProvider: string;
  memoryGatekeeperModel: string;
  memoryGatekeeperProvider: string;
  memoryLayerExtractorModel: string;
  memoryLayerExtractorProvider: string;
  memoryPersonaWriterModel: string;
  memoryPersonaWriterProvider: string;
  vectorEmbeddingModel: string;
  vectorEmbeddingProvider: string;
  vectorQueryMode: string;
  vectorRerankerModel: string;
  vectorRerankerProvider: string;
}

export type RuntimeSettingUpdate = { key: string; value: unknown };

export interface BuildRuntimeSettingUpdatesParams {
  chatOptions: DefaultModelOption[];
  embeddingOptions: DefaultModelOption[];
  rerankerOptions: DefaultModelOption[];
  values: RuntimeModelFormValues;
}
```

- [ ] **Step 1: Write failing pure-contract tests**

Create `src/features/Admin/adminRuntimeModelSettings.test.ts`:

```ts
const options: DefaultModelOption[] = [
  {
    label: 'DeepSeek V4 Pro (opencode-go / OpenCode Go / chat)',
    model: 'deepseek-v4-pro',
    provider: 'provider-1',
    providerLabel: 'opencode-go / OpenCode Go',
    value: 'provider-1:deepseek-v4-pro',
  },
];

expect(normalizeRuntimeModelFields('provider-1:deepseek-v4-pro', '', options)).toEqual({
  model: 'deepseek-v4-pro',
  provider: 'provider-1',
});
expect(normalizeRuntimeModelFields('', 'stale-provider', options)).toEqual({
  model: '',
  provider: '',
});
expect(normalizeRuntimeModelFields('legacy-model', 'legacy-provider', options)).toEqual({
  model: 'legacy-model',
  provider: 'legacy-provider',
});
```

Add this serialization assertion proving vector Embedding, vector Reranker, memory chat, and memory Embedding fields retain the existing `APP_SETTING_KEYS`, with a cleared model producing an empty provider:

```ts
const updates = buildRuntimeSettingUpdates({
  chatOptions: options,
  embeddingOptions: [
    {
      label: 'Embedding (OpenCode Go / embedding)',
      model: 'embedding-model',
      provider: 'embedding-provider',
      value: 'embedding-provider:embedding-model',
    },
  ],
  rerankerOptions: options,
  values: {
    memoryEmbeddingModel: 'embedding-model',
    memoryEmbeddingProvider: 'embedding-provider',
    memoryGatekeeperModel: 'deepseek-v4-pro',
    memoryGatekeeperProvider: 'provider-1',
    memoryLayerExtractorModel: 'legacy-layer-model',
    memoryLayerExtractorProvider: 'legacy-provider',
    memoryPersonaWriterModel: 'deepseek-v4-pro',
    memoryPersonaWriterProvider: 'provider-1',
    vectorEmbeddingModel: 'embedding-model',
    vectorEmbeddingProvider: 'embedding-provider',
    vectorQueryMode: 'hybrid',
    vectorRerankerModel: '',
    vectorRerankerProvider: 'stale-provider',
  },
});

expect(updates).toContainEqual({
  key: APP_SETTING_KEYS.vectorEmbeddingProvider,
  value: 'embedding-provider',
});
expect(updates).toContainEqual({
  key: APP_SETTING_KEYS.vectorRerankerProvider,
  value: '',
});
expect(updates).toContainEqual({
  key: APP_SETTING_KEYS.memoryUserMemoryGatekeeperProvider,
  value: 'provider-1',
});
expect(updates).toContainEqual({
  key: APP_SETTING_KEYS.memoryUserMemoryEmbeddingProvider,
  value: 'embedding-provider',
});
```

- [ ] **Step 2: Write the failing field-component test**

Create `src/features/Admin/components/RuntimeModelFieldPair.test.tsx`. Use a deterministic AutoComplete test double while retaining the real antd `Form` and `Input`:

```tsx
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    AutoComplete: ({ options = [], onChange, onSelect, ...props }: any) => (
      <select
        {...props}
        onChange={(event) => {
          const value = event.target.value;
          onChange?.(value);
          if (value) onSelect?.(value);
        }}
      >
        <option value="">Clear</option>
        {options.map((option: DefaultModelOption) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});
```

Render the component inside an antd `Form` with the option above and assert:

```tsx
expect(screen.getByLabelText('供应商')).toHaveValue('opencode-go / OpenCode Go');
expect(screen.getByLabelText('供应商')).toHaveAttribute('readonly');
```

Exercise a catalog selection and then clear the model. Inspect `form.getFieldsValue()` after each action:

```ts
expect(form.getFieldsValue()).toMatchObject({
  memoryGatekeeperModel: 'deepseek-v4-pro',
  memoryGatekeeperProvider: 'provider-1',
});

expect(form.getFieldsValue()).toMatchObject({
  memoryGatekeeperModel: '',
  memoryGatekeeperProvider: '',
});
```

This keeps field registration and read-only behavior covered without depending on portal timing.

- [ ] **Step 3: Run the new tests and verify RED**

Run:

```powershell
bun run check --test "src/features/Admin/adminRuntimeModelSettings.test.ts" "src/features/Admin/components/RuntimeModelFieldPair.test.tsx"
```

Expected: failure because neither runtime contract nor field component exists.

- [ ] **Step 4: Implement runtime normalization and serialization**

Create `src/features/Admin/adminRuntimeModelSettings.ts` with these rules:

```ts
export const normalizeRuntimeModelFields = (
  modelValue: string | undefined,
  providerValue: string | undefined,
  options: DefaultModelOption[],
) => {
  const model = modelValue?.trim() ?? '';
  const provider = providerValue?.trim() ?? '';
  if (!model) return { model: '', provider: '' };

  const selected =
    options.find((option) => option.value === model) ??
    options.find(
      (option) => option.model === model && (!provider || option.provider === provider),
    );

  return {
    model: selected?.value === model ? selected.model : model,
    provider: provider || selected?.provider || '',
  };
};
```

`buildRuntimeSettingUpdates` must normalize every pair before returning the existing vector and memory setting keys. It must not rename keys or change the batch payload shape.

- [ ] **Step 5: Implement the reusable field pair**

Create `src/features/Admin/components/RuntimeModelFieldPair.tsx`:

```tsx
interface RuntimeModelFieldPairProps {
  extra?: ReactNode;
  form: FormInstance;
  modelField: string;
  modelLabel: string;
  options: DefaultModelOption[];
  placeholder: string;
  providerField: string;
  providerLabel?: string;
}

const RuntimeModelFieldPair = ({
  extra,
  form,
  modelField,
  modelLabel,
  options,
  placeholder,
  providerField,
  providerLabel = '供应商',
}: RuntimeModelFieldPairProps) => {
  const model = Form.useWatch(modelField, form) as string | undefined;
  const provider = Form.useWatch(providerField, form) as string | undefined;
  const displayProvider = resolveModelProviderLabel({ model, provider }, options);

  return (
    <AdminFormGrid label={`${modelLabel}与${providerLabel}`}>
      <Form.Item extra={extra} label={modelLabel} name={modelField}>
        <AutoComplete
          allowClear
          options={options}
          placeholder={placeholder}
          onChange={(value) => {
            if (!options.some((option) => option.value === value)) {
              form.setFieldValue(providerField, '');
            }
          }}
          onSelect={(value) => {
            const selected = options.find((option) => option.value === value);
            if (!selected) return;
            form.setFieldsValue({
              [modelField]: selected.model,
              [providerField]: selected.provider,
            });
          }}
        />
      </Form.Item>
      <Form.Item hidden name={providerField}>
        <Input />
      </Form.Item>
      <Form.Item label={providerLabel}>
        <Input
          readOnly
          aria-label={providerLabel}
          placeholder="选择模型后自动显示"
          value={displayProvider}
        />
      </Form.Item>
    </AdminFormGrid>
  );
};
```

Use `memo` and a module-level component; do not define the component inside the page render.

- [ ] **Step 6: Run Task 2 tests and verify GREEN**

Run the Step 3 command again.

Expected: normalization, serialization, catalog selection, read-only provider display, clearing, and legacy preservation pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- "src/features/Admin/adminRuntimeModelSettings.ts" "src/features/Admin/adminRuntimeModelSettings.test.ts" "src/features/Admin/components/RuntimeModelFieldPair.tsx" "src/features/Admin/components/RuntimeModelFieldPair.test.tsx"
git commit -m "✨ feat: bind runtime models to providers"
```

---

### Task 3: Integrate Catalog-Backed Runtime Rows

**Files:**

- Modify: `src/features/Admin/AdminDefaultSettingsPage.tsx`
- Modify: `src/features/Admin/AdminSystemManagementExperience.test.ts`

**Interfaces:**

- Consumes: `RuntimeModelFieldPair` and `buildRuntimeSettingUpdates` from Task 2.

- Produces: six runtime rows: vector Embedding, vector Reranker, three memory chat models, and memory Embedding.

- Preserves: current SWR keys, save action, success/error messages, vector query mode, and all non-runtime scopes.

- [ ] **Step 1: Write the failing page-integration test**

Extend `AdminSystemManagementExperience.test.ts`:

```ts
it('uses one catalog-backed model control and one read-only provider for every runtime pair', () => {
  const page = readRepoFile('src/features/Admin/AdminDefaultSettingsPage.tsx');

  expect(page.match(/<RuntimeModelFieldPair/g)).toHaveLength(6);
  expect(page).toContain('options={rerankerModelOptions}');
  expect(page).toContain("modelType: 'embedding'");
  expect(page).toContain('buildRuntimeSettingUpdates');
  expect(page).not.toContain('modelProviderOptions');
  expect(page).not.toContain('embeddingProviderOptions');
});
```

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```powershell
bun run check --test "src/features/Admin/AdminSystemManagementExperience.test.ts"
```

Expected: failure because the page still renders free-text vector fields and editable provider selects.

- [ ] **Step 3: Build all three option sets**

In `AdminDefaultSettingsPage.tsx`, retain chat and Embedding filters and add an unfiltered Reranker set:

```tsx
const rerankerModelOptions = useMemo(
  () =>
    buildModelOptions({
      enabledNewapiModels: settings?.sharedHealth?.enabledNewapiModels as any,
    }),
  [settings?.sharedHealth?.enabledNewapiModels],
);
```

Remove `buildProviderOptions`, `findModelOption`, `normalizeMemoryModelFields`, provider option memos, and `applySelectedModelProvider` from the page.

- [ ] **Step 4: Replace all six model/provider pairs**

Render `RuntimeModelFieldPair` for:

```tsx
<RuntimeModelFieldPair
  form={form}
  modelField="vectorEmbeddingModel"
  modelLabel="Embedding 模型"
  options={embeddingModelOptions}
  placeholder="选择 Embedding 模型"
  providerField="vectorEmbeddingProvider"
  providerLabel="Embedding 供应商"
/>
```

Repeat with `rerankerModelOptions` for vector Reranker, `modelOptions` for the three memory chat rows, and `embeddingModelOptions` for memory Embedding. Preserve every existing explanatory `extra` string.

- [ ] **Step 5: Route saves through the pure serialization contract**

Replace the page-local `buildRuntimeUpdates` body with this delegating function, leaving the existing save-branch selection intact:

```ts
const buildRuntimeUpdates = (values: FormValues): SettingUpdate[] =>
  buildRuntimeSettingUpdates({
    chatOptions: modelOptions,
    embeddingOptions: embeddingModelOptions,
    rerankerOptions: rerankerModelOptions,
    values,
  });
```

Keep the existing call to `adminCommercialService.setAppSettingsBatch({ updates })` and the runtime SWR refresh unchanged.

- [ ] **Step 6: Run page and runtime tests and verify GREEN**

Run:

```powershell
bun run check --test "src/features/Admin/AdminSystemManagementExperience.test.ts" "src/features/Admin/adminRuntimeModelSettings.test.ts" "src/features/Admin/components/RuntimeModelFieldPair.test.tsx"
```

Expected: all integration and runtime field tests pass.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- "src/features/Admin/AdminDefaultSettingsPage.tsx" "src/features/Admin/AdminSystemManagementExperience.test.ts"
git commit -m "✨ feat: show runtime model providers"
```

---

### Task 4: Repository and Rendered Verification

**Files:**

- Verify all files changed in Tasks 1-3.
- Do not add screenshots, traces, temporary scripts, or test reports to the repository.

**Interfaces:**

- Consumes: repository `bun run check` workflow and the local debug proxy.

- Produces: fresh lint/test/type evidence plus desktop and narrow rendered evidence.

- [ ] **Step 1: Run the complete changed-file gate**

Run with the final changed-file list:

```powershell
bun run check "src/features/NavPanel/index.test.tsx" "src/features/NavPanel/Shell.tsx" "src/features/Admin/AdminSidebar.test.tsx" "src/features/Admin/AdminSidebar.tsx" "src/features/Admin/adminRuntimeModelSettings.ts" "src/features/Admin/adminRuntimeModelSettings.test.ts" "src/features/Admin/components/RuntimeModelFieldPair.tsx" "src/features/Admin/components/RuntimeModelFieldPair.test.tsx" "src/features/Admin/AdminDefaultSettingsPage.tsx" "src/features/Admin/AdminSystemManagementExperience.test.ts"
```

Expected: lint clean and all discovered focused tests pass.

- [ ] **Step 2: Run type and diff gates**

```powershell
bun run check --type
git diff --check
git status --short --branch
```

Expected: types clean, no whitespace errors, and only intended task changes or commits.

- [ ] **Step 3: Start or reuse the local SPA server**

Use the repository's existing `bun run dev:spa` workflow and its debug proxy. If port `9876` is occupied by the correct worktree server, reuse it; otherwise start this worktree on the next free port and use the emitted proxy URL.

- [ ] **Step 4: Verify the desktop admin shell**

The flow under test is: `/settings/admin` -> admin shell renders -> main application panel is absent -> dedicated admin navigation and search remain correctly aligned.

Check page URL/title, meaningful DOM, framework overlays, relevant console warnings/errors, and capture a desktop screenshot. Confirm there is no visible standalone `搜索管理功能` text above the input.

- [ ] **Step 5: Verify runtime provider selection**

The flow under test is: `/settings/admin/ai-runtime-defaults` -> select an available runtime model -> corresponding read-only provider becomes visible -> clearing the model clears the provider.

Exercise at least one chat or Embedding row. If the live enabled catalog has no selectable model, verify the saved legacy fallback and report the empty-catalog limitation rather than fabricating data or mutating production catalog enablement.

- [ ] **Step 6: Verify the narrow responsive state**

Use a viewport near `390x844`. Confirm the main application panel remains absent, the admin menu button opens the admin navigation sheet, model/provider rows stack without horizontal overflow, and text does not overlap.

- [ ] **Step 7: Final scope review**

Compare the final diff against every acceptance criterion in the design specification. Report commands, test counts, browser URL/viewports, screenshots, any live-catalog limitation, commit IDs, and explicitly state that nothing was pushed, merged, deployed, or changed in production.
