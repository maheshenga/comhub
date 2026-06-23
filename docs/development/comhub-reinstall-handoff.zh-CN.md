# ComHub 重装系统前交接记录

记录时间：2026-06-23 17:25 +08:00

用途：本文件用于本机重装系统后恢复 ComHub 上游更新、部署、生产排障和继续运营的上下文。不要在本文件写入服务器密码、数据库连接串、API Key、GHCR Token 或 GitHub Secret 明文。

## 最重要结论

ComHub 当前已经升级到上游 v2.2.7，生产已部署并通过验收。

当前生产版本：

```text
https://chat.qingyouai.com
version: 2.2.7
image: ghcr.io/maheshenga/comhub:sha-722cfee33f45
rollback image: ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a
```

当前最新本地/远端工作应以此提交之后为准：

```text
5991cc449f7ffc35b37e7cccc6f6c2e9ea5b9b4e
Record evidence for the v2.2.7 production rollout
```

这次 v2.2.7 升级验收报告在：

```text
docs/development/comhub-v2.2.7-release-acceptance.zh-CN.md
```

## 重装后优先恢复步骤

1. 安装 Git、Node、pnpm、Bun、Docker、ssh/sshpass 或等效 SSH 工具。
2. 克隆 ComHub 远端：

```bash
git clone git@github.com:maheshenga/comhub.git
cd comhub
git checkout upgrade/upstream-v2.2.6-comhub-merge
```

3. 如果默认远端不是下列形式，恢复远端配置：

```text
comhub         git@github.com:maheshenga/comhub.git
origin         https://gh-proxy.com/https://github.com/lobehub/lobehub.git
origin-direct  https://github.com/lobehub/lobehub.git
```

4. 阅读以下文档：

```text
AGENTS.md
docs/development/comhub-upstream-customizations.md
docs/development/comhub-github-actions-deploy.zh-CN.md
docs/development/comhub-v2.2.7-database-upgrade-preflight.zh-CN.md
docs/development/comhub-v2.2.7-release-acceptance.zh-CN.md
docs/development/comhub-reinstall-handoff.zh-CN.md
```

5. 先验证当前生产，不要马上重新部署：

```bash
curl -k -sS https://chat.qingyouai.com/api/version
curl -k -sS https://chat.qingyouai.com/trpc/tools/healthcheck
```

预期：

```text
{"version":"2.2.7"}
{"result":{"data":{"json":"i'm live!"}}}
```

## 本地仓库记录

重装前本地工作区：

```text
outer workspace: E:\code\comhub
active repo:     E:\code\comhub\ci-verify-3bbf64f
branch:          upgrade/upstream-v2.2.6-comhub-merge
```

当前近端提交：

```text
5991cc449f Record evidence for the v2.2.7 production rollout
722cfee33f Merge upstream v2.2.7 while preserving ComHub operations
0b4ecc3ef9 Keep community skills available when Market rejects M2M tokens
1b4528573e Allow pushed upgrade branches to produce GHCR images
2d1fd477fc Document v2.2.7 database upgrade preflight evidence
```

远端：

```text
comhub git@github.com:maheshenga/comhub.git
origin https://gh-proxy.com/https://github.com/lobehub/lobehub.git
origin-direct https://github.com/lobehub/lobehub.git
```

注意：

- 外层 `E:\code\comhub` 不是 Git 仓库。
- 真正源码仓库是 `ci-verify-3bbf64f`。
- 后续如果继续升级上游，应从当前分支和当前提交继续，不要回到旧临时目录。

## 上游更新方案

当前策略是“保留 ComHub 定制，按上游版本做合并升级”。

上游来源：

```text
origin-direct: https://github.com/lobehub/lobehub.git
origin:        https://gh-proxy.com/https://github.com/lobehub/lobehub.git
```

升级原则：

1. 先 fetch 上游 tag / branch。
2. 在 ComHub 升级分支合并上游版本。
3. 逐项解决冲突，优先保留 ComHub 生产定制。
4. 不用上游默认部署工作流替换 ComHub 的 GHCR + `/www/compose/comhub` 部署链。
5. 数据库迁移不能简单改回上游编号；ComHub 已有 0111+ 自定义迁移，v2.2.7 的 workspace/device/aiInfra 结构变更已作为 `0129` carry-forward。
6. 合并完成后必须跑类型检查、关键测试、数据库迁移链测试，再构建镜像和部署。

必须保留的 ComHub 定制：

- 后台配置品牌、Logo、认证页文案、底部版权。
- ComHub 商业计费、会员、积分、套餐、充值、订单和后台审计。
- NewAPI 实例、模型目录、模型类型、套餐模型规则、failover、计费和 tracing hooks。
- community / Market token fallback 修复。
- GHCR 镜像构建和生产部署工作流。
- ComHub 数据库迁移链和生产兼容迁移。

重要已知冲突/决策：

- v2.2.7 上游将 SPA routing import 向 `react-router` 迁移，ComHub 已替换旧 `react-router-dom` 相关残留。
- 上游模型类型将 speech-to-text 方向从 `stt` 转向 `asr`，ComHub 保留 `asr` 兼容，同时兼容生产旧 `stt` 数据。
- NewAPI runtime 会把 legacy `stt` row/scope 映射到当前边界。
- Market SDK 类型缺少 `taskTemplates` 时，ComHub 使用窄接口兼容。
- `0129_workspace_device_and_ai_infra_surrogate_pk` 是 ComHub 对上游 v2.2.7 workspace/device/aiInfra 结构变更的顺延迁移。

## 部署方案

当前部署链：

```text
GitHub Actions -> GHCR image -> SSH server -> /www/compose/comhub/deploy.sh -> Docker Compose -> Baota Nginx
```

Workflow：

```text
.github/workflows/comhub-deploy.yml
```

部署目录：

```text
/www/compose/comhub
```

部署脚本：

```text
/www/compose/comhub/deploy.sh
```

部署命令格式：

```bash
cd /www/compose/comhub
COMHUB_IMAGE='ghcr.io/maheshenga/comhub:sha-xxxx' \
  COMHUB_IMAGE_TAG='sha-xxxx' \
  ./deploy.sh 'ghcr.io/maheshenga/comhub:sha-xxxx'
```

当前生产镜像：

```text
ghcr.io/maheshenga/comhub:sha-722cfee33f45
```

当前回滚镜像：

```text
ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a
```

回滚建议：

```bash
cd /www/compose/comhub
COMHUB_IMAGE='ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a' \
  ./deploy.sh 'ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a'
```

注意：

- 服务器有 `/www/compose/comhub/rollback.sh`，但它主要切 Nginx 到 `COMHUB_ROLLBACK_PORT` 并 `docker compose down`，不等价于完整应用镜像回滚。
- 实际应用镜像回滚优先用 `COMHUB_IMAGE + deploy.sh`。
- Baota 只负责 Nginx 和证书；不要改成 Baota 应用部署。

## 服务器记录

生产服务器：

```text
host: 47.120.31.65
user: root
deploy dir: /www/compose/comhub
domain: https://chat.qingyouai.com
active app port: 3213
container: comhub-app
```

服务器目录重装前状态：

```text
/www/compose/comhub
  .env.docker        # 生产环境变量，敏感，不入仓库
  backups/
  deploy.sh
  docker-compose.yml
  rollback.sh
```

当前容器：

```text
name: comhub-app
image: ghcr.io/maheshenga/comhub:sha-722cfee33f45
health: healthy
restartCount: 0
startedAt: 2026-06-22T23:46:02.027638934Z
```

当前磁盘：

```text
/    89% used, about 7.6G available
/www 89% used, about 7.6G available
```

当前保留镜像：

```text
ghcr.io/maheshenga/comhub:sha-722cfee33f45
ghcr.io/maheshenga/comhub:sha-0b4ecc3ef92a
```

当前版本接口：

```text
GET https://chat.qingyouai.com/api/version
{"version":"2.2.7"}
```

当前健康接口：

```text
GET https://chat.qingyouai.com/trpc/tools/healthcheck
{"result":{"data":{"json":"i'm live!"}}}
```

## 生产数据库记录

生产库连接串只在服务器 `.env.docker` 中，不要写入仓库。

最新迁移：

```text
id: 132
hash: 53e4276afb94d4524b314ee7b5fd6b64650a498dda3440c3b272856b3f8415ab
created_at: 1781883177374
meaning: 0129_workspace_device_and_ai_infra_surrogate_pk
```

最近三条迁移：

```text
132 53e4276afb94d4524b314ee7b5fd6b64650a498dda3440c3b272856b3f8415ab
131 e3b03c1c2dffb25d3cc6ee738ae1af354e462f35e1f3f41a79b98e5b71c2d281
130 c906fa0737b76f8223d39d25e5d8c884a33aec26390bc4d6c10730d70f118d55
```

关键业务表计数：

```text
users: 25
admin users: 3
normal users: 22
user_plan_snapshots: 33
credit_accounts: 25
credit_ledger_entries: 2730
plan_catalog: 5
topup_packages: 4
admin_newapi_instances: 4
admin_newapi_instance_models: 831
admin_audit_logs: 223
app_settings: 55
llm_generation_tracing: 0
```

说明：

- `llm_generation_tracing` 表存在但当前没有记录。
- 需要真实用户触发一次 NewAPI 生成后，再验计费账本与 tracing 写入。
- 账本数在验收后从 2720 增长到 2730，说明生产期间已有业务写入。

## 已通过测试记录

上线前后已验证：

```text
pnpm type-check
```

数据库 server-db：

```text
pnpm --filter @lobechat/database test:server-db -- src/models/__tests__/device.test.ts src/models/__tests__/migrationChain.test.ts
```

结果：2 个测试文件，15 tests passed。

品牌、登录、后台导航：

```text
pnpm exec vitest run --silent='passed-only' \
  "src/app/[variants]/(auth)/_layout/index.test.tsx" \
  "src/app/[variants]/(auth)/signin/SignInEmailStep.test.tsx" \
  "src/app/[variants]/(auth)/signin/SignInPasswordStep.test.tsx" \
  src/features/Brand/BrandProvider.test.tsx \
  src/features/Admin/adminNavigation.test.ts
```

结果：5 个测试文件，16 tests passed。

商业计费、NewAPI 后台、订单手动结算、套餐模型规则：

```text
pnpm --filter @lobechat/business-server exec vitest run --silent='passed-only' \
  src/commercialBilling.test.ts \
  src/__tests__/planModelRules.test.ts \
  src/lambda-routers/admin/orders.test.ts \
  src/lambda-routers/admin/newapiProviders.test.ts
```

结果：4 个测试文件，31 tests passed。

## 重装后必查清单

本机恢复后先执行：

```bash
git status --short --branch
git log --oneline -5
```

生产恢复检查：

```bash
ssh root@47.120.31.65
cd /www/compose/comhub
docker compose ps
docker inspect -f 'image={{.Config.Image}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restartCount={{.RestartCount}}' comhub-app
curl -k -sS https://chat.qingyouai.com/api/version
curl -k -sS https://chat.qingyouai.com/trpc/tools/healthcheck
df -h / /www
```

如果要部署新镜像，先触发 Actions build-only，确认 GHCR 镜像存在；再 deploy。

## 敏感信息边界

这些信息不要写入 Git：

- root 密码。
- `/www/compose/comhub/.env.docker` 内容。
- 数据库连接串。
- NewAPI key。
- GitHub Secret。
- GHCR Token。
- SSH 私钥。

这些信息需要重装后恢复到对应位置：

- GitHub SSH key 或 GitHub CLI 登录态。
- 生产服务器 SSH 访问方式。
- 必要时重新配置 `sshpass` 或改用 SSH key。
- 浏览器/Playwright 依赖可按需重新安装。

## 后续优先事项

1. 推送当前文档提交到 `comhub` remote 当前分支。
2. 使用真实管理员账号完成生产后台人工点验。
3. 触发真实 NewAPI 生成，补充计费和 tracing 验收。
4. 继续观察 24 小时生产日志、磁盘和容器重启次数。
5. 下一次上游升级前，先读本文件和 v2.2.7 验收报告。

