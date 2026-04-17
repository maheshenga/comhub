# ComHub 宝塔上线清单

这份清单是给服务器实际执行用的短版步骤。
默认使用目录 `/www/compose/comhub`，默认方案为宝塔反代 + Docker Compose 状态层/应用层分离 + 蓝绿发布。

## 0. 目标确认

- 不再使用旧 `lobedocker` 目录做正式生产
- 生产机不执行 `docker build`
- 发版只通过镜像 + `scripts/deploy.sh`
- 回滚只通过 `scripts/rollback.sh`

## 1. 服务器目录准备

```sh
mkdir -p /www/compose/comhub
cd /www/compose/comhub
```

把 [docker-compose/production/baota](E:/comhub/aihub/lobehub-canary-publish/docker-compose/production/baota) 整体上传到服务器后，目录应包含：

- `app`
- `state`
- `nginx`
- `scripts`
- `systemd`

## 2. 环境变量准备

```sh
cd /www/compose/comhub/scripts
chmod +x ./*.sh
./init-env.sh
```

必须填写的核心项：

- `app/.env`
  - `APP_URL`
  - `KEY_VAULTS_SECRET`
  - `AUTH_SECRET`
  - `LOBE_DB_NAME`
  - `POSTGRES_PASSWORD`
  - `S3_ENDPOINT`
  - `RUSTFS_ACCESS_KEY`
  - `RUSTFS_SECRET_KEY`
  - `RUSTFS_LOBE_BUCKET`
- `state/.env`
  - `LOBE_DB_NAME`
  - `POSTGRES_PASSWORD`
  - `RUSTFS_ACCESS_KEY`
  - `RUSTFS_SECRET_KEY`
  - `RUSTFS_LOBE_BUCKET`

注意：

- `app/.env` 和 `state/.env` 里的数据库名、数据库密码、RustFS 访问密钥必须完全一致
- `APP_URL` 和 `S3_ENDPOINT` 正式环境建议都用 `https://`
- 如果需要换域名，可以重新生成：

```sh
cd /www/compose/comhub/scripts
APP_PUBLIC_URL=https://your-chat-domain.example.com \
S3_PUBLIC_URL=https://your-s3-domain.example.com \
FORCE=1 \
./init-env.sh
```

## 3. 宿主机网络修复

如果是宝塔 + 阿里云 Linux 这类机器，先执行：

```sh
cd /www/compose/comhub/scripts
./prepare-host.sh
```

这一步需要 `root`。

## 4. 初始化运行目录

```sh
cd /www/compose/comhub/scripts
./install.sh
./preflight.sh
```

如果 `preflight.sh` 报错，先修配置再继续。

## 5. 启动状态层

```sh
cd /www/compose/comhub/state
docker compose --env-file .env up -d
```

确认状态层起来后再发应用。

## 6. 宝塔 Nginx 接入

在宝塔里准备证书和站点，然后把以下示例配置接入：

- [chat.vip.hezelove.cn.conf.example](E:/comhub/aihub/lobehub-canary-publish/docker-compose/production/baota/nginx/chat.vip.hezelove.cn.conf.example)
- [s3.vip.hezelove.cn.conf.example](E:/comhub/aihub/lobehub-canary-publish/docker-compose/production/baota/nginx/s3.vip.hezelove.cn.conf.example)
- [s3-admin.vip.hezelove.cn.conf.example](E:/comhub/aihub/lobehub-canary-publish/docker-compose/production/baota/nginx/s3-admin.vip.hezelove.cn.conf.example)

应用站点必须包含：

```nginx
include /www/server/nginx/conf/comhub-upstream.conf;
```

## 7. 首次发版

```sh
cd /www/compose/comhub/scripts
./deploy.sh ghcr.io/<your-org>/comhub:<tag>
```

如果服务器已经有本地镜像，也可以：

```sh
SKIP_PULL=1 ./deploy.sh <local-image:tag>
```

如果你想把首次上线步骤收成一次执行，可以直接：

```sh
cd /www/compose/comhub/scripts
./first-release.sh ghcr.io/<your-org>/comhub:<tag>
```

首次安装且需要顺便处理 bridge sysctl 时：

```sh
cd /www/compose/comhub/scripts
RUN_PREPARE_HOST=1 ./first-release.sh ghcr.io/<your-org>/comhub:<tag>
```

## 8. 发版后检查

```sh
cd /www/compose/comhub/scripts
./status.sh
```

重点看：

- 当前活动槽位是不是预期值
- 新槽位健康检查是否通过
- Nginx upstream 是否指向正确端口
- 页面是否能正常打开 `/signin`

## 9. 回滚

```sh
cd /www/compose/comhub/scripts
./rollback.sh
```

或者指定：

```sh
./rollback.sh blue
./rollback.sh green
```

## 10. 长期维护约定

- 配置只改 `.env`
- 流量只通过 `deploy.sh` / `rollback.sh` 切换
- 稳定后再执行 `cleanup-images.sh`
- 旧 `lobedocker` 容器、网络、数据目录确认不再使用后再删除
