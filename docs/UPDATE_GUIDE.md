# 🔄 插件更新指南

## ✅ 可以随时更新！

**重要**：Chrome插件支持随时更新，无需重新审核（除非有重大变更）。

## 📝 更新流程

### 1. 修改代码

```bash
# 修改代码...
# 添加新功能...
# 修复Bug...
```

### 2. 更新版本号

**必须同时更新两个文件**：

#### package.json
```json
{
  "version": "1.0.1"  // 从 1.0.0 改为 1.0.1
}
```

#### src/manifest.json
```json
{
  "version": "1.0.1"  // 必须与 package.json 一致
}
```

**版本号规则**（语义化版本）：
- `1.0.0` → `1.0.1`：Bug修复（Patch）
- `1.0.0` → `1.1.0`：新功能（Minor）
- `1.0.0` → `2.0.0`：重大变更（Major）

### 3. 重新构建

```bash
npm run build
```

### 4. 重新打包

```bash
# 使用脚本打包
./scripts/package-extension.sh

# 或手动打包
cd dist
zip -r ../context-ai-v1.0.1.zip .
cd ..
```

### 5. 上传更新

1. **登录 Chrome Web Store 开发者控制台**
   - https://chrome.google.com/webstore/devconsole

2. **找到你的插件**
   - 点击插件名称进入详情页

3. **上传新版本**
   - 点击"上传新版本"或"Upload new package"
   - 选择新的ZIP文件
   - 等待上传和验证

4. **填写更新说明**（可选但推荐）
   ```
   版本 1.0.1
   
   - 修复语言检测误判问题
   - 优化UI显示效果
   - 改进错误处理
   ```

5. **提交审核**
   - 点击"提交审核"
   - 通常不需要重新审核（除非有重大变更）

## ⚡ 快速更新流程

```bash
# 1. 更新版本号
# 编辑 package.json 和 src/manifest.json

# 2. 构建
npm run build

# 3. 打包
./scripts/package-extension.sh

# 4. 上传到Chrome Web Store
# 访问 https://chrome.google.com/webstore/devconsole
```

## 📊 更新类型

### 1. Bug修复（Patch）

**版本号**：1.0.0 → 1.0.1

**示例**：
- 修复语言检测错误
- 修复UI显示问题
- 修复崩溃问题

**审核**：通常不需要审核，自动发布

### 2. 新功能（Minor）

**版本号**：1.0.0 → 1.1.0

**示例**：
- 新增语言支持
- 新增功能（如闪卡学习）
- UI改进

**审核**：可能需要审核，但通常很快

### 3. 重大变更（Major）

**版本号**：1.0.0 → 2.0.0

**示例**：
- API重大变更
- 权限变更
- 架构重构

**审核**：需要审核，可能需要更长时间

## 🔍 更新检查清单

### 代码检查

- [ ] 代码已测试
- [ ] 版本号已更新（package.json 和 manifest.json）
- [ ] 构建成功（`npm run build`）
- [ ] 无编译错误

### 功能检查

- [ ] 新功能已测试
- [ ] 旧功能仍然正常
- [ ] 无回归问题

### 打包检查

- [ ] ZIP文件已创建
- [ ] 文件大小合理（<100MB）
- [ ] 不包含敏感信息（.env等）

### 上传检查

- [ ] 已上传到Chrome Web Store
- [ ] 更新说明已填写
- [ ] 已提交审核

## 📝 更新说明模板

### Bug修复
```
版本 1.0.1

Bug修复：
- 修复语言检测误判问题
- 修复UI显示闪烁问题
- 改进错误处理
```

### 新功能
```
版本 1.1.0

新功能：
- 新增闪卡学习模式
- 新增西班牙语支持
- 优化翻译质量

改进：
- 优化UI显示效果
- 改进语言检测准确率
```

### 重大更新
```
版本 2.0.0

重大更新：
- 重构语言检测架构
- 集成FastText快速检测
- 优化性能

注意：本次更新可能需要重新配置API Key
```

## ⚠️ 注意事项

### 1. 版本号必须递增

- ❌ 不能降级版本号（如：1.0.1 → 1.0.0）
- ✅ 必须递增（如：1.0.0 → 1.0.1）

### 2. manifest.json 版本号必须更新

- ❌ 忘记更新 manifest.json
- ✅ 同时更新 package.json 和 manifest.json

### 3. 不要包含敏感信息

- ❌ 不要包含 .env 文件
- ❌ 不要包含 API Key
- ✅ 使用环境变量或用户配置

### 4. 重大变更需要说明

- 如果添加新权限，需要说明原因
- 如果API变更，需要提供迁移指南

## 🚀 自动化更新（可选）

可以创建 GitHub Actions 自动打包：

```yaml
# .github/workflows/package.yml
name: Package Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  package:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: ./scripts/package-extension.sh
      - uses: actions/upload-artifact@v3
        with:
          name: extension-package
          path: context-ai-*.zip
```

## 📚 相关资源

- [Chrome Web Store 更新指南](https://developer.chrome.com/docs/webstore/update/)
- [Chrome 扩展程序版本管理](https://developer.chrome.com/docs/extensions/mv3/manage/)

---

**更新很简单，随时可以发布新版本！** 🚀
