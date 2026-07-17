# Admin Governance Task 9 Report

## 结论

Task 9 已完成套餐、Provider、模型删除的依赖影响预检，并补齐批量订阅变更的逐目标审计。

- 统一 `AdminDependencyImpact` contract：`blocking`、`immediateEffects`、`liveEffects`、`canProceed`、target metadata。
- 套餐删除同时检查 active subscription snapshots、plan redemption codes、pending subscription change requests（`fromPlan` 或 `toPlan`）。
- Provider/模型删除同时检查系统默认模型、plan model rules、pricing model rules、model-policy fallback。
- 删除 UI 在确认前加载并显示阻断依赖、立即影响和在线运行影响；阻断时确认按钮不可用。
- 删除 mutation 在事务内重新计算 impact，不信任前端预览结果。
- 批量订阅通过/拒绝为每个 request 写入 succeeded/failed 审计，并保留原聚合摘要；同一批次共享 correlation id。

平台在线支付继续保持关闭。Desktop OSS Secrets、Module App、Worker、部署和服务器清理边界均未改动。

## 删除行为

### 套餐

- `plans.getDeleteImpact` 提供只读预览。
- `plans.delete` 在事务内再次调用相同 impact builder。
- 任一 active snapshot、兑换码或 pending change request 都会返回 `PLAN_DELETE_BLOCKED`。

### Provider 与模型

- `newapiProviders.getDeleteInstanceImpact` 和 `getRemoveModelImpact` 提供只读预览。
- 删除 mutation 在事务内复核依赖；阻断错误分别为 `PROVIDER_DELETE_BLOCKED`、`PROVIDER_MODEL_DELETE_BLOCKED`。
- 响应详情只包含 plan key、model id、group、setting/rule index 等引用标识，不返回 API key、base URL、密文或其他 secret value。
- 若系统默认或 fallback 模型仍有匹配的 enabled route，则不会仅因删除单一路由而阻断。

## 审计行为

- 每个 bulk target 生成独立审计记录，action 为 `subscription.changeRequest.bulkApprove.item` 或 `bulkReject.item`。
- 单项审计包含 request id、target user、from/to plan、cycle、结果和错误码。
- 单项与聚合审计共享 `batchCorrelationId`，可按批次追踪。
- required audit 失败会使事务失败，不产生未审计的批量成功结果。

## 验证证据

按用户要求执行一轮 Task 9 聚焦验证，失败后只确认失败目标。

- Targeted ESLint（19 个 Task 9 TS/TSX 文件，`--fix`）：exit 0。
- `packages/business-server`：5 files，42/42 passed。
- `packages/database`：1 file，1/1 passed。
- `packages/types`：1 file，5/5 passed。
- repository frontend/service：4 files，76/76 passed。
- 汇总：124 focused tests passed。
- 首次 type-check 发现 2 个包内 alias 错误和 1 个复合主键 returning 字段错误。
- 最小确认：`newapiProviders.test.ts` 17/17 passed。
- `bun run type-check`：PASS，`tsgo --noEmit` exit 0。
- `git diff --check`：PASS。

## 残余风险

- 按用户要求未运行全量测试、全量 ESLint、浏览器/E2E 或生产数据库集成测试。
- plan/model rule 和 pricing rule 引用采用保守阻断：配置显式引用待删除路由时，要求管理员先清理配置，避免留下 stale policy。
- 预览不是写入凭证；真正删除仍以事务内重新计算结果为准。极端并发写入仍依赖数据库事务隔离，未新增全表锁或 serializable transaction。

## 独立审查修复

独立审查发现 typed-confirm Modal 在 mutation 提交期间仍可关闭，可能隐藏不可逆操作的最终结果。已修复：

- `submitting` 期间关闭按钮、遮罩点击和 Escape 均禁用。
- `onCancel` 在提交期间无操作。
- `handleTypedConfirm` 拒绝重复提交。
- 修复后 targeted ESLint exit 0，相关 frontend tests 43/43 passed，`tsgo --noEmit` exit 0。
