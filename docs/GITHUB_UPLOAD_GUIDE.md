# 📤 GitHub 上传完整指南

## 🎯 目标

安全地将 Context AI 项目上传到 GitHub，确保不泄露任何敏感信息。

## ⚠️ 重要：安全检查

**在上传之前，必须先运行安全检查脚本！**

```bash
# 运行安全检查
./scripts/check-security.sh
```

## 📋 上传前准备

### 1. 确保敏感文件已被忽略

检查 `.gitignore` 文件，确保包含：

```
.env
dist/
node_modules/
*.zip
```

### 2. 检查Git状态

```bash
# 查看哪些文件会被提交
git status

# 确保以下文件不在列表中：
# ❌ .env
# ❌ dist/
# ❌ node_modules/
```

### 3. 运行安全检查脚本

```bash
./scripts/check-security.sh
```

如果发现错误，按照提示修复后再继续。

## 🚀 上传步骤

### 步骤1：初始化Git仓库（如果还没有）

```bash
# 检查是否已经是Git仓库
git status

# 如果不是，初始化
git init
```

### 步骤2：添加文件

```bash
# 添加所有文件（.gitignore会自动排除敏感文件）
git add .

# 再次检查状态，确保没有敏感文件
git status
```

**确保以下文件不在列表中**：
- ❌ `.env`
- ❌ `dist/`
- ❌ `node_modules/`
- ❌ `*.zip`

### 步骤3：提交代码

```bash
git commit -m "Initial commit: Context AI Chrome Extension

- 智能翻译功能（支持5种语言）
- 语法点拨和上下文语境分析
- 语音朗读功能
- 生词本和闪卡学习模式
- 混合架构语言检测（FastText + 字符扫描 + LLM）"
```

### 步骤4：在GitHub上创建仓库

1. **登录GitHub**：https://github.com
2. **点击右上角的 "+"** → "New repository"
3. **填写仓库信息**：
   - Repository name: `context-ai`（或你喜欢的名字）
   - Description: `智能外语学习助手 - Chrome Extension`
   - Visibility: Public（或Private，根据你的需求）
   - **不要**勾选 "Initialize this repository with a README"
4. **点击 "Create repository"**

### 步骤5：连接本地仓库和GitHub

```bash
# 添加远程仓库（替换为你的GitHub用户名和仓库名）
git remote add origin https://github.com/你的用户名/context-ai.git

# 或者使用SSH（如果你配置了SSH密钥）
git remote add origin git@github.com:你的用户名/context-ai.git

# 验证远程仓库
git remote -v
```

### 步骤6：推送代码

```bash
# 设置主分支为 main（如果还没有）
git branch -M main

# 推送代码到GitHub
git push -u origin main
```

**如果遇到认证问题**：

- **使用HTTPS**：GitHub会提示输入用户名和密码（或Personal Access Token）
- **使用SSH**：需要先配置SSH密钥

## 🔐 配置GitHub认证

### 方法1：使用Personal Access Token（推荐）

1. **生成Token**：
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token (classic)
   - 选择权限：`repo`（完整仓库访问权限）
   - 生成并复制Token

2. **使用Token**：
   ```bash
   # 推送时，用户名输入你的GitHub用户名
   # 密码输入刚才生成的Token
   git push -u origin main
   ```

### 方法2：使用SSH密钥

1. **生成SSH密钥**：
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **添加SSH密钥到GitHub**：
   - 复制公钥：`cat ~/.ssh/id_ed25519.pub`
   - GitHub → Settings → SSH and GPG keys → New SSH key
   - 粘贴公钥并保存

3. **使用SSH URL**：
   ```bash
   git remote set-url origin git@github.com:你的用户名/context-ai.git
   ```

## ✅ 上传后检查

### 1. 检查GitHub仓库

访问你的GitHub仓库，确认：
- ✅ 所有源代码文件都已上传
- ✅ `.env` 文件**没有**上传
- ✅ `dist/` 目录**没有**上传
- ✅ `node_modules/` **没有**上传

### 2. 检查敏感信息

在GitHub仓库中搜索：
- 搜索 `sk-`（API Key前缀）
- 搜索你的真实API Key（如果记得的话）

**如果发现敏感信息**：
1. 立即删除相关文件
2. 更换API Key
3. 清理Git历史（见 `GITHUB_SECURITY_GUIDE.md`）

## 📝 推荐的README.md内容

确保 `README.md` 包含：

1. **项目介绍**
2. **功能特点**
3. **安装步骤**
4. **配置说明**（如何设置API Key）
5. **使用说明**
6. **技术栈**
7. **贡献指南**（可选）
8. **许可证**（可选）

## 🔄 后续更新

### 日常开发流程

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

### 更新前检查

每次推送前，运行安全检查：

```bash
./scripts/check-security.sh
```

## 🛠️ 常见问题

### Q: 推送时提示 "Permission denied"

**A**: 检查认证方式：
- 如果使用HTTPS，确保使用Personal Access Token
- 如果使用SSH，确保SSH密钥已添加到GitHub

### Q: 推送时提示 "Large files"

**A**: 检查是否有大文件（如 `node_modules/`）：
```bash
# 从Git中删除大文件
git rm --cached -r node_modules/
git commit -m "Remove node_modules"
git push
```

### Q: 不小心提交了 `.env` 文件

**A**: 立即处理：
```bash
# 1. 从Git中删除
git rm --cached .env

# 2. 提交删除
git commit -m "Remove .env file"

# 3. 推送
git push

# 4. 更换API Key（重要！）
```

### Q: 如何让其他人使用这个项目？

**A**: 在 `README.md` 中说明：
1. 克隆仓库
2. 安装依赖：`npm install`
3. 复制 `.env.example` 为 `.env`
4. 在 `.env` 中填入自己的API Key
5. 构建：`npm run build`

## 📚 相关文档

- `docs/GITHUB_SECURITY_GUIDE.md` - 详细的安全检查指南
- `docs/CHROME_STORE_PUBLISH_GUIDE.md` - Chrome Web Store上线指南
- `README.md` - 项目说明文档

---

**准备好了吗？按照步骤一步步来，安全上传到GitHub！** 🚀
