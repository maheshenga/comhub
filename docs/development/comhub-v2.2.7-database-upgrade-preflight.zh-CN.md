# ComHub v2.2.7 数据库升级预检

本文记录 ComHub 升级到上游 v2.2.7 前，针对 `0129_workspace_device_and_ai_infra_surrogate_pk` 的本地 ParadeDB 演练结论和生产预检 SQL。

## 迁移范围

`0129` 是 ComHub 对上游 v2.2.7 `workspace/device/aiInfra` 结构变更的顺延迁移。它必须保留在 `0128` 之后，不能改回上游原始 `0111` 编号，因为 ComHub 生产库已经存在自定义 `0111+` 迁移链。

核心变更：

- `ai_providers` / `ai_models` 从业务复合主键改为 `_id` 代理主键。
- `ai_providers` / `ai_models` 增加 personal 与 workspace 作用域的 partial unique index。
- `devices` 从单一 `(user_id, device_id)` 唯一索引改为 personal/workspace 两套 partial unique index。
- `workspaces` 增加 `frozen`、`frozen_reason`、`frozen_at` 字段。

## 本地演练结论

环境：`docker.m.daocloud.io/paradedb/paradedb:latest`，宿主机端口 `5545`。

已完成验证：

- 空库完整迁移链可执行，`drizzle.__drizzle_migrations` 记录数为 `133`。
- `device.test.ts` server-db：`13 passed`。
- `migrationChain.test.ts` server-db：`2 passed`。
- `aiProvider.test.ts` server-db：`28 passed`。
- `aiModel.test.ts` server-db：`23 passed`。
- `workspace.test.ts` server-db：`37 passed`。
- `workspaceMember.test.ts` server-db：`28 passed`。
- 单独构造 `0129` 前状态后执行 `0129`，样本库耗时约 `212ms`。
- `0129` 前允许存在 `_id IS NULL` 的 `ai_providers` / `ai_models` 行；迁移后已补齐并切换为 `_id` 主键。
- `0129` 后验证 personal 与 workspace 作用域可以共存同一 provider/model 业务 id。
- `0129` 后验证 personal 与 workspace 作用域可以共存同一 `device_id`。

演练中确认的旧约束：

- `0129` 前 `ai_providers` 主键仍是 `(id, user_id)`。
- `0129` 前 `ai_models` 主键仍是 `(id, provider_id, user_id)`。
- 因此生产旧库不应已经存在同一用户同 provider/model 跨 workspace 重复行；如果存在，说明库已被手动改动或迁移链异常。

## 生产预检 SQL

在生产部署前，先对当前生产库只读执行以下 SQL。所有查询都应返回可解释结果；其中 duplicate 检查返回行时，需要暂停部署并人工确认数据来源。

```sql
-- 1. 当前迁移链状态：确认生产库尚未执行 0129，且最后迁移符合预期。
SELECT id, hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at DESC
LIMIT 10;

-- 2. 0129 会补齐的空 _id 行数量。返回大于 0 是正常的，但数量决定 UPDATE 扫描规模。
SELECT 'ai_providers_null_id' AS check_name, count(*) AS count
FROM ai_providers
WHERE _id IS NULL
UNION ALL
SELECT 'ai_models_null_id' AS check_name, count(*) AS count
FROM ai_models
WHERE _id IS NULL;

-- 3. 迁移前不应存在 personal 作用域业务键重复。
SELECT id, user_id, count(*) AS count
FROM ai_providers
WHERE workspace_id IS NULL
GROUP BY id, user_id
HAVING count(*) > 1;

SELECT id, provider_id, user_id, count(*) AS count
FROM ai_models
WHERE workspace_id IS NULL
GROUP BY id, provider_id, user_id
HAVING count(*) > 1;

-- 4. 迁移后 workspace partial unique index 会约束这些键；返回行需要暂停部署。
SELECT id, user_id, workspace_id, count(*) AS count
FROM ai_providers
WHERE workspace_id IS NOT NULL
GROUP BY id, user_id, workspace_id
HAVING count(*) > 1;

SELECT id, provider_id, user_id, workspace_id, count(*) AS count
FROM ai_models
WHERE workspace_id IS NOT NULL
GROUP BY id, provider_id, user_id, workspace_id
HAVING count(*) > 1;

-- 5. devices 新 personal/workspace unique index 的重复风险。
SELECT user_id, device_id, count(*) AS count
FROM devices
WHERE workspace_id IS NULL
GROUP BY user_id, device_id
HAVING count(*) > 1;

SELECT workspace_id, device_id, count(*) AS count
FROM devices
WHERE workspace_id IS NOT NULL
GROUP BY workspace_id, device_id
HAVING count(*) > 1;

-- 6. 估算 0129 相关表规模，用于判断维护窗口。
SELECT 'ai_providers' AS table_name, count(*) AS count FROM ai_providers
UNION ALL
SELECT 'ai_models' AS table_name, count(*) AS count FROM ai_models
UNION ALL
SELECT 'devices' AS table_name, count(*) AS count FROM devices
UNION ALL
SELECT 'workspaces' AS table_name, count(*) AS count FROM workspaces;
```

## 锁表和耗时风险

`0129` 包含以下会阻塞写入或要求较强锁的操作：

- `UPDATE ai_providers SET _id = gen_random_uuid() WHERE _id IS NULL`
- `UPDATE ai_models SET _id = gen_random_uuid() WHERE _id IS NULL`
- `ALTER TABLE ... ALTER COLUMN _id SET NOT NULL`
- `DROP CONSTRAINT` / `ADD CONSTRAINT ... PRIMARY KEY`
- `CREATE UNIQUE INDEX IF NOT EXISTS ...`
- `ALTER TABLE workspaces ADD COLUMN ...`

用户数不多时，这组迁移可以在短维护窗口内执行。部署前仍应备份数据库，并安排低峰窗口；如果 `ai_models` 或 `ai_providers` 行数异常偏大，需先评估是否改为分阶段后台补 `_id` 再执行约束切换。

## 部署前决策

满足以下条件后再进入生产部署：

- 生产预检 SQL 未发现 duplicate 风险。
- 数据库快照或物理备份已完成。
- 当前镜像和最近一个回滚镜像已确认保留。
- `deploy.sh` / `rollback.sh` 可执行，且指向 GHCR 新镜像的蓝绿部署链路。
- 部署窗口内允许短暂写入阻塞。

部署后必须检查：

- 应用健康检查正常。
- `drizzle.__drizzle_migrations` 最新记录为 `0129_workspace_device_and_ai_infra_surrogate_pk` 对应迁移。
- `ai_providers_pkey` / `ai_models_pkey` 均为 `PRIMARY KEY (_id)`。
- `devices_user_id_device_id_unique` 与 `devices_workspace_id_device_id_unique` 均存在。
- 首页、登录、community、后台管理、计费/会员关键路径可访问。
