# Governance Sprint 001

生成时间：2026-07-07

依据文件：

- `docs/PROJECT_AUDIT.md`
- `docs/FEATURE_REGISTRY.md`
- `docs/REFACTOR_PLAN.md`

目标：第一批治理任务只选择最小、可独立提交、可回滚的 P0/P1 项。当前 Sprint 不做大规模重构，不移动核心业务架构，优先补测试、补 formatter、补 fallback，先把最容易继续失控的地方“上护栏”。

## Sprint 范围

| 任务 | 优先级 | 类型 | 可独立提交 | 核心目标 |
| --- | --- | --- | --- | --- |
| GOV-001 | P0 | 测试护栏 | 是 | 阻止后台设置继续漂移 |
| GOV-002 | P0 | 小型 formatter 修复 | 是 | 修复 Ledger/用量中 provider UUID/modelId 乱码显示 |
| GOV-003 | P1 | 数据 normalize/fallback | 是 | 修复 Community/MCP 缺字段导致 404/空白 `UN` |

暂不纳入本 Sprint：

| 暂缓项 | 原因 |
| --- | --- |
| 完整 `ModelCatalogView` | 范围较大，需先有 GOV-001/GOV-002 这类小护栏 |
| 商业页面 ViewModel 重构 | 涉及 Plans/Credits/Billing/Usage 多页面，适合第二批 |
| 桌面发布流水线治理 | 涉及 GitHub Actions、OSS、Electron 更新，需单独 Sprint |
| 品牌 loading/fav 全链路修复 | 需要部署 smoke 和缓存策略，适合作为 P0 后续任务 |

## GOV-001：后台设置完整性测试

| 字段 | 内容 |
| --- | --- |
| 问题是什么 | 后台设置字段分散在 `APP_SETTING_KEYS`、registry、表单、router、runtime service、缓存域中，新增字段时容易漏任一环节，导致“后台保存了但前台不生效”。 |
| 为什么优先处理 | 这是 `PROJECT_AUDIT.md` 和 `REFACTOR_PLAN.md` 的首要 P0。后续品牌、AI 模型、Composio、通知、桌面端配置都会继续依赖后台设置，如果没有完整性测试，新增功能越多越乱。 |
| 涉及哪些文件 | `src/const/appSettingsRegistry.ts`、`src/features/Admin/adminSettingsForm.ts`、`src/features/Admin/adminSettingsForm.test.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts`、`packages/business-server/src/lambda-routers/admin/settings.test.ts`、`src/server/services/appSettings/governance.ts`、`src/server/services/appSettings/governance.test.ts` |
| 是否需要先补测试 | 是。这个任务本身以补测试为主，第一步不改业务行为。 |
| 修改步骤 | 1. 新增或扩展 `adminSettingsForm.test.ts`，断言每个 `APP_SETTING_KEYS` 都能映射到表单字段或显式标记为非表单字段。2. 扩展 `appSettings/governance.test.ts`，断言每个 key 有分组、敏感性、缓存域和 runtime 暴露策略。3. 扩展 `admin/settings.test.ts`，断言敏感字段不会进入公共输出。4. 若测试暴露缺失 metadata，只补 registry metadata，不重构页面。 |
| 回滚方案 | 回滚该提交即可恢复原状；因为第一阶段只增加测试和 registry metadata，不迁移数据、不改 API 行为。 |
| 验收标准 | 1. 针对后台设置完整性的单测通过。2. 任意新增 `APP_SETTING_KEYS` 时，缺少 registry/form/router/runtime 约束会导致测试失败。3. 敏感字段不会被公共配置输出。4. 没有用户可见 UI 行为变化。 |
| 推荐执行顺序 | Sprint 第 1 个执行。它是后续配置类治理的基础护栏。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是。范围清晰、以测试为主、风险可控。 |

### GOV-001 建议提交边界

| 提交 | 内容 |
| --- | --- |
| Commit 1 | 增加后台设置完整性测试 |
| Commit 2 | 补齐测试暴露出的 registry metadata 缺口 |

## GOV-002：Ledger 模型引用显示 formatter

| 字段 | 内容 |
| --- | --- |
| 问题是什么 | 用户端积分/用量流水中会显示 `Consumed on 757e1732-.../deepseek-v4-pro` 这类 provider UUID/modelId 组合，用户看起来像乱码。 |
| 为什么优先处理 | 这是 P0 计费链路可读性问题。Ledger 是用户核对扣费的依据，如果显示不可读，会影响信任，也会阻碍后续模型价格治理。 |
| 涉及哪些文件 | `src/business/client/BusinessSettingPages/ledgerDisplay.ts`、`src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`、`src/business/client/hooks/useBusinessModelPricing.ts`、`src/server/services/modelCatalog/visibleModels.ts`、`apps/server/src/routers/lambda/aiModel.ts` |
| 是否需要先补测试 | 是。先用 fixture 复现 provider UUID/modelId 显示，再实现 formatter。 |
| 修改步骤 | 1. 在 `ledgerDisplay.test.ts` 增加 fixture：输入 provider UUID + modelId，应输出可读 providerName + model displayName。2. 增加缺失 providerName、缺失 modelName、只知道 modelId 的 fallback 断言。3. 在 `ledgerDisplay.ts` 增加纯函数 `formatLedgerModelReference` 或扩展现有 formatter。4. 只在 Credits/Usage Ledger 展示层接入 formatter，不修改扣费逻辑。5. 若当前页面拿不到 provider/model display map，只增加轻量 adapter，从现有模型列表或 pricing hook 读取，不引入新 catalog 大重构。 |
| 回滚方案 | 回滚 formatter 接入提交即可恢复旧展示；不涉及数据库迁移和扣费逻辑。 |
| 验收标准 | 1. `ledgerDisplay.test.ts` 覆盖 UUID/modelId、未知 provider、未知 model 三类情况。2. Credits/Usage 页面不再直接显示 provider UUID 作为主要文案。3. 扣费金额、token、credit 数值不变。4. 不修改商业计费事务。 |
| 推荐执行顺序 | Sprint 第 2 个执行。依赖 GOV-001 不强，但建议在设置护栏后执行。 |
| 预估复杂度 | S-M |
| 是否适合交给 AI 自动处理 | 是。限定在展示 formatter 和单测，适合小步实现。 |

### GOV-002 建议提交边界

| 提交 | 内容 |
| --- | --- |
| Commit 1 | 增加 Ledger 模型引用显示测试 |
| Commit 2 | 实现 formatter 并接入 Credits/Usage 展示 |

## GOV-003：Community/MCP 缺字段兜底

| 字段 | 内容 |
| --- | --- |
| 问题是什么 | Community/MCP/Skill 详情依赖上游市场数据。缺字段或详情缺失时，页面可能显示“页面不存在”或空白 `UN`。 |
| 为什么优先处理 | `FEATURE_REGISTRY.md` 将“技能、MCP 与社区市场”标为 `broken`，`REFACTOR_PLAN.md` 将其列为 P1。它不是最大数据风险，但直接影响用户可见页面，并且可以用小 normalize/fallback 独立修复。 |
| 涉及哪些文件 | `src/routes/(main)/community`、`src/routes/(mobile)/community`、`src/features/SkillStore`、`src/features/MCP/MCPSettings/index.tsx`、`apps/server/src/routers/lambda/market/skill.ts`、`apps/server/src/routers/lambda/market/agent.ts`、`apps/server/src/routers/lambda/agentSkills.ts` |
| 是否需要先补测试 | 是。先补缺字段 fixture 和 404 fallback 测试。 |
| 修改步骤 | 1. 找到 Community/MCP 详情数据进入 UI 前的最窄入口，优先选择 normalize 层或 detail provider，不直接改多个页面。2. 新增 fixture：缺 title、缺 description、缺 icon、缺 detail、缺 install metadata。3. 新增 `normalizeMarketItem` 或 `normalizeMcpSkillDetail` 测试，要求输出可读 fallback，不输出裸 `UN`。4. UI 接入 normalize 结果，缺详情时显示“内容暂不可用”类 fallback，而不是直接页面不存在。5. 添加轻量诊断日志或备注字段，便于后续定位上游数据缺失。 |
| 回滚方案 | 回滚 normalize/fallback 接入即可恢复旧行为；不涉及数据库和 API 结构迁移。 |
| 验收标准 | 1. 缺字段 fixture 测试通过。2. MCP 技能标题、图标、描述缺失时有可读 fallback。3. Community 详情缺失时不出现空白 `UN`。4. 对真实不存在的 slug 仍保留 404 行为，不把所有错误吞掉。 |
| 推荐执行顺序 | Sprint 第 3 个执行。它独立于后台设置和 Ledger formatter，可单独提交。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是。输入输出边界清晰，以 normalize 和 fallback 为主。 |

### GOV-003 建议提交边界

| 提交 | 内容 |
| --- | --- |
| Commit 1 | 增加 Community/MCP 缺字段 fixture 测试 |
| Commit 2 | 实现 normalize/fallback 并接入详情页 |

## Sprint 验收

| 验收项 | 标准 |
| --- | --- |
| 任务数量 | 只包含 3 个任务以内，本 Sprint 固定为 GOV-001 至 GOV-003 |
| 优先级 | 全部来自 P0/P1 |
| 独立提交 | 每个任务都可单独提交和回滚 |
| 测试策略 | 三个任务都要求先补测试 |
| 业务风险 | 不做数据库迁移，不改扣费事务，不迁移后台设置架构，不改部署策略 |
| 文档同步 | 执行任一任务后，应更新 `docs/FEATURE_REGISTRY.md` 和 `docs/CHANGELOG_INTERNAL.md` |

## 建议执行顺序

1. GOV-001：先给后台设置加护栏，避免继续引入配置漂移。
2. GOV-002：修复计费流水可读性，降低用户侧信任风险。
3. GOV-003：修复已标记 broken 的社区/MCP 可见问题。

## 执行前检查清单

| 检查项 | 要求 |
| --- | --- |
| 阅读治理文档 | 已阅读 `PROJECT_AUDIT`、`FEATURE_REGISTRY`、`REFACTOR_PLAN` |
| 分支状态 | 确认当前分支和未提交变更，不能覆盖用户改动 |
| 任务边界 | 每次只执行一个 GOV 任务 |
| 测试命令 | 优先运行对应 targeted vitest，不运行全量 `bun run test` |
| 回滚准备 | 每个任务提交前确认 diff 仅包含该任务相关文件 |
