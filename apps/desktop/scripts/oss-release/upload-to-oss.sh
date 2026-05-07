#!/bin/bash

# ============================================
# 阿里云 OSS 桌面应用更新发布脚本
#
# 前置条件:
#   1. 安装 ossutil: https://help.aliyun.com/document_detail/120075.html
#   2. 配置 ossutil: ossutil config -e oss-cn-xxx.aliyuncs.com -i <AccessKeyId> -k <AccessKeySecret>
#   3. 已构建桌面应用: cd apps/desktop && bun run build:main && electron-builder --config electron-builder.mjs
#
# 用法:
#   ./upload-to-oss.sh [选项]
#
# OSS 目录结构:
#   {bucket}/releases/
#     stable/
#       latest.yml          (Windows manifest)
#       latest-mac.yml      (macOS manifest)
#       LobeHub-x.x.x-setup.exe
#       LobeHub-x.x.x-arm64.dmg
#       LobeHub-x.x.x-arm64-mac.zip
#     canary/
#       latest.yml
#       ...
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
RELEASE_DIR="$DESKTOP_DIR/release"

# ===== 配置 (请根据实际情况修改) =====
OSS_BUCKET="${OSS_BUCKET:-oss://comhubup}"
OSS_PATH="${OSS_PATH:-releases}"
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-beijing.aliyuncs.com}"
CHANNEL="${CHANNEL:-stable}"
# =====================================

show_help() {
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  -b, --bucket BUCKET      OSS Bucket (默认: \$OSS_BUCKET 或 oss://your-bucket-name)"
  echo "  -p, --path PATH          OSS 路径前缀 (默认: releases)"
  echo "  -e, --endpoint ENDPOINT  OSS Endpoint (默认: oss-cn-shanghai.aliyuncs.com)"
  echo "  -c, --channel CHANNEL    发布渠道 (stable|canary, 默认: stable)"
  echo "  -d, --dir DIR            本地 release 目录 (默认: apps/desktop/release)"
  echo "  --dry-run                仅显示将要上传的文件，不实际上传"
  echo "  -h, --help               显示帮助"
  echo ""
  echo "环境变量:"
  echo "  OSS_BUCKET       OSS Bucket 地址"
  echo "  OSS_PATH         OSS 路径前缀"
  echo "  OSS_ENDPOINT     OSS Endpoint"
  echo "  CHANNEL          发布渠道"
  echo ""
  echo "示例:"
  echo "  # 上传 stable 版本"
  echo "  $0 -b oss://comhub-releases -c stable"
  echo ""
  echo "  # 上传 canary 版本"
  echo "  $0 -b oss://comhub-releases -c canary"
  echo ""
  echo "  # 预览模式"
  echo "  $0 --dry-run"
}

DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--bucket) OSS_BUCKET="$2"; shift 2 ;;
    -p|--path) OSS_PATH="$2"; shift 2 ;;
    -e|--endpoint) OSS_ENDPOINT="$2"; shift 2 ;;
    -c|--channel) CHANNEL="$2"; shift 2 ;;
    -d|--dir) RELEASE_DIR="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) show_help; exit 0 ;;
    *) echo "未知参数: $1"; show_help; exit 1 ;;
  esac
done

# 检查 ossutil
if ! command -v ossutil &> /dev/null; then
  echo "错误: ossutil 未安装"
  echo "安装方法: https://help.aliyun.com/document_detail/120075.html"
  echo ""
  echo "快速安装 (Linux/macOS):"
  echo "  curl -o ossutil https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil-v1.7.18-linux-amd64/ossutil64"
  echo "  chmod +x ossutil && sudo mv ossutil /usr/local/bin/"
  echo ""
  echo "配置:"
  echo "  ossutil config -e ${OSS_ENDPOINT} -i <AccessKeyId> -k <AccessKeySecret>"
  exit 1
fi

# 检查 release 目录
if [ ! -d "$RELEASE_DIR" ]; then
  echo "错误: release 目录不存在: $RELEASE_DIR"
  echo "请先构建桌面应用:"
  echo "  cd apps/desktop"
  echo "  bun run build:main"
  echo "  electron-builder --config electron-builder.mjs"
  exit 1
fi

echo "========================================"
echo "  阿里云 OSS 桌面应用更新发布"
echo "========================================"
echo ""
echo "  Bucket:   $OSS_BUCKET"
echo "  路径:     $OSS_PATH/$CHANNEL/"
echo "  Endpoint: $OSS_ENDPOINT"
echo "  渠道:     $CHANNEL"
echo "  本地目录: $RELEASE_DIR"
echo ""

# 收集要上传的文件
FILES_TO_UPLOAD=()

# Windows: latest.yml + .exe + .exe.blockmap
for f in "$RELEASE_DIR"/latest.yml "$RELEASE_DIR"/*.exe "$RELEASE_DIR"/*.exe.blockmap; do
  [ -f "$f" ] && FILES_TO_UPLOAD+=("$f")
done

# macOS: latest-mac.yml + .dmg + .zip + .blockmap
for f in "$RELEASE_DIR"/latest-mac.yml "$RELEASE_DIR"/*.dmg "$RELEASE_DIR"/*-mac.zip "$RELEASE_DIR"/*.dmg.blockmap; do
  [ -f "$f" ] && FILES_TO_UPLOAD+=("$f")
done

# Linux: latest-linux.yml + .AppImage + .deb + .rpm
for f in "$RELEASE_DIR"/latest-linux.yml "$RELEASE_DIR"/*.AppImage "$RELEASE_DIR"/*.deb "$RELEASE_DIR"/*.rpm; do
  [ -f "$f" ] && FILES_TO_UPLOAD+=("$f")
done

if [ ${#FILES_TO_UPLOAD[@]} -eq 0 ]; then
  echo "错误: 未找到可上传的文件"
  echo "请确认 release 目录中包含构建产物"
  ls -la "$RELEASE_DIR"
  exit 1
fi

echo "将要上传 ${#FILES_TO_UPLOAD[@]} 个文件:"
echo ""
for f in "${FILES_TO_UPLOAD[@]}"; do
  SIZE=$(stat --printf="%s" "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo "?")
  echo "  $(basename "$f")  ($(numfmt --to=iec $SIZE 2>/dev/null || echo "${SIZE} bytes"))"
done
echo ""

OSS_DEST="${OSS_BUCKET}/${OSS_PATH}/${CHANNEL}/"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] 将上传到: $OSS_DEST"
  echo "[DRY RUN] 完成，未实际上传"
  exit 0
fi

echo "开始上传到: $OSS_DEST"
echo ""

for f in "${FILES_TO_UPLOAD[@]}"; do
  FILENAME=$(basename "$f")
  echo "  上传: $FILENAME ..."
  ossutil cp "$f" "${OSS_DEST}${FILENAME}" \
    -e "$OSS_ENDPOINT" \
    --force \
    --meta "Cache-Control:public, max-age=300"
done

echo ""
echo "========================================"
echo "  上传完成!"
echo "========================================"
echo ""
echo "访问地址:"
BUCKET_NAME=$(echo "$OSS_BUCKET" | sed 's|oss://||')
PUBLIC_URL="https://${BUCKET_NAME}.${OSS_ENDPOINT}/${OSS_PATH}/${CHANNEL}"
echo "  $PUBLIC_URL/latest.yml"
echo ""
echo "后台配置:"
echo "  Update Server URL: https://${BUCKET_NAME}.${OSS_ENDPOINT}/${OSS_PATH}"
echo ""
echo "验证:"
echo "  curl -I ${PUBLIC_URL}/latest.yml"
