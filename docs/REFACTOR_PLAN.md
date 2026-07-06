# Refactor Plan

生成时间：2026-07-07

适用仓库：`E:\code\comhub\ci-verify-3bbf64f`

依据文件：

- `docs/PROJECT_AUDIT.md`
- `docs/FEATURE_REGISTRY.md`

目标：为当前 LobeHub 二次开发项目制定小步、可回滚、可验证的重构路线图。本文档只描述治理路线，不修改业务代码。

## 执行原则

| 原则 | 说明 |
| --- | --- |
| 小步提交 | 每个重构项应拆成 1-3 个可独立回滚的 PR，不做一次性大规模重构 |
| 测试先行 | P0 和核心 P1 项必须先补测试或 smoke，再移动逻辑 |
| 保持行为 | 第一阶段只做约束、适配器、formatter、诊断和测试，不改变用户可见行为 |
| 单一来源 | 后台设置、模型目录、价格、套餐展示、品牌配置必须逐步收敛到单一来源 |
| 先止血后美化 | 线上失效、数据风险、权限泄露、计费错误优先于 UI polish |
| 可观测 | 重要链路必须能在后台或 smoke 中看到当前配置来源、缓存状态和部署版本 |

复杂度约定：

| 复杂度 | 含义 |
| --- | --- |
| S | 1-2 个文件，低耦合，主要是测试、formatter 或文档 |
| M | 3-8 个文件，涉及前后端之一，需针对性测试 |
| L | 8-20 个文件，跨前后端/数据库/配置，必须分批 |
| XL | 跨多个子系统，不能一次执行，必须拆成多个 P0/P1 子项 |

AI 自动处理约定：

| 标记 | 含义 |
| --- | --- |
| 是 | 适合由 AI 在明确测试和范围下直接实现 |
| 部分 | AI 可处理机械整理、测试、formatter、adapter；业务边界需人工确认 |
| 否 | 涉及生产数据、支付、权限、部署策略或产品决策，必须人工确认后再执行 |

## P0：稳定性 / 安全性 / 数据风险

### P0-01 后台设置 Schema 漂移治理

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 后台设置字段在 registry、表单、router、runtime、locale、缓存域中重复维护 |
| 当前表现 | 新增设置经常出现“后台有值，前台不生效”“保存后缓存未刷新”“线上仍使用旧默认值”。 |
| 影响范围 | 品牌白标、默认助手、AI 模型、Composio、通知、桌面端、存储、用户默认设置。 |
| 涉及文件 | `src/const/appSettingsRegistry.ts`、`src/features/Admin/adminSettingsForm.ts`、`src/features/Admin/AdminSettingsPage.tsx`、`packages/business-server/src/lambda-routers/admin/settings.ts`、`src/server/services/appSettings/index.ts`、`src/server/services/appSettings/governance.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 先补完整性测试，要求每个 `APP_SETTING_KEYS` 都具备 registry metadata、表单映射、router 读写、runtime 输出策略、敏感字段标记和缓存域；第二步再引入 `appSettings.schema.ts` 作为适配层，不一次性替换所有页面。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-01-1 增加完整性测试；P0-01-2 增加 schema adapter；P0-01-3 分批迁移表单初值和 update payload。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-02 敏感配置输出与密钥安全

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 后台设置中存在 API Key、OSS Secret、Composio Key、S3 Secret 等敏感字段 |
| 当前表现 | 配置字段集中在同一 app settings 链路，若过滤不严，可能被公共 runtime config 或前端缓存带出。 |
| 影响范围 | AI 服务商 Key、Composio、阿里云 OSS/S3、桌面发布、文件上传、管理员设置页。 |
| 涉及文件 | `src/const/appSettingsRegistry.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts`、`src/server/services/appSettings/index.ts`、`src/features/Admin/AdminFileStoragePage.tsx`、`src/features/Admin/AdminDesktopUpdatePage.tsx` |
| 风险等级 | 高 |
| 推荐处理方式 | 建立敏感字段白名单/黑名单测试；公共 config 只输出脱敏值或可公开字段；后台表单保存后只返回成功状态，不回显 Secret 明文；对上传/OSS/Composio 增加“已配置/未配置”状态。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-02-1 敏感字段泄露单测；P0-02-2 后台响应脱敏；P0-02-3 前端状态展示适配。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-03 AI 服务商、模型目录与重复模型 ID 统一

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 模型来源分散，重复模型 ID、服务商显示名、能力、价格在多个链路中不一致 |
| 当前表现 | 后台新增模型后用户端不一定出现；重复模型 ID 可能只显示一个；system-defaults/service-model 中服务商显示 UUID 乱码。 |
| 影响范围 | 用户模型选择、后台服务商、模型计费矩阵、系统默认模型、记忆分析模型、图片/视频模型。 |
| 涉及文件 | `apps/server/src/routers/lambda/aiProvider.ts`、`apps/server/src/routers/lambda/aiModel.ts`、`packages/business-server/src/lambda-routers/admin/newapiProviders.ts`、`src/server/services/modelCatalog/visibleModels.ts`、`src/features/ModelSwitchPanel`、`src/features/Admin/AdminProvidersPage.tsx`、`packages/database/src/schemas/aiInfra.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 新建后端只读 `ModelCatalogView` 适配器，输出 `{providerId, providerName, modelId, displayName, type, abilities, pricing, source, enabled, restricted}`；先让前端只读消费该 view，不直接删除旧逻辑；重复模型按 modelId 分组，provider 作为子项。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-03-1 后端 catalog 快照测试；P0-03-2 重复 ID 分组测试；P0-03-3 替换 ModelSwitchPanel 数据源；P0-03-4 替换 system-defaults/service-model provider label。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-04 模型价格、利润倍率与 Ledger 显示一致性

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 官方价、后台覆盖价、35% 利润、实际扣费、Ledger 显示分散 |
| 当前表现 | 部分模型不显示能力和价格；积分流水出现 `Consumed on providerUUID/modelId` 乱码；价格展示和扣费来源不完全清晰。 |
| 影响范围 | 聊天扣费、图片/视频/PPT 扣费、套餐模型权限、积分流水、后台模型计费矩阵。 |
| 涉及文件 | `src/features/Admin/adminModelBillingMatrix.ts`、`src/features/Admin/adminProviderModelPricing.tsx`、`packages/business-server/src/commercialBilling.ts`、`packages/business-server/src/generationBilling.ts`、`src/business/client/BusinessSettingPages/ledgerDisplay.ts`、`src/const/billingPresentation.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 先抽纯函数 `resolveModelPricingSnapshot` 和 `formatLedgerModelReference`，由旧调用点逐步接入；不要先移动扣费事务；补 35% 利润、后台覆盖价、缺失价格 fallback、UUID 显示名解析测试。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-04-1 Ledger formatter 单测；P0-04-2 pricing snapshot 单测；P0-04-3 后台矩阵接入；P0-04-4 用户端 Usage/Credits 接入。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-05 商业计费与积分流水数据边界

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 套餐、账单、积分、用量、订单职责边界不清 |
| 当前表现 | 页面中存在重复卡片、重复展示余额/订阅积分/充值积分；Billing UI 可能被误解为真实财务账单。 |
| 影响范围 | `/settings/plans`、`/settings/credits`、`/settings/billing`、`/settings/usage`、后台订单/订阅/积分。 |
| 涉及文件 | `src/business/client/BusinessSettingPages/Plans.tsx`、`Credits.tsx`、`Billing.tsx`、`Usage.tsx`、`packages/business-server/src/lambda-routers/subscription.ts`、`spend.ts`、`admin/orders.ts`、`packages/database/src/schemas/commercial.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 先写“商业页面数据契约测试”：Plans 只读套餐权益，Credits 只读余额/流水，Billing 只读周期/订单，Usage 只读消耗统计；然后抽 `CommercialPageViewModel` 适配层。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-05-1 页面 view-model 测试；P0-05-2 提取 formatter；P0-05-3 UI 逐页接入；P0-05-4 移除重复展示。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-06 品牌加载页、favicon 与默认助手部署后失效

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 后台品牌配置保存后，线上加载 SVG、favicon、默认 AI 名称/头像可能仍使用旧值 |
| 当前表现 | 用户反馈加载完成后网页图标恢复默认；页面 loading 仍显示旧文案；默认 AI 曾从“小果”回退为旧名称。 |
| 影响范围 | SPA HTML、manifest、favicon、About 页面、默认助手、登录页、桌面登录页。 |
| 涉及文件 | `src/server/spaHtml.ts`、`src/server/metadata.ts`、`src/server/manifest.ts`、`src/server/services/brand/index.ts`、`src/features/Brand/loadingBrand.ts`、`src/features/Brand/BrandProvider.tsx`、`src/const/brand.ts`、`src/const/branding.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 先补构建后 smoke 脚本，检查 HTML loading SVG、favicon URL、brand config、默认助手字段来源；再修缓存/优先级；最后补后台“刷新品牌缓存”操作。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-06-1 brand smoke；P0-06-2 优先级测试；P0-06-3 runtime cache 刷新；P0-06-4 线上部署验收脚本。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-07 部署包版本与线上功能一致性

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 部署后线上可能恢复旧版本或缺失新功能 |
| 当前表现 | 用户多次反馈“线上没有看到变化”“新功能丢失”“部署恢复成原来的版本”。 |
| 影响范围 | 整站部署、后台设置、生效的 SPA asset、生产容器、桌面发布。 |
| 涉及文件 | `.github/workflows/comhub-deploy.yml`、`docker-compose/`、`scripts/`、生产 `/www/compose/comhub` 部署脚本、`src/server/spaHtml.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 部署流水线加入 commit SHA、image digest、SPA asset hash、health check、品牌 smoke、关键页面 smoke；部署日志写入可查询版本；不要通过宝塔手动文件覆盖。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-07-1 版本探针 API/日志；P0-07-2 workflow 输出 digest；P0-07-3 部署后 smoke；P0-07-4 回滚记录。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-08 用户默认设置覆盖规则

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 后台默认值和用户自定义默认值的覆盖规则不稳定 |
| 当前表现 | 后台同步用户设置、用户自行改默认助手、后台再次覆盖之间缺少清晰规则。 |
| 影响范围 | 默认助手、默认模型、用户全局设置、输入补全模型、记忆模型、service-model 页面。 |
| 涉及文件 | `src/store/user/slices/settings`、`packages/business-server/src/lambda-routers/admin/settings.ts`、`src/features/Admin/AdminSettingsPage.tsx`、`src/const/appSettingsRegistry.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 明确三层优先级：后台默认值、用户自定义值、管理员强制同步快照；先补迁移/同步测试，再为后台同步操作增加 dry-run 预览和审计日志。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-08-1 优先级矩阵测试；P0-08-2 同步 dry-run；P0-08-3 强制覆盖操作日志；P0-08-4 用户端刷新提示。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

### P0-09 管理员危险操作与审计

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 积分调整、套餐分配、用户缓存同步、危险操作需要强审计保护 |
| 当前表现 | 管理后台已经有危险操作组件，但跨用户资产和系统配置的操作仍需统一审计和回滚信息。 |
| 影响范围 | `/admin/users`、`/admin/credits`、`/admin/subscriptions`、`/admin/maintenance`、用户资产。 |
| 涉及文件 | `src/features/Admin/adminDangerousActions.ts`、`AdminDangerousActionButton.tsx`、`AdminUserDetailDrawer.tsx`、`packages/business-server/src/lambda-routers/admin/audit-router.ts`、`admin/users.ts`、`admin/credits.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 对资产类操作统一要求 reason、operator、before/after snapshot；先补审计 router 测试，再逐个接入操作点。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P0-09-1 审计结构测试；P0-09-2 积分操作接入；P0-09-3 套餐操作接入；P0-09-4 缓存同步接入。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

## P1：严重影响后续开发效率

### P1-01 后台路由双入口收敛

| 字段 | 内容 |
| --- | --- |
| 问题名称 | `/admin/*` 与 `/settings/admin/*` 并存，legacy 段和合并路由生命周期不清 |
| 当前表现 | 后台入口重复，功能归类混乱，后续新增页面容易漏注册或注册到旧入口。 |
| 影响范围 | 管理后台导航、路由同步、权限、测试、用户书签。 |
| 涉及文件 | `src/routes/(main)/admin`、`src/routes/(main)/settings/admin`、`src/features/Admin/adminNavigation.ts`、`src/business/client/adminSettingsRouteRegistry.ts`、`src/features/Admin/AdminMergedRoutePage.tsx` |
| 风险等级 | 高 |
| 推荐处理方式 | 确定 `/admin/*` 为主入口；`/settings/admin/*` 只做兼容跳转并加路由测试；保留 legacy 映射表但标记到期策略。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-01-1 路由映射测试；P1-01-2 兼容跳转；P1-01-3 导航只指向主入口；P1-01-4 删除前二次确认。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P1-02 管理后台信息架构重分组

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 后台功能栏目分散，客户端、品牌、系统默认、模型、商业配置互相穿插 |
| 当前表现 | 同类设置在多个页面出现，用户难以判断应该去哪里配置。 |
| 影响范围 | `/admin/settings`、`/admin/system-defaults`、`/admin/desktop-update`、`/admin/file-storage`、`/admin/model-*`。 |
| 涉及文件 | `src/features/Admin/adminNavigation.ts`、`AdminSettingsPage.tsx`、`AdminSystemDefaultsPage.tsx`、`AdminDesktopUpdatePage.tsx`、`AdminFileStoragePage.tsx` |
| 风险等级 | 中 |
| 推荐处理方式 | 先在文档和导航文案中明确分组；再把“客户端”相关设置集中到客户端栏目；不在第一阶段搬迁数据字段。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-02-1 导航快照测试；P1-02-2 文案分组；P1-02-3 客户端栏目适配；P1-02-4 旧入口提示。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P1-03 商业页面 ViewModel 层

| 字段 | 内容 |
| --- | --- |
| 问题名称 | Plans/Credits/Billing/Usage/Referral 页面各自直接拼装后端数据和 UI 文案 |
| 当前表现 | 页面排版和数据职责反复调整，容易出现重复框、重复余额、formatter 不一致。 |
| 影响范围 | 用户端商业页面、后台套餐/积分/订单配置。 |
| 涉及文件 | `src/business/client/BusinessSettingPages/Plans.tsx`、`Credits.tsx`、`Billing.tsx`、`Usage.tsx`、`Referral.tsx`、`shared.tsx`、`plansDisplay.ts`、`ledgerDisplay.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 每页先抽纯函数 `buildXxxPageViewModel`，保持组件 JSX 不大改；补输入输出快照测试；随后统一容器和 spacing。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-03-1 Plans VM；P1-03-2 Credits/Billing VM；P1-03-3 Usage/Referral VM；P1-03-4 UI 容器统一。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P1-04 桌面客户端配置边界

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 桌面端业务连接地址、下载地址、更新地址、OSS 上传地址边界不清 |
| 当前表现 | 后台有桌面设置，但打包时的 `OFFICIAL_CLOUD_SERVER` 和运行时更新 manifest 不是同一层。 |
| 影响范围 | 桌面登录页、客户端下载入口、自动更新、OSS 发布、GitHub Actions。 |
| 涉及文件 | `src/features/Admin/AdminDesktopUpdatePage.tsx`、`src/features/DesktopDownload`、`apps/desktop/src/main/modules/updater`、`.github/workflows/comhub-desktop-release.yml`、`src/app/(backend)/api/admin/desktop-release/route.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 先输出四类地址的只读诊断卡：业务连接、下载入口、更新 manifest、OSS 存储；再逐步让后台写入明确字段，不把打包期变量伪装成运行时可改。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-04-1 诊断测试；P1-04-2 后台展示；P1-04-3 workflow dry-run；P1-04-4 用户端下载入口统一。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P1-05 通知、记忆、Composio 诊断页

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 多个实验功能失败时缺少后台诊断和用户可读错误 |
| 当前表现 | 输入补全暂停、记忆分析无法执行、Composio 配置不确定、通知链路不透明。 |
| 影响范围 | `/admin/system-defaults`、`/admin/notifications`、Composio 设置、用户聊天体验。 |
| 涉及文件 | `src/features/Admin/AdminSystemDefaultsPage.tsx`、`AdminNotificationsPage.tsx`、`apps/server/src/routers/lambda/composio.ts`、`userMemory.ts`、`notification.ts`、`src/server/services/modelCatalog/diagnostics.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 新增只读诊断 API/卡片，显示当前 provider/model 是否可用、API key 是否存在、最近错误和缓存刷新状态；第一阶段不改变业务执行逻辑。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-05-1 model diagnostics；P1-05-2 memory diagnostics；P1-05-3 composio diagnostics；P1-05-4 notification diagnostics。 |
| 预估复杂度 | L |
| 是否适合交给 AI 自动处理 | 部分 |

### P1-06 社区市场与 MCP 数据标准化

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 社区/MCP/Skill 详情依赖上游市场数据，缺失字段会导致 404 或空白 `UN` |
| 当前表现 | 用户反馈 community 内容页页面不存在，MCP 技能出现空白。 |
| 影响范围 | `/community`、`/settings/skill`、Skill/MCP 详情弹窗、工具安装流程。 |
| 涉及文件 | `src/routes/(main)/community`、`src/features/SkillStore`、`src/features/MCP`、`apps/server/src/routers/lambda/market/*`、`apps/server/src/routers/lambda/agentSkills.ts` |
| 风险等级 | 高 |
| 推荐处理方式 | 抽 `normalizeMarketItem` 和 `normalizeMcpSkillDetail`，统一空标题、空描述、空图标、缺失详情 fallback；增加 404 fallback 页面和诊断日志。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-06-1 缺字段 fixture 测试；P1-06-2 normalize 函数；P1-06-3 详情 fallback；P1-06-4 UI 接入。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P1-07 Workspace 与空壳 Router 生命周期确认

| 字段 | 内容 |
| --- | --- |
| 问题名称 | Workspace 商业化和多个 workspace router 状态不明 |
| 当前表现 | `workspaceCredits`、`workspaceUsage`、`workspaceData`、`workspaceCreds`、`workspaceMember` 疑似空或薄实现。 |
| 影响范围 | Workspace 设置、团队空间、Workspace billing、API Key、未来商业化。 |
| 涉及文件 | `packages/business-server/src/lambda-routers/workspace*.ts`、`src/business/client/BusinessSettingPages/Workspace*`、`src/features/WorkspaceSetting` |
| 风险等级 | 高 |
| 推荐处理方式 | 先做只读审计和路由使用测试，标记为 active/planned/deprecated；不先删除；若未开放，前端隐藏入口或显示实验状态。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P1-07-1 路由使用扫描；P1-07-2 空实现测试；P1-07-3 状态标记；P1-07-4 入口策略。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

## P2：结构优化、代码复用、模块边界优化

### P2-01 Dropdown/Menu Action 工厂

| 字段 | 内容 |
| --- | --- |
| 问题名称 | `useDropdownMenu.tsx` 至少 19 个，重命名/删除/确认动作重复 |
| 当前表现 | 各域菜单逻辑相似但散落，批量维护成本高。 |
| 影响范围 | Agent topic、Group topic、Home、PageEditor、ProviderMenu、Resource library。 |
| 涉及文件 | 多个 `useDropdownMenu.tsx`、`src/features/*`、`src/routes/(main)/*` |
| 风险等级 | 中 |
| 推荐处理方式 | 不做全局 UI 统一；先抽 `createConfirmDeleteItem`、`createRenameItem` 等 action factory，逐域替换。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P2-01-1 找 2 个相似度最高菜单；P2-01-2 抽 factory；P2-01-3 保持快照；P2-01-4 分批替换。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P2-02 通用状态组件规范

| 字段 | 内容 |
| --- | --- |
| 问题名称 | `Card.tsx`、`Header.tsx`、`Loading.tsx`、`Empty.tsx` 等同名组件大量重复 |
| 当前表现 | UI 密度、空状态、加载骨架在不同页面风格不一致。 |
| 影响范围 | 管理后台、商业页面、社区、资源库、内置工具。 |
| 涉及文件 | `src/features`、`src/routes/(main)`、`packages/builtin-tool-*` 中同名组件 |
| 风险等级 | 中 |
| 推荐处理方式 | 先制定组件命名和状态规范；只抽极稳定的 `PageEmptyState`、`PageLoadingState`；业务卡片不强行合并。 |
| 是否需要先补测试 | 否 |
| 推荐执行顺序 | P2-02-1 文档规范；P2-02-2 抽空/加载组件；P2-02-3 新页面使用；P2-02-4 老页面按需迁移。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P2-03 商业 formatter 与类型收敛

| 字段 | 内容 |
| --- | --- |
| 问题名称 | token、credit、金额、周期、套餐 metadata 的展示类型分散 |
| 当前表现 | 前端、后台、服务端各自格式化，容易出现单位/小数/文案不一致。 |
| 影响范围 | Plans、Credits、Billing、Usage、Admin Plans、Model Billing Matrix。 |
| 涉及文件 | `src/const/billingPresentation.ts`、`src/business/client/BusinessSettingPages/*Display.ts`、`packages/business-server/src/commercialBilling.ts`、`packages/types/src/business.ts` |
| 风险等级 | 中 |
| 推荐处理方式 | 将纯展示函数集中为 `billingPresentation` 扩展模块；服务端只产出原始数值和快照，前端统一格式化。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P2-03-1 列出现有 formatter；P2-03-2 加单测；P2-03-3 迁移商业页面；P2-03-4 迁移后台页面。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P2-04 API wrapper 命名和返回类型规范

| 字段 | 内容 |
| --- | --- |
| 问题名称 | `src/services/*` 和 `src/business/client/*` 均封装 `lambdaClient`，命名和返回类型不统一 |
| 当前表现 | 调用方难以判断 service 是否带缓存、是否返回 raw data、是否处理错误。 |
| 影响范围 | 商业服务、AI Model、User Memory、Agent、文件上传、后台管理。 |
| 涉及文件 | `src/services`、`src/business/client/services`、`src/services/commercial.ts`、`src/business/client/commercialRefresh.ts` |
| 风险等级 | 中 |
| 推荐处理方式 | 先写 service 命名规范；新增 service 必须标记 `query/mutation/cache`；旧 service 不大搬家，只补类型和 JSDoc。 |
| 是否需要先补测试 | 否 |
| 推荐执行顺序 | P2-04-1 文档规范；P2-04-2 商业 service 类型；P2-04-3 AI/Memory service 类型；P2-04-4 错误处理统一。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P2-05 Resource Store 边界拆分

| 字段 | 内容 |
| --- | --- |
| 问题名称 | Resource 路由 store 与 feature store 都维护选择状态和 mode |
| 当前表现 | URL 状态、业务选择状态、UI 展开状态边界不清。 |
| 影响范围 | `/resource`、`/resource/library`、知识库、文件树。 |
| 涉及文件 | `src/routes/(main)/resource/store`、`src/routes/(main)/resource/features/store`、`src/features/ResourceManager` |
| 风险等级 | 中 |
| 推荐处理方式 | 先加 selector 行为测试；再分离 route state 和 domain state；不一次性迁移所有资源页面。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P2-05-1 store selector 测试；P2-05-2 route state 标注；P2-05-3 domain state adapter；P2-05-4 逐页替换。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

### P2-06 Image/Video PromptInput 共用 Hook

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 图片和视频生成 PromptInput 高相似 |
| 当前表现 | 上传限制、模型选择、输入状态、提交逻辑重复。 |
| 影响范围 | `/image`、`/video`、生成工作区、模型计费。 |
| 涉及文件 | `src/routes/(main)/(create)/image/features/PromptInput`、`src/routes/(main)/(create)/video/features/PromptInput`、`src/routes/(main)/(create)/features` |
| 风险等级 | 中 |
| 推荐处理方式 | 只抽无 UI 的 `useGenerationPromptInput` hook，保留图片/视频各自 UI；先覆盖现有提交参数测试。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P2-06-1 参数 fixture 测试；P2-06-2 抽 hook；P2-06-3 图片接入；P2-06-4 视频接入。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P2-07 品牌文本 Resolver 收敛

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 品牌名、默认技能名、LobeHub/Lobe AI 替换逻辑散落 |
| 当前表现 | Skill、Memory、Messenger、Devices、Agent Gateway 文案仍可能残留上游品牌。 |
| 影响范围 | 品牌白标、关于页、技能页、设置页、桌面端。 |
| 涉及文件 | `src/features/Brand/brandText.ts`、`useBrandName.ts`、`useDefaultSkillName.ts`、`locales/*`、`packages/builtin-tool-*` |
| 风险等级 | 中 |
| 推荐处理方式 | 扩展 `brandText` resolver，先建立“可替换/不可替换”白名单；逐步替换前台可见文案，不改上游概念名。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P2-07-1 文案白名单；P2-07-2 resolver 测试；P2-07-3 设置页接入；P2-07-4 工具包接入。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

## P3：体验优化、UI 优化、可选优化

### P3-01 商业页面 UI 间距与容器统一

| 字段 | 内容 |
| --- | --- |
| 问题名称 | Credits/Billing/Usage 页面存在 Collapse 内嵌卡片、间距不足、信息拥挤 |
| 当前表现 | 用户标注多处“里面不需要再加一个框”“与上下加间隔”。 |
| 影响范围 | `/settings/credits`、`/settings/billing`、`/settings/usage`、`/settings/referral` |
| 涉及文件 | `src/business/client/BusinessSettingPages/Credits.tsx`、`Billing.tsx`、`Usage.tsx`、`Referral.tsx`、`shared.tsx` |
| 风险等级 | 中 |
| 推荐处理方式 | 在 P1-03 ViewModel 后执行；统一 section header、summary row、table spacing；不改变数据来源。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P3-01-1 视觉快照；P3-01-2 Credits；P3-01-3 Billing/Usage；P3-01-4 Referral。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P3-02 用户面板套餐与积分展示

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 用户信息弹窗需要显示套餐、积分和升级入口 |
| 当前表现 | 用户多次要求参考上游在左上角个人信息弹窗加入套餐显示和积分显示，并删除不需要的帮助菜单。 |
| 影响范围 | 首页左上角用户弹窗、侧边栏升级提示、移动端个人中心。 |
| 涉及文件 | `src/business/client/features/User/BusinessPanelContent.tsx`、`useBusinessMenuItems.tsx`、`HomeFreeCreditBadge.tsx`、`src/const/helpMenu.ts` |
| 风险等级 | 中 |
| 推荐处理方式 | 先复用商业 ViewModel；菜单项由后台 `help.menu.items` 控制；上游不存在的菜单默认隐藏。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P3-02-1 面板数据测试；P3-02-2 套餐显示；P3-02-3 积分显示；P3-02-4 菜单隐藏策略。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P3-03 套餐页上游 UI 对齐

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 套餐页和上游官方样式、折扣、FAQ、套餐对比仍需持续对齐 |
| 当前表现 | 用户多次要求对齐上游套餐、用量、积分、账单、推荐页面 UI。 |
| 影响范围 | `/settings/plans`、`/settings/credits`、`/settings/billing`、侧边栏升级提示。 |
| 涉及文件 | `src/business/client/BusinessSettingPages/Plans.tsx`、`plansDisplay.ts`、`src/features/Admin/AdminSettingsPage.tsx` 中 FAQ 配置 |
| 风险等级 | 中 |
| 推荐处理方式 | 在数据边界稳定后，只做 UI 分层和样式调整；FAQ、折扣文案、促销文案全部后台可配置。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P3-03-1 截图基线；P3-03-2 分段控件折扣；P3-03-3 套餐对比；P3-03-4 FAQ。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P3-04 后台表单体验优化

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 后台表单字段多、分组密集，上传、帮助文案、诊断状态需要统一体验 |
| 当前表现 | 图像 URL 已加入上传按钮，但客户端、品牌、系统默认、模型、存储设置仍较复杂。 |
| 影响范围 | `/admin/settings`、`/admin/system-defaults`、`/admin/file-storage`、`/admin/desktop-update` |
| 涉及文件 | `src/features/Admin/AdminSettingsPage.tsx`、`AdminSystemDefaultsPage.tsx`、`AdminFileStoragePage.tsx`、`AdminDesktopUpdatePage.tsx`、`components/ImageUrlUploadInput.tsx` |
| 风险等级 | 中 |
| 推荐处理方式 | 每个大类增加说明卡和诊断状态；图片上传组件统一预览/清空/复制；不改变保存协议。 |
| 是否需要先补测试 | 否 |
| 推荐执行顺序 | P3-04-1 字段分组文案；P3-04-2 上传组件体验；P3-04-3 诊断卡；P3-04-4 表单密度调整。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 是 |

### P3-05 模型选择器详情展示优化

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 部分模型能力、价格、服务商信息展示不全或不清晰 |
| 当前表现 | 用户反馈后台添加的模型不显示能力和价格；重复模型需要按服务商分组而不是拼服务商名称。 |
| 影响范围 | ModelSwitchPanel、system-defaults、service-model、后台模型矩阵。 |
| 涉及文件 | `src/features/ModelSwitchPanel/components/ModelDetailPanel.tsx`、`MultipleProvidersModelItem.tsx`、`src/features/Admin/adminProviderModelAbilities.tsx` |
| 风险等级 | 中 |
| 推荐处理方式 | 在 P0-03/P0-04 完成后，优化展示层：缺价格显示“未配置”，缺能力显示“待补充”，重复模型展开服务商子菜单。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P3-05-1 展示状态测试；P3-05-2 缺失能力 UI；P3-05-3 缺失价格 UI；P3-05-4 分组视觉优化。 |
| 预估复杂度 | S |
| 是否适合交给 AI 自动处理 | 是 |

### P3-06 Referral 页面排版

| 字段 | 内容 |
| --- | --- |
| 问题名称 | 推荐码、推荐链接、确认绑定布局不够清晰 |
| 当前表现 | 用户标注推荐码/推荐链接应一行显示，确认绑定应独立一行栏目。 |
| 影响范围 | `/settings/referral` |
| 涉及文件 | `src/business/client/BusinessSettingPages/Referral.tsx`、`shared.tsx` |
| 风险等级 | 低 |
| 推荐处理方式 | 保持数据逻辑不变，只调整 flex 布局、复制按钮、输入框宽度和独立 section。 |
| 是否需要先补测试 | 否 |
| 推荐执行顺序 | P3-06-1 布局快照；P3-06-2 推荐码行；P3-06-3 推荐链接行；P3-06-4 绑定栏目。 |
| 预估复杂度 | S |
| 是否适合交给 AI 自动处理 | 是 |

### P3-07 旧功能隐藏与提示文案

| 字段 | 内容 |
| --- | --- |
| 问题名称 | deprecated/unknown 功能仍可能暴露给用户或管理员 |
| 当前表现 | Legacy Top-up、Storage Overage、Workspace 空壳、mobileSubscription 状态不明。 |
| 影响范围 | 用户菜单、后台导航、移动端设置、Workspace 页面。 |
| 涉及文件 | `src/features/Admin/adminNavigation.ts`、`src/business/client/BusinessDesktopRoutes.tsx`、`BusinessMobileRoutes.tsx`、`packages/business-server/src/lambda-routers/topUp.ts`、`storageOverage.ts`、`workspace*.ts` |
| 风险等级 | 中 |
| 推荐处理方式 | 在确认生命周期后，对未开放功能加实验标识或隐藏；保留兼容路由时显示迁移提示。 |
| 是否需要先补测试 | 是 |
| 推荐执行顺序 | P3-07-1 生命周期确认；P3-07-2 导航隐藏测试；P3-07-3 迁移提示；P3-07-4 文档同步。 |
| 预估复杂度 | M |
| 是否适合交给 AI 自动处理 | 部分 |

## 推荐执行批次

| 批次 | 包含项 | 验收标准 |
| --- | --- | --- |
| Batch 1 | P0-01、P0-02、P0-07 | 新增设置不会再无测试进入；敏感字段不泄露；部署能证明当前 SHA/digest 生效 |
| Batch 2 | P0-03、P0-04 | 后台新增 provider/model 在用户端可见；重复模型按服务商分组；Ledger 不再显示 UUID 乱码 |
| Batch 3 | P0-05、P1-03、P3-01 | 商业页面数据边界清晰；Credits/Billing/Usage 无重复内嵌框；关键页面 smoke 通过 |
| Batch 4 | P0-06、P0-08、P3-02 | 品牌 loading/fav/default agent 线上生效；用户面板显示套餐/积分；后台同步规则可审计 |
| Batch 5 | P1-04、P1-05、P1-06 | 桌面、Composio、通知、记忆、社区/MCP 具备可读诊断和 fallback |
| Batch 6 | P1-01、P1-02、P1-07、P2 系列、P3 余项 | 后台入口收敛；重复代码逐步减少；unknown/deprecated 功能状态明确 |

## 不建议立刻做的事

| 不建议事项 | 原因 | 替代方案 |
| --- | --- | --- |
| 一次性重写后台设置页 | 字段多且牵涉 runtime/cache/security，容易造成线上配置丢失 | 先加 schema adapter 和完整性测试，再逐组迁移 |
| 一次性替换所有模型数据源 | 模型涉及聊天、记忆、图片、视频、计费和套餐权限 | 先构建只读 Catalog View，再逐入口切换 |
| 一次性重构商业化系统 | 套餐、积分、订单、账单、用量都有数据风险 | 先抽 ViewModel 和 formatter，保持 API 不变 |
| 直接删除 legacy/unknown 路由 | 可能存在用户书签、旧入口或上游兼容 | 先标记、跳转、埋点/审计，再删除 |
| 先做 UI 大改 | 当前主要问题是配置漂移、计费一致性和部署不可观测 | UI 优化放到 P3，在数据边界稳定后执行 |

## 每项重构的最小验收清单

| 检查项 | 要求 |
| --- | --- |
| 范围 | PR 只覆盖一个重构项或一个重构项的子步骤 |
| 测试 | P0/P1 核心项必须有新增或更新测试；无法自动化时要有手动 smoke 步骤 |
| 回滚 | 不删除旧逻辑，先通过 adapter/formatter/feature flag 接入 |
| 文档 | 修改功能归属、配置项或入口时同步更新 `docs/FEATURE_REGISTRY.md` |
| 部署 | 涉及品牌、部署、桌面、计费时必须记录 commit SHA、构建产物、线上 smoke 结果 |
