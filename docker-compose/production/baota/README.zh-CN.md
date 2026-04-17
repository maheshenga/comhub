# ComHub 宝塔生产部署

这套目录用于把 ComHub 部署成一套长期可维护的生产环境，目标是：

- 构建只发生在 CI 或构建机，不在生产机 `docker build`
- 宝塔只负责 `Nginx`、证书和反向代理
- 应用层与状态层拆分，避免每次发版触碰数据库和对象存储
- 应用层支持蓝绿发布和快速回滚

## 目录结构

建议在宝塔服务器使用独立目录，例如 `/www/compose/comhub`：

```text
/www/compose/comhub
├── acme
├── app
│   ├── .env
│   └── docker-compose.yml
├── state
│   ├── .env
│   └── docker-compose.yml
├── nginx
├── runtime
│   ├── active-slot
│   ├── history.log
│   └── slots
├── scripts
└── systemd
```

不要把这套目录直接混进 `/www/wwwroot/chat.vip.hezelove.cn` 这类站点目录里。
`acme` 目录用于 HTTP-01 校验文件，不再依赖旧站点目录。

## 推荐角色分工

- 宝塔：站点、证书、Nginx 反代
- Docker Compose `state`：PostgreSQL、Redis、RustFS、SearXNG
- Docker Compose `app`：ComHub 应用镜像
- CI：构建并推送版本化镜像

## 首次安装

1. 把本目录整体上传到服务器，例如 `/www/compose/comhub`
2. 复制环境变量模板：

```sh
cd /www/compose/comhub
cd scripts
chmod +x ./*.sh
./init-env.sh
```

默认会按当前方案生成：

- `APP_URL=https://chat.vip.hezelove.cn`
- `S3_ENDPOINT=https://s3.vip.hezelove.cn`
- 自动生成 `KEY_VAULTS_SECRET`
- 自动生成 `AUTH_SECRET`
- 自动生成 `POSTGRES_PASSWORD`
- 自动生成 `RUSTFS_SECRET_KEY`

如果你需要改域名或保留自己的密钥，可以这样：

```sh
cd /www/compose/comhub/scripts
APP_PUBLIC_URL=https://your-chat-domain.example.com \
S3_PUBLIC_URL=https://your-s3-domain.example.com \
FORCE=1 \
./init-env.sh
```

3. 如果服务器是宝塔 + Docker + 阿里云/Alibaba Linux 这一类组合，先准备宿主机 bridge sysctl：

```sh
cd /www/compose/comhub/scripts
./prepare-host.sh
```

4. 复核 `state/.env` 与 `app/.env`
5. 初始化运行时目录：

```sh
cd /www/compose/comhub/scripts
./install.sh
./preflight.sh
```

安装脚本会创建：

- `/www/compose/comhub/runtime`
- `/www/compose/comhub/acme/.well-known/acme-challenge`

6. 启动状态层：

```sh
cd /www/compose/comhub/state
docker compose --env-file .env up -d
```

7. 用首个镜像发版：

```sh
cd /www/compose/comhub/scripts
./deploy.sh ghcr.io/<your-org>/comhub:<tag>
```

首次发版默认会起 `blue` 槽位，并把 Nginx 上游切到 `127.0.0.1:3210`。

如果你希望把“初始化配置 -> 预检 -> 启动状态层 -> 首次发版”串成一次执行，可以直接：

```sh
cd /www/compose/comhub/scripts
./first-release.sh ghcr.io/<your-org>/comhub:<tag>
```

它的默认行为是：

- 若 `app/.env` 与 `state/.env` 都不存在，则自动执行 `./init-env.sh`
- 若两者已经存在，则直接复用
- 若只存在其中一个，会直接报错，避免覆盖错配

可选参数：

```sh
RUN_PREPARE_HOST=1 ./first-release.sh ghcr.io/<your-org>/comhub:<tag>
AUTO_INIT_ENV=0 ./first-release.sh ghcr.io/<your-org>/comhub:<tag>
```

说明：

- `RUN_PREPARE_HOST=1` 会先执行 `./prepare-host.sh`，通常只在 root 下首次安装时使用
- `AUTO_INIT_ENV=0` 会禁止自动生成 `.env`，适合你已经准备好配置文件的场景

## 宿主机网络前置项

在部分宝塔服务器环境，尤其是阿里云 Linux + Docker + nftables 组合下，Docker 自定义 bridge 可能出现这个症状：

- 容器之间 `ping` 正常
- DNS 正常
- 但 TCP 全部报 `Host is unreachable`

这不是应用问题，而是宿主机 bridge netfilter 导致的桥接转发异常。推荐在首次安装时执行：

```sh
cd /www/compose/comhub/scripts
./prepare-host.sh
```

它会写入：

- `/etc/sysctl.d/99-comhub-docker-bridge.conf`

并持久化以下设置：

- `net.bridge.bridge-nf-call-iptables = 0`
- `net.bridge.bridge-nf-call-ip6tables = 0`
- `net.bridge.bridge-nf-call-arptables = 0`

如果你已经遇到 `EHOSTUNREACH`、`No route to host`、`Host is unreachable` 这类错误，先执行这个脚本，再重新跑一次 `deploy.sh`。

## 发版流程

日常发布只发应用层：

```sh
cd /www/compose/comhub/scripts
./deploy.sh ghcr.io/<your-org>/comhub:<tag>
```

如果第一次上线要直接复用服务器上已经存在的本地镜像，可以这样执行：

```sh
SKIP_PULL=1 ./deploy.sh comhub-signinfix:hotpatch-20260416
```

发布脚本会做这些事：

1. 确保状态层已经启动
2. 选中非当前流量槽位作为新版本槽位
3. 拉取目标镜像并启动新槽位容器
4. 对 `http://127.0.0.1:<slot-port>/signin` 做健康检查
5. 检查通过后切换 Nginx 上游
6. 记录发版历史

当前默认端口：

- `blue`: `3210`
- `green`: `3211`
- `rustfs`: `39000`
- `rustfs-admin`: `39001`

## 回滚

如果新版本异常，直接切回旧槽位：

```sh
cd /www/compose/comhub/scripts
./rollback.sh
```

如果要明确指定目标槽位：

```sh
./rollback.sh blue
./rollback.sh green
```

回滚只切流量，不重新构建镜像，因此速度很快。

## 日常运维

查看当前部署状态：

```sh
cd /www/compose/comhub/scripts
./status.sh
```

这个脚本会输出：

- 当前活动槽位
- `blue / green` 对应的镜像、端口和健康状态
- 当前运行中的 `comhub-*` 容器
- Nginx 当前 upstream
- 最近发版/切换历史

上线前建议先执行一次：

```sh
cd /www/compose/comhub/scripts
./preflight.sh
```

它会检查：

- `app/.env` 与 `state/.env` 是否存在
- 必填变量是否齐全
- 数据库和 RustFS 关键变量是否一致
- Compose 文件能否正常解析
- Docker daemon、Nginx、运行目录是否就绪

清理旧应用镜像：

```sh
cd /www/compose/comhub/scripts
./cleanup-images.sh
```

默认行为：

- 永远保留 `blue.env / green.env` 当前引用的镜像
- 如果存在 `<repo>:latest`，也会保留
- 每个应用镜像仓库额外保留 1 个最近镜像
- 其余旧镜像会删除

常用参数：

```sh
KEEP_LATEST=2 ./cleanup-images.sh
DRY_RUN=1 ./cleanup-images.sh
PRUNE_DANGLING=1 ./cleanup-images.sh
```

建议：

- 发版稳定一段时间后，再执行一次 `./cleanup-images.sh`
- 正式环境先用 `DRY_RUN=1` 看一遍要删哪些镜像

## 宝塔接入方式

宝塔里只做 3 件事：

1. 给 `chat.vip.hezelove.cn` 配证书
2. 给 `s3.vip.hezelove.cn` 配证书
3. 在对应站点的 Nginx 配置里使用本目录下的 `nginx/*.conf.example`

应用域名通过 `include /www/server/nginx/conf/comhub-upstream.conf;` 引入当前活动槽位。
切换槽位时，`scripts/switch-slot.sh` 会自动重写这个文件并重载 Nginx。
如果你使用 HTTP-01 校验，建议把 `/.well-known/acme-challenge/` 指到 `/www/compose/comhub/acme/.well-known/acme-challenge/`。

## 从旧 lobedocker 迁移

如果服务器上已经有旧的 `lobedocker` 或 `lobehub-vip` 部署，不要让新方案长期复用旧目录的数据路径。推荐做法是：

1. 先让新方案接管流量
2. 把数据库、Redis、RustFS 数据迁移到 `/www/compose/comhub/state/data/*`
3. 把 ACME 校验目录迁移到 `/www/compose/comhub/acme`
4. 再删除旧容器、旧 network、旧 volume、旧 compose 文件

这样新部署才能真正独立，后续删除旧站点目录时不会误伤当前生产环境。

## systemd

如果你希望服务器重启后主动确保应用和状态层都被拉起，可以安装 `systemd` 模板：

```sh
cp /www/compose/comhub/systemd/comhub-state.service /etc/systemd/system/
cp /www/compose/comhub/systemd/comhub-app.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now comhub-state.service
systemctl enable --now comhub-app.service
```

如果你已经依赖 Docker 的 `restart: unless-stopped`，`systemd` 不是必需，但保留它更利于标准化运维。

## CI 建议

推荐把镜像产物固定成：

- `ghcr.io/<your-org>/comhub:<git-sha>`
- `ghcr.io/<your-org>/comhub:latest`

生产机只允许：

```sh
docker pull ghcr.io/<your-org>/comhub:<git-sha>
./deploy.sh ghcr.io/<your-org>/comhub:<git-sha>
```

不要在生产机做这些事：

- `docker build`
- `docker commit`
- 手改容器内部文件当正式发版

仓库里已经补了一条手动触发工作流 [`.github/workflows/comhub-prod-deploy.yml`](../../../.github/workflows/comhub-prod-deploy.yml)，需要的 GitHub Secrets 为：

- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_REGISTRY_USER` 可选，用于生产机登录 GHCR
- `PROD_REGISTRY_TOKEN` 可选，用于生产机拉取私有 GHCR 镜像

这条工作流会：

1. 构建并推送镜像到 GHCR
2. 可选同步 `docker-compose/production/baota/` 到生产机
3. 在生产机执行 `install.sh`
4. 再执行 `deploy.sh <image>`

注意：

- 它默认假设生产机 `/www/compose/comhub/app/.env` 和 `/www/compose/comhub/state/.env` 已经存在
- 如果 GHCR 包是私有的，建议配置 `PROD_REGISTRY_USER` 和 `PROD_REGISTRY_TOKEN`

## 维护约定

- 状态层和应用层分开升级
- `state/.env` 与 `app/.env` 纳入配置管理，不在容器里手改
- 每次上线都使用新 tag，不覆盖老版本
- 只允许 `scripts/deploy.sh` 和 `scripts/rollback.sh` 操作应用流量
