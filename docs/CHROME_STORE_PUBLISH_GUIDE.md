# 🚀 Chrome Web Store 上线指南

## 📋 上线前准备

### 1. 完善插件信息

#### 更新 manifest.json

确保以下信息完整：

```json
{
  "manifest_version": 3,
  "name": "Context AI - 智能外语学习助手",
  "version": "1.0.0",
  "description": "智能翻译、语法点拨、语音朗读、生词本 - 你的外语学习好帮手",
  "icons": {
    "16": "src/icons/icon16.png",
    "48": "src/icons/icon48.png",
    "128": "src/icons/icon128.png"
  },
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://dashscope.aliyuncs.com/*"
  ]
}
```

#### 准备商店资源

1. **图标**（已有）
   - 16x16, 48x48, 128x128（已准备）

2. **商店截图**（需要准备）
   - 至少1张，建议3-5张
   - 尺寸：1280x800 或 640x400
   - 展示插件的主要功能

3. **宣传图片**（可选但推荐）
   - 440x280：小宣传图
   - 920x680：大宣传图

4. **详细描述**（需要准备）
   - 简短描述：132字符以内
   - 详细描述：可以很长，介绍所有功能

### 2. 构建生产版本

```bash
# 确保代码是最新的
npm run build

# 检查 dist 目录
ls -la dist/
```

### 3. 测试插件

在本地测试：
1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist` 目录
5. 测试所有功能

## 📦 打包插件

### 方法1：手动打包（推荐）

1. **压缩 dist 目录**
   ```bash
   cd dist
   zip -r ../context-ai-v1.0.0.zip .
   ```

2. **检查压缩包**
   - 确保包含所有必要文件
   - 确保不包含 `.env` 等敏感文件
   - 确保不包含 `node_modules`

### 方法2：使用脚本打包

创建 `scripts/package-extension.js`：

```javascript
import fs from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import archiver from 'archiver'

const distDir = './dist'
const outputFile = './context-ai-v1.0.0.zip'

const output = createWriteStream(outputFile)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`✅ 插件已打包: ${outputFile} (${archive.pointer()} bytes)`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)
archive.directory(distDir, false)
archive.finalize()
```

## 🏪 Chrome Web Store 上线流程

### 第一步：注册开发者账号

1. **访问 Chrome Web Store 开发者控制台**
   - https://chrome.google.com/webstore/devconsole
   - 需要一次性注册费：**$5 USD**（约35元人民币）

2. **支付注册费**
   - 使用信用卡或 PayPal
   - 支付后立即生效

### 第二步：上传插件

1. **登录开发者控制台**
   - 点击"新增项目"或"Add new item"

2. **上传 ZIP 文件**
   - 选择打包好的 `context-ai-v1.0.0.zip`
   - 等待上传和验证（可能需要几分钟）

3. **填写商店信息**

   **基本信息**：
   - **名称**：Context AI - 智能外语学习助手
   - **简短描述**（132字符以内）：
     ```
     智能翻译、语法点拨、语音朗读、生词本 - 你的外语学习好帮手
     ```
   - **详细描述**：
     ```
     🌍 功能特点：
     
     ✨ 智能翻译
     - 支持英语、德语、法语、日语、西班牙语5种语言
     - 使用通义千问AI，翻译质量高
     - 自动识别语言，无需手动选择
     
     💡 语法点拨
     - 不只是翻译，还会解释语法结构
     - 告诉你为什么这样翻译（信、达、雅的标准）
     
     🌿 上下文语境
     - 结合网页上下文分析词汇含义
     - 理解真实用法，不是死板的字典翻译
     
     🔊 语音朗读
     - 一键发音，支持多语种
     - 自动识别语言，用对应的语音引擎
     - 可以读原文，也可以读翻译
     
     📚 生词本
     - 一键保存到生词本
     - 闪卡学习模式，高效记忆
     - 支持导出和查看
     
     🎴 闪卡学习
     - 3D翻转效果，学习更有趣
     - 根据掌握情况调整复习频率
     - 支持键盘快捷键
     
     🎨 精美UI
     - Apple风格 + 森林风格设计
     - 玻璃态效果，视觉体验优秀
     - 流畅的动画效果
     ```

   **分类**：
   - 主要类别：生产力工具（Productivity）
   - 次要类别：教育（Education）

   **语言**：
   - 中文（简体）
   - 中文（繁体）
   - English

   **隐私政策**（重要）：
   - 需要提供隐私政策URL
   - 可以创建 `PRIVACY_POLICY.md` 或使用 GitHub Pages

4. **上传截图和图片**
   - 商店截图（至少1张）
   - 宣传图片（可选）

5. **设置权限说明**
   - 解释为什么需要每个权限
   - 例如：
     - `storage`：保存生词本数据
     - `activeTab`：读取选中文本
     - `scripting`：注入内容脚本

### 第三步：提交审核

1. **检查清单**
   - ✅ 所有必填项已填写
   - ✅ 隐私政策已提供
   - ✅ 截图已上传
   - ✅ 权限说明已填写

2. **提交审核**
   - 点击"提交审核"
   - 审核时间：通常1-3个工作日
   - 审核通过后会自动上线

## 🔄 后续更新流程

### 可以随时更新！

**重要**：Chrome插件支持随时更新，无需重新审核（除非有重大变更）。

### 更新步骤

1. **修改代码**
   ```bash
   # 修改代码...
   # 更新版本号
   ```

2. **更新版本号**

   **在 `package.json` 中**：
   ```json
   {
     "version": "1.0.1"  // 从 1.0.0 改为 1.0.1
   }
   ```

   **在 `src/manifest.json` 中**：
   ```json
   {
     "version": "1.0.1"  // 必须与 package.json 一致
   }
   ```

3. **重新构建**
   ```bash
   npm run build
   ```

4. **重新打包**
   ```bash
   cd dist
   zip -r ../context-ai-v1.0.1.zip .
   ```

5. **上传更新**
   - 登录 Chrome Web Store 开发者控制台
   - 找到你的插件
   - 点击"上传新版本"
   - 上传新的 ZIP 文件
   - 填写更新说明（可选）
   - 提交审核

### 版本号规则

推荐使用语义化版本（Semantic Versioning）：

- **主版本号（Major）**：不兼容的API修改（如：1.0.0 → 2.0.0）
- **次版本号（Minor）**：向下兼容的功能性新增（如：1.0.0 → 1.1.0）
- **修订号（Patch）**：向下兼容的问题修正（如：1.0.0 → 1.0.1）

**示例**：
- `1.0.0` → `1.0.1`：Bug修复
- `1.0.0` → `1.1.0`：新功能（如新增语言支持）
- `1.0.0` → `2.0.0`：重大变更（如API变更）

## 📝 更新说明模板

每次更新时，建议填写更新说明：

```
版本 1.0.1 - Bug修复
- 修复语言检测误判问题
- 优化UI显示效果
- 改进错误处理

版本 1.1.0 - 新功能
- 新增闪卡学习模式
- 新增西班牙语支持
- 优化翻译质量

版本 1.2.0 - 性能优化
- 集成FastText快速检测
- 优化检测准确率
- 改进用户体验
```

## 🔒 隐私政策模板

创建 `PRIVACY_POLICY.md`：

```markdown
# Context AI 隐私政策

## 数据收集

本插件**不会**收集任何用户数据。

## 数据存储

- 生词本数据存储在本地（chrome.storage.local）
- 不会上传到任何服务器
- 不会与第三方分享

## API使用

- 使用通义千问API进行翻译
- 翻译文本会发送到通义千问服务器
- 不会存储翻译历史

## 权限说明

- `storage`：保存生词本数据（本地存储）
- `activeTab`：读取选中文本
- `scripting`：注入内容脚本

## 联系方式

如有问题，请联系：[你的邮箱]
```

## ⚠️ 注意事项

### 1. 不要包含敏感信息

- ❌ 不要包含 `.env` 文件
- ❌ 不要包含 API Key
- ❌ 不要包含 `node_modules`
- ✅ 使用环境变量或用户配置

### 2. API Key 处理

**当前问题**：API Key 在 `.env` 中，用户需要自己配置。

**解决方案**：
- **方案1**：让用户在插件设置中配置API Key
- **方案2**：提供免费额度（需要后端支持）
- **方案3**：使用Chrome Storage存储用户配置

### 3. 权限最小化

只申请必要的权限：
- `storage`：必需（生词本）
- `activeTab`：必需（读取选中文本）
- `scripting`：必需（注入内容脚本）

### 4. 审核可能被拒的原因

- ❌ 权限说明不清晰
- ❌ 缺少隐私政策
- ❌ 功能描述不准确
- ❌ 截图质量差
- ❌ 违反Chrome Web Store政策

## 🎯 上线检查清单

### 代码检查

- [ ] 代码已测试，无严重Bug
- [ ] 版本号已更新
- [ ] 所有注释和文档已完善
- [ ] 错误处理完善
- [ ] 不包含敏感信息

### 资源准备

- [ ] 图标已准备（16, 48, 128）
- [ ] 商店截图已准备（至少1张）
- [ ] 宣传图片已准备（可选）
- [ ] 隐私政策已准备

### 商店信息

- [ ] 名称已填写
- [ ] 简短描述已填写（132字符以内）
- [ ] 详细描述已填写
- [ ] 分类已选择
- [ ] 语言已选择
- [ ] 权限说明已填写

### 打包上传

- [ ] 已构建生产版本（`npm run build`）
- [ ] 已打包ZIP文件
- [ ] ZIP文件不包含敏感信息
- [ ] 已上传到Chrome Web Store

## 📚 相关资源

- [Chrome Web Store 开发者文档](https://developer.chrome.com/docs/webstore/)
- [Chrome 扩展程序最佳实践](https://developer.chrome.com/docs/extensions/mv3/best_practices/)
- [Chrome Web Store 政策](https://developer.chrome.com/docs/webstore/program-policies/)

## 💡 常见问题

### Q: 审核需要多长时间？

A: 通常1-3个工作日，复杂插件可能需要更长时间。

### Q: 审核被拒怎么办？

A: 查看拒绝原因，修改后重新提交。可以多次提交。

### Q: 可以免费发布吗？

A: 可以！Chrome Web Store 本身免费，只需要一次性注册费 $5。

### Q: 更新需要重新审核吗？

A: 通常不需要，除非有重大变更（如新增权限）。

### Q: 可以下架插件吗？

A: 可以，随时可以在开发者控制台下架。

---

**准备好上线了吗？按照这个指南一步步来，祝你成功！** 🚀
