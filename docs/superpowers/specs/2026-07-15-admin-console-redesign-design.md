# 后台管理控制台重规划设计

日期：2026-07-15

状态：已确认方案，等待规格文档审查

范围：ComHub 后台管理控制台、后台设置、管理权限、后台服务封装和模块应用管理

## 1. 目标与边界

### 1.1 目标

本设计解决后台功能持续增长后出现的入口重复、业务归属不清、设置漂移、权限过宽和页面难维护问题。目标不是一次性重写所有页面，而是建立可以持续扩展的后台治理底座，并在保持现有行为的前提下逐步迁移。

完成后应满足：

1. 菜单、前端路由注册和功能状态来自同一份后台目录元数据；前后端通过共享 capability ID 和权限矩阵测试保持一致。
2. `/settings/admin` 是唯一主入口；旧链接可兼容，但不再形成第二套页面实现。
3. 设置键具备类型、默认值、敏感性、缓存域、运行时消费者和维护归属，新增设置可以被完整性测试拦截。
4. 读权限和写权限分离，菜单访问与具体操作使用同一份能力契约。
5. 用户、商业化、AI、模块应用、内容运营和系统运维之间有清晰边界。
6. 管理工作台能显示关键运行状态和配置来源，而不只是业务统计。
7. 模块应用支付宝电脑网站支付与平台套餐/充值支付明确分域，避免在后台和数据模型中混淆。

### 1.2 不在第一阶段做的事

- 不一次性重写后台视觉设计或替换全部组件库。
- 不直接删除旧路由、旧 service facade 或数据库字段。
- 不在本设计阶段实现平台套餐/充值的支付宝支付。当前平台支付 Router 仍是未实现状态；模块应用支付宝链路另行治理。
- 不改变聊天、模型调用、计费事务和模块应用运行时的业务结果。第一阶段优先做适配层、权限、诊断和测试。
- 不把所有设置自动生成成表单。schema 先作为治理和校验来源，表单按域逐步迁移。

## 2. 当前功能盘点

### 2.1 当前规模

| 层 | 当前形态 | 主要问题 |
| --- | --- | --- |
| 前台菜单 | 8 个分组、约 30 个入口 | 分组按历史演进堆叠，商业化、模型和系统设置边界交叉 |
| 路由 | `adminSettingsRouteRegistry` 注册约 29 项，包含 3 个兼容入口 | registry、导航、route config 和遗留页面各自维护事实 |
| 后端 | 14 组 Admin Router | 读写能力混用，设置和模块应用 Router 过大 |
| 设置 | `APP_SETTING_KEYS` 167 个键 | registry、表单、Router、runtime、缓存和 locale 需要人工同步 |
| 前端 service | `adminCommercial.ts` 约 696 行 | 用户、财务、模型、设置、模块应用和审计跨域聚合 |
| 页面 | 多个路由包含 260–675 行业务逻辑；模块应用页约 1,227 行 | 路由不够薄，数据请求、状态、表格、编辑器和权限混在一起 |
| 设置 Router | `admin/settings.ts` 约 2,397 行 | 单一文件承载读取、规范化、敏感字段、缓存、公开配置和维护动作 |

### 2.2 功能状态矩阵

状态含义：`active` 表示有完整使用路径；`experimental` 表示依赖外部服务或开关；`compatibility` 表示仅保留历史入口；`diagnostic-gap` 表示功能存在但缺少可读诊断。

| 业务域 | 当前入口 | 当前后端 | 状态 | 主要缺口 |
| --- | --- | --- | --- | --- |
| 工作台 | `/settings/admin` | `admin.stats`、`admin.subscriptions`、`admin.settings` | active | 只有统计和待处理项，缺模型、支付、缓存、部署健康状态 |
| 用户与支持 | `/settings/admin/users` | `admin.users`、`admin.credits`、`admin.subscriptions` | active | 用户页面约 675 行；列表/详情/导出使用写权限；资产操作审计需统一 |
| 套餐与订阅 | `/plans`、`/subscriptions` | `admin.plans`、`admin.subscriptions` | active | 套餐目录、用户订阅和变更请求职责需要显式分层 |
| 订单、充值与积分 | `/orders`、`/credits`、`/redemption` | `admin.orders`、`admin.topupPackages`、`admin.credits`、`admin.redemption` | active | 平台订单和模块应用订单容易被同名“支付”混淆；财务统计口径需要固定 |
| 平台支付 | 用户套餐/充值流程 | `lambda-routers/payment.ts` | incomplete | 当前返回 `PAYMENT_GATEWAY_NOT_CONFIGURED`，不应在后台显示为已完成支付能力 |
| AI 服务商与模型 | `/providers`、`/model-billing-matrix` | `admin.newapiProviders`、模型目录和 runtime service | active/high-risk | model-bank、数据库模型、运行时模型和后台模型的 ID、能力、价格来源不统一 |
| 模型策略与默认值 | `/model-policy`、`/system-defaults` | `admin.settings`、`admin.plans` | active/high-risk | 默认模型、套餐规则和策略规则存在多个来源；缺少当前生效快照 |
| PPT/生成服务 | `/ppt` | `admin.ppt`、Docmee service | experimental | 配置读取和运行时状态缺少统一诊断；与模型/计费域边界不够清晰 |
| 模块应用目录与编辑 | `/module-apps` 的多个 tab | `admin.moduleApps`、`moduleApps.readModels` | active/large | 目录、页面、Action、审核、商业化和运行数据集中在一个页面 |
| 模块应用支付 | 模块应用购买流程 | Module App commerce、Alipay adapter、webhook | experimental/guarded | 支付创建、异步通知、退款、对账和 payout 已存在，但全部依赖环境开关，后台缺少统一状态视图 |
| 内容治理 | `/topics`、`/files`、`/documents` | `admin.content` | active | 列表读取也使用 `contentWrite`，删除和归档的审计/批量策略不统一 |
| 运营与增长 | `/recommendations`、`/expert-plaza`、`/growth`、`/notifications` | `admin.settings`、`admin.referral` | active/experimental | 运营配置、增长配置和通知配置散落在不同设置域，失败状态不可见 |
| 品牌与站点设置 | `/settings` | `admin.settings` | active/high-risk | 表单字段和 Router 手工同步，品牌缓存和公共 runtime 可能滞后 |
| 客户端与发布 | `/desktop-update` | `admin.settings`、桌面发布 API、CI | experimental/high-risk | 打包期业务地址、下载地址、更新 manifest 和 OSS 地址不是同一层 |
| 文件存储 | `/file-storage` | `admin.settings`、S3 runtime | active/high-risk | 环境变量 fallback、数据库设置和缓存状态缺少来源标识 |
| 通知、记忆、Composio | 分散在 `/notifications`、`/system-defaults` 和用户设置 | 各自 runtime/service | experimental/diagnostic-gap | API key、模型、OAuth、推送和任务失败没有统一后台诊断 |
| 审计与维护 | `/audit`、`/maintenance` | `admin.audit`、`admin.settings` | active/high-risk | 审计覆盖和危险操作 before/after 快照不完整；维护动作需更细权限 |

### 2.3 当前入口结论

当前 desktop route config 将 `BusinessDesktopRoutesWithSettingsLayout` 挂载在 settings 树的 `admin` 子路由，因此实际主链路是 `/settings/admin/*`。`/admin/*` 主要被导航规范化函数和测试用于兼容语义，不能把文档中旧的“`/admin` 主入口”直接当成删除依据。

现阶段保留以下兼容策略：

- `ADMIN_BASE_PATH` 固定为 `/settings/admin`。
- `/admin/*` 统一规范化到 `/settings/admin/*`；如果运行时存在直接访问路由，则返回一次性 redirect，不渲染第二套 layout。
- `pricing`、`topup`、`change-requests` 保留兼容页面，但只显示迁移说明并指向合并后的主页面。
- 只有在 route registry、深链 smoke、日志和文档均确认无依赖后，才删除兼容文件。

## 3. 目标信息架构

第一阶段改变菜单归属和页面标题，不强制改变已有叶子 URL。新 URL 需要时通过别名迁移，避免书签和外部链接失效。

### 3.1 一级菜单

| 一级分组 | 入口 | 责任边界 |
| --- | --- | --- |
| 工作台 | 概览、待处理、健康诊断、版本信息 | 只读总览和跨域异常，不承载业务编辑 |
| 用户与权限 | 用户、支持操作、角色/能力、用户审计 | 用户身份、角色、支持动作和访问控制 |
| 商业化 | 套餐与权益、订阅、订单与支付、积分与流水、兑换码、推荐奖励、商业统计 | 平台用户权益和平台财务；不包含模块应用 payout |
| AI 平台 | 服务商、模型目录、价格与计费、模型策略、默认模型、生成服务 | Provider/Model 可用性、能力、价格、套餐限制和生成服务配置 |
| 模块应用 | 应用目录、版本与审核、页面与 Action、套餐权益、订单与支付宝、收入与提现、运行与数据、审计 | 模块应用生命周期和独立商业链路 |
| 内容与运营 | 话题、文件、文档、推荐运营、专家广场、通知、注册与增长 | 公共内容和运营活动，不负责平台核心财务 |
| 客户端与集成 | 桌面登录/下载/更新、文件存储、Composio/连接器、外部服务状态 | 客户端发布和外部集成配置/诊断 |
| 系统与安全 | 站点与品牌、系统默认值、缓存与维护、审计日志 | 全局运行配置、安全操作、缓存刷新和运维 |

### 3.2 入口归属表

| 当前入口 | 目标分组 | 目标显示名称/说明 | 迁移策略 |
| --- | --- | --- | --- |
| `overview` | 工作台 | 工作台概览 | 保留路径 |
| `users` | 用户与权限 | 用户管理 | 页面拆分，保留路径 |
| `subscriptions` | 商业化 | 订阅管理 | 保留路径，明确“用户权益周期” |
| `plans` | 商业化 | 套餐与权益 | 保留路径 |
| `orders` | 商业化 | 平台订单与充值 | 保留路径，充值包作为内部 tab |
| `credits` | 商业化 | 积分账户与流水 | 保留路径 |
| `redemption` | 商业化 | 兑换码 | 保留路径 |
| `stats` | 商业化 | 商业统计 | 保留路径，未来补充非财务运营指标到工作台 |
| `growth` | 内容与运营 | 注册与增长 | 保留路径，推荐奖励的财务结果仍归商业化统计 |
| `providers` | AI 平台 | 服务商与实例 | 保留路径 |
| `model-billing-matrix` | AI 平台 | 模型目录与计费 | 保留路径；逐步从矩阵视图迁移到 Catalog view |
| `pricing` | AI 平台 | 旧计费兼容入口 | 只保留迁移提示 |
| `model-policy` | AI 平台 | 模型访问策略 | 保留路径 |
| `system-defaults` | AI 平台/系统与安全 | 默认模型与运行默认值 | 先保留路径，内部按 AI 默认、记忆/向量、用户默认分节 |
| `ppt` | AI 平台 | 生成服务 | 保留路径，显示 Docmee 配置诊断 |
| `module-apps` | 模块应用 | 模块应用中心 | 保留外层路径，内部 tab 逐步拆成子路由 |
| `topics`、`files`、`documents` | 内容与运营 | 内容治理 | 保留路径 |
| `recommendations`、`expert-plaza` | 内容与运营 | 推荐运营、专家广场 | 保留路径 |
| `notifications` | 内容与运营/客户端与集成 | 通知中心 | 设置和发送诊断分离 |
| `desktop-update` | 客户端与集成 | 桌面客户端 | 保留路径，区分打包期和运行时配置 |
| `file-storage` | 客户端与集成 | 文件存储 | 保留路径，增加来源和连接诊断 |
| `settings` | 系统与安全 | 站点与品牌 | 页面拆成多个 feature section，不再继续扩展单体表单 |
| `maintenance` | 系统与安全 | 缓存与维护 | 保留路径，危险动作单独能力 |
| `audit` | 系统与安全 | 审计日志 | 保留路径；用户/模块应用详情可带过滤链接 |
| `topup` | 商业化 | 充值包兼容入口 | 迁移提示到 `orders` |
| `change-requests` | 商业化 | 套餐变更兼容入口 | 迁移提示到 `subscriptions` |

### 3.3 模块应用二级导航

当前一个页面包含约 15 个 tab。目标保留同一业务入口，但将 tab 变成可独立加载和测试的域页面：

1. 应用目录：应用列表、详情、发布状态。
2. 版本与审核：package、扫描、构建、审核和发布。
3. 编辑器：Pages、Actions、Entitlements、Billing、Products。
4. 订单与支付宝：Commerce、Payments、退款、支付对账。
5. Publisher 财务：Publishers、Revenue、Payouts、人工支付宝 payout。
6. 运行与数据：Installs、Records、Runs、Artifacts。
7. 审计与诊断：Audit、状态转换、失败原因和配置开关。

各子页共享 `selectedAppId` 和分页状态，但不得再共享一个 1,000 行以上的组件状态机。支付和 payout 的写操作继续使用财务写能力，应用编辑和审核使用模块应用写能力。

## 4. 技术架构

### 4.1 后台目录元数据

建立纯元数据目录，作为菜单、前端路由检查、权限矩阵和功能文档的事实来源。前端 lazy import 不放入共享类型包，避免服务端依赖 React；服务端只依赖共享的 capability ID 和权限类型。

```ts
type AdminFeatureStatus =
  | 'active'
  | 'compatibility'
  | 'deprecated'
  | 'experimental'
  | 'planned';

type AdminCatalogItem = {
  id: string;
  path: string;
  group: AdminNavGroupKey;
  labelKey: string;
  descriptionKey: string;
  icon: AdminNavIcon;
  status: AdminFeatureStatus;
  readCapability: AdminCapability;
  writeCapabilities?: AdminCapability[];
  owner: string;
  legacyPaths?: string[];
  backendDomains: string[];
  settingKeys?: string[];
};
```

实现方式：

- `adminCatalog.ts` 保存上述纯元数据。
- `adminNavigation.ts` 从 catalog 派生分组、选中项、别名和角色过滤结果。
- `adminSettingsRouteRegistry.ts` 从 catalog 的 active/experimental 项生成路由段，并保留显式 lazy import 映射。
- `BusinessDesktopRoutes.tsx` 只挂载一个 settings admin route。
- 测试验证每个可见菜单项都有 route、每个 route 都有 capability，且后端 procedure 的 capability 与 catalog 矩阵一致；兼容项不会进入主菜单。
- `status` 用于菜单徽标、文档和迁移策略；`planned` 不进入生产菜单。

### 4.2 路由和页面边界

路由文件只负责导入 feature 页面、必要的 route-level error boundary 和参数组合。业务逻辑迁移到 `src/features/Admin` 的领域目录：

```text
src/features/Admin/
  catalog/
  users/
  commercial/
  ai/
  moduleApps/
  content/
  operations/
  system/
  shared/
```

迁移优先级：

1. 用户、套餐、兑换码、审计四个高风险大路由。
2. 统计和积分页面中的 query/view model。
3. 服务商、系统默认、模型计费矩阵中的表单和数据适配层。
4. 模块应用页面按二级导航拆分。

每个领域页面采用以下边界：

- `page.tsx`：页面壳和布局。
- `useXxxQuery.ts` / `useXxxMutation.ts`：数据访问和缓存失效。
- `xxxViewModel.ts`：纯数据转换和展示契约。
- `components/`：表格、编辑器、抽屉和动作组件。
- `policy.ts`：按钮级能力和危险操作策略。
- `types.ts`：领域输入输出类型。

### 4.3 Admin service 分域

保留现有 `adminCommercialService` 作为兼容 facade，内部委托以下域 service：

```text
src/services/admin/
  users.ts
  commercial.ts
  ai.ts
  moduleApps.ts
  content.ts
  settings.ts
  operations.ts
  index.ts
```

新代码只能依赖对应域 service；旧调用方在迁移完成前继续通过 facade。每个 service 明确标注 query、mutation、缓存键和错误转换，不改变 tRPC procedure 名称。

后端同样保持 `adminRouter` 的外部结构，先把内部实现拆为：

- settings：schema/normalizers、read、commands、diagnostics。
- moduleApps：read models、commands、payment/revenue policy。
- users/commercial：查询 view model 和资产变更 command 分离。

### 4.4 权限契约

在现有能力基础上拆分读写，目标能力为：

```text
admin.access
audit.read
content.read / content.write
finance.read / finance.write
modelOps.read / modelOps.write
moduleApp.read / moduleApp.write
support.read / support.write
system.read / system.write
user.read / user.write
```

规则：

- 页面访问使用 `readCapability`。
- 按钮和 mutation 使用对应的 `writeCapability`。
- 外部副作用操作（测试连接、刷新 runtime、发送通知、退款、payout）不能因为是 query 就自动获得读权限，必须按副作用归类。
- `admin` 保持全能力；其他角色只增加其业务域读写和 `audit.read`。
- 角色默认能力、前端菜单、后端 procedure 三者必须由权限矩阵测试覆盖。

迁移中的具体边界：

| 当前问题 | 目标 |
| --- | --- |
| `admin/content.ts` 列表使用 `contentWrite` | 列表使用 `content.read`，归档/删除使用 `content.write` |
| `newapiProviders` 所有 procedure 使用 `modelOpsWrite` | 列表/目录/诊断使用 `modelOps.read`；写实例、同步、刷新和测试连接使用 `modelOps.write` |
| `users` detail/list/export 使用 `userWrite` | 查询使用 `user.read`；封禁、支持动作和资产变更按 `user.write`/`support.write`/`finance.write` 分开 |
| `settings` 的 read 等同于 `systemWrite` | 读取、诊断和校验使用 `system.read`；保存、缓存刷新和维护使用 `system.write` |
| `moduleApps` 读写混在 content/finance/audit | 读取使用 `moduleApp.read`；编辑/审核使用 `moduleApp.write`；支付和 payout 继续使用 `finance.write`；导出审计使用 `audit.read` |

### 4.5 设置 Schema-first

将现有 registry 扩展为设置描述层。核心字段：

```ts
type AppSettingSchema<T> = {
  key: AppSettingKey;
  domain: AppSettingDomain;
  valueType: 'boolean' | 'number' | 'string' | 'url' | 'json' | 'secret' | 'model-ref';
  defaultValue: T | (() => T);
  sensitive: boolean;
  publicRuntime: boolean;
  cacheScopes: Array<'app-settings' | 'brand' | 'runtime' | 's3' | 'user-state'>;
  ownerPage: string;
  runtimeConsumers: string[];
  readCapability: AdminCapability;
  writeCapability: AdminCapability;
  normalize: (value: unknown) => T;
  validate: (value: T) => void;
  redact?: (value: T) => unknown;
};
```

治理规则：

1. 所有 `APP_SETTING_KEYS` 必须有 schema；schema 不得把 `sensitive` 和 `publicRuntime` 同时设为 true。
2. 所有后台表单字段必须引用已注册 key；表单更新不能发送未知 key。
3. 所有 runtime consumer 必须声明缓存域；保存后返回实际失效的 cache scopes。
4. secret 只返回 configured/masked 状态，不回显明文，也不得进入 public runtime。
5. `normalizeAppSettingUpdate` 拆为按 valueType 和 domain 的小函数；保留现有错误码和审计行为。
6. unknown setting 只能通过显式迁移/清理流程处理，不能被普通批量保存静默删除。

第一阶段不强制 schema 自动生成 UI；`AdminSettingsPage` 继续手写布局，但初值、更新 payload、校验和 governance API 逐步改为 schema 驱动。

### 4.6 统一模型与价格视图

新增只读适配层 `ModelCatalogView`，至少输出：

```ts
type ModelCatalogView = {
  providerId: string;
  providerName: string;
  providerType: string;
  modelId: string;
  displayName: string;
  type: string;
  abilities: Record<string, boolean>;
  pricing?: {
    input?: number;
    output?: number;
    unit: string;
    source: 'official' | 'database' | 'admin-override' | 'missing';
  };
  enabled: boolean;
  visible: boolean;
  restricted: boolean;
};
```

模型 ID 的展示和唯一键必须同时包含 provider 维度；用户端按 `modelId` 分组时，provider 是子项，后台管理始终显示完整 provider/model 组合。

价格治理分为四层：官方来源、数据库/后台覆盖价、利润倍率、实际扣费快照。扣费事务继续使用现有模型，先统一只读快照和 Ledger formatter，再迁移调用方。

### 4.7 商业化数据边界

| 页面/域 | 只负责 | 不负责 |
| --- | --- | --- |
| 套餐与权益 | 套餐目录、价格展示、权益和模型规则 | 支付成功判定、退款和真实收款 |
| 订阅 | 用户订阅周期、变更请求、人工变更 | 通用充值订单和模块应用订单 |
| 平台订单与充值 | 平台套餐/充值订单状态、支付记录、兑换码关联 | 模块应用 Publisher payout |
| 积分与流水 | 余额、授信、消费和调账流水 | 套餐目录编辑 |
| 商业统计 | 统一口径的用户、订阅、平台订单和收入指标 | 原始资产变更 |
| 模块应用商业化 | 模块应用订单、支付宝支付、退款、收入分成和 payout | 平台套餐/充值账户 |

平台通用支付仍是待实现能力，后台必须显示“未配置/未启用”而不是伪装为可用。模块应用支付宝电脑网站支付保留现有环境变量和服务端签名边界，后台新增只读配置状态、回调状态、最近失败和对账异常，不把商户私钥写入 `appSettings`。

## 5. 诊断与可观测性

工作台和各域页面增加只读诊断卡，第一阶段不改变业务执行：

| 诊断项 | 必须显示 |
| --- | --- |
| 版本 | 当前 commit SHA、镜像 digest、构建时间和 SPA asset 标识 |
| 模型 | 当前有效 provider/model、来源、启用状态、能力/价格缺失项 |
| 计费 | 当前倍率、价格覆盖来源、Ledger formatter 版本、平台支付是否实现 |
| 模块应用支付 | Alipay enabled、payment creation flag、auto settlement flag、回调 URL 是否配置、最近对账异常 |
| 设置 | unknown key、敏感项 configured 状态、缓存域和最近刷新结果 |
| S3 | 配置来源、连接测试结果、公共域和签名 URL 状态 |
| 通知 | inbox/push/email 开关、最近发送失败和 retention 状态 |
| 记忆/向量 | gatekeeper、extractor、persona、embedding、reranker 的 provider/model 和可用性 |
| Composio | API key configured、auth config 数量、OAuth/缓存状态和最近错误 |
| 桌面端 | 业务地址、下载地址、更新 manifest、OSS 发布状态，并标注打包期/运行时来源 |

所有诊断接口使用 read capability；敏感配置只返回布尔、掩码和错误分类。

## 6. 分阶段实施路线

### Phase 0：基线与契约

- 建立菜单/路由/页面/service/router/capability/setting/runtime/test 功能矩阵。
- 为当前 route registry、双 router config 和兼容别名补契约测试。
- 记录所有 active、experimental、compatibility 项，不删除代码。

验收：每个当前菜单入口都能定位到页面、后端域和权限；每个兼容入口都有目标路径。

### Phase 1：后台治理底座（本次实现计划的起点）

- 引入 Admin catalog，导航和 route registry 从 catalog 派生。
- 固定 `/settings/admin` 主入口，补兼容 redirect/alias 测试。
- 拆分读写 capability，并更新前端菜单和后端 procedure。
- 增加权限矩阵测试，覆盖角色、页面、procedure 和危险操作。

验收：新增一个后台页面只需增加一项 catalog、一个 page import 和对应测试；读角色无法调用写 procedure。

### Phase 2：设置治理

- 扩展设置 schema 元数据。
- 拆分 normalize/validate/redact/cache invalidation。
- 将站点设置、默认模型、存储、桌面配置按 ownerPage 迁移。
- 完善 unknown key、敏感字段和 public runtime 测试。

验收：新增设置键缺少 schema、表单映射、缓存域或敏感性时 CI 失败；secret 不出现在公开响应。

### Phase 3：领域 service 和薄路由

- 新增按域 admin service，旧 facade 委托到新 service。
- 将用户、套餐、兑换码、审计、统计路由迁移到 feature domain。
- 抽 query/mutation hooks、view model 和 action policy。

验收：路由文件只做导入/组合；旧 facade 调用契约测试保持通过。

### Phase 4：商业化与 AI 数据契约

- 建立商业页面 ViewModel 和统一 formatter。
- 引入 ModelCatalogView、PricingSnapshot 和 Ledger model reference formatter。
- 明确平台支付未实现状态和模块应用支付状态。

验收：重复模型按 provider 显示；缺失价格/能力有明确状态；积分流水不显示 UUID/内部 ID 作为最终文案。

### Phase 5：模块应用后台拆分

- 将模块应用 tab 拆成可独立加载的页面和 hooks。
- 分离目录、审核、编辑、商业化、支付对账、Publisher payout、运行数据和审计。
- 保持 `/settings/admin/module-apps` 外层入口和旧 API 名称兼容。

验收：每个二级域可单独测试和授权；支付宝退款、对账和 payout 不影响平台订单域。

### Phase 6：诊断与体验

- 增加工作台健康诊断和各域诊断卡。
- 统一加载、空状态、错误反馈、危险操作确认和表单分组。
- 在有运行数据和兼容日志后，评估删除 legacy 页面。

验收：管理员能从工作台定位配置来源、缓存状态、部署版本和外部服务失败原因。

## 7. 测试与审查策略

### 7.1 必须新增或更新的测试

- `adminCatalog`：唯一 ID、路径、分组、状态和 owner。
- `BusinessDesktopRoutes`：catalog 与 route registry 一致，两个 desktop router 一致。
- `adminNavigation`：角色过滤、别名归一化、兼容入口不进入主菜单。
- 权限矩阵：每个角色的 read/write capability 和 procedure 访问结果。
- 设置 schema：167 个现有 key 全覆盖、secret/public 互斥、cache scope 完整、表单 key 合法。
- settings router：读写分离、脱敏、unknown key 和缓存刷新结果。
- service facade：旧方法委托到新域 service，返回类型和错误行为不变。
- ModelCatalog/Pricing/Ledger：重复模型、缺失价格、覆盖价、倍率和 provider display name。
- Module App：支付 feature flag、异步通知、退款、对账和 payout capability 边界。
- route smoke：管理员、finance_admin、model_ops、content_admin、support_admin、system_admin 的可达页面和 redirect。

### 7.2 验证命令

优先运行受影响的 Vitest 文件：

```powershell
pnpm exec vitest run --silent='passed-only' src/features/Admin/adminNavigation.test.ts
pnpm exec vitest run --silent='passed-only' src/business/client/BusinessDesktopRoutes.test.ts
pnpm exec vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts
pnpm exec vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts
pnpm run type-check
```

实际执行时按改动文件补充测试，不默认运行完整 `bun run test`。

### 7.3 审查重点

每个阶段完成后审查：

1. 是否误把兼容路由删除或改变深链行为。
2. 是否把 read procedure 留在 write capability 下。
3. 是否有 secret、内部 provider ID、支付签名或错误堆栈进入前端响应。
4. 是否改变计费事务、订单状态转换或模块应用支付幂等性。
5. 是否出现页面、service、router 三处重复实现。
6. 是否补充了对应测试和回滚说明。

## 8. 发布、回滚与提交边界

- 每个 Phase 拆成可独立回滚的提交；不混入无关 UI 或上游同步。
- 第一阶段不做数据库迁移，优先使用 metadata、adapter 和兼容 redirect。
- 生产发布继续使用现有 GitHub Actions + GHCR + Baota blue-green 方案；后台诊断记录 SHA 和 image digest。
- 删除 legacy 前至少满足：route registry 无引用、访问日志无命中、兼容测试覆盖、文档已更新，并保留一个版本周期的回滚路径。
- 涉及支付、计费、权限和敏感设置的提交必须附带测试结果和未测试项说明。

## 9. 设计结论

后台下一阶段的核心不是继续增加菜单，而是让每个功能只有一个归属、一个读写权限契约、一个设置来源和一个可观测状态。推荐先完成 catalog、权限和设置治理底座，再迁移商业化、AI 和模块应用页面。这样可以保持当前上线功能和历史链接，同时为后续支付宝平台支付、模块应用独立运营和上游同步留下清晰边界。
