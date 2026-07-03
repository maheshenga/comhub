# ComHub v2.2.7 上线验收报告

生成时间：2026-06-23 17:11:10 +08:00

## 结论

ComHub 已完成上游 v2.2.7 合并、GHCR 镜像构建、生产部署、数据库结构升级和上线后收尾测试。当前生产容器运行健康，公开入口、版本接口、基础健康接口、后台保护跳转、数据库迁移落点和关键本地回归测试均已通过。

上线结论：通过。

需要单独说明：本次自动验收未使用真实管理员账号执行生产后台的有状态点击操作，例如修改配置、手动结算订单、触发真实 NewAPI 生成。相关代码路径、数据库结构、路由保护和回归测试已验证；真实账号操作仍建议作为人工业务抽检补充。

## 版本与提交

| 项目 | 结果 |
| --- | --- |
| 本地仓库 | `E:\code\comhub\ci-verify-3bbf64f` |
| 分支 | `upgrade/upstream-v2.2.6-comhub-merge` |
| HEAD | `722cfee33f456e419f686af1027250da192cf1a9` |
| 工作树 | 干净 |
| 上线版本 | `2.2.7` |
| 生产域名 | `https://chat.qingyouai.com` |

## GitHub Actions 与镜像

| 项目 | 结果 |
| --- | --- |
| Workflow | `ComHub Build and Deploy` |
| Run ID | `27991203628` |
| Run URL | `https://github.com/maheshenga/comhub/actions/runs/27991203628` |
| 状态 | `completed / success` |
| head_sha | `722cfee33f456e419f686af1027250da192cf1a9` |
| 生产镜像 | `ghcr.io/maheshenga/comhub:sha-722cfee33f45` |
| 回滚镜像 | `ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a` |

生产服务器镜像留存符合当前策略：保留当前 ComHub 镜像和最近一个回滚镜像。

```text
ghcr.io/maheshenga/comhub:sha-722cfee33f45
ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a
```

## 生产运行状态

部署目录：`/www/compose/comhub`

| 检查项 | 结果 |
| --- | --- |
| 容器 | `comhub-app` |
| 运行镜像 | `ghcr.io/maheshenga/comhub:sha-722cfee33f45` |
| 健康状态 | `healthy` |
| 重启次数 | `0` |
| 启动时间 | `2026-06-22T23:46:02.027638934Z` |
| 运行时长 | 刷新验收时约 9 小时 |
| `deploy.sh` | 存在且可执行 |
| `rollback.sh` | 存在且可执行 |

最近日志窗口未发现以下关键字异常：

```text
error
failed
exception
panic
Unhandled
ECONN
Prisma
```

磁盘状态：

| 挂载点 | 使用率 | 可用空间 |
| --- | --- | --- |
| `/` | `89%` | 约 `7.6G` |
| `/www` | `89%` | 约 `7.6G` |

## 公开入口与接口验收

| 路径 | 结果 |
| --- | --- |
| `/` | 未登录跳转到 `/signin?callbackUrl=...`，最终 HTTP 200 |
| `/login` | 跳转到 `/signin`，最终 HTTP 200 |
| `/community` | 未登录跳转到 `/signin?callbackUrl=.../community`，最终 HTTP 200 |
| `/discover` | HTTP 308 到 `/community` |
| `/settings/admin` | 未登录 HTTP 302 到登录页，保留 callbackUrl |
| `/settings/admin/users` | 未登录 HTTP 302 到登录页，保留 callbackUrl |
| `/api/version` | HTTP 200，返回 `{"version":"2.2.7"}` |
| `/trpc/tools/healthcheck` | HTTP 200，返回 live |

说明：`/admin` 是旧入口，当前后台基路径为 `/settings/admin`。旧入口返回 404 不作为本次故障。

## 浏览器渲染验收

使用本机 Chrome + Playwright 指定系统 Chrome 可执行文件进行真实浏览器无登录渲染检查。

已验证页面：

```text
https://chat.qingyouai.com/
https://chat.qingyouai.com/login
https://chat.qingyouai.com/community
https://chat.qingyouai.com/settings/admin
```

结果：

- 页面最终均渲染到登录页，不再停留在“加载中”。
- 页面文本包含后台配置品牌：`玄果AI`。
- 页脚版权显示：`© 2026 玄果 AI. All rights reserved.`
- 未捕获 `pageerror`。
- 未捕获 `console.error`。

浏览器中出现的 `ERR_ABORTED` 为 Next/React 路由跳转期间取消旧请求，最终页面渲染正常。

## 数据库迁移验收

本次重点数据库变更：`0129_workspace_device_and_ai_infra_surrogate_pk`

生产库只读核验结果：

| 检查项 | 结果 |
| --- | --- |
| 最新迁移 hash | `53e4276afb94d4524b314ee7b5fd6b64650a498dda3440c3b272856b3f8415ab` |
| 本地 0129 hash | `53e4276afb94d4524b314ee7b5fd6b64650a498dda3440c3b272856b3f8415ab` |
| `ai_providers_pkey` | `PRIMARY KEY (_id)` |
| `ai_models_pkey` | `PRIMARY KEY (_id)` |
| `ai_providers._id` | `uuid NOT NULL DEFAULT gen_random_uuid()` |
| `ai_models._id` | `uuid NOT NULL DEFAULT gen_random_uuid()` |
| `workspaces.frozen` | 存在，默认 `false` |
| `workspaces.frozen_reason` | 存在 |
| `workspaces.frozen_at` | 存在 |
| `ai_providers` 空 `_id` | `0` |
| `ai_models` 空 `_id` | `0` |
| personal/workspace provider 重复风险 | `0` |
| personal/workspace model 重复风险 | `0` |
| personal/workspace device 重复风险 | `0` |

关键索引均存在：

```text
ai_providers_id_user_id_unique
ai_providers_id_user_id_workspace_id_unique
ai_models_id_provider_id_user_id_unique
ai_models_id_provider_id_user_id_workspace_id_unique
devices_user_id_device_id_unique
devices_workspace_id_device_id_unique
```

生产关键表规模：

| 表 | 计数 |
| --- | ---: |
| `ai_models` | 873 |
| `ai_providers` | 60 |
| `devices` | 0 |
| `workspaces` | 0 |

## 业务数据只读健康检查

| 项目 | 结果 |
| --- | ---: |
| 用户总数 | 25 |
| admin 用户 | 3 |
| 普通用户 | 22 |
| `user_plan_snapshots` | 33 |
| `credit_accounts` | 25 |
| `credit_ledger_entries` | 2720 |
| `plan_catalog` | 5 |
| `topup_packages` | 4 |
| `subscription_change_requests` | 8 |
| `admin_newapi_instances` | 4 |
| `admin_newapi_instance_models` | 831 |
| `admin_audit_logs` | 223 |
| `app_settings` | 55 |
| `llm_generation_tracing` | 0 |

NewAPI 生产数据：

- 启用 NewAPI 实例：4。
- 模型目录合计：831。
- 模型类型分布：
  - `chat`: 671
  - `embedding`: 6
  - `image`: 62
  - `video`: 92

说明：`llm_generation_tracing` 表已存在，但当前无记录。需要触发一次真实生成链路后再验证 tracing 写入。

## 本地回归测试

已在当前 HEAD 复跑：

```text
pnpm type-check
```

结果：通过。

数据库 server-db 测试使用临时 ParadeDB 测试库：

```text
pnpm --filter @lobechat/database test:server-db -- src/models/__tests__/device.test.ts src/models/__tests__/migrationChain.test.ts
```

结果：2 个测试文件通过，15 tests passed。

品牌、登录、后台导航测试：

```text
pnpm exec vitest run --silent='passed-only' \
  "src/app/[variants]/(auth)/_layout/index.test.tsx" \
  "src/app/[variants]/(auth)/signin/SignInEmailStep.test.tsx" \
  "src/app/[variants]/(auth)/signin/SignInPasswordStep.test.tsx" \
  src/features/Brand/BrandProvider.test.tsx \
  src/features/Admin/adminNavigation.test.ts
```

结果：5 个测试文件通过，16 tests passed。

商业计费、NewAPI 后台、订单手动结算、套餐模型规则测试：

```text
pnpm --filter @lobechat/business-server exec vitest run --silent='passed-only' \
  src/commercialBilling.test.ts \
  src/__tests__/planModelRules.test.ts \
  src/lambda-routers/admin/orders.test.ts \
  src/lambda-routers/admin/newapiProviders.test.ts
```

结果：4 个测试文件通过，31 tests passed。

## 已保留的 ComHub 定制

本次上线确认保留以下 ComHub 定制方向：

- 后台配置品牌、Logo、认证页文案和底部版权。
- ComHub 商业计费、会员、积分、套餐、充值和订单管理路径。
- NewAPI 实例路由、模型目录、计费规则、failover 和 tracing hooks 相关路径。
- Market token fallback / community 数据加载修复。
- ComHub 自有数据库迁移链，尤其是 0111+ 自定义迁移与上游 v2.2.7 的 0129 carry-forward 兼容方案。

## 回滚方案

当前可用回滚镜像：

```text
ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a
```

推荐应用镜像回滚命令：

```bash
cd /www/compose/comhub
COMHUB_IMAGE='ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a' \
  ./deploy.sh 'ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a'
```

回滚后必须复查：

```bash
cd /www/compose/comhub
docker compose ps
docker inspect -f 'image={{.Config.Image}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restartCount={{.RestartCount}}' comhub-app
curl -k -sS https://chat.qingyouai.com/api/version
curl -k -sS https://chat.qingyouai.com/trpc/tools/healthcheck
docker logs --since 10m comhub-app
```

注意：服务器已有 `rollback.sh`，但完整应用镜像回滚应优先使用上面的 `COMHUB_IMAGE + deploy.sh` 方式，以确保容器实际切回回滚镜像。

## 后续建议

1. 使用真实管理员账号完成生产后台人工点验：
   - `/settings/admin`
   - 品牌设置
   - Provider / NewAPI 实例
   - 模型计费矩阵
   - 会员套餐
   - 订单手动结算
   - 审计日志
2. 使用真实用户触发一次 NewAPI 聊天或图像生成，验证：
   - 请求成功
   - failover 无异常
   - 计费账本写入
   - `llm_generation_tracing` 写入
3. 持续观察 24 小时：
   - `docker logs --since 24h comhub-app`
   - 磁盘空间
   - 容器重启次数
   - NewAPI 失败率

