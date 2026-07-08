# Feature Registry

生成时间：2026-07-07

适用仓库：`E:\code\comhub\ci-verify-3bbf64f`

用途：这是 ComHub 基于 LobeHub 二次开发后的长期功能注册表。后续新增、合并、删除或重构功能时，应同步更新本文档，避免后台设置、前端入口、API、数据库和部署链路继续漂移。

资料来源：当前代码库、`docs/PROJECT_AUDIT.md`、CodeGraph/codebase-memory 索引、路由/API/schema/feature 文件扫描。

状态约定：

| 状态 | 含义 |
| --- | --- |
| `active` | 当前有明确入口和实现，属于正常使用路径 |
| `experimental` | 已有入口或实现，但仍依赖新增配置、外部服务、灰度流程或运行时验证 |
| `deprecated` | 疑似旧入口、兼容壳、空实现或已被新功能替代 |
| `broken` | 已有现场反馈或结构证据显示可能不可用 |
| `planned` | 规划中或已有壳但核心能力尚未完成 |
| `unknown` | 需要人工确认业务归属或实际使用状态 |

维护规则：

| 规则 | 要求 |
| --- | --- |
| 新增功能 | 必须新增一条注册项，并写明入口、API、数据依赖和测试缺口 |
| 修改后台设置 | 必须同步更新涉及的配置项依赖、缓存域和备注 |
| 新增 AI 服务商/模型 | 必须同步更新 AI Provider、Model Catalog、Pricing、Ledger 显示相关条目 |
| 上游升级 | 必须检查 `deprecated`、`unknown`、高风险条目是否和上游新功能冲突 |
| 删除功能 | 先将状态改为 `deprecated` 并说明迁移路径，再删除代码 |

## 功能总览

| 功能名称 | 状态 | 风险 | 建议重构 | 需要补测试 |
| --- | --- | --- | --- | --- |
| 聊天与 Agent 运行时 | `active` | 高 | 是 | 是 |
| 默认助手与 Agent Profile | `active` | 高 | 是 | 是 |
| AI 服务商与模型目录 | `active` | 高 | 是 | 是 |
| 模型价格、能力与套餐权限 | `active` | 高 | 是 | 是 |
| 用户套餐页面 | `active` | 高 | 是 | 是 |
| 积分、充值包与流水 | `active` | 高 | 是 | 是 |
| 账单、订单与订阅变更 | `active` | 高 | 是 | 是 |
| 推荐/邀请增长 | `active` | 中 | 是 | 是 |
| 管理后台与设置治理 | `active` | 高 | 是 | 是 |
| 品牌白标、加载页、图标与帮助菜单 | `active` | 高 | 是 | 是 |
| 通知系统 | `experimental` | 高 | 是 | 是 |
| 桌面客户端下载、更新与发布 | `experimental` | 高 | 是 | 是 |
| Composio 与工具连接器 | `experimental` | 高 | 是 | 是 |
| 技能、MCP 与社区市场 | `broken` | 高 | 是 | 是 |
| 用户记忆与向量检索 | `experimental` | 高 | 是 | 是 |
| 文件、对象存储、资源库与知识库 | `active` | 高 | 是 | 是 |
| Messenger、机器人与频道接入 | `experimental` | 高 | 是 | 是 |
| 设备、Agent Gateway 与本地系统能力 | `experimental` | 高 | 是 | 是 |
| 图片、视频与 PPT 生成 | `experimental` | 高 | 是 | 是 |
| 认证、用户资料与引导流程 | `active` | 中 | 否 | 是 |
| 部署与上游同步流水线 | `active` | 高 | 是 | 是 |
| Workspace/团队空间 | `unknown` | 高 | 是 | 是 |
| 管理员用户、权限与审计 | `active` | 高 | 是 | 是 |
| 内容页、专家广场与推荐管理 | `experimental` | 中 | 是 | 是 |
| 系统维护与危险操作 | `active` | 高 | 是 | 是 |
| 页面分享与发布页 | `active` | 中 | 否 | 是 |
| 任务、异步工作流与 Agent Signal | `experimental` | 高 | 是 | 是 |
| Group Agent 与多智能体编排 | `experimental` | 高 | 是 | 是 |
| Agent/RAG 评测 | `experimental` | 中 | 否 | 是 |
| Devtools 与系统诊断 | `experimental` | 中 | 否 | 是 |
| 移动端页面 | `active` | 中 | 是 | 是 |
| Popup 快捷聊天 | `active` | 中 | 否 | 是 |
| API Key、凭证与 OAuth 设备流 | `active` | 高 | 是 | 是 |
| 搜索、网页浏览与每日简报 | `experimental` | 中 | 是 | 是 |
| 导入、导出与数据迁移 | `active` | 中 | 否 | 是 |
| Legacy Top-up 入口 | `deprecated` | 中 | 是 | 是 |
| 空壳 Workspace 商业 Router | `unknown` | 高 | 是 | 是 |
| Storage Overage 空壳 Router | `deprecated` | 中 | 是 | 是 |
| Platform Plugin Marketplace | `experimental` | 高 | 是 | 是 |
| Module App Platform | `planned` | 高 | 是 | 是 |

## 功能明细

### 1. 聊天与 Agent 运行时

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 聊天与 Agent 运行时 |
| 功能状态 | `active` |
| 功能说明 | 主聊天、会话、话题、消息流、Agent Runtime、工具调用、异构 Agent、任务执行的核心链路。 |
| 前端入口 | `/`、`/agent`、`/agent/:topicId`、`src/routes/(main)/agent`、`src/routes/(mobile)/chat`、`src/routes/(popup)/agent/[aid]` |
| 核心组件 | `src/features/Conversation`、`src/features/ChatInput`、`src/routes/(main)/agent/features/Conversation`、`src/features/ModelSwitchPanel`、`src/features/AgentHome` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/aiChat.ts`、`message.ts`、`topic.ts`、`session.ts`、`thread.ts`、`aiAgent.ts`、`apps/server/src/modules/AgentRuntime`、`apps/server/src/modules/ModelRuntime` |
| 数据库依赖 | `packages/database/src/schemas/message.ts`、`topic.ts`、`session.ts`、`agent.ts`、`thread.ts`、`llmGenerationTracing.ts` |
| 配置项依赖 | `defaultAgent.*`、`user.globalSettings.defaults`、`model.policy.*`、`pricing.*`、`memory.userMemory.*` |
| 环境变量依赖 | `DATABASE_URL`、各类 `*_API_KEY`、`AGENT_GATEWAY_URL`、`DEVICE_GATEWAY_URL`、`CRON_SECRET`、`QSTASH_*` |
| 外部服务依赖 | AI 服务商 API、Agent Gateway、Device Gateway、Composio、对象存储、Redis/QStash |
| 主要相关文件 | `src/store/chat`、`src/store/agent`、`src/store/tool`、`packages/agent-runtime`、`packages/agent-manager-runtime`、`packages/business-server/src/generationBilling.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 所有商业计费、模型策略、工具、记忆、通知都会汇入此链路。后续改动应先加集成测试和运行时诊断。 |

### 2. 默认助手与 Agent Profile

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 默认助手与 Agent Profile |
| 功能状态 | `active` |
| 功能说明 | 管理默认助手名称、头像、模型、Profile 展示、Agent 高级配置和用户自定义默认助手。 |
| 前端入口 | `/agent/:agentId/profile`、侧边栏默认助手入口、Inbox Agent 入口 |
| 核心组件 | `src/routes/(main)/agent/profile/features`、`src/routes/(main)/agent/profile/features/AgentSettings`、`src/routes/(main)/agent/_layout/Sidebar/Header/Agent` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/agent.ts`、`apps/server/src/routers/lambda/aiAgent.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts` |
| 数据库依赖 | `packages/database/src/schemas/agent.ts`、`packages/database/src/schemas/session.ts`、用户全局设置 |
| 配置项依赖 | `defaultAgent.name`、`defaultAgent.avatar`、`defaultAgent.provider`、`defaultAgent.model`、`user.globalSettings.defaults`、`brand.logoUrl` |
| 环境变量依赖 | AI 服务商 Key、`DATABASE_URL` |
| 外部服务依赖 | AI 服务商、品牌 Logo/头像资源 |
| 主要相关文件 | `src/const/defaultAgent.ts`、`src/features/Brand`、`src/store/user/slices/settings`、`src/store/agent` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已出现“后台默认 AI 名称和头像失效”的反馈。需要明确后台默认值、用户自定义值、强制同步覆盖的优先级。 |

### 3. AI 服务商与模型目录

| 字段 | 内容 |
| --- | --- |
| 功能名称 | AI 服务商与模型目录 |
| 功能状态 | `active` |
| 功能说明 | 管理内置服务商、后台新增服务商、NewAPI/ToAPI/OpenCode Go/SiliconFlow 等实例、模型同步、模型能力和用户端模型选择。 |
| 前端入口 | 用户端 `/settings/provider`、`/settings/provider/all`、`/settings/service-model`；后台 `/admin/providers`、`/admin/system-defaults` |
| 核心组件 | `src/features/Admin/AdminProvidersPage.tsx`、`src/features/ModelSwitchPanel`、`src/features/ServiceModel`、`src/business/client/model-bank/loadModels.ts` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/aiProvider.ts`、`aiModel.ts`、`packages/business-server/src/lambda-routers/admin/newapiProviders.ts`、`src/server/services/newapiInstance` |
| 数据库依赖 | `packages/database/src/schemas/aiInfra.ts`、`newapiInstance.ts`、`packages/database/src/repositories/aiInfra` |
| 配置项依赖 | `model.policy.*`、`defaultAgent.*`、`defaultImage.*`、`defaultVideo.*`、`memory.userMemory.*`、`pricing.modelRules` |
| 环境变量依赖 | `ENABLED_*`、`*_API_KEY`、`*_BASE_URL`、`*_MODEL_LIST`、`API_KEY_SELECT_MODE`、`DEBUG_*_CHAT_COMPLETION` |
| 外部服务依赖 | OpenAI-compatible API、NewAPI、ToAPI、SiliconFlow、OpenCode Go、上游 `packages/model-bank` |
| 主要相关文件 | `packages/model-bank`、`packages/model-runtime`、`src/server/services/modelCatalog/visibleModels.ts`、`src/server/services/modelCatalog/diagnostics.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 重复模型 ID 应按服务商分组展示，不能只保留一个。服务商 UUID 在用户端显示为乱码的问题应由统一 displayName resolver 解决。 |

### 4. 模型价格、能力与套餐权限

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 模型价格、能力与套餐权限 |
| 功能状态 | `active` |
| 功能说明 | 维护模型能力、官方价格、后台覆盖价格、利润倍率、套餐可用模型、扣费规则、Ledger 展示名称。 |
| 前端入口 | `/admin/model-billing-matrix`、`/admin/model-policy`、`/admin/pricing`、模型选择器详情、用量/积分流水页 |
| 核心组件 | `src/features/Admin/AdminModelBillingMatrixPage.tsx`、`adminModelBillingMatrix.ts`、`adminProviderModelPricing.tsx`、`adminProviderModelAbilities.tsx`、`src/features/ModelSwitchPanel/components/ModelDetailPanel.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/settings.ts`、`admin/plans.ts`、`packages/business-server/src/modelPolicy.ts`、`commercialBilling.ts`、`generationBilling.ts` |
| 数据库依赖 | `ai_models.pricing`、`ai_providers`、`planCatalog.modelRules`、`creditLedgerEntries` |
| 配置项依赖 | `pricing.creditMultiplier`、`pricing.modelRules`、`model.policy.*` |
| 环境变量依赖 | 服务商 Key、`*_MODEL_LIST`、后台 app settings |
| 外部服务依赖 | 服务商官方价格、模型能力元数据、NewAPI/ToAPI 同步结果 |
| 主要相关文件 | `src/features/Admin/adminModelBillingMatrix.ts`、`src/features/Admin/adminModelPolicySettings.ts`、`src/business/client/hooks/useBusinessModelPricing.ts`、`src/business/client/BusinessSettingPages/ledgerDisplay.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 用户要求“官方价格基础上 35% 利润”。应统一成单一 Pricing Domain Service，避免 UI、扣费、Ledger 三套价格逻辑漂移。 |

### 5. 用户套餐页面

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 用户套餐页面 |
| 功能状态 | `active` |
| 功能说明 | 用户端展示免费版/专业版/团队版等套餐、月付/年付/一次性、折扣、套餐对比、FAQ 和升级入口。 |
| 前端入口 | `/settings/plans`、侧边栏升级提示、用户信息弹窗套餐显示、移动端商业入口 |
| 核心组件 | `src/business/client/BusinessSettingPages/Plans.tsx`、`plansDisplay.ts`、`SubscriptionIframeWrapper.tsx`、`HomeFreeCreditBadge.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/subscription.ts`、`packages/business-server/src/lambda-routers/admin/plans.ts` |
| 数据库依赖 | `packages/database/src/schemas/commercial.ts` 中 `planCatalog`、`userPlanSnapshots`、`subscriptionChangeRequests` |
| 配置项依赖 | `plans.faq.items`、`pricing.modelRules`、`model.policy.*`、套餐购买 URL/展示配置 |
| 环境变量依赖 | 主要依赖数据库；支付网关变量需要人工确认 |
| 外部服务依赖 | 支付网关未完全确认；可配置外部购买链接 |
| 主要相关文件 | `src/routes/(main)/settings/plans/index.tsx`、`src/routes/(main)/admin/plans/index.tsx`、`src/features/Admin/AdminAssignPlanModal.tsx` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已多次要求对齐上游官方套餐 UI。需要保持“展示套餐”和“真实收款/订单”边界清晰。 |

### 6. 积分、充值包与流水

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 积分、充值包与流水 |
| 功能状态 | `active` |
| 功能说明 | 展示可用积分、订阅积分、充值积分、推荐积分、积分包、限时优惠、兑换码、消费流水。 |
| 前端入口 | `/settings/credits`、`/settings/usage`、`/admin/credits`、`/admin/topup`、`/admin/redemption` |
| 核心组件 | `src/business/client/BusinessSettingPages/Credits.tsx`、`Usage.tsx`、`RedemptionPanel.tsx`、`src/features/Admin/AdminTopUpPackagesPage.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/spend.ts`、`admin/credits.ts`、`admin/topupPackages.ts`、`admin/redemption.ts` |
| 数据库依赖 | `creditAccounts`、`creditLedgerEntries`、`topUpPackages`、`topUpOrders`、`redemptionCodes` |
| 配置项依赖 | `pricing.creditMultiplier`、`onboarding.initialCredits.*`、`referral.rewardCredits`、充值包促销元数据 |
| 环境变量依赖 | `DATABASE_URL`；支付网关变量需要人工确认 |
| 外部服务依赖 | 支付网关、管理员手动调账、兑换码 |
| 主要相关文件 | `src/business/client/BusinessSettingPages/ledgerDisplay.ts`、`packages/business-server/src/commercialBilling.ts`、`packages/database/src/models/commercial.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已反馈 Ledger 中 `provider UUID/modelId` 显示乱码，应统一通过模型目录格式化为可读名称。 |

### 7. 账单、订单与订阅变更

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 账单、订单与订阅变更 |
| 功能状态 | `active` |
| 功能说明 | 管理用户当前周期金额、订阅快照、订单、变更申请、后台订阅分配和管理员审批。 |
| 前端入口 | `/settings/billing`、`/admin/orders`、`/admin/subscriptions`、`/admin/change-requests` |
| 核心组件 | `src/business/client/BusinessSettingPages/Billing.tsx`、`src/features/Admin/AdminOrdersPage.tsx`、`AdminSubscriptionsPage.tsx`、`AdminChangeRequestsPage.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/orders.ts`、`admin/subscriptions.ts`、`packages/business-server/src/lambda-routers/subscription.ts` |
| 数据库依赖 | `userPlanSnapshots`、`subscriptionChangeRequests`、`topUpOrders`、`planCatalog` |
| 配置项依赖 | 套餐目录、购买链接、支付状态枚举、`pricing.*` |
| 环境变量依赖 | 支付服务变量需要人工确认；`DATABASE_URL` |
| 外部服务依赖 | 支付网关、人工财务记录、发票系统需要人工确认 |
| 主要相关文件 | `src/features/Admin/adminSubscriptionCycles.ts`、`packages/business-server/src/lambda-routers/admin/orders.ts`、`packages/business-server/src/lambda-routers/admin/subscriptions.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 当前 UI 已提示金额来自套餐快照。后续要防止“账单展示”被误认为“真实财务收款”。 |

### 8. 推荐/邀请增长

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 推荐/邀请增长 |
| 功能状态 | `active` |
| 功能说明 | 邀请码、推荐链接、绑定推荐人、推荐奖励积分、后台增长配置。 |
| 前端入口 | `/settings/referral`、用户信息面板、注册页 `?ref=` |
| 核心组件 | `src/business/client/BusinessSettingPages/Referral.tsx`、`src/features/Admin/AdminGrowthPage.tsx`、`AdminRecommendationsPage.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/referral.ts`、`admin/referral.ts`、`admin/settings.ts` |
| 数据库依赖 | `userReferrals`、`referralRewardCredits`、`creditLedgerEntries`、用户表 |
| 配置项依赖 | `referral.rewardCredits`、`recommendation.*`、`onboarding.initialCredits.*` |
| 环境变量依赖 | 站点 URL、Auth 相关变量；邮件服务变量需要人工确认 |
| 外部服务依赖 | 分享渠道、邮件服务需要人工确认 |
| 主要相关文件 | `src/business/client/ReferralProvider.tsx`、`src/business/client/features/User/useBusinessMenuItems.tsx` |
| 维护风险 | 中 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 用户反馈推荐页布局需要优化。建议将推荐码、推荐链接、绑定入口拆成清晰区块。 |

### 9. 管理后台与设置治理

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 管理后台与设置治理 |
| 功能状态 | `active` |
| 功能说明 | 后台导航、系统设置、系统默认、全局配置、缓存刷新、敏感字段、配置分组和兼容路由。 |
| 前端入口 | `/admin`、`/admin/*`、兼容入口 `/settings/admin/*` |
| 核心组件 | `src/features/Admin/AdminSidebar.tsx`、`AdminSettingsPage.tsx`、`AdminSystemDefaultsPage.tsx`、`AdminSettingsGovernanceCard.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/index.ts`、`admin/settings.ts`、`src/server/services/appSettings` |
| 数据库依赖 | app settings 存储、管理员权限、审计日志 |
| 配置项依赖 | `src/const/appSettingsRegistry.ts` 中全部 `APP_SETTING_KEYS` |
| 环境变量依赖 | `DATABASE_URL`、Auth/Admin 权限相关变量 |
| 外部服务依赖 | 依配置项而定：S3、Composio、桌面更新、AI 服务商等 |
| 主要相关文件 | `src/features/Admin/adminSettingsForm.ts`、`src/features/Admin/adminNavigation.ts`、`src/business/client/adminSettingsRouteRegistry.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 当前最核心治理点。新增后台字段必须同时覆盖 registry、form、router、runtime、locale、cache scope 和测试。 |

### 10. 品牌白标、加载页、图标与帮助菜单

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 品牌白标、加载页、图标与帮助菜单 |
| 功能状态 | `active` |
| 功能说明 | 后台配置品牌名、Logo、favicon、加载 SVG、About 页面 Logo、侧边栏帮助菜单、桌面登录页文案。 |
| 前端入口 | 首屏加载页、`/settings/about`、侧边栏左下角菜单、登录页、桌面登录页、Skill/Memory/Messenger/Devices 等文案 |
| 核心组件 | `src/features/Brand`、`src/components/Loading/BrandTextLoading`、`src/features/Admin/components/ImageUrlUploadInput.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/settings.ts`、`src/server/services/brand`、`src/server/spaHtml.ts`、`src/server/metadata.ts`、`src/server/manifest.ts` |
| 数据库依赖 | app settings |
| 配置项依赖 | `brand.*`、`about.*`、`help.menu.items`、`desktop.login.*`、`defaultSkill.name`、`desktop.download.*` |
| 环境变量依赖 | `S3_*` 或后台存储配置；站点 URL |
| 外部服务依赖 | 对象存储/CDN、浏览器 favicon 缓存 |
| 主要相关文件 | `src/const/brand.ts`、`branding.ts`、`aboutLinks.ts`、`helpMenu.ts`、`src/features/Brand/loadingBrand.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已多次反馈线上 loading SVG/favicon/品牌名未生效。需要部署后 smoke 检查 HTML、manifest、favicon 和 runtime config。 |

### 11. 通知系统

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 通知系统 |
| 功能状态 | `experimental` |
| 功能说明 | 管理站内通知、推送、桌面通知、系统通知默认内容、保留天数和后台通知配置。 |
| 前端入口 | Inbox/通知中心、`/settings/notification`、`/admin/notifications`、桌面通知 |
| 核心组件 | `src/business/client/BusinessSettingPages/Notification.tsx`、`src/features/Admin/AdminNotificationsPage.tsx`、Inbox Drawer |
| 后端 API / Server Action | `apps/server/src/routers/lambda/notification.ts`、`pushToken.ts`、`agentNotify.ts`、`botMessage.ts` |
| 数据库依赖 | `packages/database/src/schemas/notification.ts`、`pushToken.ts` |
| 配置项依赖 | `notification.inbox.enabled`、`notification.push.enabled`、`notification.desktop.enabled`、`notification.email.enabled`、`notification.system.*`、`notification.eventDefaults` |
| 环境变量依赖 | 推送服务、邮件服务、桌面环境变量需要人工确认 |
| 外部服务依赖 | 浏览器 Push、Expo/桌面通知、邮件服务、Agent Gateway |
| 主要相关文件 | `src/const/notificationPreferences.ts`、`apps/desktop/src/main/controllers/NotificationCtr.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 用户要求对齐上游通知并在后台加强。需要增加管理员诊断：渠道开关、最近发送、失败原因。 |

### 12. 桌面客户端下载、更新与发布

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 桌面客户端下载、更新与发布 |
| 功能状态 | `experimental` |
| 功能说明 | 桌面应用构建、OSS 上传、下载入口、版本更新 manifest、自动更新提示、后台客户端栏目。 |
| 前端入口 | 侧边栏“获取桌面应用”、Agent Gateway 下载按钮、`/admin/desktop-update`、桌面登录页 |
| 核心组件 | `src/features/DesktopDownload`、`src/features/Admin/AdminDesktopUpdatePage.tsx`、`apps/desktop/src/main/modules/updater` |
| 后端 API / Server Action | `src/app/(backend)/api/admin/desktop-release/route.ts`、`packages/business-server/src/lambda-routers/admin/settings.ts` |
| 数据库依赖 | app settings；桌面发布记录需要人工确认 |
| 配置项依赖 | `desktop.download.*`、`desktop.update.*`、`desktop.oss.*`、`desktop.login.*` |
| 环境变量依赖 | `OFFICIAL_CLOUD_SERVER`、`UPDATE_SERVER_URL`、`DESKTOP_UPDATE_SERVER_URL`、`COMHUB_DESKTOP_RELEASE_TOKEN`、`CSC_LINK` |
| 外部服务依赖 | GitHub Actions、阿里云 OSS/S3、electron-updater、代码签名/公证服务 |
| 主要相关文件 | `.github/workflows/comhub-desktop-release.yml`、`apps/desktop/src/main/controllers/UpdaterCtr.ts`、`RemoteServerConfigCtr.ts`、`RemoteServerSyncCtr.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 后台动态配置和打包期配置并非同一链路。需要区分业务连接地址、更新地址、下载地址和 OSS 凭据。 |

### 13. Composio 与工具连接器

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Composio 与工具连接器 |
| 功能状态 | `experimental` |
| 功能说明 | 管理 Composio API Key、开关、OAuth 配置、连接器状态，并将工具接入 Agent/Skill/ChatInput。 |
| 前端入口 | 后台系统设置、Onboarding Composio Server List、工具/插件设置、聊天输入工具菜单 |
| 核心组件 | `src/routes/onboarding/components/ComposioServerList`、`src/features/MCP/MCPSettings`、`src/features/ChatInput/InputEditor/ActionTag` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/composio.ts`、`src/server/services/composio` |
| 数据库依赖 | `packages/database/src/schemas/connector.ts`、用户工具/插件设置 |
| 配置项依赖 | `composio.enabled`、`composio.apiKey`、`composio.authConfigIds` |
| 环境变量依赖 | `COMPOSIO_API_KEY`、`COMPOSIO_ENABLED`、`COMPOSIO_AUTH_CONFIG_IDS` |
| 外部服务依赖 | Composio API、OAuth provider、第三方工具服务 |
| 主要相关文件 | `packages/app-config/src/composio.ts`、`packages/agent-manager-runtime`、`src/store/tool` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 后台配置项已有，但需要验证 enable/disable、OAuth pending/failed、前端缓存刷新是否一致。 |

### 14. 技能、MCP 与社区市场

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 技能、MCP 与社区市场 |
| 功能状态 | `broken` |
| 功能说明 | 展示社区 Agent/Skill/MCP 市场、详情页、安装方式、内置 Tools、技能名称与按钮文案。 |
| 前端入口 | `/community`、`/community/mcp/:id`、`/settings/skill`、Skill modal、Agent 工具面板 |
| 核心组件 | `src/features/SkillStore`、`src/features/MCP`、`src/routes/(main)/community`、`src/routes/(mobile)/community` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/market/*`、`agentSkills.ts`、`plugin.ts`、`connector.ts` |
| 数据库依赖 | `packages/database/src/schemas/agentSkill.ts`、`connector.ts`、用户插件设置 |
| 配置项依赖 | `defaultSkill.name`、`brand.name`、`help.menu.items`、Composio 设置 |
| 环境变量依赖 | 市场 API、Composio、MCP 运行环境变量需要人工确认 |
| 外部服务依赖 | LobeHub/社区市场数据源、MCP Server、Composio |
| 主要相关文件 | `src/features/ChatInput/InputEditor/ActionTag`、`src/features/MCP/MCPSettings/index.tsx`、`packages/builtin-tools` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已反馈社区详情页 404、MCP 技能空白 `UN`、LobeHub 品牌残留。需要 normalize market item 和空值兜底。 |

### 15. 用户记忆与向量检索

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 用户记忆与向量检索 |
| 功能状态 | `experimental` |
| 功能说明 | 用户记忆提取、偏好/persona 维护、向量检索、记忆分析模型配置、手动分析入口。 |
| 前端入口 | `/memory`、`/settings/memory`、`/admin/system-defaults`、聊天记忆提示 |
| 核心组件 | `src/routes/(main)/memory`、`src/store/userMemory`、记忆设置页 |
| 后端 API / Server Action | `apps/server/src/routers/lambda/userMemory.ts`、`userMemories.ts`、`src/server/workflows-hono/memory-user-memory` |
| 数据库依赖 | `packages/database/src/schemas/userMemories/*`、message/topic/session |
| 配置项依赖 | `memory.userMemory.gatekeeper.*`、`layerExtractor.*`、`personaWriter.*`、`embedding.*`、`vector.embedding.model`、`vector.reranker.model` |
| 环境变量依赖 | `MEMORY_USER_MEMORY_*`、`DEV_DISABLE_AUTO_MEMORY`、AI 服务商 Key、`CRON_SECRET`、`QSTASH_*` |
| 外部服务依赖 | Embedding 模型、LLM 提取模型、QStash/cron |
| 主要相关文件 | `packages/memory-user-memory`、`src/const/userMemory.ts`、`src/server/services/modelCatalog/diagnostics.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已反馈“记忆分析无法执行”和服务商乱码。需要后台诊断当前 provider/model 是否可用。 |

### 16. 文件、对象存储、资源库与知识库

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 文件、对象存储、资源库与知识库 |
| 功能状态 | `active` |
| 功能说明 | 文件上传、预览、资源库、知识库、RAG 文档、S3/OSS 存储配置、文件侧栏用量。 |
| 前端入口 | `/resource`、`/resource/library`、`/settings/storage`、`/admin/file-storage`、聊天上传区 |
| 核心组件 | `src/features/ResourceManager`、`src/features/FileTree`、`src/business/client/features/FileSidePanel`、`src/features/Admin/AdminFileStoragePage.tsx` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/file.ts`、`upload.ts`、`knowledge.ts`、`knowledgeBase.ts`、`chunk.ts`、`document.ts` |
| 数据库依赖 | `packages/database/src/schemas/file.ts`、`rag.ts`、`agentDocuments.ts`、`documentHistory.ts` |
| 配置项依赖 | `storage.s3.*`、`vector.embedding.model`、`vector.reranker.model` |
| 环境变量依赖 | `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_DOMAIN`、`NEXT_PUBLIC_S3_FILE_PATH` |
| 外部服务依赖 | 阿里云 OSS/S3、向量模型、文档解析服务 |
| 主要相关文件 | `src/features/Admin/components/ImageUrlUploadInput.tsx`、`src/features/ChatInput/*FilePreview*`、`packages/database/src/models/file.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 后台图像上传按钮、品牌图像和桌面 OSS 都依赖这一层，建议统一上传服务和 URL 规范。 |

### 17. Messenger、机器人与频道接入

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Messenger、机器人与频道接入 |
| 功能状态 | `experimental` |
| 功能说明 | 将账号连接到官方机器人或外部频道，让 Agent 接收和处理来自 IM/频道的消息。 |
| 前端入口 | `/settings/messenger`、IM 验证页、机器人安装回调 |
| 核心组件 | Messenger 设置页、Agent 选择器、频道安装 UI |
| 后端 API / Server Action | `apps/server/src/routers/lambda/messenger.ts`、`botMessage.ts`、`agentBotProvider.ts`、`src/server/agent-hono/handlers/messenger*` |
| 数据库依赖 | `messengerInstallation.ts`、`messengerAccountLink.ts`、`agentBotProvider.ts` |
| 配置项依赖 | `brand.name`、通知配置、Agent 默认设置 |
| 环境变量依赖 | Bot/平台 Webhook Secret、Agent Gateway、服务 Token 需要人工确认 |
| 外部服务依赖 | Messenger/IM 平台、Agent Gateway、Webhook |
| 主要相关文件 | `src/server/agent-hono/handlers/messengerWebhook.ts`、`messengerOAuthCallback.ts`、`platformWebhook.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已反馈页面文案仍包含 LobeHub，应使用后台品牌名。 |

### 18. 设备、Agent Gateway 与本地系统能力

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 设备、Agent Gateway 与本地系统能力 |
| 功能状态 | `experimental` |
| 功能说明 | 管理用户设备、桌面端连接、Agent Gateway 云端执行、关闭网页后任务继续运行、本地文件/命令工具。 |
| 前端入口 | `/settings/devices`、Agent 任务页下载桌面端按钮、桌面客户端 |
| 核心组件 | 设备设置页、Agent Gateway 提示卡、`packages/builtin-tool-local-system` UI |
| 后端 API / Server Action | `apps/server/src/routers/lambda/device.ts`、`deviceWorkingDirs.ts`、`deviceWorkspaceGuard.ts`、`src/server/agent-hono/handlers/gateway*` |
| 数据库依赖 | `packages/database/src/schemas/device.ts`、workspace/device guard 相关表 |
| 配置项依赖 | `desktop.download.*`、`brand.name`、Agent Gateway 配置 |
| 环境变量依赖 | `AGENT_GATEWAY_URL`、`AGENT_GATEWAY_SERVICE_TOKEN`、`DEVICE_GATEWAY_URL`、`DEVICE_GATEWAY_SERVICE_TOKEN`、`ENABLE_AGENT_GATEWAY` |
| 外部服务依赖 | Agent Gateway、Device Gateway、桌面客户端 |
| 主要相关文件 | `packages/builtin-tool-local-system`、`apps/desktop/src/main/controllers/GatewayConnectionCtr.ts`、`LocalFileCtr.ts`、`ShellCommandCtr.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 下载桌面端链接应走后台 `desktop.download.url`，不应硬编码上游地址。 |

### 19. 图片、视频与 PPT 生成

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 图片、视频与 PPT 生成 |
| 功能状态 | `experimental` |
| 功能说明 | 图片生成、视频生成、PPT 生成、生成任务批次、免费额度、模型默认值和计费。 |
| 前端入口 | `/image`、`/video`、创建工作区、`/admin/ppt`、后台系统默认 |
| 核心组件 | `src/routes/(main)/(create)`、`CreateGenerationPage.tsx`、`GenerationWorkspace`、`src/features/Admin/AdminPptSettingsPage.tsx` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/image/index.ts`、`video/index.ts`、`generation.ts`、`generationBatch.ts`、`generationTopic.ts`、`docmee.ts` |
| 数据库依赖 | `packages/database/src/schemas/generation.ts`、`asyncTask.ts`、message usage |
| 配置项依赖 | `defaultImage.*`、`defaultVideo.*`、`docmee.ppt.*`、`pricing.modelRules` |
| 环境变量依赖 | 图片/视频/PPT 服务商 Key、`DOCMEE_*`、对象存储变量 |
| 外部服务依赖 | 图像模型、视频模型、Docmee、ComfyUI、对象存储 |
| 主要相关文件 | `src/server/services/docmee`、`src/business/client/features/VideoFreeQuotaInfo.tsx`、`src/business/client/hooks/useRenderBusinessVideoBatchItem.tsx` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 生成类计费应和文本模型计费共用价格域，避免积分扣费规则分裂。 |

### 20. 认证、用户资料与引导流程

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 认证、用户资料与引导流程 |
| 功能状态 | `active` |
| 功能说明 | 登录、注册、SSO/OIDC、用户资料、移动端个人中心、Web onboarding、默认 Agent 选择。 |
| 前端入口 | Auth 页面、`/onboarding`、`/onboarding/agent`、移动端 `/me`、`/me/profile` |
| 核心组件 | `src/routes/onboarding`、`src/business/client/BusinessAuthProvider.tsx`、`src/business/client/hooks/useBusinessSignin.ts`、`useBusinessSignup.tsx` |
| 后端 API / Server Action | Auth handlers、`apps/server/src/routers/lambda/user.ts`、`verify.ts`、`oauthDeviceFlow.ts` |
| 数据库依赖 | `betterAuth.ts`、`nextauth.ts`、`user.ts`、`oidc.ts`、`verify.ts` |
| 配置项依赖 | `brand.*`、`profile.*`、`onboarding.initialCredits.*`、`defaultAgent.*` |
| 环境变量依赖 | `AUTH_SECRET`、`AUTH_*_ID`、`AUTH_*_SECRET`、`AUTH_SSO_PROVIDERS`、`ENABLE_OIDC` |
| 外部服务依赖 | OIDC/SSO Provider、OAuth Provider |
| 主要相关文件 | `src/app/[variants]/(auth)`、`src/const/onboarding.ts`、`src/const/onboardingAgentTemplates.ts` |
| 维护风险 | 中 |
| 是否建议重构 | 否 |
| 是否需要补测试 | 是 |
| 备注 | 最近出现过账号密码不对的反馈。若再出现，应优先核查 Auth DB、用户表和部署数据库指向。 |

### 21. 部署与上游同步流水线

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 部署与上游同步流水线 |
| 功能状态 | `active` |
| 功能说明 | GitHub Actions 构建镜像、GHCR 发布、宝塔服务器蓝绿部署、上游同步、桌面发布流水线。 |
| 前端入口 | 无直接用户页面；后台维护/桌面发布页可观察部分状态 |
| 核心组件 | GitHub workflow、部署脚本、Docker Compose、后台维护页 |
| 后端 API / Server Action | 健康检查 API、`src/app/(backend)/api/admin/desktop-release/route.ts` |
| 数据库依赖 | 生产数据库、迁移脚本、app settings |
| 配置项依赖 | 部署环境变量、桌面发布配置、品牌配置 |
| 环境变量依赖 | `COMHUB_SSH_HOST`、`COMHUB_SSH_PORT`、`COMHUB_SSH_USER`、`COMHUB_GHCR_TOKEN`、`COMHUB_DEPLOY_DIR`、`DATABASE_URL` |
| 外部服务依赖 | GitHub Actions、GHCR、宝塔/Nginx、生产服务器、Docker |
| 主要相关文件 | `.github/workflows/comhub-deploy.yml`、`comhub-upstream-sync.yml`、`docker-compose/`、`scripts/` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 已发生线上回到旧版本/新功能丢失反馈。部署必须以 commit SHA、image digest、容器版本和 smoke 结果闭环。 |

### 22. Workspace/团队空间

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Workspace/团队空间 |
| 功能状态 | `unknown` |
| 功能说明 | 团队/工作区、成员、工作区设置、工作区账单、资源迁移、Workspace API Key 等能力。 |
| 前端入口 | `/:workspaceSlug/settings`、`/:workspaceSlug/settings/billing`、`usage`、`storage`、`apikey` |
| 核心组件 | `src/features/WorkspaceSetting`、`src/business/client/BusinessSettingPages/Workspace*`、workspace hooks |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/workspace*.ts`、`apps/server/src/routers/lambda/deviceWorkspaceGuard.ts` |
| 数据库依赖 | `packages/database/src/schemas/workspace.ts`、商业表、API Key 表 |
| 配置项依赖 | Workspace 权限、商业套餐、存储配置 |
| 环境变量依赖 | `DATABASE_URL`、对象存储、Auth |
| 外部服务依赖 | 对象存储、支付/订阅服务需要人工确认 |
| 主要相关文件 | `src/business/client/hooks/useWorkspaces.ts`、`useWorkspaceMembers.ts`、`useSwitchWorkspace.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 多个 workspace router 疑似为空或薄封装，实际可用范围需要人工确认。 |

### 23. 管理员用户、权限与审计

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 管理员用户、权限与审计 |
| 功能状态 | `active` |
| 功能说明 | 用户列表、用户详情、套餐分配、积分调整、管理员权限、RBAC、后台审计日志。 |
| 前端入口 | `/admin/users`、`/admin/audit`、用户详情抽屉 |
| 核心组件 | `src/features/Admin/AdminUserDetailDrawer.tsx`、`AdminAssignPlanModal.tsx`、`AdminBulkActionFlow.tsx`、`AdminOperationsPage.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/users.ts`、`admin/audit.ts`、`admin/audit-router.ts`、`admin/credits.ts` |
| 数据库依赖 | `user.ts`、`rbac.ts`、商业表、审计日志 |
| 配置项依赖 | 管理员权限、危险操作配置、套餐/积分配置 |
| 环境变量依赖 | `DATABASE_URL`、Auth/Admin 环境变量 |
| 外部服务依赖 | 无强外部依赖，取决于 Auth Provider |
| 主要相关文件 | `src/const/rbac.ts`、`src/features/Admin/adminDangerousActions.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 涉及用户资产和权限，所有危险操作都应有审计记录和测试。 |

### 24. 内容页、专家广场与推荐管理

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 内容页、专家广场与推荐管理 |
| 功能状态 | `experimental` |
| 功能说明 | 后台管理内容页、专家广场、推荐智能体/任务模板、社区 Workspace Profile。 |
| 前端入口 | `/admin/content`、`/admin/expert-plaza`、`/admin/recommendations`、`/experts`、首页推荐区域 |
| 核心组件 | `src/features/Admin/AdminContentPages.tsx`、`AdminExpertPlazaPage.tsx`、`AdminRecommendationsPage.tsx`、`src/business/client/DailyBriefRecommendations.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/content.ts`、`config.ts`、market routers |
| 数据库依赖 | app settings、市场数据、社区 profile 数据 |
| 配置项依赖 | `recommendation.*`、`brand.*`、内容页配置 |
| 环境变量依赖 | 市场/内容服务变量需要人工确认 |
| 外部服务依赖 | 上游市场、社区数据源 |
| 主要相关文件 | `src/const/expertPlaza.ts`、`src/business/client/RecommendTaskTemplates.tsx`、`src/business/client/services/communityWorkspaceProfile.ts` |
| 维护风险 | 中 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 和社区市场、首页推荐、内容管理有重叠，需要明确数据源和后台归属。 |

### 25. 系统维护与危险操作

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 系统维护与危险操作 |
| 功能状态 | `active` |
| 功能说明 | 后台系统维护、缓存刷新、用户缓存同步、危险操作确认、系统概览统计。 |
| 前端入口 | `/admin/maintenance`、`/admin/operations`、`/admin/overview` |
| 核心组件 | `src/features/Admin/AdminSystemMaintenancePage.tsx`、`AdminOperationsPage.tsx`、`AdminOverviewPage.tsx`、`AdminDangerousActionButton.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/admin/stats.ts`、`admin/settings.ts`、`admin/audit-router.ts` |
| 数据库依赖 | app settings、审计日志、用户/商业统计 |
| 配置项依赖 | `adminCacheKeys`、`APP_SETTING_KEYS`、缓存域：`brand`、`runtime`、`s3`、`user-state` |
| 环境变量依赖 | `DATABASE_URL`、Redis/缓存服务变量需要人工确认 |
| 外部服务依赖 | 缓存层、部署环境 |
| 主要相关文件 | `src/const/adminCacheKeys.ts`、`src/features/Admin/adminDangerousActions.ts`、`src/server/services/appSettings/governance.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 用户要求“更新用户缓存/同步到用户设置”。该能力应收敛到维护页并产生日志。 |

### 26. 页面分享与发布页

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 页面分享与发布页 |
| 功能状态 | `active` |
| 功能说明 | 会话分享、页面分享、公开只读页面、发布 Shell 和分享按钮。 |
| 前端入口 | `/share/t/:id`、`/share/page/:id`、页面编辑/查看分享按钮 |
| 核心组件 | `src/routes/share/t/[id]`、`src/routes/share/page/[id]`、`src/business/client/features/PageShare` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/share.ts`、`packages/business-server/src/lambda-routers/pageShare.ts` |
| 数据库依赖 | `agentShare.ts`、`documentShare.ts`、message/topic/page 数据 |
| 配置项依赖 | 站点 URL、品牌配置、分享权限 |
| 环境变量依赖 | `DATABASE_URL`、站点域名 |
| 外部服务依赖 | 无强外部依赖 |
| 主要相关文件 | `src/business/client/features/PageShare/PublishedShell.tsx`、`ReadOnlyPageViewer.tsx`、`ShareButton.tsx` |
| 维护风险 | 中 |
| 是否建议重构 | 否 |
| 是否需要补测试 | 是 |
| 备注 | 分享页受品牌、Auth 和公开访问策略影响，部署后应 smoke。 |

### 27. 任务、异步工作流与 Agent Signal

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 任务、异步工作流与 Agent Signal |
| 功能状态 | `experimental` |
| 功能说明 | Agent 任务、异步执行、心跳、watchdog、QStash 调度、Agent Signal 夜间 Review/反馈/反思等能力。 |
| 前端入口 | `/tasks`、`/task/:taskId`、Agent 任务工作区、聊天中的任务状态 |
| 核心组件 | `src/features/AgentTasks`、`src/routes/(main)/tasks`、`src/routes/(main)/task/[taskId]` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/task.ts`、`taskTemplate.ts`、`agentSignal.ts`、`src/server/workflows-hono/task`、`agent-signal` |
| 数据库依赖 | `task.ts`、`asyncTask.ts`、`agentOperations.ts`、message/topic |
| 配置项依赖 | Agent Gateway、通知配置、模型策略 |
| 环境变量依赖 | `QSTASH_*`、`CRON_SECRET`、`AGENT_GATEWAY_*` |
| 外部服务依赖 | QStash、Agent Gateway、AI 服务商 |
| 主要相关文件 | `packages/builtin-tool-agent-signal`、`src/server/workflows-hono/task/handlers/*` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 异步链路很容易出现“页面切换后任务状态/终端问题”，需要端到端状态恢复测试。 |

### 28. Group Agent 与多智能体编排

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Group Agent 与多智能体编排 |
| 功能状态 | `experimental` |
| 功能说明 | 多 Agent 群组、群组会话、任务广播、子 Agent 执行、群组管理内置工具。 |
| 前端入口 | `/group/:groupId`、`/popup/group/:gid/:tid`、移动端聊天相关入口 |
| 核心组件 | Group routes、`packages/builtin-tool-group-management`、`packages/builtin-tool-group-agent-builder` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/agentGroup.ts`、`sessionGroup.ts`、`aiAgent.execGroup*` |
| 数据库依赖 | `chatGroup.ts`、`agent.ts`、message/session/topic |
| 配置项依赖 | Agent 默认模型、模型策略、工具权限 |
| 环境变量依赖 | AI 服务商 Key、Agent Gateway 变量 |
| 外部服务依赖 | AI 服务商、Agent Runtime |
| 主要相关文件 | `packages/agent-runtime/src/groupOrchestration`、`packages/builtin-tool-group-management` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 与聊天主链路共享大量状态和计费，应重点补 group task 集成测试。 |

### 29. Agent/RAG 评测

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Agent/RAG 评测 |
| 功能状态 | `experimental` |
| 功能说明 | Agent Eval、RAG Eval、数据集导入、测试用例、Benchmark 管理。 |
| 前端入口 | `/eval`、Eval 侧边栏、Benchmark/TestCase modal |
| 核心组件 | `src/routes/(main)/eval`、`DatasetImportModal`、`TestCaseCreateModal`、`BenchmarkEditModal` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/agentEval.ts`、`agentEvalExternal.ts`、`ragEval.ts` |
| 数据库依赖 | `agentEvals.ts`、`ragEvals.ts`、`rag.ts` |
| 配置项依赖 | 模型策略、知识库配置、向量模型 |
| 环境变量依赖 | AI 服务商 Key、Embedding/Reranker 变量 |
| 外部服务依赖 | AI 服务商、RAG/Embedding 服务 |
| 主要相关文件 | `src/routes/(main)/eval/utils.ts`、`apps/server/src/routers/lambda/__tests__/integration/agentEval*` |
| 维护风险 | 中 |
| 是否建议重构 | 否 |
| 是否需要补测试 | 是 |
| 备注 | 属于上游高级能力，和二开商业设置耦合较少，但受模型配置影响。 |

### 30. Devtools 与系统诊断

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Devtools 与系统诊断 |
| 功能状态 | `experimental` |
| 功能说明 | 前端开发/诊断面板、系统配置查看、AI Provider Runtime Config、缓存查看、渲染 Gallery。 |
| 前端入口 | `/devtools`、`/devtools/:identifier` |
| 核心组件 | `src/features/DevPanel`、`SystemInspector`、`CacheViewer`、`RenderGallery` |
| 后端 API / Server Action | 依赖现有 config/router，不是独立业务 API |
| 数据库依赖 | 无直接强依赖 |
| 配置项依赖 | serverConfig、feature flags、AI Provider Runtime Config |
| 环境变量依赖 | 开发环境变量、Debug 变量 |
| 外部服务依赖 | 无强外部依赖 |
| 主要相关文件 | `src/features/DevPanel/SystemInspector/AiProviderRuntimeConfig.tsx`、`src/features/DevPanel/FeatureFlagViewer` |
| 维护风险 | 中 |
| 是否建议重构 | 否 |
| 是否需要补测试 | 是 |
| 备注 | 可以承载后台设置/模型/品牌诊断，但不应混入生产用户流程。 |

### 31. 移动端页面

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 移动端页面 |
| 功能状态 | `active` |
| 功能说明 | 移动端首页、聊天、社区、设置、个人中心、Profile、Provider 设置。 |
| 前端入口 | `src/routes/(mobile)`、`/mobile` 相关 SPA 路由 |
| 核心组件 | `src/routes/(mobile)/(home)`、`chat`、`community`、`me`、`settings` |
| 后端 API / Server Action | 复用 lambda routers；部分 mobile routers 存在空实现 |
| 数据库依赖 | user/session/message/agent/market/commercial |
| 配置项依赖 | 品牌、模型、商业、通知、用户设置 |
| 环境变量依赖 | 与 Web 端一致 |
| 外部服务依赖 | 与 Web 端一致 |
| 主要相关文件 | `src/business/client/BusinessMobileRoutes.tsx`、`packages/business-server/src/mobile-routers/mobileSubscription.ts` |
| 维护风险 | 中 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | `mobileSubscription` 疑似空壳，标记为 deprecated candidate，需要确认移动端商业入口真实可用性。 |

### 32. Popup 快捷聊天

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Popup 快捷聊天 |
| 功能状态 | `active` |
| 功能说明 | 桌面/浏览器弹窗中的 Agent 快聊、群组快聊、置顶按钮和标题栏。 |
| 前端入口 | `src/routes/(popup)/agent/[aid]`、`src/routes/(popup)/group/[gid]/[tid]` |
| 核心组件 | Popup layout、`QuickChatAgentSwitcher.tsx`、`PinOnTopButton.tsx` |
| 后端 API / Server Action | 复用聊天、Agent、Group 相关 lambda routers |
| 数据库依赖 | message/topic/session/agent/chatGroup |
| 配置项依赖 | 默认 Agent、模型策略、桌面设置 |
| 环境变量依赖 | AI 服务商 Key、桌面运行时 |
| 外部服务依赖 | AI 服务商、桌面客户端 |
| 主要相关文件 | `src/spa/entry.popup.tsx`、`src/spa/router/popupRouter.config.tsx` |
| 维护风险 | 中 |
| 是否建议重构 | 否 |
| 是否需要补测试 | 是 |
| 备注 | 路由需要和桌面入口同步测试，避免升级上游时漏注册。 |

### 33. API Key、凭证与 OAuth 设备流

| 字段 | 内容 |
| --- | --- |
| 功能名称 | API Key、凭证与 OAuth 设备流 |
| 功能状态 | `active` |
| 功能说明 | 用户/Workspace API Key、市场凭证、OAuth 设备流、MCP/Connector 凭证、Provider Key 权限。 |
| 前端入口 | `/:workspaceSlug/settings/apikey`、`/settings/creds`、MCP Settings、OAuth Callback 页面 |
| 核心组件 | `src/routes/(main)/settings/creds`、`src/routes/(main)/[workspaceSlug]/settings/apikey`、`src/features/MCP/MCPSettings` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/apiKey.ts`、`oauthDeviceFlow.ts`、`market/creds.ts`、`connector.ts` |
| 数据库依赖 | `apiKey.ts`、`connector.ts`、`oidc.ts`、workspace/user |
| 配置项依赖 | RBAC 权限、Composio/OAuth 配置、Provider Key 策略 |
| 环境变量依赖 | Auth/OIDC、Composio、第三方 OAuth 变量 |
| 外部服务依赖 | OAuth Provider、Composio、外部 API |
| 主要相关文件 | `src/routes/(main)/settings/creds/features/CredItem.tsx`、`src/business/client/hooks/useShowWorkspaceApiKey.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 涉及密钥展示和权限。敏感字段必须保证不会通过公共 config 泄露。 |

### 34. 搜索、网页浏览与每日简报

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 搜索、网页浏览与每日简报 |
| 功能状态 | `experimental` |
| 功能说明 | Web Browsing、搜索工具、每日简报推荐、联网搜索、内置工具渲染。 |
| 前端入口 | 聊天工具调用、首页/Agent Home 推荐、Daily Brief 推荐 |
| 核心组件 | `packages/builtin-tool-web-browsing`、`src/business/client/DailyBriefRecommendations.tsx`、`src/features/AgentHome` |
| 后端 API / Server Action | `apps/server/src/routers/lambda/search.ts`、`webBrowsing.ts`、`brief.ts` |
| 数据库依赖 | message/tool call、user settings、可能的 brief 数据 |
| 配置项依赖 | 模型策略、工具权限、推荐配置 |
| 环境变量依赖 | 搜索服务 Key、联网服务变量需要人工确认 |
| 外部服务依赖 | 搜索引擎/SearXNG/外部 Web API、AI 服务商 |
| 主要相关文件 | `docker-compose/deploy/searxng-settings.yml`、`src/business/client/useDailyBriefRecommendationsUI.ts` |
| 维护风险 | 中 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 搜索能力常和工具、模型、计费混在一起，应在工具权限和计费上建立统一入口。 |

### 35. 导入、导出与数据迁移

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 导入、导出与数据迁移 |
| 功能状态 | `active` |
| 功能说明 | 会话/数据导入导出、文件上传导入、数据库迁移、桌面本地数据迁移。 |
| 前端入口 | 设置中的导入导出入口、资源/文件导入、桌面初始化 |
| 核心组件 | `src/features/DataImporter`、文件上传组件、桌面 migration |
| 后端 API / Server Action | `apps/server/src/routers/lambda/importer.ts`、`exporter.ts`、`upload.ts` |
| 数据库依赖 | message/topic/session/file/user/workspace |
| 配置项依赖 | 存储配置、用户设置、Workspace 配置 |
| 环境变量依赖 | `DATABASE_URL`、对象存储变量 |
| 外部服务依赖 | 对象存储、桌面本地文件系统 |
| 主要相关文件 | `apps/desktop/src/main/core/infrastructure/migration`、`src/features/DataImporter/FileUploading.tsx` |
| 维护风险 | 中 |
| 是否建议重构 | 否 |
| 是否需要补测试 | 是 |
| 备注 | 导入导出和迁移涉及数据完整性，应补失败恢复与版本兼容测试。 |

### 36. Legacy Top-up 入口

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Legacy Top-up 入口 |
| 功能状态 | `deprecated` |
| 功能说明 | 旧充值入口或兼容路由，实际充值/积分包能力已转移到商业 Credits/Topup Packages。 |
| 前端入口 | `/topup`、`/admin/topup` legacy route |
| 核心组件 | `src/features/TopUp`、`src/routes/(main)/topup/index.tsx`、`src/routes/(main)/admin/topup/index.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/topUp.ts` |
| 数据库依赖 | 商业积分表或旧表，需人工确认 |
| 配置项依赖 | `pricing.creditMultiplier`、充值包配置 |
| 环境变量依赖 | 支付变量需要人工确认 |
| 外部服务依赖 | 支付网关需要人工确认 |
| 主要相关文件 | `src/features/TopUp/BalanceDisplay.tsx`、`RedeemForm.tsx`、`TopUpHistory.tsx` |
| 维护风险 | 中 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | deprecated candidate。建议确认是否仍被导航使用，若无使用则迁移到 `/settings/credits`。 |

### 37. 空壳 Workspace 商业 Router

| 字段 | 内容 |
| --- | --- |
| 功能名称 | 空壳 Workspace 商业 Router |
| 功能状态 | `unknown` |
| 功能说明 | `workspaceCredits`、`workspaceUsage`、`workspaceData`、`workspaceCreds`、`workspaceMember` 等工作区商业接口。 |
| 前端入口 | Workspace settings、Workspace billing 页面 |
| 核心组件 | `src/business/client/BusinessSettingPages/Workspace*`、workspace hooks |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/workspaceCredits.ts`、`workspaceUsage.ts`、`workspaceData.ts`、`workspaceCreds.ts`、`workspaceMember.ts` |
| 数据库依赖 | `workspace.ts`、commercial.ts、apiKey.ts |
| 配置项依赖 | Workspace 商业配置，需要人工确认 |
| 环境变量依赖 | `DATABASE_URL`、Auth、对象存储 |
| 外部服务依赖 | 支付/存储服务需要人工确认 |
| 主要相关文件 | `src/business/client/hooks/useActiveWorkspace.ts`、`useWorkspaceMembers.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 部分 router 可能为空或仅为上游预留。应人工确认是否 planned、experimental 或可删除。 |

### 38. Storage Overage 空壳 Router

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Storage Overage 空壳 Router |
| 功能状态 | `deprecated` |
| 功能说明 | 存储超额计费预留接口，当前审计未发现完整用户链路。 |
| 前端入口 | `/settings/storage`、Workspace storage、文件侧栏用量，实际入口需人工确认 |
| 核心组件 | `src/business/client/features/StoragePayAsYouGo`、`FileSidePanel/UsageFooter.tsx` |
| 后端 API / Server Action | `packages/business-server/src/lambda-routers/storageOverage.ts` |
| 数据库依赖 | storage/file/commercial 表，需人工确认 |
| 配置项依赖 | `storage.s3.*`、套餐存储配额 |
| 环境变量依赖 | `S3_*`、`DATABASE_URL` |
| 外部服务依赖 | 对象存储、支付/计费服务 |
| 主要相关文件 | `src/routes/(main)/[workspaceSlug]/settings/storage/index.tsx`、`src/features/WorkspaceSetting/Storage/index.tsx` |
| 维护风险 | 中 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | deprecated candidate。若产品需要存储超额付费，应改为 planned 并补完整 API/DB/账单链路。 |

### 39. Platform Plugin Marketplace

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Platform Plugin Marketplace |
| 功能状态 | `experimental` |
| 功能说明 | 平台控制的商业插件市场，P1 支持 API action 与 content generation 插件，包含后台管理、套餐权限、计费配置、安装、Agent 绑定、运行记录、产物和聊天输入快捷入口。 |
| 前端入口 | `/plugins`、`/plugins/:pluginId`、`/admin/platform-plugins`、聊天输入平台插件 mention 分类 |
| 核心组件 | `src/features/PlatformPluginMarket`、`src/features/Admin/platformPlugins`、`src/features/ChatInput/InputEditor/platformPluginMentions.ts` |
| 后端 API / Server Action | `lambda.platformPlugin`、`admin.platformPlugins` |
| 数据库依赖 | `platform_plugin_*` tables |
| 配置项依赖 | Plugin plan entitlements、plugin billing config、plugin secrets |
| 环境变量依赖 | `PLATFORM_PLUGIN_SECRET_KEY`、既有 AI provider 与对象存储变量 |
| 外部服务依赖 | 既有 AI provider、插件配置的外部 API、对象存储 |
| 主要相关文件 | `packages/types/src/platformPlugin.ts`、`packages/database/src/schemas/platformPlugin.ts`、`packages/business-server/src/platform-plugins`、`apps/server/src/routers/lambda/platformPlugin.ts`、`src/services/platformPlugin.ts` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | P1 明确不导入现有 MCP 或 Skills。聊天快捷入口只导航到显式插件详情/运行面板，不经过旧 Tool Store、MCP settings 或 Skill ActionTag 执行链路。 |
| Seed script | `scripts/seedPlatformPlugins.ts` creates draft samples; admins must publish them before users can see them. |

#### Platform Plugin Marketplace P2-lite Update

- Status: experimental
- Description: Independent platform function plugin marketplace. P2-lite adds operations metadata, admin stats, user filtering, plan availability presentation, and user run history.
- Frontend entries: `/plugins`, `/plugins/:pluginId`, `settings/admin/platform-plugins`
- Core components: `src/features/PlatformPluginMarket/*`, `src/features/Admin/platformPlugins/*`
- Backend API: `admin.platformPlugins.*`, `lambda.platformPlugin.*`
- Database dependencies: `platform_plugins`, `platform_plugin_versions`, `platform_plugin_actions`, `platform_plugin_plan_entitlements`, `platform_plugin_installations`, `platform_plugin_agent_bindings`, `platform_plugin_runs`, `platform_plugin_artifacts`, `platform_plugin_secrets`, `platform_plugin_audit_logs`
- Config dependencies: plugin billing config, plan entitlement config, plugin secret config
- Env dependencies: `PLATFORM_PLUGIN_SECRET_KEY`
- External services: plugin API Action targets and AI providers configured by content generation plugins
- Maintenance risk: high
- Refactor recommendation: split the admin page and run history query further after this phase
- Test recommendation: add real DB integration and browser interaction tests later
- Note: P2-lite does not import MCP / Skills, does not add desktop plugin ability, and does not add new runtime types.

#### Platform Plugin Marketplace P3 Run Experience Update

- Status: experimental
- Description: P3 run experience adds localized detail-page copy, localized restriction explanations, readable run result metadata, and recent-run refresh after successful execution.
- Maintenance risk: medium
- Test recommendation: add browser smoke for install -> bind Agent -> run -> see history once a seeded test database is available.
- Note: This slice is frontend presentation only and does not change plugin permissions, billing calculation, runtime types, MCP / Skills isolation, or database schema.

#### Platform Plugin Marketplace P4 Run History Pagination Update

- Status: experimental
- Description: P4 adds client-side pagination for current-user plugin run history using the existing `listRuns` cursor API.
- Maintenance risk: medium
- Test recommendation: add browser smoke for repeated plugin runs and history load-more once a seeded test database is available.
- Note: This slice does not change plugin run authorization, billing, runtime types, database schema, MCP / Skills isolation, or desktop behavior.

#### Platform Plugin Marketplace P5 Run Error Copy Update

- Status: experimental
- Description: P5 localizes user-facing run failures, failed-run notices, and backend error-code mapping without changing run authorization, billing, runtime execution, persistence, or MCP / Skills isolation.
- Maintenance risk: medium
- Test recommendation: add browser smoke for a configured failing plugin run once a seeded test database is available.
- Note: This slice keeps backend error creation and run history persistence unchanged; it only changes presentation copy.

#### Platform Plugin Marketplace P6 Detail Operation Error Copy Update

- Status: experimental
- Description: P6 localizes install, uninstall, and Agent binding operation failures without changing plugin authorization, entitlement checks, persistence, runtime execution, billing, or MCP / Skills isolation.
- Maintenance risk: medium
- Test recommendation: add browser smoke for install denied, plugin missing, and Agent binding denied states once a seeded test database is available.
- Note: This slice only changes frontend presentation copy for detail-page operation failures.

#### Platform Plugin Marketplace P7 Run History Preview Copy Update

- Status: experimental
- Description: P7 localizes failed run-history sentinel previews while preserving readable runtime previews and existing run-history pagination.
- Maintenance risk: low
- Test recommendation: add browser smoke for failed plugin runs appearing in history once a seeded test database is available.
- Note: This slice only changes frontend run-history presentation and does not change history persistence, billing, authorization, runtime execution, or MCP / Skills isolation.

### 40. Module App Platform

| 字段 | 内容 |
| --- | --- |
| 功能名称 | Module App Platform |
| 功能状态 | `planned` |
| 功能说明 | 规划中的通用模块/应用平台，用于承载普通业务应用、AI 应用、API 应用、简单工作流应用和混合应用。P1 目标是支持个人与团队数据保存、简单团队权限、应用页面、动作、运行记录、产物、套餐权限和计费。 |
| 前端入口 | 规划：`/apps`、`/apps/my`、`/apps/team`、`/apps/:appId`、`/apps/:appId/app`、`/admin/module-apps` |
| 核心组件 | 规划：`src/features/ModuleAppMarket`、`src/features/ModuleAppRuntime`、`src/features/Admin/moduleApps` |
| 后端 API / Server Action | 规划：`lambda.moduleApp`、`admin.moduleApps` |
| 数据库依赖 | 规划：`module_apps`、`module_app_versions`、`module_app_pages`、`module_app_actions`、`module_app_entitlements`、`module_app_installations`、`module_app_records`、`module_app_record_events`、`module_app_runs`、`module_app_artifacts` |
| 配置项依赖 | 应用 manifest、页面 schema、动作 schema、套餐权限、计费配置、应用 secrets、个人/团队 scope |
| 环境变量依赖 | P1 不新增强制环境变量；AI/API action 复用既有 AI provider、对象存储和安全配置变量 |
| 外部服务依赖 | 可选：AI provider、外部 API、对象存储；普通 CRUD 应用不依赖 AI provider |
| 主要相关文件 | 设计文档：`docs/superpowers/specs/2026-07-09-module-app-platform-p1-design.md` |
| 维护风险 | 高 |
| 是否建议重构 | 是 |
| 是否需要补测试 | 是 |
| 备注 | 新域必须与现有 `platform_plugin_*`、MCP、Skills 保持隔离。P1 不执行外部前端 JS、不使用 iframe/remote module、不动态创建每个应用的物理表。 |

## 待人工确认清单

| 项目 | 需要确认的问题 | 建议动作 |
| --- | --- | --- |
| 支付网关 | 当前是否已有真实在线支付、退款、开票接口 | 确认后更新套餐、积分、账单条目的外部服务与环境变量 |
| Workspace 商业化 | Workspace Billing/Credits/Usage 是否面向生产用户开放 | 若未开放，标记为 planned 或 deprecated candidate |
| 移动端订阅 | `mobileSubscription` 是否仍需保留 | 若为空壳，迁移或删除前先标记 deprecated |
| Composio | 后台 API Key 和 auth config 是否已在线上验证 | 补状态诊断和 OAuth 流程测试 |
| 通知渠道 | Email/Push/Desktop 各自是否有真实发送服务 | 后台通知页展示渠道健康状态 |
| 桌面更新 | 后台配置和打包期配置的边界 | 输出“业务连接地址/更新地址/下载地址/OSS 地址”四列说明 |
| 市场数据源 | 社区 Agent/Skill/MCP 是否使用上游实时数据 | 为 404/空白/缺字段加 fallback 和错误上报 |
| 品牌白标 | 哪些 LobeHub/Lobe AI 文案必须保留上游概念 | 形成品牌文案白名单，避免误替换 |

## 下一步治理优先级

| 优先级 | 功能范围 | 目标 |
| --- | --- | --- |
| P0 | 管理后台与设置治理 | 建立单一 app settings schema 和完整性测试，阻止新增设置继续漂移 |
| P1 | AI 服务商、模型目录、价格和 Ledger | 统一 provider/model display resolver、pricing service、重复模型分组和前端展示 |
| P2 | 套餐、积分、账单、用量、推荐 | 收敛商业页面数据边界和 UI 容器，补端到端 smoke |
| P3 | 品牌白标、加载页、favicon、默认助手 | 建立部署后 smoke，确认后台配置在线上真实生效 |
| P4 | 桌面客户端、Composio、通知、记忆 | 增加后台诊断页和缓存刷新/同步反馈 |
| P5 | 社区、Skill、MCP、Workspace 预留功能 | 清理空壳、deprecated candidate 和市场数据 fallback |

## Governance Execution Notes

| Date | Scope | Status | Note |
| --- | --- | --- | --- |
| 2026-07-07 | Admin System And Settings Governance | active | GOV-001 added guardrail coverage for app setting form classification, registry metadata completeness, and public desktop config sensitive-field leakage. |
| 2026-07-07 | Credits, Top-up And Ledger | active | GOV-002 added ledger provider/model display formatting that prefers metadata display names and avoids exposing raw provider UUIDs in user credit ledger rows. |
| 2026-07-07 | Skills, MCP And Community Market | active | GOV-003 added frontend and server fallback normalization for placeholder `UN` labels and blank market descriptions. |
| 2026-07-07 | Governance Sprint 002 | active | GOV-004 to GOV-015 added the Sprint 002 register, admin settings map, commercial page boundaries, deployment probe checklist, governance index, secret-like settings guard, desktop public config allowlist guard, commercial formatter coverage, top-up serializer cleanup, and referral input formatter extraction. |
| 2026-07-07 | Governance Sprint 003 | active | GOV-016 to GOV-025 added model catalog display resolvers, cross-provider duplicate model diagnostics, credit ledger allocation formatter extraction, model catalog display rules, and governance/changelog updates. |
| 2026-07-07 | Runtime Brand Cache Refresh | active | GOV-026 added brand cache invalidation to the admin runtime cache refresh path for loading SVG, favicon, and runtime brand config. |
| 2026-07-07 | Deployment Version Probe | active | GOV-027 extended `/api/version` with safe commit, branch, build timestamp, and image metadata for post-deploy verification. |
| 2026-07-07 | User Default Settings Sync Priority | active | GOV-028 documents and tests the priority rule for backend defaults, user-customized default assistant meta, and explicit admin force-sync snapshots. |
| 2026-07-07 | Admin Credit Adjustment Audit | active | GOV-029 adds before/after credit account snapshots to the `credits.adjust` audit payload for manual admin credit changes. |
| 2026-07-07 | Admin Plan Catalog Audit | active | GOV-030 adds before/after plan catalog snapshots to admin plan update/delete audit payloads while preserving existing audit fields. |
| 2026-07-07 | Admin Plan Minor Mutation Audit | active | GOV-031 adds before/after plan catalog snapshots to `plan.setActive` and `plan.setModelRules` audit payloads. |
| 2026-07-07 | Admin Settings Cache Sync Audit | active | GOV-032 adds structured operation, status, scope, and cache-domain result metadata to admin settings cache refresh and user-default sync audit payloads. |
| 2026-07-07 | Model Pricing Margin Foundation | active | GOV-033 adds a pure business pricing margin transform for model-bank pricing objects, covering fixed, tiered, lookup, and approximate media price fields without mutating source pricing or changing billing transactions. |
| 2026-07-07 | Server Model Pricing Snapshot | active | GOV-034 adds a server-side model pricing snapshot helper that records whether pricing comes from admin/database metadata, static model-bank data, or is missing while keeping existing billing pricing output unchanged. |
| 2026-07-07 | Admin Model Billing Matrix Pricing Source | active | GOV-035 surfaces manual override, database/admin pricing, model-bank pricing, and missing pricing sources in the admin model billing matrix without changing billing transactions. |
| 2026-07-07 | Admin Enabled Model Pricing Source API | active | GOV-036 adds backend `pricingSource` metadata to enabled AI provider model rows so the admin billing matrix no longer relies only on frontend inference. |
| 2026-07-07 | Admin Enabled Model Pricing Source API | active | GOV-037 adds exact static model-bank pricing source detection for safe provider mappings while preserving DB priority and leaving generic compatible gateways as missing. |
