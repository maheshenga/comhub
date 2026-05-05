# Comhub 充值 + 计费完整修复设计

日期: 2026-05-05
状态: Approved

## 概述

Comhub（玄果）平台基于 LobeHub fork，采用卡密分发模型：后台生成算力卡密 → 用户在淘宝购买 → 平台兑换获得算力。本次迭代全面修复计费和充值流程，并填充所有二级缺口，确保架构兼容后续迭代（支付宝接入、存储配额等）。

## 设计决策

### 方案选择：共享工具 + 独立桩填充（方案 C）

在 `CommercialModel` 上封装 `preCharge()` / `postCharge()` 共享工具方法，不重构已有 chat billing 流程。各桩函数调用共享方法但保留独立入口点，兼顾一致性与灵活性。

**未选方案**：

- A（镜像 chat 模式）：6 个文件重复逻辑，视频 3 入口易不一致
- B（统一中间件）：需重构已工作的 chat billing，回归风险高

## 1. 计费架构 — 共享工具层

### CommercialModel 新增方法

#### `preCharge(userId, estimatedCredits, db) → { orderId, creditAccountId }`

- 内部调用 `canStartChatUsage()` + `ensureCreditAccount()`
- 余额不足时抛出错误
- 返回预检结果供桩函数决定是否放行

#### `postCharge(userId, params, db) → void`

- params: `{ source, provider, model, credits, points, metadata }`
- 内部调用 `consumeCreditsForAiUsage()`
- 自动写 ledger（来源优先级分配）

### 不改动的部分

- `shouldChargeCommercialUsage()` — 各桩函数自行调用
- `assertCommercialChatBudget()` — chat 专用
- `recordCommercialChatUsage()` — chat 专用
- `resolveEffectiveCost()` — 各桩函数自行调用获取成本

### 桩函数统一调用模式

```
1. shouldChargeCommercialUsage() → 是否计费?
2. resolveEffectiveCost() → 算成本
3. preCharge() → 够不够?
4. [执行业务]
5. postCharge() → 扣费记账
```

## 2. 卡密充值流程 — topUpOrders 统一化

### 数据库变更

`topUpOrders` 表新增字段：

- `source` varchar(20) — `'redemption' | 'alipay' | 'wechat_pay' | 'manual'`，默认 `'redemption'`
- `redemptionCodeId` varchar — 关联的卡密 ID（仅 source=redemption 时有值）

### 兑换流程重构

当前路径（redemption.ts, rewardType=topup_package）直接操作 creditAccount + ledger，绕过 topUpOrders。

改为：

```
1. 创建 topUpOrder (source='redemption', status='paid', provider='redemption', redemptionCodeId=code.id)
2. settleTopUpOrder() — 复用已有事务方法
3. 标记 redemptionCode 为已使用
```

整个流程在单 DB 事务中执行。

### 订单生命周期双模式

**即时完成型**（redemption / manual）：

```
创建 → status=paid（一步到位，事务内 settle）
```

**异步回调型**（alipay / wechat_pay）：

```
创建 → status=pending → 网关回调 → status=paid → settle
         ↘ 超时 → status=expired
         ↘ 用户取消 → status=canceled
```

### 支付路由预留

`lambda-routers/payment.ts`：

- `createPaymentOrder` — 创建支付订单，返回支付参数（当前骨架，return not-implemented）
- `handlePaymentCallback` — 网关异步回调（当前骨架）

后续接支付宝时只需填充这两个过程，零架构改动。

### ONLINE_PAYMENT_ENABLED 处理

删除 `CommercialModel` 中的硬编码常量。路由层各自控制：redemption 路由直接创建，payment 路由由 feature flag 控制。

## 3. 图像计费 — 桩函数填充

### chargeBeforeGenerate

```
1. shouldChargeCommercialUsage() → 不计费则 return undefined
2. computeImageCost(model, generationParams) → 算成本
3. preCharge(userId, estimatedCredits, db) → 余额不足则 throw InsufficientBudgetForModel
4. return { estimatedCredits, costDetail } → 传给 chargeAfterGenerate
```

### chargeAfterGenerate

成功路径（已有调用点）：

```
1. prechargeResult 为 undefined → return（免费场景）
2. resolveEffectiveCost() → 取实际成本
3. postCharge(userId, { source:'image', ... }, db)
```

错误路径（新增，async/image 当前无退款逻辑）：

```
1. isError=true 且有 prechargeResult → 退款
2. 退还 prechargeResult.estimatedCredits
3. ledger 记录 type='refund', 关联原 preCharge
```

### notifyImageCompleted

本次仅移除空桩注释，保留空实现。后续可扩展通知逻辑。

### 计费单位

使用 `imageGeneration` pricing unit，已有 `computeImageCost` 工具。成本 = rate × imageNum（fixed）或 lookup by quality+size。

## 4. 视频计费 — 桩函数填充

### 视频计费特殊性

3 个收费入口需统一处理：

| 入口             | 调用位置              | 场景             |
| ---------------- | --------------------- | ---------------- |
| async/video 成功 | `async/video.ts:209`  | 正常完成，后扣费 |
| async/video 失败 | `async/video.ts:289`  | 生成失败，需退款 |
| webhook 回调     | `webhook:164,233,276` | 异步回调完成     |

### chargeBeforeGenerate

```
1. shouldChargeCommercialUsage() → 不计费则 return {}
2. computeVideoCost(model, params) → 算成本
3. preCharge(userId, estimatedCredits, db) → 余额不足则 throw
4. return { estimatedCredits, costDetail, prechargeId } → 传给 chargeAfterGenerate
```

返回空对象 `{}` 语义为 "不计费"，与当前桩行为兼容。

### chargeAfterGenerate

统一处理 3 个入口：

```
1. prechargeResult 为空对象 → return（不计费）
2. isError=true → 退款路径
   - 有 prechargeResult.estimatedCredits → 退还预扣
   - 无预扣（webhook 直接进入）→ 仅记录，不扣费
3. isError=false → 正常扣费
   - resolveEffectiveCost() → 取实际成本
   - postCharge(userId, { source:'video', ... }, db)
```

### getVideoFreeQuota

```
1. shouldChargeCommercialUsage() → 不计费则 return { freeQuota: Infinity }
2. 当前无免费配额业务规则 → return null
3. 预留返回结构 { freeQuota: number | null }
```

### videoBackgroundPolling 补充

在轮询完成回调处插入：

```
if (taskResult.status === 'succeeded') {
  chargeAfterGenerate({ isError: false, ... }, ...)
}
if (taskResult.status === 'failed') {
  chargeAfterGenerate({ isError: true, ... }, ...)
}
```

复用同一 chargeAfterGenerate，保证计费一致。

## 5. Admin 订单管理 + 二级缺口

### Admin 订单管理完善

`admin/orders.ts` 新增：

| 过程        | 说明                                                           |
| ----------- | -------------------------------------------------------------- |
| `getDetail` | 查询订单详情，source 字段区分来源，redemption 类型关联卡密信息 |
| `settle`    | 手动结算 pending 订单，复用 `settleTopUpOrder()`               |

### 存储配额中间件

`checkFileStorageUsage` 填充：

```
1. 查询用户 creditAccount.storageQuota
2. quota 不为 null → 检查已用存储 vs 配额
3. 超限 → throw StorageQuotaExceeded
4. 未超 → opts.next()
```

`creditAccounts` 表新增：

- `storageUsed` bigint — 已用字节数
- `storageQuota` bigint — 配额字节数，null = 无限

存储使用量增量更新由文件上传 / 删除时触发，本次仅实现中间件检查 + schema 字段。

### 账户注销

`accountDeletion.ts` 填充：

```
1. 验证用户身份（密码/二次确认）
2. 检查是否有 pending 订单 → 拒绝注销
3. 软删除用户数据：
   - creditAccount 余额清零 + 写 ledger（type=account_closure）
   - 禁用所有 redemptionCodes
   - 取消订阅
4. 标记用户 deletedAt
5. 延迟硬删除（预留 cron job 接口）
```

本次实现步骤 1-4，步骤 5 预留接口。

### Admin 推荐分析

`admin/referral.ts` 新增：

- `getReferralStats` — 总推荐人数、已激活数、总奖励发放额
- 依赖现有 `referralRelations` + `referralRewards` 表聚合查询，无需新表

## 6. 客户端 UI + 错误处理

### 用户兑换入口

新增页面：`src/routes/(main)/topup/index.tsx` → 委托 `@/features/TopUp`

TopUp feature 包含：

- 兑换码输入框 + 兑换按钮
- 当前余额展示（复用 `getCreditAccountSummary`）
- 充值套餐展示（`listTopUpPackages`，展示名称 + 算力数）
- 兑换历史（查询 topUpOrders where source=redemption）

路由注册：桌面端路由配置中注册 `/topup` 路径。

### 商业错误提示

`useBusinessErrorAlertConfig` 填充：

- `InsufficientBudgetForModel` → "余额不足，请充值" + 跳转 `/topup`
- `StorageQuotaExceeded` → "存储空间不足"
- 其他商业错误 → 通用提示

### Admin UI 补充

- 订单管理页：新增 "详情" 和 "手动结算" 按钮
- 卡密管理页：topup_package 类型显示套餐名称 + 算力数
- 推荐分析：新增统计卡片

### 菜单入口

侧边栏 / 设置中添加 "充值中心" 入口，指向 `/topup`。

## 7. 数据流全景 + 事务一致性

### 卡密兑换完整数据流

```
用户输入卡密 → redeem procedure
  ┣ 1. 查 redemptionCodes (code, status=active, rewardType=topup_package)
  ┣ 2. 查 topUpPackages (packageId → credits, price)
  ┣ 3. DB 事务开始
  ┃   ├ 创建 topUpOrder (source=redemption, status=paid, provider=redemption,
  ┃   │   redemptionCodeId=code.id, amount=package.price, credits=package.credits)
  ┃   ├ settleTopUpOrder() → creditAccount += credits + ledger entry
  ┃   └ 标记 redemptionCode (status=used, usedBy=userId, usedAt=now)
  ┣ 4. 事务提交
  ┗ 5. 返回兑换结果
```

### 图像计费数据流

```
用户请求生成图像
  ├ chargeBeforeGenerate
  │   ├ shouldCharge? → no → return undefined (免费)
  │   ├ computeImageCost() → estimatedCredits
  │   └ preCharge() → 余额不足 throw
  ├ [执行图像生成]
  └ chargeAfterGenerate
      ├ 无 prechargeResult → return (免费)
      ├ isError → 退还 prechargeResult.estimatedCredits + ledger refund
      └ 成功 → resolveEffectiveCost() → postCharge() + ledger consumption
```

### 视频计费数据流

```
用户请求生成视频
  ├ chargeBeforeGenerate → preCharge (同图像)
  ├ [轮询/回调]
  └ chargeAfterGenerate (3个入口统一)
      ├ 无 prechargeResult → return
      ├ isError → 退还
      └ 成功 → resolveEffectiveCost → postCharge

videoBackgroundPolling 完成
  └ 复用 chargeAfterGenerate (同上逻辑)
```

### 事务一致性保障

- **兑换**：单 DB 事务，失败全部回滚
- **预扣→后扣**：不使用数据库锁，采用 ledger 双条目模式（pre-charge 一条 + settlement/refund 一条），余额通过 SUM (ledger) 计算，天然一致
- **退款**：ledger 新增 type=refund 条目，credits 为正值（加回），关联原 consumption 条目 ID

## 变更文件清单

### 数据库 schema

- `packages/database/src/schemas/commercial.ts` — topUpOrders 新增 source, redemptionCodeId; creditAccounts 新增 storageUsed, storageQuota

### Model 层

- `packages/database/src/models/commercial.ts` — 新增 preCharge/postCharge 方法；删除 ONLINE_PAYMENT_ENABLED; 修改兑换流程

### Server 桩函数

- `src/business/server/image-generation/chargeBeforeGenerate.ts` — 填充
- `src/business/server/image-generation/chargeAfterGenerate.ts` — 填充
- `src/business/server/image-generation/notifyImageCompleted.ts` — 移除空桩
- `src/business/server/video-generation/chargeBeforeGenerate.ts` — 填充
- `src/business/server/video-generation/chargeAfterGenerate.ts` — 填充
- `src/business/server/video-generation/getVideoFreeQuota.ts` — 填充

### Server 路由 / 中间件

- `src/business/server/lambda-routers/admin/orders.ts` — 新增 getDetail, settle
- `src/business/server/lambda-routers/admin/redemption.ts` — 兑换流程重构
- `src/business/server/lambda-routers/admin/referral.ts` — 新增 getReferralStats
- `src/business/server/lambda-routers/accountDeletion.ts` — 填充
- `src/business/server/lambda-routers/payment.ts` — 新增（预留骨架）
- `src/business/server/trpc-middlewares/lambda.ts` — 填充 checkFileStorageUsage
- `src/server/services/generation/videoBackgroundPolling.ts` — 插入计费调用

### Client

- `src/routes/(main)/topup/index.tsx` — 新增
- `src/features/TopUp/` — 新增 feature
- `src/business/client/hooks/useBusinessErrorAlertConfig.ts` — 填充
- `src/business/client/BusinessSettingPages/RedemptionPanel.tsx` — 卡密类型 UI 优化
- `src/spa/router/desktopRouter.config.tsx` — 注册 /topup 路由
- `src/spa/router/desktopRouter.config.desktop.tsx` — 注册 /topup 路由

### Services

- `src/services/commercial.ts` — 新增 topUp 相关方法
- `src/services/adminCommercial.ts` — 新增 order getDetail/settle, referralStats
