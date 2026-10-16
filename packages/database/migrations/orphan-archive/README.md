# 孤儿迁移 SQL 归档（orphan-archive）

本目录存放 23 个**不被 `packages/database/migrations/meta/_journal.json` 引用**的历史 SQL 文件（Drizzle 迁移链之外的 "孤儿"）。它们原位于 `packages/database/migrations/` 顶层，2026-10 第九轮整体移入本目录归档，内容**逐字节未改动**。

## 来历：上游重号冲突的原始版

这些文件是 lobehub/lobechat 上游 v2.2.7 重号冲突时期留下的**原始 SQL**：

- **0104–0109**：上游同名迁移在 ComHub 中被重命名为**同号新名**的孪生版本（如上游 `0104_add_devices_connectors_push_tokens` → 孪生 `0104_add_plan_catalog_and_app_settings`），journal 采用的是孪生重命名版；本目录保存的是上游原始版。
- **0111–0126**：同上，journal 采用的是后续重映射的孪生版本（0129 与 0153–0167 系列），本目录保存的是原始编号版。
- **0065_add_document_fields**：上游自身固有的孤儿（上游 journal 亦未引用）。

## 为什么归档是安全的

1. **Drizzle 按 journal tag 读迁移**：`drizzle readMigrationFiles` 只加载 `_journal.json` 里登记的 tag 对应文件，顶层散落未被引用的 SQL 从不参与运行时；挪入子目录对启动 / 迁移**零影响**。
2. **生产 24 张新增表全部已存在**：这批孤儿 SQL 的全部效果早已通过孪生版本（0104–0109 同号新名、0111–0126 → 0129 + 0153–0167）落到生产库。
3. **0130 建的 `platform_plugin_*` 已被 0134 删除**：即便按孤儿版本重放，相关表也已不存在于目标终态，无恢复诉求。
4. `scripts/verifyMigrationChain.mjs` 的孤儿检测只做**顶层** `readdirSync`（见该文件约 290 行），非 `.sql` 递归扫描；文件移入本目录后 warning 自然消失，journal 计数守恒（仓库 journal 232 条）。

## 如何手工补救（上游同步警示）

**如果一次上游同步落到了孤儿副本上**（即合并引入 / 恢复了上游原始文件、或 journal 条目被上游版本覆盖），**不能直接当作迁移链的一部分**：

- journal 必须**手工重映射**到 ComHub 的孪生版本：上游同号文件对应 ComHub 0104–0109 的同号新名版，或 0129 / 0153–0167 的重映射版 —— 保持 `idx` 与 tag 与生产实际执行历史一致（生产 journal 守恒数 = 212，与仓库 journal 两套口径并存，严禁增删重排已部署条目）。
- 上游新 wave 若恢复孤儿文件，应再次移入本目录归档（或删除），保持顶层只留 journal 引用的 `.sql`。
- 处理后运行 `node scripts/verifyMigrationChain.mjs`：孤儿 warning 应保持为 0（顶层无未引用 `.sql`），journal 条目数不得发生非预期变化 —— 任何 delta 都意味着合并污染了迁移链。
