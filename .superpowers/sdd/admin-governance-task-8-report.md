# Admin Governance Task 8 Report

## 结论

Task 8 已完成能力边界与只读用户模型对齐：

- 新增 `adminAnyCapabilityProcedure`，用于显式声明多个能力中的任意一个即可读取。
- 新增 `users.compactDetail`，只返回 `id`、`role`、`banned`、`createdAt`、`lastActiveAt`。
- `users.fullDetail` 继续要求 `supportWrite`，finance/audit 角色不会收到邮箱、电话、订单、积分账本或审计详情。
- 模型策略改用 `systemRead/systemWrite`；模型计费矩阵分别按模型、套餐、系统设置能力读取和写入。
- `newapiProviders.getAllEnabledModels` 扩展到模型、财务、系统读取角色，但通过显式白名单投影移除 `baseUrl`、API key 等运营字段。
- 静态搜索证明 `supportRead`、`userWrite` 已无生产引用，现已从能力目录和角色映射删除。

平台在线支付继续保持关闭。Desktop OSS Secrets、Module App、Worker、部署和服务器清理边界均未改动。

## 权限矩阵

| 功能 | 读取能力 | 写入能力 |
| --- | --- | --- |
| 紧凑用户详情 | `auditRead` 或 `financeRead` 或 `userRead` | 无 |
| 完整支持详情 | `supportWrite` | `supportWrite` |
| 模型目录 | `modelOpsRead` 或 `financeRead` 或 `systemRead` | 本任务未扩大 |
| 套餐模型规则 | `financeRead` | `financeWrite` |
| 默认模型、倍率与计费设置 | `systemRead` | `systemWrite` |

矩阵页不会请求无权读取的 section，也不会显示无 `systemRead` 权限的倍率、每美元积分和默认模型操作列。所有写处理器同时执行能力短路，避免只依赖按钮禁用状态。

## 验证证据

按约束只执行一轮汇总验证；配置未收集到的 package 测试按包补跑，失败后仅重跑受影响目标。

- Targeted ESLint（18 个变更 TS/TSX 文件，`--fix`）：exit 0。
- Repository frontend tests：3 files，25/25 passed。
- `packages/business-server` tests：4 files，34/34 passed。
- `packages/trpc` middleware test：7/7 passed。
- `packages/types` admin test：5/5 passed。
- 类型修复后受影响 frontend tests：2 files，8/8 passed。
- `bun run type-check`：PASS，`tsgo --noEmit` exit 0。
- `git diff --check`：PASS。
- `rg -n "supportRead|userWrite|support\\.read|user\\.write" packages src`：只命中两个“属性不存在”断言，无生产引用。

验证期间发现并处理：

- 根 Vitest 配置只收集到 frontend tests，未重复前端测试，改为使用各 package 配置补齐未执行目标。
- tRPC 拒绝样本最初错误使用拥有 `auditRead` 的 `system_admin`，改为普通 `user` 后 7/7 通过。
- 首次 type-check 发现详情别名无法收窄和测试读取联合类型可选属性；局部修复后只重跑受影响测试及 type-check。

## 残余风险

- 按用户要求未运行全量测试、全量 ESLint、浏览器/E2E 或生产数据库集成测试。
- `getAllEnabledModels` 不再返回 `baseUrl`，这是扩大读取角色后的有意安全收紧；仓库内唯一业务消费者只使用白名单字段，但仓库外私有调用方如依赖该字段需迁移到受 `modelOpsRead` 保护的 Provider 详情接口。
- compact drawer 只展示身份、角色、状态和注册时间；跨域页面若后续需要更多字段，必须先评估 PII 所有权，不应复用 `fullDetail`。

## 独立审查修复

独立只读审查首次发现 1 个 Important 问题：权限拆分后 `finance_admin` 无法读取系统默认模型，矩阵前端的 free-plan 冲突检查会失效，而 `plans.setModelRules` 当时没有服务端不变量。

修复后，`plans.setModelRules` 和 `plans.upsert` 都会在事务写入前：

- 读取当前 chat/image/video 默认模型与 provider。
- 读取已启用模型路由并按 provider、model type、group 匹配。
- 确认 free plan 规则至少保留一条默认模型可用路由。
- 失败时返回 `PRECONDITION_FAILED / DEFAULT_MODEL_DENIED_BY_FREE_PLAN`，不写 plan、不记录成功审计。

审查修复验证：

- Targeted ESLint（`plans.ts`、`plans.test.ts`）：exit 0。
- `plans.test.ts`：10/10 passed，分别覆盖 `setModelRules` 与 `upsert` 的 finance-admin 绕过路径。
- `bun run type-check`：PASS，`tsgo --noEmit` exit 0。
- 同一审查代理最终复核：**APPROVED**，无剩余 Critical/Important 绕过路径。
