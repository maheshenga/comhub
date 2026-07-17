# Admin Governance Task 7 Report

## 结论

Task 7 已完成：新增 typed snapshot loader，将 `settings.getAll` 收敛为单次
`app_settings` 批量查询，新增受 `systemRead` 保护的 `settings.getSection`，迁移 13 个
设置所有者页面，并集中处理 section/aggregate SWR 失效。

平台在线支付保持关闭。Desktop OSS 的五个配置项继续标记为
`CI/GitHub Secrets` 外部所有，后台仅只读展示。响应中的 cron、Composio、S3、PPT 和
Desktop OSS 秘密只返回 configured/masked 状态，不返回明文或加密密文。

## 查询次数

- `loadAppSettingsSnapshot([])`: **0** 次数据库查询。
- `loadAppSettingsSnapshot(keys)`: 去重后执行 **1** 次
  `appSettings.findMany WHERE key IN (...)`，snapshot accessor 后续执行 **0** 次查询。
- `settings.getAll`: **1** 次 `app_settings` 查询；测试同时确认
  `appSettings.findFirst` 为 **0** 次。`getAllEnabledModels` 是独立模型目录读取，不是
  `app_settings` 查询。
- `settings.getSection`: 每次执行 **1** 次该 section 的 `app_settings` 查询。
  `model-policy` 与 `system-defaults` 会额外读取 enabled model catalog，用于显式
  `sharedHealth`，该读取不是 `app_settings` 查询。
- 基线 `8f7e009b77` 静态计数：`getAll` 内 **97** 个直接 `readSetting` 调用，四个嵌套
  reader 内 **45** 个 `readSetting` 调用，合计 **142** 个显式逐键读取；此外还调用
  `getServerModelPolicyConfig` 与 `getResolvedServerDefaultAgentConfig`，其间接读取次数
  受缓存状态影响。这与任务 brief 的约 151 次运行时 lookup 描述一致，但本报告不把
  缓存相关间接读取伪装成固定计数。

## 所有权与兼容

- `settings`: site/brand、default agent name/avatar、default skill、community 按钮文案、
  profile interest areas、plan FAQ。
- `model-billing-matrix`: default agent/image/video model/provider、pricing 与关闭状态的
  online payment。
- `system-defaults`: Composio、avatar presets、memory/vector/user defaults。
- `maintenance`: cron 与 memory trigger mode。
- `notifications`: notification retention 的唯一 owner。
- 其余 section 按 Task 1 catalog 归属；section key list 直接从 catalog 派生。
- `getAll` 保留原 tRPC 名称、字段集合与默认/掩码语义；Overview 保留 aggregate read。
- 13 个设置所有者页面均改用带 section ID 的 SWR key 与 `getSection`。
- 写入只失效受影响 section、兼容 aggregate key，以及页面原有的必要 runtime cache。

## 验证证据

按用户要求未执行独立 RED，也未重跑已通过的整套测试。首次合并验证后，只对失败项
做最小确认。

### 首次 focused tests

```powershell
# packages/business-server
bunx vitest run --silent='passed-only' src/appSettings/loader.test.ts src/appSettings/catalog.test.ts src/lambda-routers/admin/ppt.test.ts src/lambda-routers/admin/settings.test.ts
```

- 首次结果：76 tests，75 passed，1 failed。
- 已通过且未重跑：loader 4/4、settings 60/60、PPT 5/5。
- 唯一失败：catalog runtime-consumer source metadata 仍指向已迁移的旧 reader。
- 最小确认第一次：catalog 6 passed、1 failed，定位到同类 notification metadata。
- 同类 metadata 一次性同步后最终确认：catalog **7/7 passed**。

```powershell
# repository root
bunx vitest run --silent='passed-only' src/const/adminCacheKeys.test.ts src/features/Admin/adminCommercialFlow.test.ts src/server/services/appSettings/governance.test.ts src/features/Admin/adminChineseCopy.test.ts src/services/adminCommercial.test.ts src/features/Admin/adminSettingsForm.test.ts src/server/services/docmee/config.test.ts src/server/services/appSettings/secrets.test.ts src/server/services/appSettings/index.test.ts src/features/Admin/AdminNotificationsPage.test.ts
```

- 首次结果：132 tests，130 passed，2 failed。
- 两个失败均为 `adminCommercialFlow.test.ts` 对旧 `settings.ts` source location 的静态断言。
- 最小确认命令：

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

- 最终结果：**40/40 passed**。

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/AdminSystemMaintenancePage.test.tsx src/features/Admin/AdminDesktopUpdatePage.test.tsx
```

- 结果：**2/2 passed**。该组首次即通过，未重跑。

### TypeScript 与 ESLint

```powershell
bun run type-check
```

- 首次结果：1 个 test mock contract error，缺少 `{ count: 3 }`。
- 修正后最小确认：**PASS**，`tsgo --noEmit` exit 0。

首次 targeted ESLint 对 Task 7 变更文件执行，结果为 6 errors、45 warnings。错误均为
import sort、secret-like regex lint 与迁移后未使用 helper；完成最小修正后执行：

```powershell
bunx eslint packages/business-server/src/lambda-routers/admin/settings.ts src/const/appSettingsRegistry.ts src/features/Admin/AdminNotificationsPage.tsx src/features/Admin/AdminSettingsPage.tsx src/services/adminCommercial.test.ts src/services/adminCommercial.ts
```

- 最终结果：**0 errors**，exit 0；保留 23 个既有 JSX prop-order warnings。

### Self-review

- 按 `.agents/skills/review-checklist/SKILL.md` 检查 correctness、security、tests、SPA、
  database 与 cloud impact。
- 未新增 `console.log` / `console.debug`、硬编码真实秘密、迁移、依赖升级或路由路径变更。
- `getSection` 输入使用 catalog section enum，未知 section fail closed，并要求
  `systemRead`。
- 测试覆盖 zero/duplicate/missing/null loader、稳定顺序、单查询、`getAll` 字段与秘密
  兼容、section 隔离/权限、notification retention 唯一 owner、13 页面迁移与 cache
  invalidation。
- 改动文件未涉及 Module App 支付、Worker、部署 workflow、服务器/容器/磁盘清理。

## 残余风险

- 按用户明确要求未运行全量 test、全量 ESLint、浏览器/E2E 或生产数据库集成验证。
- Targeted ESLint 仍报告 23 个非阻塞 JSX prop-order warnings；本任务未扩大为页面样式重排。
- `model-policy` / `system-defaults` section 的 enabled-model shared health 仍依赖模型目录
  可用性；失败语义沿用原 `getAll` 的 `getAllEnabledModels` 行为。
- `getAll` 处于兼容期，Overview 仍会读取完整 snapshot；后续移除 aggregate API 需独立任务。

## Task 7 审查修复 Follow-up

### 已修复

- 将 `APP_SETTING_KEYS.userGlobalSettingsDefaults` 显式归属 `system-defaults`。catalog
  section list 现在只在该 section 包含此 key；`getSection('system-defaults')` 会查询并返回
  已存对象，read-model 不再因 key 被错误分区而生成 `{}` 空基线。
- `AdminSettingsPage` 与 `AdminSystemDefaultsPage` 各自保留原 owner section read，同时使用
  `ADMIN_SETTINGS_SECTION_SWR_KEY('file-storage')` 和
  `getSettingsSection('file-storage')` 单独读取 `storageS3PublicDomain`，作为
  `ImageUrlUploadInput.publicUrlPrefix`。
- `storageS3PublicDomain` 仍只属于 `file-storage`；未复制到 `settings`、
  `system-defaults` 或 `sharedHealth`。
- 新增 registry、catalog、section route、read-model、页面静态数据流与 service 回归覆盖。

### 已技术否决

- **不修改缓存失效**：`adminCommercialService.setAppSetting`、
  `setAppSettingsBatch` 与 `savePptSettings` 已统一调用
  `invalidateAdminSettingsWrites`，按受影响 section 加 compatibility aggregate key 失效；
  `adminCommercial.test.ts` 已覆盖 section 去重与不误伤无关 section。
- **不修改 default model suggestions**：当前
  `getServerDefaultModelSuggestions({ currentModel })` 只返回去重后的 `currentModel`；
  `buildModelBillingSettings` 的 `Set([defaultAgentModel])` 与基线语义一致，不存在建议列表
  收缩。

### Follow-up 验证

```powershell
# packages/business-server
bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts src/appSettings/adminReadModel.test.ts src/lambda-routers/admin/settings.test.ts
```

- 结果：**3 files passed，69/69 tests passed**。

```powershell
# repository root
bunx vitest run --silent='passed-only' src/const/appSettingsRegistry.test.ts src/features/Admin/adminCommercialFlow.test.ts src/services/adminCommercial.test.ts
```

- 结果：**3 files passed，58/58 tests passed**。

```powershell
bun run type-check
```

- 结果：**PASS**，`tsgo --noEmit` exit 0。

```powershell
bunx eslint src/const/appSettingsRegistry.ts src/const/appSettingsRegistry.test.ts packages/business-server/src/appSettings/catalog.test.ts packages/business-server/src/appSettings/adminReadModel.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/features/Admin/AdminSettingsPage.tsx src/features/Admin/AdminSystemDefaultsPage.tsx src/features/Admin/adminCommercialFlow.test.ts src/services/adminCommercial.test.ts
```

- 结果：**0 errors**，exit 0；保留 26 个非阻塞既有 style warnings。
- 按约束只执行上述一轮 focused verification，未重跑整套测试。
- 平台在线支付、Module App、Worker、部署、清理和秘密响应边界均未改动。
