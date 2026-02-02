# 📦 FastText安装指南

## 为什么需要FastText？

FastText是Facebook开源的快速文本分类和语言检测库，在混合架构语言检测系统中作为**第一步**使用。

**优势**：
- ⚡ 极快速度（~10-50ms）
- 🎯 高准确率（~98%）
- 🌍 支持176种语言

## 安装步骤

### 1. 安装npm包

```bash
npm install fasttext.wasm.js
```

### 2. 验证安装

安装完成后，混合架构检测器会自动检测FastText是否可用，并在可用时使用。

### 3. 测试

```typescript
import { hybridLanguageDetect } from './utils/hybridLanguageDetector'

const result = await hybridLanguageDetect("Hello world")
console.log(result.method) // 如果显示 'fasttext'，说明FastText已成功集成
```

## 注意事项

1. **FastText是可选的**
   - 如果不安装，系统会自动跳过第一步
   - 仍然可以使用字符扫描和LLM检测

2. **首次加载**
   - FastText模型首次加载需要时间（~1-2秒）
   - 模型加载后会缓存，后续调用很快

3. **包大小**
   - FastText模型约900KB（压缩后）
   - 会增加插件体积，但提升检测准确率

## 故障排除

### 问题1：FastText未安装

**现象**：检测方法始终是 `charscan` 或 `llm`，从未使用 `fasttext`

**解决**：
```bash
npm install fasttext.wasm.js
npm run build
```

### 问题2：FastText加载失败

**现象**：控制台显示 "FastText模型加载失败"

**解决**：
1. 检查网络连接（首次需要下载模型）
2. 检查浏览器控制台错误信息
3. 尝试重新加载插件

### 问题3：TypeScript编译错误

**现象**：`Cannot find module 'fasttext.wasm.js'`

**解决**：
- 确保已运行 `npm install fasttext.wasm.js`
- 重新运行 `npm run build`

## 性能影响

| 场景 | 不使用FastText | 使用FastText |
|------|---------------|--------------|
| 检测速度 | ~1-500ms | ~10-500ms |
| 准确率 | ~92% | ~97% |
| 插件体积 | 较小 | +900KB |

## 推荐配置

**推荐**：安装FastText，获得最佳检测体验。

**如果**：
- 插件体积敏感 → 可以不安装，使用字符扫描+LLM
- 需要最高准确率 → 必须安装FastText

---

**安装FastText，享受极速高准确率的语言检测！** 🚀
