# ComHub GitHub Actions 构建部署

本文记录 `maheshenga/comhub` 的默认 Actions 部署约定。

## 目标

- GitHub Actions 负责构建 Docker 镜像并推送到 GHCR。
- 生产服务器只拉取和运行镜像，不执行 `pnpm build`、`next build` 或 Docker build。
- 宝塔只负责 Nginx 和证书。
- 生产部署目录固定为 `/www/compose/comhub`，由服务器上的 `deploy.sh` 和 `rollback.sh` 负责蓝绿切换。

## Workflow

文件：`.github/workflows/comhub-deploy.yml`

- `push main`：构建并推送镜像。
- `workflow_dispatch`：
  - `deploy=false`：只构建镜像。
  - `deploy=true`：构建镜像后 SSH 到生产服务器执行部署。

镜像地址格式：

```text
ghcr.io/maheshenga/comhub:sha-<12位commit>
ghcr.io/maheshenga/comhub:latest
```

`latest` 只在 `main` 分支构建时更新。

## GitHub Secrets

在 `maheshenga/comhub` 仓库的 `Settings -> Secrets and variables -> Actions` 添加：

| 名称                     | 说明                               |
| ------------------------ | ---------------------------------- |
| `COMHUB_SSH_HOST`        | 生产服务器 IP，例如 `47.120.31.65` |
| `COMHUB_SSH_PORT`        | SSH 端口，默认可填 `22`            |
| `COMHUB_SSH_USER`        | SSH 用户，默认可填 `root`          |
| `COMHUB_SSH_PRIVATE_KEY` | 只用于部署的 SSH 私钥              |

可选变量：

| 名称                | 默认值                | 说明           |
| ------------------- | --------------------- | -------------- |
| `COMHUB_DEPLOY_DIR` | `/www/compose/comhub` | 服务器部署目录 |

## 服务器 deploy.sh 合约

Actions 会在服务器执行：

```bash
cd /www/compose/comhub
COMHUB_IMAGE='ghcr.io/maheshenga/comhub:sha-xxxx' \
  COMHUB_IMAGE_TAG='sha-xxxx' \
  ./deploy.sh 'ghcr.io/maheshenga/comhub:sha-xxxx'
```

因此服务器脚本需要支持：

- 从第一个参数或 `COMHUB_IMAGE` 读取镜像地址。
- 拉取 GHCR 镜像。
- 启动新版本并完成健康检查。
- 健康检查通过后切换流量。
- 保留可回滚版本，由 `rollback.sh` 处理回滚。

## 注意

- 不要把服务器密码写进 workflow。
- 如果 GHCR package 是 private，需要确保生产服务器具备拉取 GHCR 镜像的凭据。
- 后续上游同步后，保留这个 workflow 和本文档。
