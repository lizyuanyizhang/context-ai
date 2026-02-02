#!/bin/bash

# 安全检查脚本
# 用于检查是否有敏感信息泄露风险

set -e

echo "🔒 开始安全检查..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数器
ERRORS=0
WARNINGS=0

# 检查1: .env 文件是否会被提交
echo "1️⃣ 检查 .env 文件..."
if git ls-files | grep -q "^\.env$"; then
  echo -e "${RED}❌ 错误：.env 文件在Git跟踪列表中！${NC}"
  echo "   解决方案：运行 'git rm --cached .env'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ .env 文件不在Git跟踪列表中${NC}"
fi

# 检查2: dist/ 目录是否会被提交
echo ""
echo "2️⃣ 检查 dist/ 目录..."
if git ls-files | grep -q "^dist/"; then
  echo -e "${RED}❌ 错误：dist/ 目录在Git跟踪列表中！${NC}"
  echo "   解决方案：运行 'git rm -r --cached dist/'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ dist/ 目录不在Git跟踪列表中${NC}"
fi

# 检查3: node_modules/ 是否会被提交
echo ""
echo "3️⃣ 检查 node_modules/ 目录..."
if git ls-files | grep -q "^node_modules/"; then
  echo -e "${RED}❌ 错误：node_modules/ 目录在Git跟踪列表中！${NC}"
  echo "   解决方案：运行 'git rm -r --cached node_modules/'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ node_modules/ 目录不在Git跟踪列表中${NC}"
fi

# 检查4: 源代码中是否有硬编码的API Key
echo ""
echo "4️⃣ 检查源代码中是否有硬编码的API Key..."
# 搜索常见的API Key模式（sk-开头）
if grep -r "sk-[a-zA-Z0-9]\{20,\}" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "VITE_QWEN_API_KEY" | grep -v "your_api_key" | grep -v "your_actual_api_key"; then
  echo -e "${RED}❌ 警告：在源代码中发现可能的API Key！${NC}"
  echo "   请检查上述结果，确保没有硬编码API Key"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ 源代码中没有发现硬编码的API Key${NC}"
fi

# 检查5: .env.example 是否存在
echo ""
echo "5️⃣ 检查 .env.example 文件..."
if [ -f ".env.example" ]; then
  echo -e "${GREEN}✅ .env.example 文件存在${NC}"
  
  # 检查 .env.example 中是否包含真实API Key
  if grep -q "sk-[a-zA-Z0-9]\{20,\}" .env.example 2>/dev/null; then
    echo -e "${RED}❌ 错误：.env.example 中包含真实的API Key！${NC}"
    echo "   解决方案：将API Key替换为 'your_api_key_here'"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ .env.example 文件格式正确${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  警告：.env.example 文件不存在${NC}"
  echo "   建议：创建 .env.example 作为模板文件"
  WARNINGS=$((WARNINGS + 1))
fi

# 检查6: .gitignore 是否正确配置
echo ""
echo "6️⃣ 检查 .gitignore 配置..."
if [ -f ".gitignore" ]; then
  if grep -q "^\.env$" .gitignore && grep -q "^dist/" .gitignore && grep -q "^node_modules/" .gitignore; then
    echo -e "${GREEN}✅ .gitignore 配置正确${NC}"
  else
    echo -e "${YELLOW}⚠️  警告：.gitignore 可能配置不完整${NC}"
    echo "   请确保包含：.env, dist/, node_modules/"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ 错误：.gitignore 文件不存在！${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 检查7: 检查Git历史中是否有敏感信息（可选）
echo ""
echo "7️⃣ 检查Git历史（可选）..."
read -p "是否检查Git历史中的敏感信息？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if git log --all --full-history --source -- .env 2>/dev/null | grep -q "."; then
    echo -e "${RED}❌ 警告：Git历史中包含 .env 文件！${NC}"
    echo "   解决方案：使用 git-filter-repo 清理历史"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}✅ Git历史中没有发现 .env 文件${NC}"
  fi
fi

# 总结
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 检查结果总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ 所有检查通过！可以安全上传到GitHub${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  有 $WARNINGS 个警告，建议修复后再上传${NC}"
  exit 0
else
  echo -e "${RED}❌ 发现 $ERRORS 个错误，$WARNINGS 个警告${NC}"
  echo "   请修复错误后再上传到GitHub"
  exit 1
fi
