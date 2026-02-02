# 🔒 GitHub 上传安全检查指南

## ⚠️ 重要警告

**在将代码上传到 GitHub 之前，必须确保没有泄露任何敏感信息！**

## 🔍 安全检查清单

### ✅ 1. 环境变量文件（已保护）

- [x] `.env` 文件已在 `.gitignore` 中
- [x] `.env.example` 可以上传（不包含真实密钥）
- [x] `.env.local` 已在 `.gitignore` 中

**状态**：✅ 安全

### ✅ 2. 构建输出目录（已保护）

- [x] `dist/` 目录已在 `.gitignore` 中
- [x] 构建后的文件包含API Key，但不会被上传

**状态**：✅ 安全

**注意**：如果之前已经提交过 `dist/` 目录，需要从Git历史中删除！

### ✅ 3. 配置文件检查

#### `src/config/api.ts` ✅ 安全

```typescript
// ✅ 正确：从环境变量读取，不硬编码
export const QWEN_API_KEY = import.meta.env.VITE_QWEN_API_KEY || ''
```

**状态**：✅ 安全（代码中没有硬编码API Key）

### ✅ 4. 其他敏感文件

- [x] `package-lock.json` - ✅ 可以上传（不包含敏感信息）
- [x] `package.json` - ✅ 可以上传（不包含敏感信息）
- [x] 源代码文件 - ✅ 可以上传（使用环境变量）

## 🚨 发现的问题

### 问题1：构建产物包含API Key

**发现**：`dist/assets/qwenApi-cb407675.js` 中包含硬编码的API Key

**原因**：Vite在构建时会将环境变量打包到代码中

**解决方案**：
1. ✅ `dist/` 目录已在 `.gitignore` 中
2. ⚠️ **如果之前已经提交过 `dist/` 目录，需要从Git历史中删除**

### 问题2：`.env` 文件包含真实API Key

**发现**：`.env` 文件包含真实的API Key

**解决方案**：
1. ✅ `.env` 已在 `.gitignore` 中
2. ✅ `.env.example` 可以上传（模板文件）

## 📋 上传前检查步骤

### 步骤1：检查 `.gitignore`

```bash
# 查看 .gitignore 内容
cat .gitignore

# 确保包含以下内容：
# - .env
# - dist/
# - node_modules/
```

### 步骤2：检查Git状态

```bash
# 查看哪些文件会被提交
git status

# 确保以下文件不在列表中：
# ❌ .env
# ❌ dist/
# ❌ node_modules/
```

### 步骤3：检查敏感信息

```bash
# 搜索可能的API Key（替换为你的实际API Key前缀）
grep -r "sk-" . --exclude-dir=node_modules --exclude-dir=dist

# 如果找到结果，检查是否在源代码中硬编码
# 如果只在 .env 或 dist/ 中，则安全
```

### 步骤4：检查Git历史（如果之前提交过）

```bash
# 检查Git历史中是否包含敏感信息
git log --all --full-history -- .env
git log --all --full-history -- dist/

# 如果发现之前提交过，需要清理历史（见下方）
```

## 🛠️ 如果之前已经泄露了API Key

### 情况1：只提交了 `.env` 文件

**解决方案**：

```bash
# 1. 从Git中删除 .env 文件
git rm --cached .env

# 2. 提交删除
git commit -m "Remove .env file from Git"

# 3. 如果已经推送到GitHub，需要强制推送
# ⚠️ 警告：这会重写历史，如果其他人也在使用这个仓库，需要协调
git push --force
```

### 情况2：提交了 `dist/` 目录（包含API Key）

**解决方案**：

```bash
# 1. 从Git中删除 dist/ 目录
git rm -r --cached dist/

# 2. 提交删除
git commit -m "Remove dist/ directory from Git"

# 3. 如果已经推送到GitHub，需要强制推送
git push --force
```

### 情况3：API Key已经在Git历史中

**解决方案**：使用 `git-filter-repo` 或 `BFG Repo-Cleaner` 清理历史

**使用 git-filter-repo**：

```bash
# 安装 git-filter-repo
pip install git-filter-repo

# 从所有历史中删除包含API Key的文件
git filter-repo --path .env --invert-paths
git filter-repo --path dist/ --invert-paths

# 强制推送（⚠️ 会重写历史）
git push --force --all
```

**使用 BFG Repo-Cleaner**：

```bash
# 下载 BFG：https://rtyley.github.io/bfg-repo-cleaner/

# 删除包含API Key的文件
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --delete-folders dist

# 清理Git历史
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 强制推送
git push --force --all
```

**⚠️ 重要**：清理历史后，**必须立即更换API Key**！

## ✅ 安全上传清单

### 上传前必须检查：

- [ ] `.env` 文件不在Git跟踪列表中
- [ ] `dist/` 目录不在Git跟踪列表中
- [ ] `node_modules/` 不在Git跟踪列表中
- [ ] 源代码中没有硬编码API Key
- [ ] `.env.example` 文件存在（作为模板）
- [ ] `README.md` 中说明了如何配置API Key

### 可以安全上传的文件：

- ✅ 源代码文件（`src/` 目录）
- ✅ 配置文件（`package.json`, `tsconfig.json`, `vite.config.ts` 等）
- ✅ 文档文件（`docs/`, `README.md` 等）
- ✅ `.env.example`（模板文件）
- ✅ `.gitignore`
- ✅ 其他不包含敏感信息的文件

## 📝 推荐的Git工作流程

### 第一次上传到GitHub

```bash
# 1. 初始化Git仓库（如果还没有）
git init

# 2. 检查 .gitignore 是否正确
cat .gitignore

# 3. 检查哪些文件会被提交
git status

# 4. 添加文件（.gitignore 会自动排除敏感文件）
git add .

# 5. 再次检查状态，确保没有敏感文件
git status

# 6. 提交
git commit -m "Initial commit: Context AI Chrome Extension"

# 7. 在GitHub上创建新仓库，然后推送
git remote add origin https://github.com/你的用户名/context-ai.git
git branch -M main
git push -u origin main
```

### 日常开发

```bash
# 1. 修改代码
# ...

# 2. 检查状态
git status

# 3. 添加文件
git add .

# 4. 提交
git commit -m "描述你的更改"

# 5. 推送
git push
```

## 🔐 最佳实践

### 1. 永远不要提交敏感信息

- ❌ 不要提交 `.env` 文件
- ❌ 不要提交 `dist/` 目录（构建产物）
- ❌ 不要硬编码API Key在源代码中
- ✅ 使用环境变量
- ✅ 提供 `.env.example` 作为模板

### 2. 使用环境变量

```typescript
// ✅ 正确：从环境变量读取
export const API_KEY = import.meta.env.VITE_API_KEY || ''

// ❌ 错误：硬编码
export const API_KEY = 'sk-1234567890abcdef'
```

### 3. 定期检查

```bash
# 定期检查是否有敏感信息泄露
grep -r "sk-" . --exclude-dir=node_modules --exclude-dir=dist
```

### 4. 使用Git Hooks（可选）

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash
# 检查是否包含敏感信息
if git diff --cached --name-only | grep -q "\.env$"; then
  echo "❌ 错误：不能提交 .env 文件！"
  exit 1
fi

if git diff --cached --name-only | grep -q "^dist/"; then
  echo "❌ 错误：不能提交 dist/ 目录！"
  exit 1
fi
```

## 📚 相关资源

- [GitHub 安全最佳实践](https://docs.github.com/en/code-security)
- [Git 忽略文件指南](https://git-scm.com/docs/gitignore)
- [环境变量安全指南](https://www.twilio.com/blog/environment-variables-python)

---

**记住：安全第一！上传前一定要检查！** 🔒
