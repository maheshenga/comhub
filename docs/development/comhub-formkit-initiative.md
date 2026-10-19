# FormKit 立项：53 个 no-restricted-imports 豁免文件的改造路线图

> 立项文档（第十轮主题④，2026-10）。只写文档、不动代码。
> 事实基线：第八轮 lint 清零交付报告 `out/lint-zero-round8/lint-round8-report.md` 的 ③豁免清单全表 与 ④CI 门禁变更 两节，
> 以及撰写本会话在 `E:\code\comhub\wt-round10`（main @ `acdb0f54e4`，即第九轮 #161 合入后）上的独立复测
> （复测命令与结果见文末附录 A）。目标读者：下一个开工 P0 的会话 —— 本文自带全部考古结论，不需要重读第八轮报告以外的任何历史材料。

---

## ① 背景与目标

### 1.1 背景事实

- 第八轮完成 `src tests` 全量 eslint error 清零（基线 447 error / 294 文件 → **0 error**；复测口径
  `files: 8368, errors: 0, warnings: 168`，报告 ①总结论表），并在 `.github/workflows/comhub-pr-check.yml`
  新增 **Lint step**（本会话复测：`comhub-pr-check.yml:71-72`，`pnpm exec eslint src tests --concurrency=auto`，
  位于 business-server tests step 之后、swap + tsgo step 之前；门禁只挡 error，warning 基线 168 条）。
- 清零的实现手段是 "真迁移或豁免"：普通 UI 组件（Button/Modal/Select/Switch/Alert/Typography 等）全部
  真迁 `@lobehub/ui/base-ui`，而对 base-ui **无渲染不变等价物**的场景按 PR #135 先例逐行加规范化豁免注释
  `// eslint-disable-next-line no-restricted-imports -- ...`。
- 结果：豁免文件从 main `a620823f399f` 的 **21 文件** 增至 **74 文件 / 75 处**，第八轮净新增 **53 个**
  （本会话以 `git grep + comm` 差集独立复算：53 新增、0 消失，见附录 A）。53 个的分类构成
  **A 类（Form 系）44 + B 类（FormGroup 静态分组）3 + C 类（非 Form 语义）6 = 53**，可机械复算（报告 ③）。

### 1.2 为什么 A 类 44 个是同一个根因

- A 类 44 个文件的受限导入根因全部是 **antd rc-field-form 的受控 Form 语义**：`Form.useForm` 返回命令式
  `FormInstance`（`getFieldsValue` / `setFieldsValue` / `validateFields` / `errorFields` / `Form.useWatch`），
  `Form.Item` 以 `name` 路径 + `rules` + `valuePropName` 声明式绑定字段（三个代表实读见 §2.2）。
- **base-ui Form 没有这套契约**。本会话实读 `node_modules/@lobehub/ui/es/base-ui/Form/type.d.mts`：
  `FormProps` 是数据驱动面（`items` / `initialValues` / `onFinish`），`FormContextValue` 仅含
  `hasUnsavedChanges / submitLoading / requestReset / layout / variant` 等布局态字段；
  base-ui 导出面（`es/base-ui/index.d.mts:231`）有 `Form / FormField / FormGroup / FormSubmitFooter /
useFormContext`，**没有 `useForm` / `FormInstance`**。也就是说 base-ui Form 不是 rc-field-form 的渲染不变
  等价物，机械替换会改变行为 —— 第八轮因此选择 keep-antd 豁免而非迁移。
- 结论（与第八轮报告 ⑦ 一致）：**A 类 44 个的收敛路径只有一条 —— 受控语义重写**，即立项一个 "FormKit"
  方向：为 ComHub 提供一套与 rc-field-form 契约对齐（或在语义判据上明确降级）的表单方案，然后逐文件重写。
  没有 FormKit，A 类就没有行为不变的真迁移空间（报告 ⑦ 原话）。

### 1.3 目标与量化终点

- **目标**：把 53 个新增豁免文件收敛到只剩 C 类 6 个（各需独立专项，与 FormKit 无关），
  全仓 `no-restricted-imports` 豁免从 74 文件收敛到约 **27 文件**（21 历史基线 + C 类 6）。
- **里程碑锚点**：第八轮 ask 曾给 "本轮新增豁免 ≤40" 的预期上限，53 已突破约 +33% 并成为当时合入裁决的唯一
  high 项（报告 ⑤/⑥/⑦）。本立项的隐含承诺是：**后续轮次不得再净增豁免**，存量只减不增（验收门禁见 §5）。
- **非目标**：不做 antd 全量下线；不动 21 个历史基线豁免文件（AdminDataTable、ContentPage 等，属更早批次，
  另有 keep-antd 判据）；C 类 6 个不在本立项的 P0-P2 范围内（§4 P3 仅做逐个判据评审）。
- **第十四轮完成态（2026-10-19）**：再迁 **10 个自包含文件**（DesktopControlCenter 5、Providers 2、
  AdminNotificationsPage、AgentChat、RecordForm），R14 实测 `no-restricted-imports` 全仓 **39 文件 / 40 处**
  （第十三轮结束为 47 文件 / 48 处；再往前 74/75）。剩余 10 个 FormKit 目标文件
  （SettingsCards/SettingsTabs、FeaturedSection、SectionCards、PackageFormFields、ChannelCards、
  PolicySections、SpacePreview/EntryMetaFields/CardListFields）**全部是 antd 基线父页持有的子字段组件**：
  它们不创建 Form 实例，只渲染 `Form.Item` 并依赖隐式上下文，单独迁移会断链。必须与
  `AdminSettingsPage / AdminOperationsPage / AdminRecommendationsPage / AdminTopUpPackagesPage /
ChannelSettings / AdminModelPolicyPage / AdminExpertPlazaPage` 七个父页同批推进 —— 这已超出本立项
  “不动 21 文件基线” 的非目标，需另立 P2b-2 批次（先父页、再子组件）。

---

## ② 范围与分类表（53 文件全表）

> 表体逐行摘自第八轮报告 ③ 的 A/B/C 三表（判据与 "留豁免的 Form 成员" 栏为报告原文），文件路径按本会话
> 在 wt-round10 树上实测补全；A-3 段报告表格笔误 "6 个非测试" 实为 7 个非测试 + 1 测试 = 8，
> 其分类总账 "A 类 auth 8" 正确，本表已按 7+1 修正（差异已在附录 A 注明）。

### A 类：Form 系豁免（44 个，FormKit 的直接消费面）

**A-1 Admin 非测试（32 个）**—— 按目录重排，`难度` 为本文档新增评级：`低`= 全文件仅 Form 系 / 类型可整行删豁免；
`中`= 混合文件（普通组件已迁 base-ui，只剩 1 条 Form 导入行）受控语义改写；`高`= 含 Form.List/ 跨字段联动。

| #   | 文件                                                                              | 留豁免的 Form 成员（报告原文）            | 难度 |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------- | ---- |
| 1   | `src/features/Admin/AdminNotificationsPage.tsx`                                   | Form.useForm / Form.Item                  | 中   |
| 2   | `src/features/Admin/AdminDefaultSettingsPage.tsx`                                 | 全文件仅 Form 系（Form.useForm）          | 低   |
| 3   | `src/features/Admin/DesktopControlCenter/CreateDesktopReleaseModal.tsx`           | Form.useForm / Form.useWatch / Form.Item  | 中   |
| 4   | `src/features/Admin/ExpertPlaza/CardListFields.tsx`                               | Form.List/ FormInstance 类型              | 高   |
| 5   | `src/features/Admin/ModelPolicy/PolicySections.tsx`                               | Form / FormInstance                       | 中   |
| 6   | `src/features/Admin/components/RuntimeModelFieldPair.tsx`                         | Form / FormInstance                       | 中   |
| 7   | `src/features/Admin/DefaultSettings/ProfileDefaultsCard.tsx`                      | Form / FormInstance / Form.List           | 高   |
| 8   | `src/features/Admin/DefaultSettings/SectionFields.tsx`                            | Form / FormInstance                       | 中   |
| 9   | `src/features/Admin/DesktopControlCenter/DistributionPage.tsx`                    | Form 受控                                 | 中   |
| 10  | `src/features/Admin/DesktopControlCenter/UpdateSettingsPage.tsx`                  | Form 受控                                 | 中   |
| 11  | `src/features/Admin/DesktopControlCenter/BrandPage.tsx`                           | Form 受控                                 | 中   |
| 12  | `src/features/Admin/DesktopControlCenter/BuildProfileEditor.tsx`                  | Form 受控                                 | 中   |
| 13  | `src/features/Admin/DesktopControlCenter/BuildProfilePage.tsx`                    | 全文件仅 Form 系                          | 低   |
| 14  | `src/features/Admin/DesktopControlCenter/useDesktopSettingsFormSync.ts`           | 全文件仅 FormInstance 类型                | 低   |
| 15  | `src/features/Admin/ExpertPlaza/SpacePreview.tsx`                                 | Form / FormInstance（getFieldValue 读值） | 中   |
| 16  | `src/features/Admin/ExpertPlaza/EntryMetaFields.tsx`                              | Form 受控                                 | 中   |
| 17  | `src/features/Admin/moduleApps/ActionEditor.tsx`                                  | Form 受控                                 | 中   |
| 18  | `src/features/Admin/moduleApps/PageEditor.tsx`                                    | Form.List 受控                            | 高   |
| 19  | `src/features/Admin/moduleApps/productFormFields.tsx`                             | Form 受控                                 | 中   |
| 20  | `src/features/Admin/moduleApps/BillingEditor.tsx`                                 | Form 受控                                 | 中   |
| 21  | `src/features/Admin/moduleApps/EntitlementEditor.tsx`                             | Form 受控                                 | 中   |
| 22  | `src/features/Admin/moduleApps/ProductManager.tsx`                                | 全文件仅 Form 系                          | 低   |
| 23  | `src/features/Admin/moduleApps/apps/configuration/ModuleAppConfigurationPage.tsx` | 全文件仅 Form 系                          | 低   |
| 24  | `src/features/Admin/moduleApps/apps/entitlements/ModuleAppEntitlementsPage.tsx`   | 全文件仅 Form 系                          | 低   |
| 25  | `src/features/Admin/Operations/FeaturedSection.tsx`                               | Form 受控                                 | 中   |
| 26  | `src/features/Admin/PaymentChannels/ChannelCards.tsx`                             | Form 受控                                 | 中   |
| 27  | `src/features/Admin/Providers/InstanceFormModal.tsx`                              | Form 受控                                 | 中   |
| 28  | `src/features/Admin/Providers/GroupFieldsRow.tsx`                                 | Form 受控                                 | 中   |
| 29  | `src/features/Admin/Recommendations/SectionCards.tsx`                             | Form 受控                                 | 中   |
| 30  | `src/features/Admin/Settings/SettingsCards.tsx`                                   | Form 受控                                 | 中   |
| 31  | `src/features/Admin/Settings/SettingsTabs.tsx`                                    | Form 受控                                 | 中   |
| 32  | `src/features/Admin/TopUpPackages/PackageFormFields.tsx`                          | Form 受控                                 | 中   |

（历史基线另有 `AdminExpertPlazaPage / AdminFileStoragePage / AdminGrowthPage / AdminModelPolicyPage /
AdminOperationsPage / AdminPlanFaqCard` 等含 Form.List 的豁免页 —— 属 21 文件基线，**不在本立项范围**，
但 FormKit 的 Form.List 语义判据可直接复用到它们。）

**A-2 Admin 测试（2 个）**—— 豁免随被测组件迁移自然消失：

| #   | 文件                                                           | 说明（报告原文）                                                           | 难度               |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------ |
| 33  | `src/features/Admin/components/RuntimeModelFieldPair.test.tsx` | 测试内静态 import antd Form（vi.mock antd 场景，随被测组件受控 Form 语义） | 低（跟随 #6）      |
| 34  | `src/features/Admin/moduleApps/editors.test.tsx`               | Form 作 renderWithForm 包裹器（antd 受控行为契约）                         | 低（跟随 #17-#21） |

**A-3 auth 非测试（7 个）**—— 表单小、测试面窄，P1 首批（报告表头 "6 个非测试" 为笔误，实为 7）：

| #   | 文件                                                                      | 说明（报告原文）                                                                                    | 难度 |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- |
| 35  | `src/app/[variants]/(auth)/signin/SignInEmailStep.tsx`                    | Form.useForm/ Form.Item name+rules / FormInstance；同文件普通组件已全迁 base-ui（混合导入按规拆分） | 中   |
| 36  | `src/app/[variants]/(auth)/signin/SignInPasswordStep.tsx`                 | Form 系；InputPassword 已迁 base-ui，InputRef→HTMLInputElement                                      | 中   |
| 37  | `src/app/[variants]/(auth)/signin/useSignIn.ts`                           | Form 系（含 errorFields 判断，`useSignIn.ts:119`）                                                  | 中   |
| 38  | `src/app/[variants]/(auth)/signup/[[...signup]]/useSignUp.ts`             | Form 系                                                                                             | 中   |
| 39  | `src/app/[variants]/(auth)/signup/[[...signup]]/BetterAuthSignUpForm.tsx` | Form.useForm/setFieldsValue/dependencies 跨字段校验；Input.Password 已换 InputPassword              | 中   |
| 40  | `src/app/[variants]/(auth)/reset-password/useResetPassword.ts`            | Form 系                                                                                             | 中   |
| 41  | `src/app/[variants]/(auth)/reset-password/ResetPasswordContent.tsx`       | Form 系（跨字段校验）；InputPassword 已迁                                                           | 中   |

**A-4 auth 测试（1 个）**：

| #   | 文件                                                       | 说明（报告原文）                                        | 难度              |
| --- | ---------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| 42  | `src/app/[variants]/(auth)/_layout/AuthAgreement.test.tsx` | 测试内静态 import antd Form（随被测组件受控 Form 语义） | 低（跟随 #39 等） |

**A-5 src/features（2 个）**—— 语义最复杂的两个，P2 末批：

| #   | 文件                                            | 说明（报告原文）                                                                                                                                                                                                                        | 难度 |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 43  | `src/features/AgentSetting/AgentChat/index.tsx` | `@lobehub/ui` 根桶 Form 受控（Form.useForm + items=\[FormGroupItemType] + valuePropName='checked' + Form.SubmitFooter）与字段双向绑定；Form 与 FormGroupItemType 类型同留根桶保证类型自洽；SliderWithInput/Switch/TextArea 已迁 base-ui | 高   |
| 44  | `src/features/ModuleAppRuntime/RecordForm.tsx`  | antd 受控 Form（Form.useForm + Form.Item name+rules 校验、Select/InputNumber 联动），另加一条 antd/es/form Rule 类型豁免；4/4 测试过                                                                                                    | 高   |

**难度统计**：低 8（#2/13/14/22/23/24 + A-2 两个 + A-4 一个）、中 32、高 4（#4/7/18/43）。
（注：#44 归 "高" 以 rules 联动判据计；低 = 8、高 = 4，其余 32 为中。）

### B 类：FormGroup 静态分组豁免（3 个）——**不必等 FormKit，P0 可机械硬迁**

base-ui 实际**导出** `FormGroup`（本会话复测 `node_modules/@lobehub/ui/es/base-ui/index.d.mts:169-170,231`：
`FormGroup, type FormGroupProps, type FormGroupItemType` 在导出列表中），且 `About.tsx` 已示范同款静态分组
硬迁成功（本会话复测 `src/features/Settings/about/features/About.tsx:4` 现为
`import { Divider, Form } from '@lobehub/ui/base-ui'`，无豁免行）。三个文件均为纯静态分组用法：

| #   | 文件                                                                        | 用法（本会话实读行号）                                                                                                                                                           | 状态                                                               |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 45  | `src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.tsx` | `:4` 导入、`:169` `<FormGroup collapsible={false} extra={desktopExtra} gap={16} title={title} variant="filled">`                                                                 | ✅ 已硬迁（第十一轮 P0）                                           |
| 46  | `src/routes/(main)/agent/cron/[cronId]/features/CronJobContentEditor.tsx`   | `:14` 导入、`:70,96` `<FormGroup title variant="filled">`                                                                                                                        | ✅ 已硬迁（第十一轮 P0）                                           |
| 47  | `src/routes/(main)/agent/cron/[cronId]/features/CronJobScheduleConfig.tsx`  | `:5` 导入、`:65,127` `<FormGroup title variant="filled">`；同文件 TimePicker 不在禁令名单、base-ui 无对应导出，保留 antd 合法且**无需**豁免（该文件豁免仅对应 FormGroup 导入行） | ✅ 已硬迁（第十一轮 P0，Flexbox 留根桶 ——base-ui 无 Flexbox 导出） |

> 第十一轮 P0 实测补充：#45 的 `gap={16}` 在 base-ui `FormGroupProps` 上**不存在**（根桶版有），已按
> About.tsx 先例改为外层 `Flexbox gap={16}` 包装，配对测试的 gap 断言随组件搬家（断言语义不变）。

第八轮报告明确修正：三文件留豁免属**执行缺口而非技术不可行**（组报 "base-ui/form 无行内等价项" 与导出面不符）。
硬迁后 53 → 50，半天工作量、零行为风险。

### C 类：非 Form 语义豁免（6 个）—— 与 FormKit 无关，各自专项，P3 只做评审

| #   | 文件                                                        | 理由（报告 ③ 原文摘录）                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 48  | `src/components/InlineTable/index.tsx`                      | antd Table 直连，对齐先例 `AdminDataTable.tsx:5`：base-ui Table 是 tanstack 重写（无 locale.emptyText、rowKey 强制、CSS 挂 styles.root 而非 `.ant-table` 类名），本组件 createStaticStyles 硬编码 `.ant-table*` 选择器且 4 个消费方（BusinessSettingPages/Billing.tsx:362、CreditPackageList.tsx:190、Credits.tsx:325、Referral.tsx:435）传 antd 特有 props—— 换 base-ui 属行为重写 |
| 49  | `src/components/antd-compat/Card.ts`                        | base-ui 无 Card 导出（g6/g7 双查 index.d.mts 0 命中），垫片被 17 文件消费且传 antd CardProps（cover/bordered/hoverable）                                                                                                                                                                                                                                                            |
| 50  | `src/features/Admin/MobileConfigPreview.tsx`                | base-ui Segmented 渲染 toggle button（aria-pressed）而 antd Segmented 渲染 radio，配对测试契约 `getByRole('radio')`（MobileConfigPreview\.test.tsx:152,161）；实测迁移后 11/11 失败、回退后 11/11 通过 —— 迁移即违反行为不变硬约束                                                                                                                                                  |
| 51  | `src/features/Settings/stats/features/usage/UsageTable.tsx` | DatePicker.RangePicker 的 value/onChange 是 Dayjs 对象契约（dateRange 过滤链 dayjs.isBefore/isAfter 全链耦合），base-ui DateRangePicker 是 Date 契约，行为不变迁移需重写过滤逻辑；TableColumnType 类型随 InlineTable 的 antd 列契约保留                                                                                                                                             |
| 52  | `src/features/TopUp/RedeemForm.tsx`                         | antd message 散布 3 处 + Input.Search（回车提交 + 内嵌按钮）在 base-ui 无渲染不变等价物                                                                                                                                                                                                                                                                                             |
| 53  | `src/server/services/newapiInstance/catalog.ts`             | LOBE_DEFAULT_MODEL_LIST（服务端 builtin 模型目录）仅在 model-bank 根桶导出：./aiModel 仅含类型 /normalizeAiModelType、./modelProviders 为 deprecated 旧列表                                                                                                                                                                                                                         |

---

## ③ FormKit 语义差异判据

FormKit 的核心命题是：**在 rc-field-form 契约与 base-ui 受控数据驱动面之间选定兼容策略**。
判据来自第八轮报告 ③A 判据句与代码实读，逐条列出，供 P0-P2 每个文件迁移前对照。

### 3.1 antd 侧契约（需要被满足或明确降级的能力清单）

1. **命令式实例**：`Form.useForm()` → `FormInstance`。仓库内使用面（本会话 grep 实测）：`setFieldsValue` /
   `getFieldsValue` 共 **26 个文件**；`errorFields` 在 `src/app/[variants]/(auth)/signin/useSignIn.ts:119` 被用作
   提交错误分支判断（豁免注释原文即 "rc-field-form 的 errorFields 契约是本 PR 判据的基础"，见
   `AdminExpertPlazaPage.tsx:5` 等 6 个历史豁免文件的同一句注释）。
2. **声明式字段**：`Form.Item` 的 `name`（含嵌套路径数组，如 AdminNotificationsPage 的
   `name={['eventDefaults', channel.key, eventKey]}`，`AdminNotificationsPage.tsx:180`）+ `rules` +
   `valuePropName`（Switch 类字段统一 `'checked'`）+ `noStyle`（嵌套布局下仅取行为不加 DOM，同文件 :178）。
3. **动态字段集合**：`Form.List`（`AdminPlanFaqCard.tsx:105` `name="planFaqItems"` 等历史豁免页在用）。
4. **跨字段联动**：`Form.useWatch`、`dependencies` + `validator`（`BetterAuthSignUpForm.tsx` 跨字段校验、
   `RecordForm.tsx:149` 动态 `Rule[]`）。
5. **校验语义**：`rules` 的 `required/validator`、`validateFields()` Promise 拒绝携带 `errorFields`（含出错字段
   路径与 message），错误信息渲染在 `Form.Item` 下方。
6. **数据驱动分组**（部分文件用的是根桶 Form 的扩展而非 antd 原生）：`items=[FormGroupItemType]`、
   `Form.SubmitFooter`（`AgentChat/index.tsx:84-88` 实读确认 `footer={<Form.SubmitFooter />}` + `items={[chat]}`）。

### 3.2 base-ui 侧现状（实读 `node_modules/@lobehub/ui/es/base-ui/Form/type.d.mts`）

- `FormProps`：数据驱动。`items?: FormGroupItemType[] | FormFieldProps[]`、`initialValues`（按 name 分发
  defaultValue，兼作未保存检测基线）、`onFinish(values)`；`ref?: Ref<HTMLFormElement>`——**是原生 form 元素，
  不是命令式 FormInstance**。
- `FormContextValue`（`useFormContext()` 返回值）：`hasUnsavedChanges / initialValues / itemMinWidth / layout /
requestReset / submitLoading / variant`——**没有任何取值 / 设值 / 校验命令式方法**。
- `FormFieldProps`：`label / desc / hidden / required / minWidth / variant` 等布局字段；**类型面没有 `name`+`rules`
  绑定与逐字段错误态**（继承 `Field.Root` 的 props，受控语义需经 base-ui Field 体系另行组装）。
- 导出面（`index.d.mts:231`）：`Form / FormField / FormFlatGroup / FormGroup / FormSubmitFooter / FormTitle /
FormDivider / useFormContext`；**无 `useForm`、无 `FormInstance`**。
- 判据结论（与第八轮报告 ③A 判据句一致）：**base-ui Form 是 "受控的声明式表单布局组件"，不是 rc-field-form
  的等价物**。antd Form 的 6 项契约中，base-ui 原生只覆盖声明式分组与 onFinish；命令式实例、Form.List、
  useWatch/dependencies 联动、errorFields 校验分支均需 FormKit 自建或明确降级。

### 3.3 FormKit 判据基线（P0 必须先裁决的四个问题）

每个文件的迁移不是逐行翻译，而是按以下判据逐条裁决并把结论写进该文件的迁移说明：

- **J1 取值 / 设值**：`form.getFieldsValue/setFieldsValue` 的调用点改由 React state（或 base-ui 受控字段）持有表单
  值 —— 凡保留命令式读写的调用点列为行为风险点，须有等价测试断言。
- **J2 校验**：`rules.required/validator` 逐字段迁移到 FormKit 校验器；**`errorFields` 分支语义必须保留**
  （至少：校验失败时提交中断 + 能区分字段级错误；具体 API 形态由 FormKit 设计定，降级须在文件级说明）。
- **J3 动态字段**：`Form.List` 用 FormKit 的 FormList（若采 base-ui FormSubmitFooter 同族的列表能力）或显式
  数组 state + key 化字段实现；增删后的值顺序与校验错误归属必须与迁移前一致。
- **J4 联动**：`useWatch`/`dependencies` 改为 state 派生或 FormKit watch 能力；联动触发时序（用户输入 → 联动
  字段更新）不得改变。
- **J5 分组与提交脚手架**：`FormGroupItemType`/`Form.SubmitFooter` 直接换 base-ui `FormGroup` /
  `FormSubmitFooter`（均已在导出面，见 3.2）—— 这一项是**唯一可先行机械处理**的判据，B 类 3 文件即据此硬迁。

### 3.3.1 P0 试点实测结论（第十一轮，wt-round11 @ 5f60d4a97f + FormKit P0 批次）

> 实测对象：B 类硬迁 #45/46/47 + 试点 A（#2 AdminDefaultSettingsPage + #8 SectionFields，连带 #6
> RuntimeModelFieldPair、#7 ProfileDefaultsCard、测试 #33）+ 试点 B（#14 判据结论）。以下全部为
> `node_modules/@lobehub/ui@5.57.1` 源码实读 + 真渲染测试跑通的实测结论，非设计推断。

**导入形态（实测确认）**：FormKit 只能从 `@lobehub/ui/base-ui/form` 子路径导入（package.json exports
`./base-ui/form` → `es/base-ui/FormKit/`）；**base-ui 根桶不重导出 FormKit**。可用形态：
`import { Form, useForm, useWatch, type FormInstance, type FormListRenderProps } from '@lobehub/ui/base-ui/form'`，
其中 `Form` 是聚合对象（`Form.Field` / `Form.List` / `Form.Group` / `Form.SubmitFooter` 等，
`FormKit/index.mjs:17-28`）。仓内既有先例 `src/components/FeedbackModal/FeedbackContent.tsx:6`。

**J1 取值 / 设值（实测通过，一个坑）**：`setFieldsValue`→`setValues`、`getFieldsValue`→`getValues`、
`setFieldValue`→`setValue`、`getFieldValue(path)`→`getValue('a.b.c')`（点路径字符串，数字下标也是点）。
坑：**FormInstance 方法对 `FieldPath<T>` 逆变**，`FormInstance<FormValues>` 不能直接赋给
`FormInstance<Record<string, any>>` 形参 —— 动态字段名字符串的消费组件（如 RuntimeModelFieldPair）
props 用宽类型 `FormInstance<Record<string, any>>`，调用点用一次显式断言收口（同实例对象，无包装）。
`useForm<T>({ initialValues })` 的 initialValues 类型是**完整 T**（非 DeepPartial），首页只灌部分字段时
直接不传（加载后 setValues 灌值即可，且 api 源 setValues 会同步 dirty 基线，`instance.mjs:setValues` +
`tanstack.mjs setValue: source==="api" 时 baseline=setBy`）。

**J2 校验（实测通过）**：`await form.validateFields()`（拒绝抛 errorFields）→
`const { valid } = await form.validate(); if (!valid) return;`（错误落 `errors: Record<path,message>` 并由
Form.Field 渲染在字段下方；`Form.validate()` **不抛异常**，提交分支写法见
AdminDefaultSettingsPage.handleSave）。`rules:[{required,message}]` → `required="message"` +
`validate(value)=>string|undefined`（两者都在 FieldControl 内合并执行，`Field.mjs:validatorRef`）。
errorFields 语义降级说明：不需要逐字段 errorFields 结构的文件（本试点全部）直接用 `{errors,valid}`，
`{valid:false}` 即提交中断；需要 errorFields 分支的文件（useSignIn.ts 等）留待 P1 逐文件判。

**J3 动态字段（实测通过，两个坑）**：antd `Form.List` → FormKit `Form.List`。坑 1：render 签名是
**单参对象** `{ fields, add, remove, move }`（`FormListRenderProps`），不是 antd 的
`(fields, {add,remove})` 双参；fields 元素是 `{index,key,name:"parent.N"}`，子字段 name 拼点路径
`` `${field.name}.label` ``。坑 2：`newItem` prop 承担 antd `add(初值)` 的角色（List 内部
`structuredClone`），外层 `Form.Field`（无 name）只做布局。嵌套取值
`form.getValue(\`avatarPresets.${field.index}.value\`)`需`as any`收口 FieldPath 字面量类型。 **行为差异（如实记录）**：Form.List 渲染错误行不带 antd 的红框语义，错误文案由`required`在裸`Form.Field` 下方渲染；`bare\` 字段校验错误同样内联渲染（ProfileDefaultsCard 3 个 required 字段）。

**J4 联动（实测通过）**：`Form.useWatch(name, form)` → `useWatch(form, name)`（参数序对调）。api 源
`setValues` 同样触发 useWatch 重渲染（`useStoreSelector` 订阅 engine store，setValues→setValue→notify
全链通知，`tanstack.mjs`），SWR 灌值 → 供应商联动显示的时序与 antd 一致（六对模型对的联动显示测试
原断言全过）。

**J5 / 试点 A 落地形态（实测通过）**：`<Form form layout="vertical">` + 子组件持 `FormInstance` 类型 +
`Form.Field(name,label,extra,valueProp,validate,render,hidden,bare,style)`。**坑（antd 有而 FormKit 无）**：
① `valuePropName="checked"` → `valueProp="checked"`（Switch 接受 `checked`+`onCheckedChange→onChange`
转发，`Switch.mjs`）；② **FormProps 无 `disabled`**（HTMLFormAttributes 无此属性，antd 的字段级禁用
经 Form context 下发，FormKit 无等价面）—— 现有代码以 rest 透传给原生 `<form>` 收口（Firefox 降级语义 +
注释说明），跨浏览器字段禁用是**已知残留差异**，后续批次遇到 loading 禁用场景需逐字段 `disabled` 传递或
容器层 opacity/pointer-events 方案，立项层面记为 FormKit 待补能力；③ 子元素绑定探测依赖
`child.type.formBinding`（`binding.mjs`），Input/TextArea/InputPassword/InputNumber/Checkbox 已内建
（emptyValue/checked），**Select/AutoComplete/Switch 未声明**（走默认 onChange+value 绑定，本次实测可用）；
④ FieldControl 的 onChange 先转发 child onChange 再 `engine.setValue(name, defaultGetValue(args))`——
需要 "选中的是映射值而非原始串" 的场景（AutoComplete 选中项写入 model 短名）用 **`getValue` 覆写**
（FieldRenderProps 之外的 FieldBinding 面，`FormFieldProps.getValue`）实现映射，不要用 render prop
（render 会丢 label-for 关联，Form.Field 在 render 模式不给 child 注入 id/aria）。

**试点 B 判据结论（#14 useDesktopSettingsFormSync.ts，未落地、豁免保留）**：
该 hook（55 行）全部命令式面 = `form.setFieldsValue(synchronizedValues)`（`useDesktopSettingsFormSync.ts:25`），
FormKit 等价 = `form.setValues`（DeepPartial 入参、api 源可选项，语义覆盖）。**单文件类型迁移可行但无意义**：
三个消费者 BrandPage.tsx:34 / DistributionPage.tsx:40 / UpdateSettingsPage.tsx:47 各自
`Form.useForm<DesktopSettingsValues>()` 并把实例传给 hook 与 `<Form onValuesChange={markEdited}>`
（BrandPage:106 等）+ `form.validateFields()`（BrandPage:47 等）+ `isDesktopFormValidationError`
（检查 `errorFields` in error，`desktopSettingsForm.ts:9-10`，**按 ask 硬约束未改动**）。
FormKit 侧 `onValuesChange` 挂在 `useForm({...})` options 而非 `<Form>` prop、`validate()` 不抛
errorFields—— 三页必须同步换 `useForm` + Field 面（合计 31 个 Form.Item，全在 A 类 P2b 清单），
否则该 helper 的调用契约（antd FormInstance）断裂。**最小迁移切片建议（P2b DesktopControlCenter 批次）**：
① 三页 + hook 同批（hook 是共享类型枢纽）；② `isDesktopFormValidationError` 的 errorFields 检查改为
`validate()` 返回的 `errors` 非空判断或错误对象形态约定（需先定 FormKit 侧提交错误契约 —— 属 J2 全局
判据落点，建议在该批次先给 helper 出迁移说明再动手）；③ `onValuesChange` 的
`(changed, allValues)` 双参语义与 `useForm({ onValuesChange })` 一致，`markEdited` 可原样接入。
预测工作量：4 文件一批、半天。

**P0 批次门禁自证（实测数字）**：豁免 74 → 66（`git grep -l "eslint-disable-next-line no-restricted-imports" -- src tests | wc -l`，
差集恰好为本批 8 文件：#45/46/47 + #2/6/7/8 + 测试 #33，零新增）；Admin 套件
`node node_modules/vitest/vitest.mjs run --project app src/features/Admin` = 109 文件 / 597 测试全绿；
tsgo 全仓 0 新增（本批触点 0 错误）；53→45（B 类 -3 + 试点 A 4 生产文件 + 测试 #33 随迁 -1+... 见 §2
状态列更新）。

### 3.3.2 P1 auth 域实测结论（第十二轮，wt-round12 @ 7e9fd93689 + FormKit P1 批次）

> 实测对象：#35-#41 七个生产文件 + #42 AuthAgreement.test（随迁）+ 为保持行为等价而触达的
> `src/app/[variants]/(auth)/signin/page.tsx` 接线文件。结论全部来自 `@lobehub/ui@5.57.1` FormKit 源码实读
> （`Field.mjs` / `engine/tanstack.mjs` / `instance.mjs`）+ 迁移后真跑测试，非设计推断。实现形态与 upstream
> 已迁移版本（`src/features/Auth/**`）逐点对齐，仅保留 fork 的 next/navigation/brand/props 契约。

**J2 errorFields 判据（本域主考场，结论：`errorFields` 结构可完全退场）**：

- **唯一真实使用点**是 `useSignIn.ts` 旧第 119 行：`if (!(error as any)?.errorFields)` 用来区分
  `validateFields(['email'])` 的校验拒绝（错误已内联渲染 → 不弹 toast）与真实异常（toast）。FormKit
  `form.validate(names?)` **resolve `{ errors, valid }` 且不抛异常**（`engine/tanstack.mjs:validate`），因此：
  `targetEmail || (await form.validate(['email']).then(({ valid }) => (valid ? form.getValue('email') : null)))`
  —— `!valid` 即返回 false（提交中断、错误留在字段级），catch 分支只处理真实异常并 toast。旧分支的
  “校验失败不 toast / 真实错误 toast” 二义性由 `valid` + catch 两段显式承担，**无静默吞错**。
- **错误展示路径保持不变**：登录失败的内联密码错误由 antd `form.setFields([{ name:'password', errors:[msg] }])`
  改为 `form.setErrors({ password: msg })`；FormKit 将其写入 `serverErrors`，`Field.mjs` 的
  `errorNode = field.error && !bare` 渲染在字段下方（`instance.mjs:errorOf` 优先级
  serverErrors > fieldErrors > formErrors），用户再次编辑该字段时 `afterUserChange` 清除 serverErrors。
  实测：`useSignIn.test.ts`（31 tests）断言 `setErrors({password:'Invalid credentials'})` 且**不**弹 toast；
  `SignInPasswordStep.test.tsx` 新增用例真实渲染 FormKit Form.Field，`setErrors` 后断言
  “Invalid credentials” 内联可见。**没有任何消费点需要 `errorFields` 的字段路径数组结构**；
  逐字段 message 由 `errors: Record<path,message>` 覆盖，提交中断由 `!valid` 覆盖。
- **J1 映射实测**：`setFieldsValue`→`setValues`（本域用单字段 `setValue`）、`getFieldValue`→`getValue`、
  `resetFields(['password'])`→`resetField('password')`（只重置该字段值 + dirty / 错误，等价 antd 单字段 reset）。

**J4 dependencies 跨字段判据（结论：`deps` + validate 第二参达到行为等价）**：

- antd `Form.Item dependencies={['password']}` + `({ getFieldValue }) => validator(_, value)` 改为
  FormKit `Form.Field deps={['password']}` + `validate={(value, values) => ...}`：第二参是引擎在**校验时刻**
  的 values 快照（`Field.mjs` 把 `values` 透传给 validator），与 antd `getFieldValue` 同源。
- 重校验时序实测：`engine/tanstack.mjs:afterUserChange` 在用户改动 path 后，对
  `registration.deps?.includes(path) && isTouched(other)` 的字段执行 `runField(other, true)` —— 即
  “依赖字段被触碰过才重校验”，与 antd 依赖字段已交互后的行为一致。新增
  `BetterAuthSignUpForm.test.tsx`：密码 / 确认密码输入不一致 → 提交出现
  `passwordMismatch`（提交使全部字段 touched）→ 仅改密码为一致值（不再提交）→ 错误自动消失，1/1 绿。
  `ResetPasswordContent.tsx` 的 `dependencies={['newPassword']}` 采用同一形态。
- 结论：**不需要自建 useWatch 监听重算**；`deps` 已是原生能力（`FormFieldProps.deps: FieldPath<T>[]`，
  `type.d.mts`）。

**本域其余迁移形态（实测）**：

- `useForm({ initialValues, onSubmit })` 在 hook 层创建（`useSignIn` / `useSignUp` / `useResetPassword`）；
  `Form` 的原生 submit 会先 `form.submit()` 校验全部注册字段，`valid` 后才调用 `onSubmit`，因此
  `onFinish` 的顺序语义（校验通过 → 业务提交）保持一致。**agreement 门闸随之上移**到 `useSignIn` /
  `useSignUp`（与 upstream 同构），`signin/page.tsx` 仅做 props 接线；否则组件级 `useAuthAgreement` 会话与
  submit 闭包会分裂成两个 state 实例，勾选后仍会弹确认框（行为不等价）。
- antd `rules` 的 required/min/max/type:'email'/format 合并为单个 `validate`（按原顺序返回首个错误，
  `Field.mjs` 的 required 短路优先于 validate）。signup 的 `{type:'email'}` 规则按
  `@rc-component/async-validator` 原正则逐字复刻（含 320 字符上限，仅调整 lint 要求的转义与 `eslint-disable`
  注释），避免换成 sign-in 的宽松 EMAIL_REGEX 造成边界行为漂移。
- 布局等价：antd `Form.Item` 默认 `margin-bottom: 24px` → FormKit Field
  `style={{ gap: 0, paddingBlock: '0 24px' }}`（upstream 同款）；按钮不再需要 `Form.Item` 包裹。
- 测试 mock 边界随迁：`useSignIn.test.ts` 的 antd `Form.useForm` mock 改为 FormKit `useForm` mock（断言
  `setErrors` / `resetField`）；SignIn 两个组件测试改为传入真实 `useForm` 实例；`AuthAgreement.test.tsx`
  改用 FormKit `useForm`（#42 随迁）。

**P1 批次门禁自证（实测数字）**：auth 8 个测试文件（7 个既有 + 新增 BetterAuthSignUpForm.test）
**60/60 tests、8/8 files 全绿**；触达 13 个文件 eslint **0 error / 0 warning**；全仓 tsgo 对 auth 域 **0 错误**
（当日全仓仅 5 条错误位于 `src/features/Admin/moduleApps/apps/entitlements/ModuleAppEntitlementsPage.tsx`，
属并行的 P2a 施工线，与 P1 无关）；registry `registry.test.mjs` 13/13 + `verify.mjs` 全 changed files 已登记；
本批 8 个文件的 `no-restricted-imports` 豁免行全部删除（工作区共享，当前全仓豁免计数 47 含其他施工线并发改动，
不单独归因）。

### 3.3.3 P2b/P2c 自包含批次实测结论（第十四轮，wt @ 1b1cdb5ba0e7 之后）

> 实测对象：DesktopControlCenter（useDesktopSettingsFormSync + BrandPage / DistributionPage /
> UpdateSettingsPage / CreateDesktopReleaseModal）、Providers（InstanceFormModal + GroupFieldsRow）、
> AdminNotificationsPage、AgentChat、RecordForm，共 10 个文件。结论来自 `@lobehub/ui@5.57.1` 实跑。

- **J2 动态校验**：`rules={[{required,message}]}` → `required="message"`；`rules=[{pattern}]` /
  `{type:'url'}` / `{min,max,type:'number'}` 没有 FormKit 等价 rule，改为 `validate(value)` 返回错误串。
  **pattern 对空值的语义**：antd 的 pattern 不校验空串，FormKit 的 `validate` 会执行，需显式
  `if (value == null || value === '') return undefined`，否则可选字段会被误报。
- **`disabled`**：FormKit `FormProps` 没有 `disabled`，`Form` 也没有字段上下文禁用面。本轮用
  `<fieldset disabled={...}>` 包住字段区（重置 border/margin/padding/minWidth），跨浏览器语义与 antd 一致。
- **`onValuesChange`**：它是 `useForm` 的 option，不是 `<Form>` prop。共享 hook 必须自己创建实例：
  `useDesktopSettingsFormSync({hasData, initialValues, onDirtyChange})` 返回 `{form, dirtyFields, markSaved}`；
  `useForm` 内部用 latest-options ref，回调每次渲染更新即可。
- **J1 类型收口**：`useForm<T>()` 的泛型必须写全，否则 `getValues()` 返回 `FormValues`，传给
  `buildProviderInstancePayload` 等强类型函数直接 TS2739。编辑回填不要 `...initial`（行里含
  `null`、`apiKeyStatus`、`id`），值类型要求 `string | undefined` —— 逐字段 `?? ''` 映射，既过类型也不污染表单值。
- **提交语义**：原生 submit（`htmlType="submit"`）由 FormKit `Form` 接管：`form.submit()` 校验后调用
  `useForm({onSubmit})`。需要闭包内 state 时用 ref 转发（RecordForm 的 `submitRef`）。
- **必填标记与测试**：FormKit 在 label 内渲染真实 `*` 文本节点（antd 是 CSS 伪元素），
  `getByLabelText('Title')` 精确匹配会失败 → 沿用第十二轮结论，改 `{exact:false}`。
- **行数红线**：InstanceFormModal 迁移后 303 行 → 把 `isAbsoluteUrl` 移到
  `adminProviderInstanceForm.ts` 后 292 行。AdminNotificationsPage 300 行整 → 渠道区抽成
  `Notifications/ChannelSettingsSection.tsx` 后 248 行。**迁移前先看 wc -l，别等门禁拦。**

### 3.4 同文件混合导入约定（迁移时沿用第八轮规范）

普通组件 base-ui、Form 系留 antd 的混合文件在迁移时遵循第八轮已固化的拆行规范（报告 ②共性替换模式第 6 条）：
`import { Form, Input, Switch } from 'antd'` → `import { Form } from 'antd'`（豁免行）+
`import { Input, Switch } from '@lobehub/ui/base-ui'`。FormKit 落地后该规范自然消失 —— 整行删除豁免。
三个测试豁免文件（#33/34/42）随被测组件迁移自然消失，**不单独迁移**。

---

## ④ 分阶段路线（P0 → P3）

> 每阶段一个 worktree 独立批次执行；阶段间串行，阶段内可按文件并行。所有阶段共享 §5 验收门禁。

### P0：试点 + B 类清尾（预计半天 - 1 天）

1. **B 类 3 文件机械硬迁**（#45/46/47）：`import { FormGroup } from '@lobehub/ui'` 根桶 →
   `import { FormGroup } from '@lobehub/ui/base-ui'`（或与其他 base-ui 导入合并行），删豁免行。
   About.tsx:4 是既有先例；三文件均为纯静态分组（用法行见 §2 B 类表），预期零行为变化。
   53 → **50**。成对验证：cron 编辑页、Business 移动设置页的既有测试套件跑绿（单目录，不跑全量）。
2. **FormKit 试点先行**：选 **#14 `useDesktopSettingsFormSync.ts`（全文件仅 FormInstance 类型）+ #2
   `AdminDefaultSettingsPage.tsx`（全文件仅 Form 系）** 做首个受控语义重写试点 —— 零 UI 面，能最快暴露
   J1/J2 判据在真实代码里的坑（同步逻辑读值、settings 分区保存链路）。试点结论回写本文档 §3.3。
   ✅ **第十一轮 P0 已执行**：#2 连同其类型闭链 #8（SectionFields）+#6（RuntimeModelFieldPair）+#7
   （ProfileDefaultsCard）+ 测试 #33 一起换 FormKit（4 生产 + 1 测试，比原计划多 3 个 ——SectionFields
   把 form 下传给 #6/#7，不连带则 FormInstance 类型跨文件断链，实测无法只迁两文件）。Admin 套件
   109 文件 / 597 测试全绿。实测结论见 §3.3.1。#14 只交付判据结论（§3.3.1 试点 B 段），豁免保留待
   P2b DesktopControlCenter 批次三页联动迁移。
3. P0 完成态：53 → **45**（B 类 -3 + 试点 A 生产 4 个 -4 + 随迁测试 #33 -1；#14 未落地不计）。
   原文 "53 → 47" 基于两文件试点估算，实测因 #2 的类型闭链扩大到 5 文件（含 1 测试豁免），净减更多。

### P1：auth 域 7+1 文件（表单小、测试面窄）

- 范围：#35-#41 + #42（AuthAgreement.test.tsx 随迁）。common：每文件 1 个 Form 表单、2-4 个字段，
  校验集中在 email/username 正则 + required + 跨字段（reset-password 的确认密码）。
- 建议批次：① signin 三件套（SignInEmailStep/SignInPasswordStep/useSignIn，共享 useSignIn 的 errorFields 分支，
  **J2 判据的主考场**）；② signup 两件套（useSignUp/BetterAuthSignUpForm，`dependencies` 跨字段判据）；③
  reset-password 两件套 + AuthAgreement.test。
- auth 域特殊注意：认证流程页有 `(auth)/_layout` 的测试包裹器，登录 / 注册冒烟测试必须逐文件成对跑绿；
  BetterAuthSignUpForm 曾遗留基线既有 warning `no-location-assign-relative-destination`（报告 g4 记录），
  迁移不得使其净增。
- ✅ **第十二轮已执行**（wt-round12，三批串行、每批成对测试后进入下一批）：7 个生产文件 + #42 测试迁移完成，
  额外触达 `signin/page.tsx` 接线（agreement 上移后 props 传递）；新增 `BetterAuthSignUpForm.test.tsx`
  作为 J4 `deps` 行为证据。实测结论见 §3.3.2。验收：auth 8 文件 / 60 tests 全绿、触达文件 eslint 0/0、
  tsgo auth 域 0 错误、registry 双门禁通过、8 个豁免行全部删除（P0 完成态 45 再 -8 = **37**；工作区实测
  计数 47 是三条施工线共享树的并发结果，见 §3.3.2 计数说明）。

### P2：Admin 稠密表单域按页分批（32 个非测试 + 2 个测试）

- 按 "先低难度（全文件仅 Form 系，整行删豁免）、再中难度（单条 Form 导入行混合文件）、后高难度（Form.List/ 联动）"：
  - **P2a 低 6 个** ✅ 全部完成：#2（P0）、#13/22/23/24（第十二轮）、#14（第十四轮随 DesktopControlCenter 三页联动）。
  - **P2b 中 24 个**：✅ 本轮完成自包含 8 个 ——DesktopControlCenter #3/9/10/11/12 + #14、Providers #27/28、
    AdminNotifications #1；连同 P0/P2a 已完成的 #6/8/17/19/20/21/22/23/24。**剩余 9 个全部父页阻塞**：
    \#5 PolicySections（AdminModelPolicyPage）、#15 SpacePreview / #16 EntryMetaFields / #4 CardListFields
    （AdminExpertPlazaPage）、#25 FeaturedSection（AdminOperationsPage）、#26 ChannelCards（ChannelSettings）、
    \#29 SectionCards（AdminRecommendationsPage）、#30/#31 SettingsCards/SettingsTabs（AdminSettingsPage）、
    \#32 PackageFormFields（AdminTopUpPackagesPage）—— 子组件不创建实例、依赖 antd 隐式上下文，必须与父页同批。
  - **P2c 高 4 个**：~~#7 ProfileDefaultsCard~~（P0）、~~#18 PageEditor~~（P2a）、~~#43 AgentChat~~ / ~~#44 RecordForm~~
    （**第十四轮完成**：AgentChat 改用 FormKit `itemsType="group"` + `useForm({onSubmit})`；RecordForm 用
    `required` + `validate` + `submitRef` 承接原生 submit）。#4 CardListFields 仍父页阻塞（见 P2b 剩余项）。
- Admin 域硬约束（沿用现有规则）：非测试 .tsx ≤300 行 ——`AdminNotificationsPage.tsx` 迁移前 300 行整，
  第十四轮已把渠道区抽成 `Notifications/ChannelSettingsSection.tsx`（页面降到 248 行）；`DetailSections.tsx`
  290 行同理（报告 ⑦）。`AdminNotificationsPage` 同时是 I18N 六条共享线之一涉及文件的近邻，但 FormKit
  迁移**不改任何既有 t key**（i18n key 与中英文值全部原样保留；本轮只新增校验文案 key）。

### P3：C 类 6 个逐个判据评审（本立项只评审、不实施）

每个文件单独立项评审其专项方案是否满足行为不变（§3.3 判据思路 + §6 三个明确不碰项），
评审通过一个迁一个；评审不通过则该文件豁免长期保留并在 registry 注释里挂上理由。

---

## ⑤ 每阶段验收门禁

- **行为不变**：阶段 diff 中不得出现 t key /i18n 值 / 路由 / API 调用参数的变化；表单提交 payload 字段与
  迁移前逐字段一致（每文件至少一条提交断言测试）。
- **测试契约逐文件判据**：
  - 迁移文件有成对测试的：测试跑绿且断言对象不变（只允许 mock 位置 / 包装器随组件搬家，断言语义不得改）。
  - 无测试的 Admin 文件：至少补一条 "提交 payload 不变" 冒烟断言或明确登记到当轮风险说明。
  - 三个测试豁免文件（#33/34/42）随被测组件消失豁免时，测试断言零改动（仅 import 来源变）。
- **豁免数只减不增**：每阶段结束时
  `git grep -l "eslint-disable-next-line no-restricted-imports" -- src tests | wc -l` 的数字必须 **≤** 阶段开始值，
  且每批次 `git status` 中被删豁免行的文件清单与本表一一对应。终态目标 74 → **27**（21 历史基线 + C 类 6）。
- **CI 同 scope 门禁全绿**（子代理只跑单文件 / 单目录，全量由脚本代跑）：
  - lint：`pnpm exec eslint src tests --concurrency=auto` 0 error，**warning 基线 168 不得净增**；
  - tsgo：`node node_modules/@typescript/native-preview/bin/tsgo --noEmit` 0 error；
  - registry 双门禁：`node scripts/comhub-customizations/registry.test.mjs && node scripts/comhub-customizations/verify.mjs` exit 0；
  - Admin 套件 /business-server/database 按现行门禁命令（见各轮任务书，此处不复制）。
- **300 行上限**：Admin 非测试 .tsx 全部 ≤300（现知零余量文件：AdminNotificationsPage 300、DetailSections 290）。
- **禁改清单**：`packages/business/const/src/branding.ts`、`apps/server/src/globalConfig/index.ts`、任何
  package.json/ 依赖 /migration；B11 授权改动严禁。

---

## ⑥ 风险与不做的事

### 6.1 三个 P3 起步都不碰的文件（报告 ⑦ 已逐条给出理由，本节原文复述）

1. **`MobileConfigPreview.tsx`（#50）的 radio 契约**：base-ui Segmented 渲染 toggle button（aria-pressed），
   antd Segmented 渲染 radio；配对测试契约 `getByRole('radio')`（MobileConfigPreview\.test.tsx:152,161）。
   第八轮实测：迁移后 11/11 失败、回退后 11/11 通过。迁移即违反行为不变 —— 除非先改测试契约（属可访问性
   语义变更决策，需单独裁决），否则永不迁移。
2. **`UsageTable.tsx`（#51）的 Dayjs 链**：DatePicker.RangePicker 的 value/onChange 是 Dayjs 对象契约，
   dateRange 过滤链 dayjs.isBefore/isAfter 全链耦合；base-ui DateRangePicker 是 Date 契约。迁移 = 重写统计
   过滤逻辑，行为风险高收益低。
3. **`InlineTable.tsx`（#48）的 `.ant-table` 类名耦合**：createStaticStyles 硬编码 `.ant-table*` 选择器，
   4 个消费方传 antd 特有 props（报告原文列举 Billing.tsx:362 等）；换 base-ui Table（tanstack 重写）属 UI 重写，
   需产品确认 Empty 状态样式后再立项。

### 6.2 其他已知风险（承接第八轮遗留清单）

- **base-ui Text 默认 `<div>` 的 inline→block 风险（约 170 处迁移点）**：FormKit 批次触及这些文件时顺带
  抽查混排处，但不主动扩大修复面（报告 ⑦ 遗留 1）。
- **`type="secondary"` 色差 /toast 层级差**：上游语义差异，已接受为已知；FormKit 批次不得引入新的同类差异
  （报告 ⑦ 遗留 2）。
- **300 行零余量文件**：任何 FormKit 触碰都先拆分（§5 门禁）。
- **worktree 并发竞态**：第八轮共享 worktree 的 stash/pop 曾两次造成迁移丢失（报告 ②过程事件）。
  FormKit 批次执行时**每批次独占 worktree**，禁止共享。
- **FormKit 方案本身的选型风险**：§3.3 的 J1-J4 若在 P0 试点中发现 base-ui Field 体系无法低成本承载
  （尤其 errorFields 等价分支），FormKit 可能需要包一层自研 hook—— 这属于 P0 试点的交付物之一
  （试点结论回写本文档），不阻塞 B 类硬迁（B 类与 J5 判据无关）。

### 6.3 明确不做的事

- 不动 21 个历史基线豁免文件的判据（AdminDataTable、ContentPage、AdminPlanFaqCard 等的 keep-antd 注释）；
  FormKit 完成后如需收敛它们，另行立项（可复用本文档 §3 判据）。
- 不做 antd 全量下线评估；不改 `eslint.config.mjs` 的禁令规则本身（第八轮已确认 serverSide 变体仅修浏览器
  边界误报、antd/@lobehub/ui 禁令原样保留，报告 ④）。
- 不引入新依赖（FormKit 首选基于现有 `@lobehub/ui/base-ui` Form/Field 组件族 + 自研受控 hook 组合，
  不引 react-hook-form 等三方库；若 P0 试点证明不可行，先升级说明再议）。

---

## 附录 A：本会话事实核验清单（wt-round10，main @ acdb0f54e4）

| 核验项                  | 命令 / 读取                                                                                                               | 结果                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 豁免总数                | `git grep -l "eslint-disable-next-line no-restricted-imports" -- src tests \| wc -l`                                      | 74 文件                                                                                                                                                                                                                                                                 |
| 第八轮新增差集          | `git grep`@a620823f399f（21）与当前树 `comm -13/-23`                                                                      | 新增 53、消失 0；与报告 ③ 53 文件逐一吻合                                                                                                                                                                                                                               |
| 53 分类复算             | 按 ③ 表逐文件归类                                                                                                         | A 44（A-1 32 + A-2 2 + A-3 7 + A-4 1 + A-5 2）+ B 3 + C 6 = 53；报告 A-3 段 "6 个非测试" 为笔误（表体 7 行），其总账 "auth 8" 正确                                                                                                                                      |
| 代表文件 1              | 实读 `src/features/Admin/AdminNotificationsPage.tsx`（300 行整）                                                          | `:15-16` 豁免行 + `import { Form } from 'antd'`；`:61` Form.useForm、`:178-186` Form.Item noStyle + 嵌套 name 数组、`:160` valuePropName="checked"、`:68` setFieldsValue、`:74/:97` validateFields——A 类判据句逐条坐实                                                  |
| 代表文件 2              | 实读 `src/app/[variants]/(auth)/signin/SignInEmailStep.tsx`                                                               | `:3-4` 豁免 + `import { Form, type FormInstance } from 'antd'`（FormInstance 类型进了 props 契约 `:41`）；`:163-177` Form.Item name+rules（EMAIL_REGEX/USERNAME_REGEX validator）；同文件 Alert/Button/Input/Text 等已 base-ui——"混合文件只剩一条 Form 导入行" 画像吻合 |
| 代表文件 3              | 实读 `src/features/Admin/MobileConfigPreview.tsx:3-4`                                                                     | 豁免注释原文与报告 ③C#50 一致（radio vs aria-pressed + getByRole ('radio') 契约）；根桶 `Icon, Segmented` 导入在位                                                                                                                                                      |
| About.tsx 硬迁先例      | `sed -n '1,8p' src/features/Settings/about/features/About.tsx`                                                            | `:4` `import { Divider, Form } from '@lobehub/ui/base-ui'`，无豁免行 ——B 类硬迁可行性的直接证据                                                                                                                                                                         |
| base-ui FormGroup 导出  | `grep -n FormGroup node_modules/@lobehub/ui/es/base-ui/index.d.mts`                                                       | `:83,:169` 导入、`:231` 导出列表含 `FormGroup, type FormGroupProps, type FormGroupItemType`                                                                                                                                                                             |
| B 类三文件用法          | grep 实读 BusinessMobileSection.tsx:3-4,169 / CronJobContentEditor.tsx:13-14,70,96 / CronJobScheduleConfig.tsx:4-5,65,127 | 三文件均为静态分组（title/variant/collapsible/extra/gap），豁免仅对应 FormGroup 导入行                                                                                                                                                                                  |
| base-ui Form 无命令式面 | 实读 `node_modules/@lobehub/ui/es/base-ui/Form/type.d.mts`（全文）与 `Form/index.d.mts`                                   | FormProps 数据驱动（items/initialValues/onFinish）；FormContextValue 仅 hasUnsavedChanges/submitLoading/requestReset 等；导出面无 useForm/FormInstance——§3.2 结论的直接依据                                                                                             |
| errorFields 使用        | `grep -rn "errorFields" src`                                                                                              | `src/app/[variants]/(auth)/signin/useSignIn.ts:119` 等；AdminExpertPlazaPage.tsx:5 等 6 个历史豁免文件注释原文引用该判据                                                                                                                                                |
| Form.List 现状          | `grep -rn "Form\.List" src`                                                                                               | `AdminPlanFaqCard.tsx:105`（历史基线豁免文件）等                                                                                                                                                                                                                        |
| CI Lint step            | `grep -n "eslint src tests" .github/workflows/comhub-pr-check.yml`                                                        | `:71-72` `pnpm exec eslint src tests --concurrency=auto`，位于 tsgo step 之前                                                                                                                                                                                           |
| registry 归属           | 实读 `scripts/comhub-customizations/registry.mjs` repo-infra 模块（:1381-1485）                                           | `p:docs/` 归属 repo-infra（"conservative over-cover: also claims fork-new files (fork docs at docs/root…)"）—— 本新文档无需新增登记，`verify.mjs` 门禁自然覆盖                                                                                                          |
| formkit 名称占用        | `grep -rin "formkit" src`                                                                                                 | 仅存在于豁免注释文案（"迁 FormKit 属另行立项"）—— 文档名与未来代码命名不冲突                                                                                                                                                                                            |
| git status              | 本文件写入前后各一次                                                                                                      | 见附录 B                                                                                                                                                                                                                                                                |

未做（如实声明）：未跑任何 vitest/eslint/tsgo（本立项只写文档，无代码改动，门禁类核验属 P0 执行批次职责）；
未读第八轮报告以外的历史报告全文；未触碰生产与远端。

## 附录 B：自证

- 写入本文件前：`git status --porcelain` 输出为空（wt-round10 干净）。
- 写入后唯一改动：`?? docs/development/comhub-formkit-initiative.md`（untracked 新文件，无其他改动）。
- 字数与覆盖面：约 1.1 万字（中文正文，含表格），覆盖 53/53 个豁免文件（A 44 + B 3 + C 6 全表逐行列出），
  另引用 2 个先例文件（About.tsx、AdminPlanFaqCard.tsx）与 4 个消费方 / 测试文件。
