# 后台模块中心与分层导航设计

日期：2026-07-23

状态：用户已确认设计方向，等待规格文档审阅

范围：ComHub 后台信息架构、模块应用管理路由、权限导航和页面拆分

## 1. 决策摘要

本设计采用“一级业务域导航 + 域内二级导航 + 资源详情路由”的后台结构，先以模块应用管理作为第一批完整落地对象。

已确认的关键决策：

1. 后台根入口继续使用 `/settings/admin`。
2. 当前模块应用单页被新的模块中心路由树替代。
3. 新模块中心的规范路径为 `/settings/admin/modules`。
4. 不保留 `/settings/admin/module-apps`、旧 tab 参数或旧模块子路径。
5. 不增加 redirect、alias、兼容页面或双写逻辑；旧模块管理链接直接失效。
6. 当前 tRPC procedure、数据库结构和 `moduleApps` 领域命名继续复用，URL 重命名不触发后端协议迁移。
7. 本次只删除模块应用管理域的旧 URL；其他后台兼容路由不在本设计的删除范围内。

本设计对 `2026-07-15-admin-console-redesign-design.md` 中“模块应用保留旧 URL 并逐步迁移”的内容形成定向替代。其余后台领域边界和权限治理原则继续有效。

## 2. 当前问题

### 2.1 信息架构不一致

后台已经具备工作台、用户与权限、商业化、AI 平台、模块应用、内容与运营、客户端与集成、系统与安全八个一级业务域，但叶子页面的颗粒度并不一致。

模块应用在一级导航中只有一个入口，进入后却同时承载：

- 应用目录和发布状态；
- package 扫描、构建和审核；
- Pages、Actions、Entitlements 和 Billing 配置；
- 商品、收入、支付、退款和 payout；
- Publishers；
- Installs、Records、Runs 和 Artifacts；
- 审计事件。

这不是一个页面的职责，而是目录治理、开发者治理、财务、运行监控和审计五类管理工作流。

### 2.2 页面状态过度集中

`src/features/Admin/moduleApps/index.tsx` 超过 1,200 行，并在同一个组件中维护多组筛选器、游标、选中应用、编辑器状态、SWR key、mutation 和表格列。

当前页面包含 16 个 tab。应用选择使用局部 `selectedAppId`，tab 也不是路由状态，因此存在以下问题：

- 页面刷新后无法恢复原工作位置；
- 无法分享应用或具体管理视图的链接；
- 浏览器前进和后退不能表达管理上下文；
- 隐藏视图的数据 hook 仍在同一个页面生命周期内建立；
- 任何一处改动都可能影响整个页面状态机；
- 财务和应用治理只能通过顶层角色分支切换，不能按具体页面表达权限。

### 2.3 路由权限粒度不足

现有导航权限主要匹配一级页面路径。模块应用入口允许 `moduleApp.read` 或 `finance.read` 访问，再由 `AdminPage.tsx` 在“governance”和“finance”两个页面之间切换。

拆分后必须先匹配最具体的子路由，再判断其能力要求。否则 finance admin 可能进入应用治理 URL，或模块治理人员看到支付和 payout 入口。后端 procedure 继续作为最终授权边界，前端路由权限负责避免错误入口、空页面和无意义的失败请求。

## 3. 目标与非目标

### 3.1 目标

1. 常用模块管理任务最多经过一级业务域和一个二级入口即可到达。
2. 每个页面只承载一种主要工作流，并只请求该工作流所需数据。
3. 应用、筛选、分页和详情视图由 URL 表达。
4. finance admin、模块治理人员和审计访问者只看到其能力允许的入口。
5. 路由文件保持轻量，业务逻辑进入 `src/features/Admin/moduleApps`。
6. 删除单体页面后，任何模块中心业务组件原则上不超过约 800 行。
7. 后续内容运营、商业化和系统设置可以复用同一套二级导航与权限目录结构。

### 3.2 非目标

- 不修改模块应用数据库 schema。
- 不重命名 `admin.moduleApps` tRPC Router 或现有 service 方法。
- 不改变模块应用运行时、计费、支付宝回调或 payout 的业务结果。
- 不新增模块应用管理员角色；当前角色和 capability 集保持不变。
- 不在本次同时重写所有后台页面。
- 不为了旧书签或历史链接保留任何模块中心兼容代码。

## 4. 目标信息架构

### 4.1 一级后台导航

一级导航继续表达稳定的业务域，不把所有模块子页面直接塞入全局侧边栏：

```text
工作台
用户与权限
商业化
AI 平台
模块应用
内容与运营
客户端与集成
系统与安全
```

选择“模块应用”后，主内容区显示模块中心的二级导航。全局侧边栏只负责切换业务域，模块二级导航负责切换工作流。

### 4.2 模块中心二级导航

```text
模块中心
├─ 总览
├─ 应用目录
├─ 审核队列
├─ 发布者
├─ 财务
│  ├─ 收入
│  ├─ 支付与对账
│  └─ 提现批次
├─ 运行监控
│  ├─ 安装
│  ├─ 数据记录
│  ├─ 运行记录
│  └─ 构建产物
└─ 审计
```

应用目录进入单个应用后，切换为应用详情上下文导航：

```text
应用详情
├─ 概览
├─ 页面与动作
├─ 权益与计费
├─ 商品
└─ 运行数据
```

详情导航是路由导航，不是把所有内容同时挂载到一个 Tabs 组件。每个视图独立加载、独立处理错误并可直接访问。

## 5. 规范路由

### 5.1 全局模块工作流

| 路径 | 页面 | 主要职责 |
| --- | --- | --- |
| `/settings/admin/modules` | 模块总览 | 待审核、支付异常、最近运行和常用入口的轻量总览 |
| `/settings/admin/modules/apps` | 应用目录 | 搜索、筛选、创建、发布状态和进入详情 |
| `/settings/admin/modules/reviews` | 审核队列 | package 扫描、构建、批准、拒绝和重新扫描 |
| `/settings/admin/modules/publishers` | 发布者 | Publisher 查询、验证、停用和应用归属 |
| `/settings/admin/modules/finance/revenue` | 收入 | 模块收入条目和结算批次 |
| `/settings/admin/modules/finance/payments` | 支付与对账 | 支付、退款、差异、重试和对账 |
| `/settings/admin/modules/finance/payouts` | 提现批次 | payout 创建、状态迁移和人工支付宝凭证 |
| `/settings/admin/modules/operations/installs` | 安装 | 安装范围、用户、工作区和状态 |
| `/settings/admin/modules/operations/records` | 数据记录 | 模块记录查询和归档状态 |
| `/settings/admin/modules/operations/runs` | 运行记录 | action 运行、耗时和错误类型 |
| `/settings/admin/modules/operations/artifacts` | 构建产物 | 文件、类型、大小和存储位置 |
| `/settings/admin/modules/audit` | 模块审计 | 模块应用相关审计事件和失败原因 |

### 5.2 应用详情

| 路径 | 页面 | 主要职责 |
| --- | --- | --- |
| `/settings/admin/modules/apps/:appId` | 应用概览 | 基本信息、版本、状态和发布动作 |
| `/settings/admin/modules/apps/:appId/configuration` | 页面与动作 | Pages 和 Actions 配置 |
| `/settings/admin/modules/apps/:appId/entitlements` | 权益与计费 | 套餐权益和 Billing 配置 |
| `/settings/admin/modules/apps/:appId/products` | 商品 | 商品、价格、许可范围和促销 |
| `/settings/admin/modules/apps/:appId/runtime` | 运行数据 | 当前应用的安装、记录、运行和产物快捷视图 |

### 5.3 被删除的入口

以下入口不注册、不跳转、不显示迁移提示：

- `/settings/admin/module-apps`；
- 任何 `/settings/admin/module-apps/*`；
- 任何以 `tab` 表达模块管理视图的旧查询参数；
- 旧模块页面在 deprecated settings renderer 中的映射。

访问这些地址时使用现有路由未匹配行为，不增加模块专用 fallback。

## 6. 页面与组件架构

### 6.1 路由目录

```text
src/routes/(main)/admin/modules/
  _layout/index.tsx
  index.tsx
  apps/index.tsx
  apps/[appId]/_layout/index.tsx
  apps/[appId]/index.tsx
  apps/[appId]/configuration/index.tsx
  apps/[appId]/entitlements/index.tsx
  apps/[appId]/products/index.tsx
  apps/[appId]/runtime/index.tsx
  reviews/index.tsx
  publishers/index.tsx
  finance/revenue/index.tsx
  finance/payments/index.tsx
  finance/payouts/index.tsx
  operations/installs/index.tsx
  operations/records/index.tsx
  operations/runs/index.tsx
  operations/artifacts/index.tsx
  audit/index.tsx
```

路由文件只导入 feature 页面和组合 route params，不保存表格、表单或数据请求逻辑。

### 6.2 Feature 目录

```text
src/features/Admin/moduleApps/
  layouts/
    ModuleCenterLayout.tsx
    ModuleAppDetailLayout.tsx
  navigation/
    catalog.ts
    policy.ts
    ModuleSectionNav.tsx
  overview/
  apps/
  reviews/
  publishers/
  finance/
    revenue/
    payments/
    payouts/
  operations/
    installs/
    records/
    runs/
    artifacts/
  audit/
  shared/
    CursorPager.tsx
    status.tsx
    cacheKeys.ts
    types.ts
```

现有表格和编辑器优先移动并复用，不进行无关的视觉重写。旧 `index.tsx` 在所有职责迁出后删除。

### 6.3 布局规则

- 模块中心布局包含面包屑、标题、二级导航和 `<Outlet />`。
- 二级导航在桌面使用固定上下文栏；窄窗口折叠为抽屉或菜单。
- 页面标题、说明和主要动作位置一致。
- 列表页工具栏承载搜索、筛选、刷新和创建动作。
- 应用详情使用稳定的详情头和路由化视图导航。
- 不使用卡片嵌套；总览指标、列表和工具区采用平面分区。
- 按钮使用已有 lucide 图标，并为不熟悉的图标提供 tooltip。

### 6.4 路由注册契约

现有 `ADMIN_SETTINGS_ROUTE_REGISTRY` 只表达一级 segment 到单个页面组件的扁平映射，不能直接承载模块中心的布局、index、动态参数和叶子页面。实现时将路由描述扩展为可递归的 children 结构，并继续由同一份描述生成 React Router `RouteObject`：

- `modules` 是带 `ModuleCenterLayout` 的容器路由，不再映射到单个聚合页面；
- index、静态 segment、`:appId` 和详情子路由都在 `modules` 的 children 中显式声明；
- section catalog 引用路由 ID，不另行维护第二份 segment 或 import 表；
- 两套 desktop router 继续复用同一个 `BusinessDesktopRoutesWithSettingsLayout` 结果，不分别手写模块路由树；
- 路由完整性测试验证每个可见 section 恰好命中一个叶子路由，每个叶子路由也有 catalog 或明确的详情上下文归属。

旧 registry 的其他一级页面仍保持扁平描述，本次不要求它们迁移到嵌套结构。

## 7. 路由目录与权限策略

### 7.1 二级目录元数据

在现有一级 `ADMIN_CATALOG` 之外增加可复用的后台 section 目录。一级目录决定全局侧边栏，section 目录决定域内导航和精确路径权限。

```ts
type AdminAccessPolicy = {
  allOf?: AdminCapability[];
  anyOf?: AdminCapability[];
};

type AdminSectionCatalogItem = {
  access: AdminAccessPolicy;
  description: string;
  id: string;
  label: string;
  parentId: AdminCatalogId;
  path: string;
  status: AdminFeatureStatus;
  writeCapabilities?: AdminCapability[];
};
```

`canAccessAdminPath` 必须先进行最长路径匹配：

1. 命中 section 或详情路由时，按该路由的 access policy 判断；
2. 未命中 section 时，回退一级 catalog；
3. `allOf` 必须全部满足；
4. `anyOf` 至少满足一项；
5. 后端 procedure 再次执行真实 capability 校验。

### 7.2 模块中心能力矩阵

| 页面 | 读取能力 | 写操作能力 |
| --- | --- | --- |
| 总览 | `moduleApp.read` 或 `finance.read` | 无跨域写操作 |
| 应用目录、概览、页面与动作、商品、运行数据 | `moduleApp.read` | `moduleApp.write` |
| 权益与计费 | `moduleApp.read` | `finance.write` |
| 审核队列 | `moduleApp.read` | `moduleApp.write` |
| 发布者 | `finance.read` | Publisher 治理使用 `moduleApp.write` |
| 收入、支付、提现 | `finance.read` | `finance.write` |
| 全局运行监控 | `moduleApp.read` | 当前为只读；后续写操作必须沿用对应后端 capability |
| 模块审计 | (`moduleApp.read` 或 `finance.read`) 且 `audit.read` | 无 |

该矩阵不根据页面名称推测权限，而是对齐现有 procedure：`listPublishers` 使用 `finance.read`，Publisher 治理 mutation 使用 `moduleApp.write`，`upsertBilling` 和 `upsertEntitlements` 使用 `finance.write`。需要同时读取和写入的操作必须分别通过两项检查，不能因为拥有写 capability 就绕过页面读取 capability。

finance admin 进入模块中心时只看到总览、发布者、财务，以及在同时具备 `audit.read` 时可见的审计页面。其余 section 不渲染，也不能通过直接 URL 进入。只具备模块治理能力的角色看到总览、应用、审核和运行监控，以及在同时具备 `audit.read` 时可见的审计页面；发布者页面仍遵循现有 `finance.read` 读取边界。

## 8. 数据流与 URL 状态

### 8.1 路由级加载

- 每个叶子页面独立 lazy import。
- 父布局只读取角色、导航元数据和必要的应用标题，不请求业务列表。
- 应用目录只请求应用列表。
- 审核队列只请求 package 列表。
- 财务页面只请求各自的 revenue、payment 或 payout 数据。
- 运行页面只请求对应的 installs、records、runs 或 artifacts。
- 应用详情的基础数据使用稳定 SWR key，在详情子路由间复用缓存。

禁止为了预先填充隐藏页面而在模块中心根布局中并行请求所有数据。

### 8.2 URL 状态

以下状态写入 search params：

- 搜索关键词；
- 状态筛选；
- Publisher、应用或支付筛选；
- 排序方式；
- 游标或可恢复的分页标识。

`appId` 必须位于路径中，不再使用只存在于组件内的 `selectedAppId`。

临时选中行和 modal 开关保留为局部状态。非敏感表单草稿按 `appId + 详情视图` 保存到本地并在刷新或异常退出后提供恢复；敏感字段不进入持久化草稿。离开未保存表单时使用统一离开确认，保存失败时保留当前输入。

### 8.3 缓存失效

建立模块中心 cache key helper，统一表达：

- 应用列表；
- 应用详情；
- package；
- publisher；
- revenue、payment 和 payout；
- installs、records、runs 和 artifacts；
- audit。

mutation 只失效受影响的 key，不再由单页 `refreshAppData` 同时刷新多个不相关领域。

## 9. 加载、错误和操作反馈

- 页面首次加载使用稳定高度的列表或详情骨架，避免布局跳动。
- 空状态区分“尚无数据”和“当前筛选无结果”：前者提供主要创建动作和下一步，后者提供清除筛选；不能只留下空白表格。
- 请求失败显示页内错误和重试按钮，不把失败页面渲染为空白。
- 无权限路由跳转到当前角色可访问的最近模块 section；没有可访问 section 时回到角色默认后台页。
- 应用不存在返回明确的未找到状态，不自动选择另一应用。
- 每个页面只设置一个主要动作；其他命令使用次级按钮、行操作或菜单。
- 发布、拒绝、结算、退款和 payout 等动作继续使用现有确认、审计和后端保护，并在同一操作界面表达确认、处理中、成功或失败状态。
- mutation 成功后显示明确反馈并只刷新相关数据；失败时保留当前筛选和页面位置。

## 10. 切换与删除策略

本次采用一次性切换，不执行双轨迁移：

1. 注册 `/settings/admin/modules` 路由树和新 catalog 项。
2. 更新一级导航指向 `/settings/admin/modules`。
3. 将现有模块功能按工作流迁入新页面。
4. 删除 `module-apps` 一级 catalog 项、route import 和旧页面路由文件。
5. 删除 deprecated settings renderer 中的旧模块页面映射。
6. 删除只服务旧单页状态机的组合组件、测试和无引用代码。
7. 不创建 redirect 或旧地址兼容测试。

切换不删除数据库数据，不重命名后端接口，也不修改支付环境变量。

## 11. 测试与验收

### 11.1 自动化测试

1. Catalog 完整性：一级模块入口、所有 section 和 route import 一一对应。
2. 路由树：静态、动态和 index 路由均可匹配。
3. 旧路径删除：`/settings/admin/module-apps` 不存在于 catalog、registry 和 deprecated renderer。
4. 权限矩阵：full admin、finance admin 和无关 scoped role 的可见项及直接 URL 行为正确。
5. 数据隔离：打开应用目录不会调用支付、payout、运行或审计接口。
6. URL 状态：筛选、分页和 appId 在刷新后保持。
7. 页面状态：覆盖 loading、首次无数据、筛选无结果、error、success、草稿恢复和 mutation failure。
8. Router 同步：desktop 两套路由配置继续通过现有同步测试。

### 11.2 浏览器验收

- full admin 可以进入所有模块中心页面；
- finance admin 只看到允许的财务相关页面；
- 无关 scoped role 看不到模块中心入口；
- 直接打开无权 URL 会被安全重定向；
- 应用列表、应用详情、审核、支付和运行页面均可深链访问；
- 浏览器前进、后退和刷新保持正确上下文；
- 非敏感未保存草稿在刷新后可以恢复，敏感字段不会被本地持久化；
- `/settings/admin/module-apps` 不再进入任何模块管理页面；
- 页面没有横向溢出、重叠或隐藏工具栏。

### 11.3 完成定义

只有同时满足以下条件才视为第一阶段完成：

- 旧模块单页和旧 URL 已删除；
- 新路由和导航均来自目录元数据；
- 权限测试和后端 capability 边界一致；
- 各页面只加载自身数据；
- focused Vitest、TypeScript 检查和一次浏览器验收通过；
- 没有把构建成功误报为完整 E2E 证明。

## 12. 实施顺序

1. 建立 section catalog、精确访问策略和路由树测试。
2. 建立模块中心布局、二级导航和空页面路由。
3. 迁移应用目录和应用详情，移除 `selectedAppId` 局部导航状态。
4. 迁移审核队列和 Publisher 页面。
5. 迁移 revenue、payments 和 payouts 财务页面。
6. 迁移 installs、records、runs 和 artifacts 运行页面。
7. 迁移模块审计并补齐权限测试。
8. 删除旧 `/module-apps` 路由、单体组件和兼容映射。
9. 运行 focused tests、type-check 和一次浏览器验收。

该顺序先固定路由与权限契约，再移动业务页面，避免在拆分过程中出现可见入口和真实授权不一致。
