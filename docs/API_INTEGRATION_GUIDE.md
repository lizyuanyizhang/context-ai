# 通义千问 API 集成指南

## 概述

本文档详细说明了如何集成通义千问 API 进行翻译，包括 API 调用、错误处理、提示词优化等。

## 架构设计

### 1. API 服务层 (`src/services/qwenApi.ts`)

**职责**：
- 封装所有与通义千问 API 的交互
- 构建请求、解析响应
- 错误处理和重试机制

### 2. Background Script (`src/background/index.ts`)

**职责**：
- 接收来自 Content Script 的翻译请求
- 调用 API 服务进行翻译
- 返回结果给 Content Script

**为什么在 Background Script 中调用 API？**
- Content Script 运行在网页环境中，可能受到 CORS 限制
- Background Script 有更高的权限，可以访问所有网站
- 集中管理 API 调用，便于错误处理和重试

### 3. Content Script Hook (`src/content/hooks/useTranslation.ts`)

**职责**：
- 封装翻译状态管理
- 与 Background Script 通信
- 处理加载状态和错误

## API 调用流程

```
用户选择文字
    ↓
Content Script (useTranslation Hook)
    ↓
发送消息到 Background Script
    ↓
Background Script (handleTranslateRequest)
    ↓
调用 qwenApi.translateText()
    ↓
发送 HTTP 请求到通义千问 API
    ↓
解析响应并返回结果
    ↓
Content Script 更新 UI
```

## 提示词设计

### 核心原则

1. **清晰明确**：告诉模型要做什么
2. **格式要求**：明确要求返回 JSON 格式
3. **示例说明**：提供示例帮助模型理解

### 提示词模板

```typescript
你是一位专业的外语学习助手。请将以下{语言}文本翻译成中文，并提供详细的学习辅助信息。

要求：
1. 翻译要准确、自然、符合中文表达习惯
2. 提供语法点拨，解释关键语法点
3. 分析上下文语境，说明这个词/句子在上下文中的含义
4. 如果是单词，提供音标（IPA 国际音标）

请严格按照以下 JSON 格式返回：
{
  "translation": "翻译结果",
  "grammar": "语法点拨（可选）",
  "context": "上下文语境分析（可选）",
  "phonetic": "音标（可选）"
}
```

### 为什么要求 JSON 格式？

- **结构化数据**：便于程序解析和处理
- **一致性**：确保每次返回格式相同
- **扩展性**：可以轻松添加新字段

## API 参数说明

### Temperature（温度）

```typescript
temperature: 0.3
```

**作用**：控制输出的随机性

- **0.0-0.3**：更确定性的输出（适合翻译，希望结果一致）
- **0.7-1.0**：平衡创造性和准确性
- **1.5-2.0**：非常创造性（不适合翻译）

**翻译场景推荐**：0.3（保证准确性）

### Top-p（核采样）

```typescript
top_p: 0.9
```

**作用**：另一种控制随机性的方式

- **0.9**：只考虑概率最高的 90% 的词汇（保证准确性）
- **1.0**：考虑所有词汇（可能产生不相关的词）

**翻译场景推荐**：0.9（保证准确性）

### Max Tokens

```typescript
max_tokens: 1000
```

**作用**：限制返回的最大 token 数

- 翻译场景下，我们期望返回 JSON，所以设置合理上限
- 太大会浪费 token，太小可能截断结果

## 响应解析

### 处理多种格式

通义千问可能返回：
1. 纯 JSON 字符串
2. Markdown 代码块包裹的 JSON（```json ... ```）
3. 包含其他文字的响应

### 解析策略

```typescript
function parseTranslationResponse(content: string): TranslationResponse {
  // 1. 移除 Markdown 代码块标记
  let jsonStr = content.trim()
  
  // 2. 提取 JSON 对象
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0]
  }
  
  // 3. 解析 JSON
  const parsed = JSON.parse(jsonStr)
  
  // 4. 验证必需字段
  if (!parsed.translation) {
    throw new Error('响应中缺少 translation 字段')
  }
  
  return parsed
}
```

## 错误处理

### 错误类型

1. **MISSING_API_KEY**：未配置 API Key
2. **EMPTY_TEXT**：翻译文本为空
3. **API_ERROR**：API 请求失败（HTTP 错误）
4. **INVALID_RESPONSE**：响应格式错误
5. **EMPTY_RESPONSE**：响应中缺少内容
6. **UNKNOWN_ERROR**：未知错误

### 重试机制

```typescript
// 指数退避策略
for (let attempt = 0; attempt <= retries; attempt++) {
  try {
    // 发送请求
    const response = await fetch(url, options)
    // 处理响应
    return result
  } catch (error) {
    // 如果不是最后一次尝试，等待后重试
    if (attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s...
      await new Promise(resolve => setTimeout(resolve, delay))
      continue
    }
    throw error
  }
}
```

**重试策略**：
- 默认重试 2 次（总共 3 次尝试）
- 指数退避：1s, 2s, 4s...
- 只对网络错误和临时错误重试

## 性能优化

### 1. 请求取消

```typescript
// 如果用户选择了新的文字，取消之前的请求
const currentRequestRef = useRef<{ text: string } | null>(null)

// 检查请求是否被取消
if (currentRequestRef.current?.text !== text.trim()) {
  return // 请求已被取消
}
```

### 2. 防抖处理

在 Content Script 中，使用防抖避免频繁请求：

```typescript
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

const handleSelection = () => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current)
  }
  
  debounceTimerRef.current = setTimeout(() => {
    // 处理选择
  }, 100)
}
```

### 3. 缓存（可选）

可以添加缓存机制，避免重复翻译相同文本：

```typescript
const cache = new Map<string, TranslationResponse>()

function translateWithCache(text: string): Promise<TranslationResponse> {
  if (cache.has(text)) {
    return Promise.resolve(cache.get(text)!)
  }
  
  return translateText(text).then(result => {
    cache.set(text, result)
    return result
  })
}
```

## 测试建议

### 1. 单元测试

```typescript
describe('qwenApi', () => {
  it('应该正确解析 JSON 响应', () => {
    const response = parseTranslationResponse('{"translation": "你好"}')
    expect(response.translation).toBe('你好')
  })
  
  it('应该处理 Markdown 代码块', () => {
    const response = parseTranslationResponse('```json\n{"translation": "你好"}\n```')
    expect(response.translation).toBe('你好')
  })
})
```

### 2. 集成测试

- 测试完整的翻译流程
- 测试错误处理
- 测试重试机制

### 3. 手动测试

1. 配置 API Key
2. 选择英文文本，测试翻译
3. 选择德文文本，测试翻译
4. 测试错误情况（如无效 API Key）

## 常见问题

### Q: API 返回的不是 JSON 格式？

A: 
1. 检查提示词是否明确要求 JSON 格式
2. 使用 `response_format: { type: 'json_object' }`（如果模型支持）
3. 增强响应解析逻辑，处理多种格式

### Q: 翻译结果不准确？

A:
1. 优化提示词，提供更详细的说明
2. 调整 temperature 和 top_p 参数
3. 使用更强大的模型（如 qwen-plus 或 qwen-max）

### Q: API 调用失败？

A:
1. 检查 API Key 是否正确配置
2. 检查网络连接
3. 检查 API 配额和限制
4. 查看错误日志，了解具体错误原因

### Q: 响应时间过长？

A:
1. 使用更快的模型（qwen-turbo）
2. 减少 max_tokens
3. 优化提示词长度
4. 添加超时处理

## 安全考虑

1. **API Key 保护**：
   - 不要将 API Key 提交到 Git
   - 使用环境变量存储
   - 在 Background Script 中使用，不在 Content Script 中暴露

2. **请求限制**：
   - 实现速率限制，避免过度调用
   - 监控 API 使用量

3. **错误信息**：
   - 不要向用户暴露详细的错误信息
   - 记录详细错误日志供开发者查看

## 参考资料

- [通义千问 API 文档](https://help.aliyun.com/zh/dashscope/)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)（兼容格式参考）
- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
