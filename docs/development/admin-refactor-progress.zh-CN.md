# 后台重构进度记录

## 2026-07-18 后台默认值与套餐内容归属

- 套餐页 FAQ 已从「站点与品牌」移至「套餐与权益」，并使用独立表单仅写入 `plans.faq.items`。
- 用户兴趣领域、头像预设和用户全局设置已收敛到「用户默认值」，避免与站点设置或 AI 运行时页面交叉保存。
- 原 `/settings/admin/system-defaults` 已拆分为：
  - `/settings/admin/ai-runtime-defaults`：向量检索与记忆抽取模型；
  - `/settings/admin/user-defaults`：用户继承的模型、工具和资料默认值；
  - `/settings/admin/integrations`：Composio 外部集成。
- `system-defaults` 仍保留为后端聚合读取兼容 section，旧页面路径会重定向到 AI 运行时默认值；新页面按各自 section 读取和保存，避免隐藏字段覆盖其他分区。

更新时间：2026-07-15

## 当前进度

- 后台入口统一在 `/settings/admin`，旧 `/admin/*` 兼容入口不再保留。
- 后台导航已按「工作台 / 用户与套餐 / 模型与计费 / 品牌与增长 / 系统运维」重新分组。
- 订阅、套餐变更、充值包等旧页面已逐步收口到更少的管理入口：
  - 套餐变更请求归入订阅管理。
  - 充值包归入订单与充值。
  - 旧计费设置归入模型与计费矩阵。
- 用户列表和用户详情已接入管理员直接分配套餐能力。
- 站点设置页已拆分为品牌登录、默认助手、默认模型、关于帮助、客户端维护等标签页。
- 后台中文文案测试已覆盖导航、桌面端更新、用户套餐分配、用户详情和审计详情的明显乱码。
- 旧后台入口继续收口：
  - `/settings/admin/pricing` 不再提供独立计费表单，改为提示页，引导到站点设置和模型与计费矩阵。
  - `/settings/admin/topup` 不再直接打开充值套餐管理，改为提示页，引导到订单与充值。
  - `/settings/admin/change-requests` 不再直接打开套餐变更请求管理，改为提示页，引导到订阅管理。
  - 真实功能仍保留在合并后的主页面标签页中，避免同一功能在多个入口重复维护。
- 已删除旧版独立计费设置 helper：
  - `adminPricingSettings.ts`
  - `adminPricingSettings.test.ts`
  - 全局积分倍率和订单开关现在由站点设置表单统一保存。
- 已删除旧后台通用占位页 `AdminPagePlaceholder`，避免继续用占位页面承接未完成入口。
- 推荐运营页的模块标题已接入前台社区推荐模块，管理员可以分别配置推荐助手、MCP / 工具、推荐技能、通用技能和热门技能标题。
- 模型中心的通用说明和空状态文案已改为服务商通用表达，避免把 OpenAI 兼容、DeepSeek、阿里云等实例误描述为仅 NewAPI。
- 默认中文 locale 已继续清理：后台侧边栏 fallback、站点设置、订单与充值、运营配置、增长限制、推荐运营和旧计费说明不再被英文 locale 覆盖。
- 站点设置默认供应商说明、模型中心导航说明和兑换码批次筛选文案已继续中文化和服务商中性化，避免后台出现旧版 NewAPI-only 口径或英文占位符。
- 服务商实例后台入口已从 `/settings/admin/newapi-providers` 收口为 `/settings/admin/providers`，Web 与桌面端路由、后台导航和工作台快捷入口统一使用服务商中性路径；旧 `newapi-providers` 后台入口不再保留。
- 后台服务商实例页面与表单 helper 已改为服务商中性文件名：`AdminProvidersPage`、`adminProviderInstanceForm`。底层 `newapi` 仍作为一种服务商类型保留，避免影响运行时枚举和已有实例数据。
- 后台服务商实例页面的 i18n key 已从 `admin.newapi.*` 收口为 `admin.providers.*`，减少前端维护层面的旧版 NewAPI-only 语义残留。
- 默认中文 locale 已补齐 `admin.providers.*` 服务商实例管理文案，避免服务商页面依赖组件内 fallback 文案展示。
- 后台导航和工作台快捷入口的图标 key 已从 `newapi` 改为 `providers`，前端维护层不再把服务商中心绑定到旧 NewAPI-only 命名；`newapi` 仅保留为运行时服务商类型。
- 服务商类型说明文案已改为通用表达，不再在实例表单 fallback 和默认中文 locale 中把同步模型与价格能力写死为 NewAPI。
- 站点设置页的默认聊天、图像和视频供应商说明已移除 `newapi` 作为默认示例和输入占位符，改为服务商中性提示；`newapi` 仍作为合法供应商选项保留。
- 后台品牌设置和默认技能说明已去除 LobeHub-only 表述，模型策略示例也改为 OpenAI / DeepSeek 等通用服务商示例。

## 已记录待办

### Windows 客户端切换套餐后模型列表不立即刷新

现象：网页端套餐变更后较容易看到最新模型权限，但 Windows 客户端切换套餐后模型列表仍是旧状态，重启客户端后才生效。

初步根因：

- 客户端会缓存 `userState` 和 `aiProviderRuntimeState`。
- 套餐变更成功后没有统一触发：
  - `refreshUserState()`
  - `refreshAiProviderRuntimeState()`
- 重启客户端会重新初始化这些状态，所以重启后模型权限恢复正确。

建议修复方向：

- 用户主动兑换、购买、切换套餐成功后，立即刷新用户状态和 AI 服务商运行态。
- 管理员远程给用户改套餐时，客户端需要在窗口聚焦、定时轮询或关键入口打开时刷新运行态。
- 桌面端可以复用网页端的刷新链路，避免单独维护一套模型权限缓存逻辑。

处理进度：

- 已新增 `refreshCommercialEntitlementState`，在用户端权益变化后统一刷新商业缓存、`userState` 和 `aiProviderRuntimeState`。
- 已接入套餐页兑换、账单页兑换、积分页兑换、旧充值兑换入口和推荐奖励领取入口。
- 已接入全局窗口聚焦 / 回到前台刷新，管理员远程给其他用户改套餐后，用户切回网页或 Windows 客户端会在节流窗口后刷新权益与模型运行态。

## 2026-07-15 后台治理底座 Phase 1

- `/settings/admin` 继续作为唯一主入口；`/admin/*` 仅保留路径规范化语义，不进入后台主菜单或独立路由树。
- 后台菜单、可见路由、功能状态、负责人、后端域和读取权限已收敛到统一 Admin catalog，并按「工作台 / 用户与权限 / 商业化 / AI 平台 / 模块应用 / 内容与运营 / 客户端与集成 / 系统与安全」八组展示。
- `pricing`、`topup`、`change-requests` 继续作为兼容页面注册，但不出现在主菜单中；所有可见 catalog 路由与懒加载 registry 保持一一对应。
- 用户、内容、模型、系统设置和 PPT 的纯读取 procedure 已使用独立 read capability；用户列表和完整详情因仍会同步过期订阅并写入额度，继续要求 `support.write`。
- Module App 通用读取和治理写入分别使用 `moduleApp.read`、`moduleApp.write`。财务管理员不再获得这两项能力，共享页面入口与后端领域权限分别判定。
- Module App 支付诊断、收入、提现批次和支付对账导出使用 `finance.read`；支付、支付宝退款与查询、对账写入、收入结算、提现、计费和权益变更继续使用 `finance.write`；通用审计事件继续使用 `audit.read`。
- 本阶段未改动 tRPC procedure 名称、输入输出 Schema、数据库结构或支付状态机，也未新增数据库迁移。
- 平台套餐和充值支付仍未接入支付宝；模块应用的支付宝电脑网站支付继续保持独立业务域和原有环境变量开关。

## 2026-07-15 Module App 财务隔离增量

- `/settings/admin/module-apps` 继续作为唯一 Module App 后台入口；完整管理员通过 `moduleApp.read` 进入治理页面，财务管理员通过 `finance.read` 进入同一路由。
- `finance_admin` 不再拥有 `moduleApp.read` 或 `moduleApp.write`，不能调用通用 Module App 列表、详情、审核、发布和治理写入 procedure。
- 路由内新增按角色独立懒加载的页面边界：完整管理员保持原治理页面，财务管理员只加载收入、支付诊断、发布方财务信息和提现页面，不下载或渲染治理页面代码。
- 发布方列表已归属 `finance.read`；收入结算等财务写操作继续要求 `finance.write`，未扩大财务管理员的治理权限。
- 本增量未改动 tRPC procedure 名称、输入输出 Schema、支付宝适配器、支付与退款状态流转、数据库 Schema 或迁移，也未改变完整管理员的 Module App 治理流程。
