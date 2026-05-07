# 阿里云 OSS 桌面应用更新发布

## 1. 创建 OSS Bucket

1. 登录阿里云控制台 → 对象存储 OSS
2. 创建 Bucket:
   - 名称: `comhub-releases` (自定义)
   - 地域：选择离用户最近的区域 (如 华东 2 - 上海)
   - 存储类型：标准存储
   - 读写权限: **公共读**
3. 记录 Endpoint: `oss-cn-shanghai.aliyuncs.com`

## 2. 配置 CDN (推荐)

1. 阿里云 CDN → 添加域名
   - 加速域名: `releases.qingyouai.com`
   - 源站: OSS Bucket (`comhub-releases.oss-cn-shanghai.aliyuncs.com`)
   - 回源 HOST: 同上
2. DNS 解析：添加 CNAME 记录指向 CDN 分配的域名
3. 开启 HTTPS (申请免费证书)

## 3. 安装 ossutil

```bash
# Linux/macOS
curl -o ossutil https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil-v1.7.18-linux-amd64/ossutil64
chmod +x ossutil && sudo mv ossutil /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil-v1.7.18-windows-amd64/ossutil64.exe" -OutFile ossutil.exe

# 配置
ossutil config -e oss-cn-shanghai.aliyuncs.com -i <AccessKeyId> -k <AccessKeySecret>
```

## 4. 构建并上传

```bash
cd apps/desktop

# 构建 Windows 版本
cross-env UPDATE_CHANNEL=stable UPDATE_SERVER_URL=https://releases.qingyouai.com/releases \
  electron-builder --config electron-builder.mjs --win

# 上传到 OSS
./scripts/oss-release/upload-to-oss.sh \
  -b oss://comhub-releases \
  -e oss-cn-shanghai.aliyuncs.com \
  -c stable
```

## 5. 后台配置

部署 Web 后端后，进入 Admin → Desktop Update:

| 字段                   | 值                                        |
| ---------------------- | ----------------------------------------- |
| Update Server URL      | `https://releases.qingyouai.com/releases` |
| Default Update Channel | `stable`                                  |
| Auto Check for Updates | 开启                                      |
| Check Interval         | `60`                                      |

## 6. 验证

```bash
# 检查 manifest 是否可访问
curl https://releases.qingyouai.com/releases/stable/latest.yml

# 预期返回类似:
# version: 1.2.0
# files:
#   - url: LobeHub-1.2.0-setup.exe
#     sha512: ...
#     size: ...
# path: LobeHub-1.2.0-setup.exe
# sha512: ...
# releaseDate: '2026-05-05T...'
```

## 7. OSS 目录结构

```
comhub-releases/
└── releases/
    ├── stable/
    │   ├── latest.yml              ← Windows manifest
    │   ├── latest-mac.yml          ← macOS manifest
    │   ├── LobeHub-1.2.0-setup.exe
    │   ├── LobeHub-1.2.0-setup.exe.blockmap
    │   ├── LobeHub-1.2.0-arm64.dmg
    │   └── LobeHub-1.2.0-arm64-mac.zip
    └── canary/
        ├── latest.yml
        └── ...
```

## 环境变量参考

在 CI/CD 或本地 `.env` 中配置:

```bash
OSS_BUCKET=oss://comhub-releases
OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
OSS_PATH=releases
CHANNEL=stable
```
