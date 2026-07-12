# Project Audit

审计时间：2026-07-07

审计范围：`E:\code\comhub\ci-verify-3bbf64f`

当前分支：`feat/p1-commercial-ai-admin-hardening`

审计性质：只读项目审计。本文档不包含业务代码修改、删除或重构动作。

## 0. Scope And Method

本次审计基于以下信息源：

- CodeGraph / codebase-memory 图谱：当前索引约 `61,292` 个节点、`170,459` 条边，包含函数、方法、路由、文件、类、接口、调用与导入关系。
- 文件树扫描：重点覆盖 `src/`、`packages/`、`apps/`、`docker-compose/`、`.github/`、`scripts/`、`docs/`。
- 关键字索引：覆盖 `Admin`、`Commercial`、`Subscription`、`TopUp`、`Referral`、`Billing`、`Credits`、`Provider`、`Model`、`Brand`、`Notification`、`Desktop`、`Composio`、`Memory`、`OSS`、`S3`、`process.env` 等。
- 路由与 Router 索引：覆盖 `apps/server/src/routers/lambda`、`packages/business-server/src/lambda-routers`、`src/server/workflows-hono`、`src/server/agent-hono`、`src/routes`。
- 测试文件索引：`rg --files` 识别到约 `2043` 个测试文件，不含 `node_modules`、`dist`、`output`。

状态标记说明：

| 状态 | 含义 |
| --- | --- |
| `active` | 当前代码中有明确入口、服务、数据或测试支撑，属于正常使用路径 |
| `experimental` | 有入口或实现，但依赖新流程、外部服务、后台配置或仍处于增强期 |
| `deprecated` | 疑似旧入口、兼容层、空壳或被新入口替代 |
| `broken` | 已有现场反馈或代码结构显示可能不可用 |
| `unknown` | 需要运行时、产品或数据侧人工确认 |

维护风险说明：

| 风险 | 含义 |
| --- | --- |
| 低 | 模块边界清晰，依赖少，已有测试或影响面有限 |
| 中 | 跨前后端或配置较多，修改需联动测试 |
| 高 | 跨运行时、数据库、计费、权限、缓存或部署，容易出现“后台有值、前台未生效”等问题 |

## 1. Directory Structure

| 目录 | 说明 | 风险观察 |
| --- | --- | --- |
| `.github/` | CI/CD、桌面发布、上游同步流水线。包含 `comhub-deploy.yml`、`comhub-desktop-release.yml`、`comhub-upstream-sync.yml` | 高。部署、桌面更新、上游合并与后台配置存在强耦合 |
| `apps/desktop/` | Electron 桌面端，含主进程、IPC、更新、通知、远程服务配置、Splash 等 | 高。客户端发布包和后台设置并非同一实时配置通道 |
| `apps/server/` | 服务端运行时、tRPC routers、Agent Runtime、Model Runtime、工具运行时、桌面发布解析 | 高。模型、计费、工具、通知、文件、工作流高度集中 |
| `apps/cli/` | CLI 应用与本地工具链相关代码 | 中。与桌面端、设备连接、系统工具存在交叉 |
| `packages/business-server/` | 商业化后端：套餐、积分、订单、后台、推荐、兑换码、订阅、计费策略 | 高。当前二开核心改动集中区 |
| `packages/database/` | Drizzle schema、models、repositories。包含商业化、AI 服务商、通知、记忆、设备、文件等表 | 高。业务状态和配置最终依赖这里 |
| `packages/model-bank/` | 上游与内置模型、服务商、模型能力、价格等静态数据 | 高。与后台自定义服务商/模型合并逻辑存在治理压力 |
| `packages/model-runtime/` | 模型运行时通用逻辑 | 高。服务商接入、模型列表后处理、调用协议受影响 |
| `packages/agent-runtime/`、`packages/agent-manager-runtime/` | Agent 执行、工具安装、Composio、技能、异构 Agent 管理 | 高。与聊天主流程、工具系统和外部服务耦合 |
| `packages/builtin-tool-*` | 内置工具包，包含 memory、message、skills、agent-builder、local-system、web-browsing 等 | 中到高。部分文案和 LobeHub 品牌仍在包内 |
| `src/app/` | Next.js App Router 后端 API、Auth 页面、SPA HTML 模板 | 高。品牌加载页、favicon、桌面发布 API、认证均在此 |
| `src/routes/` | SPA 路由页面，按 `(main)`、`(mobile)`、`(desktop)`、`(popup)`、`onboarding` 分组 | 高。桌面/移动/主路由存在多入口，容易漏注册 |
| `src/features/` | 业务组件域。包含 Admin、Brand、DesktopDownload、ModelSwitchPanel、SkillStore、Conversation 等 | 高。二开 UI 与上游功能同时存在，重复组件较多 |
| `src/business/` | 商业化前端页面与客户端服务，例如套餐、积分、账单、推荐、后台路由注册 | 高。业务页面与 `src/routes`、`packages/business-server` 强耦合 |
| `src/store/` | Zustand 状态管理。包含 user、serverConfig、agent、chat、tool、file、userMemory 等 | 高。模型、默认助手、工具、记忆、文件、用户设置都依赖这里 |
| `src/services/` | 客户端服务封装，调用 `lambdaClient`、上传、商业化、用户记忆、AI 模型等 | 中到高。API wrapper 存在分散重复 |
| `src/server/` | Next 侧 server services、workflows-hono、agent-hono、品牌、appSettings 等 | 高。后台配置读取、品牌运行时、记忆工作流在此 |
| `src/const/` | 业务常量和设置注册。包含 `appSettingsRegistry.ts`、`billingPresentation.ts` | 高。后台设置 Key 和展示规则核心注册点 |
| `locales/`、`packages/locales/` | 多语言文案 | 中。大量 LobeHub/Lobe AI 字符串残留，白标改造需治理 |
| `docker-compose/` | 本地、部署、Grafana/observability compose | 中到高。生产与历史部署文件并存 |
| `scripts/` | 部署包、上游同步、发布辅助脚本 | 中到高。升级流水线和部署流水线依赖 |
| `docs/` | 自托管、升级、部署、superpowers 方案与开发文档 | 中。已有治理文档分散，需要统一索引 |
| `e2e/`、`tests/`、`__mocks__/` | E2E、专项测试、mock | 中。核心商业化链路仍缺端到端保护 |

## 2. Feature Inventory

### 2.1 Chat And Agent Runtime

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | `src/routes/(main)/agent`、`src/routes/(main)/agent/[topicId]`、`src/routes/(main)/agent/(chat)`、`src/routes/(mobile)/chat`、`src/routes/(popup)/agent/[aid]` |
| 组件位置 | `src/features/Conversation`、`src/features/ChatInput`、`src/routes/(main)/agent/features/Conversation`、`src/features/ModelSwitchPanel` |
| API / Server Action | `apps/server/src/routers/lambda/aiChat.ts`、`message.ts`、`topic.ts`、`session.ts`、`aiAgent.ts`、`apps/server/src/modules/AgentRuntime`、`apps/server/src/modules/ModelRuntime` |
| 状态管理 | `src/store/chat`、`src/store/agent`、`src/store/user`、`src/store/serverConfig`、`src/store/tool` |
| 数据库 / 配置依赖 | `packages/database/src/schemas/message.ts`、`topic.ts`、`session.ts`、`agent.ts`、`thread.ts`、`llmGenerationTracing.ts`、`src/const/defaultAgent.ts` |
| 外部服务依赖 | AI 服务商 API、Agent Gateway、Device Gateway、Composio、S3、Redis、QStash |
| 环境变量依赖 | `DATABASE_URL`、各类 `*_API_KEY`、`AGENT_GATEWAY_URL`、`DEVICE_GATEWAY_URL`、`ENABLE_AGENT_GATEWAY`、`CRON_SECRET`、`S3_*` |
| 观察 | 主聊天流是所有模块的汇聚点。计费、模型策略、工具、记忆、异构 Agent、通知均会进入此链路，属于最高风险修改面。 |

### 2.2 Default Agent And Agent Profile

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | `src/routes/(main)/agent/profile`、默认助手入口、侧边栏 Inbox Agent |
| 组件位置 | `src/routes/(main)/agent/profile/features`、`src/routes/(main)/agent/profile/features/AgentSettings`、`src/routes/(main)/agent/_layout/Sidebar/Header/Agent` |
| API / Server Action | `apps/server/src/routers/lambda/agent.ts`、`apps/server/src/globalConfig/index.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts` |
| 状态管理 | `src/store/agent`、`src/store/user/slices/settings`、`src/routes/(main)/agent/profile/features/store` |
| 数据库 / 配置依赖 | `packages/database/src/schemas/agent.ts`、`src/const/appSettingsRegistry.ts` 中 `defaultAgent.*` 与 `user.globalSettings.defaults` |
| 外部服务依赖 | AI 服务商、默认模型策略、品牌 Logo |
| 环境变量依赖 | `DEFAULT_AGENT_CONFIG`、服务商 API Key、后台 `appSettings` |
| 观察 | 后台默认助手与用户自定义助手存在优先级问题。若用户已修改默认助手名称/头像，后台同步逻辑需要明确“覆盖用户设置”还是“仅初始化”。 |

### 2.3 AI Providers And Model Catalog

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | 用户端：`/settings/provider`、`/settings/provider/all`、`/settings/service-model`；后台：`/admin/providers`、`/admin/model-billing-matrix`、`/admin/model-policy`、`/admin/system-defaults` |
| 组件位置 | `src/routes/(main)/settings/provider`、`src/features/ModelSwitchPanel`、`src/features/ServiceModel`、`src/features/Admin/AdminProvidersPage.tsx`、`src/features/Admin/AdminModelBillingMatrixPage.tsx` |
| API / Server Action | `apps/server/src/routers/lambda/aiProvider.ts`、`aiModel.ts`、`packages/business-server/src/lambda-routers/admin/newapiProviders.ts`、`admin/settings.ts` |
| 状态管理 | `src/store/serverConfig`、`src/store/user/slices/settings`、`src/store/agent`、`src/business/client/model-bank` |
| 数据库 / 配置依赖 | `packages/database/src/schemas/aiInfra.ts`、`newapiInstance.ts`、`packages/database/src/repositories/aiInfra`、`packages/model-bank` |
| 外部服务依赖 | OpenAI-compatible 服务商、NewAPI、ToAPI、SiliconFlow、OpenCode Go、model-bank 上游静态数据 |
| 环境变量依赖 | `ENABLED_*`、`*_API_KEY`、`*_BASE_URL`、`*_MODEL_LIST`、`DEBUG_*_CHAT_COMPLETION`、`API_KEY_SELECT_MODE` |
| 观察 | 用户端模型列表由 `model-bank + DB` 合并，后台 NewAPI 实例又维护一套模型同步/计费配置。重复模型 ID 的展示由 `ModelSwitchPanel` 多服务商分组承接，但后台“同名模型、同 ID、不同行服务商”的唯一键、展示名和价格来源仍需统一治理。 |

### 2.4 Model Pricing, Model Policy And Billing Matrix

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | `/admin/model-billing-matrix`、`/admin/pricing`、`/admin/plans`、用户消息用量详情、模型选择器 |
| 组件位置 | `src/features/Admin/AdminModelBillingMatrixPage.tsx`、`src/features/Admin/adminModelBillingMatrix.ts`、`src/features/Admin/adminProviderModelPricing.tsx`、`src/features/Conversation/Messages/components/Extras/Usage` |
| API / Server Action | `packages/business-server/src/lambda-routers/admin/settings.ts`、`admin/plans.ts`、`packages/business-server/src/modelPolicy.ts`、`commercialBilling.ts`、`generationBilling.ts` |
| 状态管理 | `src/store/serverConfig`、`src/store/global`、用户设置 store |
| 数据库 / 配置依赖 | `appSettings.pricingCreditMultiplier`、`appSettings.pricingModelRules`、`plan_catalog.modelRules`、`ai_models.pricing`、`ai_providers` |
| 外部服务依赖 | 官方服务商价格、模型能力元数据、NewAPI 同步结果 |
| 环境变量依赖 | 服务商 API Key、`*_MODEL_LIST`、后台 app settings |
| 观察 | 文本模型计费、图片/视频生成计费、套餐模型权限、前台用量展示使用多套展示/换算逻辑。建议后续抽成单一 `PricingDomainService` 和单一价格来源快照。 |

### 2.5 Commercial Plans

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | 用户端 `/settings/plans`；后台 `/admin/plans`、`/admin/model-billing-matrix` |
| 组件位置 | `src/business/client/BusinessSettingPages/Plans.tsx`、`src/business/client/BusinessSettingPages/plansDisplay.ts`、`src/routes/(main)/admin/plans/index.tsx` |
| API / Server Action | `packages/business-server/src/lambda-routers/subscription.ts`、`admin/plans.ts` |
| 状态管理 | SWR 客户端数据、`src/services/commercial.ts`、`src/business/client/commercialRefresh.ts` |
| 数据库 / 配置依赖 | `packages/database/src/schemas/commercial.ts` 中 `planCatalog`、`userPlanSnapshots`、`subscriptionChangeRequests`；`appSettings.plansFaqItems` |
| 外部服务依赖 | 当前在线支付未完全接入，购买 URL 可由后台配置 |
| 环境变量依赖 | 暂未发现直接强依赖，主要依赖数据库配置与后台设置 |
| 观察 | 已支持月付、年付、一次性、终身价、年付优惠文案、套餐对比说明、FAQ。仍需确认“线上支付、订单、实际收款、开票”边界，避免 UI 展示超过后端能力。 |

### 2.6 Credits, Top-up And Ledger

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | 用户端 `/settings/credits`、`/settings/usage`；后台 `/admin/credits`、`/admin/topup`、`/admin/redemption` |
| 组件位置 | `src/business/client/BusinessSettingPages/Credits.tsx`、`Usage.tsx`、`src/features/Admin/AdminTopUpPackagesPage.tsx`、`src/routes/(main)/admin/credits/index.tsx` |
| API / Server Action | `packages/business-server/src/lambda-routers/spend.ts`、`admin/credits.ts`、`admin/topupPackages.ts`、`admin/redemption.ts` |
| 状态管理 | SWR、`src/services/commercial.ts`、用户商业化刷新逻辑 |
| 数据库 / 配置依赖 | `creditAccounts`、`creditLedgerEntries`、`topUpPackages`、`topUpOrders`、`redemptionCodes` |
| 外部服务依赖 | 支付网关待确认、兑换码、管理员手动调账 |
| 环境变量依赖 | 主要为数据库；支付网关变量需要人工确认 |
| 观察 | 已有积分包促销元数据、Ledger、订阅积分/充值积分展示。用户反馈过“Consumed on provider/model 显示乱码”，说明 Ledger 展示层需要 provider/model display name 解析统一。 |

### 2.7 Billing, Orders, Subscriptions And Change Requests

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | 用户端 `/settings/billing`；后台 `/admin/orders`、`/admin/subscriptions`、`/admin/change-requests` |
| 组件位置 | `src/business/client/BusinessSettingPages/Billing.tsx`、`src/features/Admin/AdminOrdersPage.tsx`、`AdminSubscriptionsPage.tsx`、`AdminChangeRequestsPage.tsx` |
| API / Server Action | `packages/business-server/src/lambda-routers/admin/orders.ts`、`admin/subscriptions.ts`、`subscription.ts` |
| 状态管理 | SWR、商业化服务封装 |
| 数据库 / 配置依赖 | `userPlanSnapshots`、`subscriptionChangeRequests`、`topUpOrders`、`planCatalog` |
| 外部服务依赖 | 支付网关、管理员后台订单记录，需人工确认 |
| 环境变量依赖 | 支付服务变量需人工确认 |
| 观察 | 当前 UI 已强调账单金额来自套餐快照，真实收款退款以后台订单为准。这里是“展示账单”和“财务账单”最容易混淆的模块。 |

### 2.8 Referral And Growth

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 中 |
| 页面入口 | 用户端 `/settings/referral`；后台 `/admin/growth`、`/admin/recommendations`、`/admin/settings` |
| 组件位置 | `src/business/client/BusinessSettingPages/Referral.tsx`、`src/features/Admin/AdminGrowthPage.tsx`、`AdminRecommendationsPage.tsx` |
| API / Server Action | `packages/business-server/src/lambda-routers/referral.ts`、`admin/referral.ts`、`admin/settings.ts` |
| 状态管理 | SWR、商业化服务封装 |
| 数据库 / 配置依赖 | `userReferrals`、`referralRewardCredits`、`appSettings.recommendation.*`、`onboarding.initialCredits.*` |
| 外部服务依赖 | 邮件/分享渠道需要人工确认 |
| 环境变量依赖 | 站点 URL、Auth、邮件服务可能相关，需人工确认 |
| 观察 | 推荐码、推荐链接、绑定确认 UI 已存在，但布局反馈显示仍需产品级 polish。 |

### 2.9 Admin System And Settings Governance

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | `/admin`、`/admin/*`、兼容入口 `/settings/admin/*` |
| 组件位置 | `src/features/Admin`、`src/routes/(main)/admin`、`src/routes/(main)/settings/admin`、`src/business/client/adminSettingsRouteRegistry.ts` |
| API / Server Action | `packages/business-server/src/lambda-routers/admin/index.ts`、`admin/settings.ts`、`admin/audit-router.ts` |
| 状态管理 | SWR、`src/services/commercial.ts`、用户权限/管理员能力判断 |
| 数据库 / 配置依赖 | `appSettings`、`adminAuditLogs`、商业化表、AI provider/model 表 |
| 外部服务依赖 | S3/OSS、Composio、桌面发布、通知、Docmee、AI 服务商 |
| 环境变量依赖 | `COMPOSIO_*`、`S3_*`、`CRON_SECRET`、`DESKTOP_*`、`DOCMEE_*`、Auth 与数据库 |
| 观察 | 后台设置横跨 `APP_SETTING_KEYS`、`adminSettingsForm.ts`、`AdminSettingsPage.tsx`、`adminSettingsRouter`、locale、运行时读取服务。新增设置需要至少 5 处同步，是目前错乱和遗漏的主要原因。 |

### 2.10 Branding, White-label, Loading And Help Menus

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | 全站、加载页、About 页、用户面板、社区技能按钮、侧边栏会员入口 |
| 组件位置 | `src/features/Brand`、`src/server/services/brand`、`src/app/spa/[variants]/[[...path]]/route.ts`、`src/features/User/UserPanel`、`src/routes/(main)/settings/about` |
| API / Server Action | `packages/business-server/src/lambda-routers/admin/settings.ts` 中 `getPublicBrand`、`getPublicCustomization`、`updateSetting` |
| 状态管理 | `BrandProvider`、i18n defaultVariables、SWR key `brand-config` |
| 数据库 / 配置依赖 | `appSettings.brand.*`、`about.*`、`help.menu.items`、`sidebar.*`、`defaultSkill.name` |
| 外部服务依赖 | 图片 CDN、S3/OSS 上传 |
| 环境变量依赖 | 默认品牌常量、`S3_*`、`NEXT_PUBLIC_S3_*` |
| 观察 | 已有 `loadingSvgUrl`、favicon、logo、品牌名注入。但仍有大量包内和 locale 中的 `LobeHub`、`Lobe AI` 文案残留，白标应分为“运行时品牌变量”和“历史文案治理”两条线。 |

### 2.11 Notifications

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | 首页右上通知入口、Inbox Drawer、后台 `/admin/notifications`、`/admin/maintenance` |
| 组件位置 | `src/routes/(main)/home_layout/Header/components/InboxDrawer`、`src/features/Admin/AdminNotificationsPage.tsx`、`apps/desktop/src/main/controllers/NotificationCtr.ts` |
| API / Server Action | `apps/server/src/routers/lambda/notification.ts`、`pushToken.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts` |
| 状态管理 | SWR key `inbox:notifications`、用户通知设置、push token store |
| 数据库 / 配置依赖 | `packages/database/src/schemas/notification.ts`、`pushToken.ts`、`appSettings.notification.*` |
| 外部服务依赖 | Expo Push、桌面系统通知、邮件服务需人工确认 |
| 环境变量依赖 | Push/邮件服务变量需人工确认；后台通知开关走 `appSettings` |
| 观察 | DB schema、用户通知列表、后台通知默认值和清理任务已具备。完整“管理员发布系统通知 -> 用户 Inbox/Push/Email”链路仍需要端到端验证。 |

### 2.12 Desktop Client, Update And Download

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | 用户面板“获取桌面应用”、设备连接页、Agent Gateway 提示、桌面端登录页、后台 `/admin/desktop-update` |
| 组件位置 | `apps/desktop/src`、`src/features/DesktopDownload`、`src/features/Admin/AdminDesktopUpdatePage.tsx`、`src/routes/(desktop)/desktop-onboarding` |
| API / Server Action | `src/app/(backend)/api/admin/desktop-release/route.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts`、`apps/server/src/services/desktopRelease` |
| 状态管理 | `src/store/electron`、`services/electron/remoteServer.ts`、公共桌面下载 SWR |
| 数据库 / 配置依赖 | `appSettings.desktop.*`、`desktop.login.*`、`desktop.oss.*` |
| 外部服务依赖 | GitHub Actions、S3/OSS、Electron autoUpdater、CDN、官方业务服务地址 |
| 环境变量依赖 | `OFFICIAL_CLOUD_SERVER`、`UPDATE_SERVER_URL`、`DESKTOP_UPDATE_SERVER_URL`、`COMHUB_DESKTOP_RELEASE_TOKEN`、`DESKTOP_RELEASE_S3_*`、`CSC_LINK` |
| 观察 | 后台可配置下载入口、登录页文案、更新服务器和 OSS，但桌面包默认连接地址由发布流水线注入，不是后台实时变更。这一点必须在后台 UI 中持续提示。 |

### 2.13 Composio And Tool Connectors

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | Onboarding Composio server list、设置 Profile 授权列表、ChatInput 工具、Agent profile mention、技能详情 |
| 组件位置 | `src/routes/onboarding/components/ComposioServerList`、`src/store/tool/slices/composioStore`、`src/features/ChatInput/ActionBar/Tools`、`src/routes/(main)/settings/profile/features/ComposioAuthorizationList` |
| API / Server Action | `apps/server/src/routers/lambda/composio.ts`、`apps/server/src/routers/tools/composio.ts`、`src/server/services/composio`、`packages/app-config/src/composio.ts` |
| 状态管理 | `src/store/tool`、`src/store/user`、AgentManagerRuntime |
| 数据库 / 配置依赖 | `appSettings.composio.*`、connector/connectorTool 表、用户授权状态 |
| 外部服务依赖 | Composio API、OAuth redirects、Market auth |
| 环境变量依赖 | `COMPOSIO_API_KEY`、`COMPOSIO_ENABLED`、`COMPOSIO_AUTH_CONFIG_IDS` |
| 观察 | 后台配置已经接入 `appSettings`，但工具安装、OAuth、默认插件切换、AgentManagerRuntime 自动安装都依赖 Composio 状态，容易出现“服务端配置好了、前端连接状态未刷新”的问题。 |

### 2.14 Skills, MCP And Community Market

| 项 | 内容 |
| --- | --- |
| 状态 | `broken` |
| 风险 | 高 |
| 页面入口 | `/settings/skill`、`/community/skill`、`/community/mcp`、`/community/skill/:id`、`/community/mcp/:id` |
| 组件位置 | `src/features/SkillStore`、`src/features/AgentSkillDetail`、`src/routes/(main)/community`、`src/routes/(main)/settings/skill` |
| API / Server Action | `apps/server/src/routers/tools/market.ts`、`mcp.ts`、`apps/server/src/routers/lambda/market`、`agentSkills.ts` |
| 状态管理 | `src/store/tool`、`src/store/discover`、`src/services/marketApi.ts` |
| 数据库 / 配置依赖 | `agentSkill`、`plugin`、market 数据、MCP manifest |
| 外部服务依赖 | LobeHub Market、GitHub、MCP servers、Composio |
| 环境变量依赖 | `NEXT_PUBLIC_MARKET_BASE_URL`、Market/OAuth 相关变量需人工确认 |
| 观察 | 用户反馈过社区详情页“页面不存在”和 MCP 技能空白 `UN`。代码上同时存在 Community、SkillStore、AgentSkillDetail、MCPPluginDetail 多套详情展示，数据归一化和错误兜底需要重点治理。 |

### 2.15 User Memory And Vector Retrieval

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | `/settings/memory`、`/memory`、手动记忆分析、后台 `/admin/system-defaults` |
| 组件位置 | `src/routes/(main)/memory`、`src/routes/(main)/settings/memory`、`src/features/ChatInput/ActionBar/Memory`、`src/store/userMemory` |
| API / Server Action | `apps/server/src/routers/lambda/userMemory.ts`、`userMemories.ts`、`src/server/workflows-hono/memory-user-memory`、`apps/server/src/globalConfig/parseMemoryExtractionConfig.ts` |
| 状态管理 | `src/store/userMemory`、`src/services/userMemory`、Chat memory manager |
| 数据库 / 配置依赖 | `packages/database/src/schemas/userMemories`、`packages/database/src/models/userMemory`、`appSettings.memory.userMemory.*`、`vector.*` |
| 外部服务依赖 | 记忆分析模型、Embedding 模型、Reranker、Upstash/QStash、S3 observability |
| 环境变量依赖 | `MEMORY_USER_MEMORY_*`、`DEV_DISABLE_AUTO_MEMORY`、`QSTASH_*`、`S3_*` |
| 观察 | 后台已出现向量检索与记忆分析模型设置，但实际执行依赖环境变量解析、后台 appSettings、模型可见性、任务工作流。需要一条可观测诊断页显示“当前会用哪个 provider/model”。 |

### 2.16 Files, Storage, Resource Manager And Knowledge Base

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | `/resource`、`/resource/library/:id`、`/settings/storage`、后台 `/admin/file-storage`、`/admin/files` |
| 组件位置 | `src/features/ResourceManager`、`src/routes/(main)/resource`、`src/store/file`、`src/features/Admin/AdminFileStoragePage.tsx` |
| API / Server Action | `apps/server/src/routers/lambda/file.ts`、`knowledgeBase.ts`、`upload.ts`、`chunk.ts`、`src/services/upload.ts` |
| 状态管理 | `src/store/file`、`src/routes/(main)/resource/features/store`、`src/routes/(main)/resource/store` |
| 数据库 / 配置依赖 | `file`、`chunk`、`knowledgeBase`、`embedding`、`appSettings.storage.s3.*` |
| 外部服务依赖 | S3-compatible storage、Aliyun OSS、Embedding 服务 |
| 环境变量依赖 | `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_DOMAIN`、`NEXT_PUBLIC_S3_FILE_PATH` |
| 观察 | S3 配置同时支持后台配置和环境变量 fallback。Resource store 存在 route 级和 feature 级两套近似状态，后续可收敛。 |

### 2.17 Messenger, Bot And Channels

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | `/settings/messenger`、Agent channel、Messenger OAuth callback |
| 组件位置 | `src/routes/(main)/settings/messenger`、`src/routes/(main)/agent/channel`、`packages/builtin-tool-message` |
| API / Server Action | `apps/server/src/routers/lambda/messenger.ts`、`botMessage.ts`、`src/server/agent-hono/handlers/messenger*`、`apps/server/src/services/messenger` |
| 状态管理 | 用户设置、Bot provider store、Agent channel forms |
| 数据库 / 配置依赖 | `messengerInstallation`、`messengerAccountLink`、`agentBotProvider`、`oauthHandoff` |
| 外部服务依赖 | Slack、Discord、Telegram、Line、WeChat、Feishu、iMessage/BlueBubbles |
| 环境变量依赖 | 各平台 OAuth / webhook secrets，需人工确认 |
| 观察 | 文案和系统工具仍包含大量 LobeHub System Bot 概念。白标场景下需要明确“官方机器人”是否改为自有品牌。 |

### 2.18 Devices, Agent Gateway And Local System

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | `/settings/devices`、Agent Gateway 云端执行提示、桌面端设备连接 |
| 组件位置 | `src/routes/(main)/settings/devices`、`src/features/ChatInput/ControlBar/HeteroDeviceSwitcher`、`packages/device-*`、`packages/builtin-tool-local-system` |
| API / Server Action | `apps/server/src/routers/lambda/device.ts`、`src/server/agent-hono/handlers/gateway*`、`packages/device-gateway-client` |
| 状态管理 | `src/store/electron`、设备状态、Agent runtime context |
| 数据库 / 配置依赖 | `device`、`agentOperation`、Agent Gateway task state |
| 外部服务依赖 | Agent Gateway、Device Gateway、桌面 IPC、本地系统权限 |
| 环境变量依赖 | `AGENT_GATEWAY_URL`、`AGENT_GATEWAY_SERVICE_TOKEN`、`DEVICE_GATEWAY_URL`、`DEVICE_GATEWAY_SERVICE_TOKEN` |
| 观察 | Web、桌面、云端执行、本地系统工具混合运行。需要用户可见的诊断页区分“桌面未连接”“网关未配置”“工具权限不足”。 |

### 2.19 Image, Video And PPT Generation

| 项 | 内容 |
| --- | --- |
| 状态 | `experimental` |
| 风险 | 高 |
| 页面入口 | `/image`、`/video`、`/ppt` 或 create 相关路由，后台 `/admin/ppt`、`/admin/pricing` |
| 组件位置 | `src/routes/(main)/(create)/image`、`video`、`ppt`、`src/features/Admin/AdminPptSettingsPage.tsx` |
| API / Server Action | `apps/server/src/routers/lambda/image`、`video`、`docmee.ts`、`packages/business-server/src/image-generation`、`video-generation` |
| 状态管理 | image/video generation stores、商业化计费 pre-charge/after-charge |
| 数据库 / 配置依赖 | `generation`、`generationBatch`、`generationTopic`、`creditLedgerEntries`、`appSettings.docmee.*`、`pricing.*` |
| 外部服务依赖 | ComfyUI、Replicate、FAL、Docmee、S3 |
| 环境变量依赖 | `COMFYUI_*`、`REPLICATE_*`、`FAL_*`、`DOCMEE_*`、`S3_*` |
| 观察 | 生成业务已有前后置扣费测试，但和通用聊天模型计费不是同一套入口。建议在治理时统一“可计费资源”的抽象。 |

### 2.20 Auth, User Profile And Onboarding

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 中 |
| 页面入口 | `/signin`、`/signup`、`/settings/profile`、`/onboarding`、桌面 onboarding |
| 组件位置 | `src/app/[variants]/(auth)`、`src/features/User`、`src/routes/onboarding`、`src/routes/(desktop)/desktop-onboarding` |
| API / Server Action | Auth routes、Better Auth、OIDC、`apps/server/src/routers/lambda/user.ts` |
| 状态管理 | `src/store/user`、AuthProvider、MarketAuthProvider |
| 数据库 / 配置依赖 | `betterAuth`、`user`、`nextauth`、`oidc`、`oauthHandoff`、`appSettings.auth.*` |
| 外部服务依赖 | OAuth providers、OIDC、邮箱/短信服务 |
| 环境变量依赖 | `AUTH_*`、`ENABLE_OIDC`、`AUTH_SECRET`、`EMAIL_SERVICE_PROVIDER` |
| 观察 | 登录、市场授权、桌面 OAuth、普通用户资料、头像预设都在不同层级。头像上传和品牌设置已接入后台，但权限和缓存刷新仍需完整测试。 |

### 2.21 Deployment And Upstream Sync

| 项 | 内容 |
| --- | --- |
| 状态 | `active` |
| 风险 | 高 |
| 页面入口 | GitHub Actions、服务器 `/www/compose/comhub`、Baota Nginx |
| 组件位置 | `.github/workflows/comhub-deploy.yml`、`docker-compose/deploy`、`scripts/deploy`、`docs/development` |
| API / Server Action | 部署脚本、GHCR 镜像、健康检查 `/health` |
| 状态管理 | GitHub Actions secrets/vars、服务器 compose state |
| 数据库 / 配置依赖 | PostgreSQL、S3/RustFS/OSS、Redis、部署 `.env` |
| 外部服务依赖 | GHCR、GitHub Actions、SSH、Baota、Nginx、证书 |
| 环境变量依赖 | `COMHUB_SSH_*`、`COMHUB_GHCR_TOKEN`、`COMHUB_DEPLOY_DIR`、`LOBE_PORT`、`DATABASE_URL`、`S3_*` |
| 观察 | 当前部署方案是 Baota 只管 Nginx/证书，应用使用 GitHub Actions + GHCR + compose 蓝绿发布。不要改回宝塔应用上传式部署。 |

## 3. Duplicate Code Findings

| 类型 | 重复点 | 证据位置 | 风险 | 建议 |
| --- | --- | --- | --- | --- |
| 重复 hooks | `useDropdownMenu.tsx` 至少 19 个 | Agent topic、Group topic、Home agent/project、PageEditor、ProviderMenu、Resource library 等 | 中 | 抽 `menu item factory` 和通用确认/重命名/删除动作，不强行合并 UI 差异 |
| 重复组件 | `Item.tsx`、`Card.tsx`、`Header.tsx`、`Loading.tsx`、`Empty.tsx` 大量同名组件 | `src/features`、`src/routes/(main)`、`packages/builtin-tool-*` | 中 | 先按域命名，不急于全局抽象；统一空状态、加载骨架和卡片密度规范 |
| 重复路由桥接 | `/admin/*` 与 `/settings/admin/*` 并存 | `src/routes/(main)/admin`、`src/routes/(main)/settings/admin`、`src/business/client/adminSettingsRouteRegistry.ts` | 高 | 保留一个主入口，另一个明确标记为兼容层并加跳转/测试 |
| 重复后台配置映射 | 设置 Key 同时在 registry、router、form、page、locale、runtime service 出现 | `src/const/appSettingsRegistry.ts`、`adminSettingsForm.ts`、`AdminSettingsPage.tsx`、`admin/settings.ts` | 高 | 建立 schema-first 的后台设置描述表，自动生成表单初值、更新 payload、敏感字段、缓存域 |
| 重复模型列表逻辑 | 用户 provider 模型列表、ModelSwitchPanel、后台 providers、NewAPI provider、model billing matrix 各自处理模型 | `src/routes/(main)/settings/provider`、`src/features/ModelSwitchPanel`、`src/features/Admin`、`packages/database/src/repositories/aiInfra` | 高 | 建立统一 `ModelCatalogView`：按 provider、modelId、displayName、type、pricing、abilities、visibility 输出 |
| 重复计费展示 | token/credit/价格换算散落 | `src/const/billingPresentation.ts`、`adminProviderModelPricing.tsx`、`UsageDetail/pricing.ts`、`commercialBilling.ts`、`generationBilling.ts` | 高 | 抽 `PricingPresentationService` 和 `CreditConversionService`，前后端共享纯函数 |
| 重复套餐展示 | 用户 plans、后台 plans、billing、credits 中各自读取 metadata | `BusinessSettingPages/Plans.tsx`、`Billing.tsx`、`Credits.tsx`、`admin/plans/index.tsx` | 中 | 统一 `PlanCatalogPresentation` 类型和 formatter，现有 `billingPresentation.ts` 可扩展 |
| 重复资源状态 | `src/routes/(main)/resource/store` 与 `src/routes/(main)/resource/features/store` 都维护选择与 mode | 两套 `initialState.ts`、`action.ts` | 中 | 先确认历史原因，再将路由 URL 状态和业务选择状态拆开 |
| 重复 PromptInput | Image 与 Video create 页面 PromptInput 高相似 | `src/routes/(main)/(create)/image/features/PromptInput`、`video/features/PromptInput` | 中 | 抽上传限制、模型选择、图片输入共用 hook，保留各自 UI |
| 重复社区列表 | agent/model/provider/skill/mcp 各有 List、Item、Category | `src/routes/(main)/community/(list)` | 中 | 抽市场列表数据标准化层，UI 仅按实体类型渲染 |
| 重复 API wrapper | `src/services/*` 和 `src/business/client/*` 均封装 `lambdaClient` | `src/services/aiModel`、`commercial.ts`、`userMemory`、`agent` 等 | 中 | 对核心业务保留 service，但补齐命名和返回类型规范 |
| 重复类型定义 | DB select type、packages/types、前端 Admin Form type 并存 | `packages/types/src/business.ts`、`packages/database/src/schemas`、`src/features/Admin/adminSettingsForm.ts` | 高 | 核心商业化类型由 `packages/types` 输出，Admin Form 使用 narrow adapter |

## 4. Coupling Hotspots

| 模块 | 耦合路径 | 风险 |
| --- | --- | --- |
| 后台设置系统 | `APP_SETTING_KEYS -> AdminSettingsPage/adminSettingsForm -> adminSettingsRouter -> appSettings -> server services -> BrandProvider/globalConfig` | 高。新增设置容易漏任一环节 |
| AI 服务商与模型 | `model-bank -> aiInfra repository -> aiModelRouter -> AiModelService -> ModelSwitchPanel -> AdminProviders/NewAPI/Matrix` | 高。重复模型、能力、价格、服务商显示名均受影响 |
| 商业化计费 | `ModelRuntime -> commercialBilling -> CommercialModel -> creditLedgerEntries -> Usage/Credits/Billing UI` | 高。聊天、图片、视频、PPT 都可能扣费 |
| 套餐权限 | `planCatalog.modelRules -> resolvePlanModelRules -> visible model list -> model policy -> chat/generation runtime` | 高。权限错误会造成用户看不到模型或能用不该用的模型 |
| 品牌白标 | `appSettings.brand.* -> server brand service -> SPA HTML route -> BrandProvider -> i18n variables -> page components` | 高。加载页、favicon、About、技能文案可能不同步 |
| 桌面端更新 | `GitHub Actions -> S3/OSS -> desktop-release API -> appSettings.desktop.* -> DesktopDownload hook -> Electron autoUpdater` | 高。后台设置和实际打包变量并非同一层 |
| 通知系统 | `notification schema -> notificationRouter -> InboxDrawer -> pushToken -> Expo/desktop notification -> admin defaults` | 高。渠道开关、用户偏好、发送状态需要统一 |
| 记忆分析 | `admin defaults/env -> parseMemoryExtractionConfig -> workflow-hono -> userMemory models -> memory UI -> chat memory manager` | 高。模型选择失败会表现为“记忆分析无法执行” |
| Composio | `appSettings/env -> server composio service -> lambda/tools routers -> tool store -> AgentManagerRuntime -> SkillStore/ChatInput` | 高。OAuth 状态、工具状态、默认插件切换跨多层 |
| 社区市场 | `market API -> discover store -> community list/detail -> SkillStore/MCP detail -> install/connect flows` | 高。上游市场数据变化会造成详情页 404 或空白 |
| Agent 执行器 | `src/store/chat/agents/createAgentExecutors.ts`、`AgentRuntime`、`tool store`、`message model`、`commercial billing` | 高。图谱显示为高复杂主路径，修改需专门测试 |

## 5. Possibly Deprecated Or Retained Code

| 位置 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| `packages/business-server/src/lambda-routers/topUp.ts` | 空 Router | `deprecated` | 当前 top-up 实际逻辑在 `spend.ts` 和 `admin/topupPackages.ts`，该空壳需要人工确认是否仅为兼容类型 |
| `packages/business-server/src/lambda-routers/storageOverage.ts` | 空 Router | `deprecated` | 仅空 router，未发现实质逻辑 |
| `packages/business-server/src/lambda-routers/workspaceCredits.ts`、`workspaceUsage.ts`、`workspaceData.ts`、`workspaceCreds.ts`、`workspaceMember.ts` | 空或薄 Router | `unknown` | 可能为上游 workspace 能力预留，需确认是否未来功能 |
| `packages/business-server/src/mobile-routers/mobileSubscription.ts` | 空 Router | `deprecated` | 移动订阅能力疑似未实现 |
| `src/routes/(main)/settings/admin` | 兼容入口 | `deprecated` | 与 `/admin/*` 重复。若继续保留需明确导航和测试 |
| `ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS` | 兼容段 | `deprecated` | `topup`、`pricing`、`change-requests` 标记为 legacy，但页面仍在注册 |
| `src/features/Admin/AdminMergedRoutePage.tsx` | 合并路由页 | `unknown` | 疑似用于旧后台页面归并，需要确认生命周期 |
| `apps/server/src/routers/lambda/_template.ts` | 模板代码 | `deprecated` | 模板 router 不应参与生产功能 |
| `docker-compose/production/grafana` | 历史/观测部署 | `unknown` | 需确认线上是否仍使用 |
| 大量 `LobeHub` / `Lobe AI` locale 与内置工具文案 | 白标残留 | `active`/`unknown` | 部分是上游概念，部分应改为品牌变量，需要产品确认 |

## 6. Missing Or Weak Test Protection

测试总体数量较多，但图谱 `TESTS` 关系很少，说明测试和被测符号的结构化关联不足。本节按风险列出缺口。

| 核心功能 | 现有保护 | 缺口 | 风险 |
| --- | --- | --- | --- |
| 后台设置新增字段 | `adminSettingsForm.test.ts`、`admin/settings.test.ts`、`appSettings/index.test.ts` | 缺“新增 APP_SETTING_KEY 必须有表单、router、runtime、locale、缓存域”的约束测试 | 高 |
| AI 服务商模型显示 | `ModelSwitchPanel` 部分测试、`visibleModels.test.ts`、`aiModel` model tests | 缺从后台新增 provider/model 到用户端模型选择器的集成测试 | 高 |
| 重复模型 ID 分组 | `MultipleProvidersModelItem.test.tsx` | 缺真实 DB + model-bank 合并后的重复 ID 快照测试 | 高 |
| 模型价格与能力展示 | `adminModelBillingMatrix.test.ts`、`parseModels.test.ts` | 缺服务商官方价格导入、35% 利润换算、前台展示一致性的端到端测试 | 高 |
| 商业化套餐页 | `plansDisplay.test.ts`、`planPurchase.test.ts`、`adminCommercialFlow.test.ts` | 缺浏览器视觉/交互快照测试，尤其 `/settings/plans` 和上游 UI 对齐 | 中 |
| Credits/Billing/Referral 布局 | 部分商业化 flow 测试 | 缺用户端页面布局回归测试，已有多次 UI 问题反馈 | 中 |
| Ledger 显示名解析 | 未发现专门测试 | provider UUID/modelId 展示为乱码的问题需要 formatter 单测 | 高 |
| 品牌加载 SVG / favicon | `BrandProvider.test.tsx`、`loadingBrand.test.ts`、SPA route tests | 缺生产缓存/部署包 smoke test，无法防止线上仍显示旧加载文案 | 高 |
| About/help menu 自定义 | `adminSettingsForm.test.ts` 部分覆盖 | 缺用户面板、About 页、Skill 按钮统一读取后台配置的集成测试 | 中 |
| 通知系统 | `AdminNotificationsPage.test.ts`、`notification.test.ts`、`pushToken.test.ts` | 缺“后台配置系统通知 -> 创建 notification -> Inbox 展示 -> mark read”的链路测试 | 高 |
| Composio | store selector tests、runtime mocks | 缺后台配置变更后前端 enable/disable 和 OAuth 状态刷新测试 | 高 |
| 记忆分析 | `userMemory` model tests、errorMessage tests、parse config tests | 缺后台模型配置到实际 workflow 执行的集成测试 | 高 |
| 社区详情页 | 有部分 header/detail provider tests | 缺市场数据缺失、MCP 空白、404 fallback 的运行时测试 | 高 |
| 桌面端发布 | `resolveDesktopDownloadEntry.test.ts`、`desktopRelease/index.test.ts`、desktop-release route test | 缺完整 release workflow dry-run 和客户端自动更新 manifest 验证 | 高 |
| 部署 | workflow 存在 smoke | 缺“部署包包含新 SPA asset 和 public SVG/brand config 生效”的自动验收 | 高 |

测试文件分布观察：

| 区域 | 测试数量 |
| --- | --- |
| `apps/server` | 约 440 |
| `packages/database` | 约 138 |
| `apps/desktop` | 约 78 |
| `packages/business-server` | 约 25 |
| `src/features/Admin` | 约 17 |
| `settings routes` | 约 15 |
| `src/business` | 约 9 |
| `admin routes` | 约 1 |
| 其他 | 约 1320 |

## 7. Priority Recommendations

### P0: Stop Further Configuration Drift

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 建立后台设置单一 schema | 以 `APP_SETTING_REGISTRY` 为基础扩展字段类型、默认值、表单分组、敏感性、缓存域、运行时可见性 | `appSettings.schema.ts` 或同等结构 |
| 增加设置完整性测试 | 任意 `APP_SETTING_KEYS` 新增必须被 registry、router/form/runtime 映射覆盖，敏感字段不得公共输出 | 单测 + CI |
| 输出后台设置矩阵文档 | 将每个后台字段归属到品牌、模型、商业、通知、桌面、存储、增长、系统默认 | `docs/admin-settings-map.md` |

### P1: Stabilize AI Provider, Model And Pricing

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 统一模型 Catalog View | 后端输出 `{providerId, providerName, modelId, displayName, type, abilities, pricing, source, enabled, restricted}` | `modelCatalog` service |
| 统一重复模型分组规则 | 用户端永远按 modelId 分组，服务商作为 submenu；后台同样能看到每个 provider/model 实例 | 单测 + 用户端快照 |
| 统一价格来源 | 区分官方价格、后台覆盖价、利润倍率、实际扣费快照 | Pricing service + ledger formatter |
| Ledger 展示名修复 | `referenceId/provider/model` 一律格式化为可读服务商名和模型名 | formatter 单测 |

### P2: Rationalize Commercial Pages

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 明确套餐、账单、积分、用量、推荐的边界 | 套餐负责权益，账单负责周期与订单，积分负责余额和流水，用量负责消费统计，推荐负责增长 | 信息架构文档 |
| 统一页面容器样式 | 去掉 Collapse 内二次卡片，统一 spacing、summary、table、empty | UI 组件规范 |
| 建立商业化端到端 smoke | `/settings/plans`、`credits`、`billing`、`usage`、`referral` 页面渲染和关键数据格式 | Playwright 或轻量 SPA test |

### P3: Make Branding Runtime Reliable

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 运行时品牌变量全覆盖 | 清理前台可见 `LobeHub` / `Lobe AI`，不可改的上游概念标记保留原因 | 品牌文案清单 |
| 加部署包品牌 smoke | 构建后检查 HTML 中 loading SVG、favicon、brand config 是否来自后台/默认品牌 | CI 脚本 |
| 区分品牌默认值和用户自定义 | 默认助手、品牌 Logo、头像、技能名、About Logo 应明确优先级 | 优先级表 + tests |

### P4: Stabilize Desktop Release Pipeline

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 分离业务连接地址和更新地址 | 保持后台提示：业务连接由 `OFFICIAL_CLOUD_SERVER` 打包注入，更新地址由后台/manifest 控制 | 文档 + UI 帮助 |
| 桌面发布 dry-run | 检查安装包内云端地址、latest.yml、下载 URL、后台回写版本号 | GitHub Action dry-run |
| 后台客户端栏目收敛 | 将登录页、下载、更新、OSS 全部归入客户端栏目，不分散在系统默认 | IA 调整方案 |

### P5: Fix Community, Skills And Composio Reliability

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 市场实体统一 normalize | Agent、Skill、MCP、Provider、Model 统一空值和缺失字段处理 | `normalizeMarketItem` 扩展 |
| MCP 空白兜底 | `UN`、空图标、空描述时显示可读 fallback，并记录诊断 | 单测 |
| Composio 状态刷新 | 后台开关变更、API key 缺失、OAuth pending/failed 均给用户明确状态 | store/action 测试 |

### P6: Notifications And Memory Observability

| 建议 | 说明 | 产出 |
| --- | --- | --- |
| 通知链路诊断 | 后台展示 inbox/push/email 是否启用、最近发送、失败原因 | Admin diagnostics |
| 记忆分析诊断 | 展示当前 gatekeeper/extractor/persona/embedding provider-model、是否可用 | Admin system-defaults diagnostics |
| 缓存刷新显式化 | 对用户设置、serverConfig、brand、runtime config 提供后台刷新/同步动作和结果反馈 | 管理员操作日志 |

## 8. Governance Checklist For Future Changes

每次新增后台设置时：

- 是否加入 `APP_SETTING_KEYS` 和 registry metadata。
- 是否标记敏感字段。
- 是否定义缓存域：`brand`、`runtime`、`s3`、`user-state`。
- 是否加入后台表单初值、normalize、build updates。
- 是否加入后端读取与公共输出过滤。
- 是否加入 locale。
- 是否有测试覆盖新增 key。

每次新增 AI 服务商或模型时：

- 是否写入 provider display name。
- 是否有 model type、abilities、pricing。
- 是否和 model-bank 同 ID 合并规则一致。
- 是否能在用户端按服务商分组看到全部启用模型。
- 是否能在 system-defaults/service-model 页面显示可读服务商名。
- 是否有套餐权限和计费矩阵覆盖。

每次新增商业化页面能力时：

- 是否明确数据来源是套餐、订单、余额、流水还是用量。
- 是否有空状态、加载状态、错误状态。
- 是否避免重复卡片嵌套。
- 是否有用户端和后台端一致的 formatter。
- 是否写入 audit log。

每次部署前：

- 是否确认 GitHub Actions 构建的是当前提交。
- 是否确认生产容器镜像 digest 已更新。
- 是否 smoke `/health`、首页 SPA HTML、后台设置页、用户套餐页。
- 是否检查 loading SVG、favicon、brand config 是否来自当前配置。

## 9. Appendix: Selected Environment Variables

| 类别 | 变量示例 |
| --- | --- |
| 数据库 | `DATABASE_URL`、`DATABASE_DRIVER`、`DATABASE_POOL_MAX`、`DATABASE_TEST_URL` |
| Auth / OIDC | `AUTH_SECRET`、`AUTH_*_ID`、`AUTH_*_SECRET`、`AUTH_SSO_PROVIDERS`、`ENABLE_OIDC` |
| AI Providers | `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`AZURE_API_KEY`、`DEEPSEEK_API_KEY`、`SILICONCLOUD_API_KEY`、`NEWAPI_*`、`OPENCODE_GO_*` |
| Provider enable/model list | `ENABLED_OPENAI`、`ENABLED_OLLAMA`、`*_MODEL_LIST`、`API_KEY_SELECT_MODE` |
| Debug | `DEBUG_*_CHAT_COMPLETION`、`DEBUG_OPENAI_RESPONSES`、`DEBUG_LOG_FILE` |
| Storage | `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_DOMAIN`、`NEXT_PUBLIC_S3_FILE_PATH` |
| Composio | `COMPOSIO_API_KEY`、`COMPOSIO_ENABLED`、`COMPOSIO_AUTH_CONFIG_IDS` |
| Memory | `MEMORY_USER_MEMORY_*`、`DEV_DISABLE_AUTO_MEMORY` |
| Agent / Device Gateway | `AGENT_GATEWAY_URL`、`AGENT_GATEWAY_SERVICE_TOKEN`、`DEVICE_GATEWAY_URL`、`DEVICE_GATEWAY_SERVICE_TOKEN` |
| Workflow / Cron | `CRON_SECRET`、`QSTASH_*`、`VERCEL_AUTOMATION_BYPASS_SECRET` |
| Desktop Release | `OFFICIAL_CLOUD_SERVER`、`UPDATE_SERVER_URL`、`DESKTOP_UPDATE_SERVER_URL`、`COMHUB_DESKTOP_RELEASE_TOKEN`、`CSC_LINK` |
| Deployment | `COMHUB_SSH_HOST`、`COMHUB_SSH_PORT`、`COMHUB_SSH_USER`、`COMHUB_GHCR_TOKEN`、`COMHUB_DEPLOY_DIR` |
| Analytics | `ENABLE_TELEMETRY`、`ENABLED_POSTHOG_ANALYTICS`、`NEXT_PUBLIC_DESKTOP_UMAMI_BASE_URL` |

## 10. Appendix: Route And API Index

主要用户端页面：

| 页面 | 路径 |
| --- | --- |
| 聊天 / Agent | `src/routes/(main)/agent` |
| Group Agent | `src/routes/(main)/group` |
| 资源 / 知识库 | `src/routes/(main)/resource` |
| 记忆 | `src/routes/(main)/memory` |
| 社区 | `src/routes/(main)/community` |
| 设置 | `src/routes/(main)/settings` |
| 工作区设置 | `src/routes/(main)/[workspaceSlug]/settings` |
| 桌面 onboarding | `src/routes/(desktop)/desktop-onboarding` |
| 移动端设置/社区/聊天 | `src/routes/(mobile)` |

主要后台页面：

| 页面 | 路径 |
| --- | --- |
| 后台首页 | `src/routes/(main)/admin/overview` |
| 用户 | `src/routes/(main)/admin/users` |
| 套餐 | `src/routes/(main)/admin/plans` |
| 积分 | `src/routes/(main)/admin/credits` |
| 积分包 | `src/routes/(main)/admin/topup` |
| 订单 | `src/routes/(main)/admin/orders` |
| 订阅 | `src/routes/(main)/admin/subscriptions` |
| 兑换码 | `src/routes/(main)/admin/redemption` |
| 服务商 | `src/routes/(main)/admin/providers` |
| 模型计费矩阵 | `src/routes/(main)/admin/model-billing-matrix` |
| 模型策略 | `src/routes/(main)/admin/model-policy` |
| 系统设置 | `src/routes/(main)/admin/settings` |
| 系统默认 | `src/routes/(main)/admin/system-defaults` |
| 通知 | `src/routes/(main)/admin/notifications` |
| 桌面端更新 | `src/routes/(main)/admin/desktop-update` |
| 文件存储 | `src/routes/(main)/admin/file-storage` |
| 维护 | `src/routes/(main)/admin/maintenance` |

主要 tRPC Router：

| Router | 位置 |
| --- | --- |
| Root lambda router | `apps/server/src/routers/lambda/index.ts` |
| Admin root router | `packages/business-server/src/lambda-routers/admin/index.ts` |
| Admin settings | `packages/business-server/src/lambda-routers/admin/settings.ts` |
| Admin plans | `packages/business-server/src/lambda-routers/admin/plans.ts` |
| Admin top-up packages | `packages/business-server/src/lambda-routers/admin/topupPackages.ts` |
| Admin newapi providers | `packages/business-server/src/lambda-routers/admin/newapiProviders.ts` |
| Subscription | `packages/business-server/src/lambda-routers/subscription.ts` |
| Spend / credits | `packages/business-server/src/lambda-routers/spend.ts` |
| Referral | `packages/business-server/src/lambda-routers/referral.ts` |
| AI Provider | `apps/server/src/routers/lambda/aiProvider.ts` |
| AI Model | `apps/server/src/routers/lambda/aiModel.ts` |
| Notification | `apps/server/src/routers/lambda/notification.ts` |
| Composio | `apps/server/src/routers/lambda/composio.ts` |
| User Memory | `apps/server/src/routers/lambda/userMemory.ts`、`userMemories.ts` |
| Desktop release API | `src/app/(backend)/api/admin/desktop-release/route.ts` |

## 11. Final Assessment

当前项目不是“功能少”，而是“功能入口、配置来源、运行时消费路径太多”。最主要的问题不是某一个页面写错，而是后台设置、模型目录、商业化计费、品牌白标、桌面端配置在多条链路中重复表达。

短期优先级应当是：

1. 固化后台设置 schema 与完整性测试，阻止继续漂移。
2. 统一 AI 服务商/模型/价格 Catalog，解决重复模型、能力、价格、乱码显示。
3. 将套餐、积分、账单、用量、推荐页面按数据边界重新治理。
4. 给品牌加载 SVG、favicon、默认助手、About、帮助菜单建立部署后 smoke。
5. 对桌面端、Composio、通知、记忆分析补诊断页，而不是只补更多设置项。

建议下一阶段不要马上大重构。先做“治理底座”：设置 schema、模型 catalog、价格 formatter、商业化 smoke。底座稳定后，再逐步合并重复页面和 hooks。这样风险最低，也最适合继续兼容 LobeHub 上游更新。
