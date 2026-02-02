#!/bin/bash

# Chrome插件打包脚本
# 使用方法: ./scripts/package-extension.sh

set -e

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
EXTENSION_NAME="context-ai"
ZIP_NAME="${EXTENSION_NAME}-v${VERSION}.zip"

echo "📦 开始打包插件..."
echo "版本号: ${VERSION}"

# 检查dist目录是否存在
if [ ! -d "dist" ]; then
  echo "❌ dist目录不存在，请先运行 npm run build"
  exit 1
fi

# 进入dist目录
cd dist

# 创建ZIP文件
echo "📦 创建ZIP文件: ${ZIP_NAME}"
zip -r "../${ZIP_NAME}" . -x "*.DS_Store" "*.git*" "*.env*" "node_modules/*"

# 返回项目根目录
cd ..

# 显示文件大小
FILE_SIZE=$(du -h "${ZIP_NAME}" | cut -f1)
echo "✅ 打包完成: ${ZIP_NAME} (${FILE_SIZE})"
echo ""
echo "📤 下一步："
echo "1. 访问 https://chrome.google.com/webstore/devconsole"
echo "2. 上传 ${ZIP_NAME}"
echo "3. 填写商店信息"
echo "4. 提交审核"
