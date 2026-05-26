# ComHub Node Standalone 部署流程

本文记录当前可复用的生产部署方式。核心原则：

- 服务器只运行 Node，不使用 Docker 部署。
- 不在服务器执行 `next build`、`pnpm build`、`bun run build`。
- 必须在本机 Docker Linux 环境构建，再打包上传服务器。
- 服务器 `/www/wwwroot/comhub/app/.env` 是生产配置，部署时必须保留，不覆盖。

## 当前生产信息

- 域名：`https://chat.qingyouai.com`
- 后台入口：`/settings/admin`
- 服务器应用目录：`/www/wwwroot/comhub/app`
- 运行端口：`3210`
- Node 路径：`/usr/local/bin/node`
- 部署产物：Next standalone `/app` 目录

## 已知关键点

之前 Docker 构建只生成 `/404`，根因不是服务器问题，也不是源码缺失。

根因是项目根目录混入了一个 `app/` 目录，Next.js 会优先识别根目录 `app`，导致真正的 `src/app` 被遮住，最终只生成 `_not-found` 等极少路由。

已在 `.dockerignore` 中排除：

- `app`
- `dist-deploy`
- `.env`
- `.env.*`
- `tmp-*`
- `queryex`

下次如果再出现只构建出 `/404`，优先检查 Docker build context 中是否混入根目录 `app/`。

## 本地构建与打包

在 Windows PowerShell 执行：

```powershell
cd E:\code\comhub\lobehub
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\comhub-build-package.ps1
```

可指定标签：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\comhub-build-package.ps1 -Tag 20260508
```

脚本会执行：

1. 确认 Docker 是 Linux engine。
2. 使用 Docker 构建 `--target app`。
3. 导出镜像内 `/app` 到 `dist-deploy/comhub-<tag>-app`。
4. 校验路由清单必须包含：
   - `spa/[variants]/[[...path]]/route`
   - `[variants]/(auth)/signin/page`
   - `(backend)/api/version/route`
   - `(backend)/trpc/lambda/[trpc]/route`
5. 使用 WSL `tar --numeric-owner` 打包，保留 Linux 符号链接。

输出包位置：

```text
dist-deploy/comhub-<tag>-app.tar.gz
```

## 上传服务器

不要把密码写入脚本。临时设置 `SSHPASS` 后上传：

```powershell
wsl -e bash -lc "export SSHPASS='<服务器密码>'; sshpass -e scp -o StrictHostKeyChecking=no /mnt/e/code/comhub/lobehub/dist-deploy/comhub-<tag>-app.tar.gz root@47.120.31.65:/tmp/comhub-<tag>-app.tar.gz"
```

也可以由你手动上传到服务器 `/tmp/`，文件名保持一致即可。

## 服务器部署

从本机 PowerShell 通过 SSH 执行部署脚本：

```powershell
wsl -e bash -lc "export SSHPASS='<服务器密码>'; sshpass -e ssh -o StrictHostKeyChecking=no root@47.120.31.65 'bash -s -- /tmp/comhub-<tag>-app.tar.gz' < /mnt/e/code/comhub/lobehub/scripts/deploy/comhub-deploy-standalone.sh"
```

部署脚本会：

1. 校验上传包存在。
2. 停止旧的 `/www/wwwroot/comhub/app` Node 进程。
3. 备份旧目录为 `/www/wwwroot/comhub/app.backup-<timestamp>`。
4. 保存并恢复旧 `.env`。
5. 解压新的 standalone 包。
6. 校验路由清单完整。
7. 执行 `node docker.cjs` 数据库迁移。
8. 使用 `nohup /usr/local/bin/node server.js` 启动服务。

脚本不包含任何构建命令。

## 验证命令

服务器本地验证：

```powershell
wsl -e bash -lc "export SSHPASS='<服务器密码>'; sshpass -e ssh -o StrictHostKeyChecking=no root@47.120.31.65 'ss -ltnp | grep :3210; curl -I http://127.0.0.1:3210/; curl http://127.0.0.1:3210/api/version'"
```

公网验证：

```powershell
curl.exe -I https://chat.qingyouai.com/
curl.exe -I https://chat.qingyouai.com/signin
curl.exe -I https://chat.qingyouai.com/settings/admin
curl.exe https://chat.qingyouai.com/api/version
```

期望结果：

- `/api/version` 返回当前版本号。
- 未登录访问首页跳转到 `https://chat.qingyouai.com/signin?...`，不能跳到 IP。
- `/signin` 返回 `200`。
- `/settings/admin` 未登录跳转登录，并保留 callback。

## 回滚

部署脚本会输出备份目录，例如：

```text
backup=/www/wwwroot/comhub/app.backup-20260508-014138
```

如需回滚：

```bash
pkill -f "/www/wwwroot/comhub/app/.*server\\.js" || true
mv /www/wwwroot/comhub/app /www/wwwroot/comhub/app.failed-$(date +%Y%m%d-%H%M%S)
mv /www/wwwroot/comhub/app.backup- < timestamp > /www/wwwroot/comhub/app
cd /www/wwwroot/comhub/app
PORT=3210 HOSTNAME=0.0.0.0 NODE_ENV=production nohup /usr/local/bin/node server.js > start.log 2>&1 &
```

## 注意事项

- 本地打包必须用 WSL/Linux `tar`，不要用 Windows zip，否则 `node_modules` 内的 pnpm 符号链接可能损坏。
- 生产 `.env` 只在服务器保留，不进入 Docker 镜像，不进入压缩包。
- 当前日志中可能出现 `QSTASH_TOKEN` 缺失警告，不影响基础页面启动，但 Upstash Workflow 相关功能可能不可用。
- 当前启动方式是 `nohup`。如需服务器重启后自动恢复，后续应接入 systemd、pm2 或宝塔 Node 项目管理。
