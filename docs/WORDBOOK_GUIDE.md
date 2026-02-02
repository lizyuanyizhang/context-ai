# 生词本功能使用指南

## 功能概述

生词本功能允许用户保存翻译结果，方便后续复习和学习。所有数据存储在本地（`chrome.storage.local`），不会上传到服务器，保护用户隐私。

## 核心功能

### 1. 保存单词

在翻译结果面板中，点击"保存到生词本"按钮即可保存当前翻译结果。

**保存的数据包括**：
- 原始文本（英文/德文）
- 翻译结果（中文）
- 语法点拨
- 上下文语境分析
- 音标（如果有）
- 创建时间
- 查看次数

### 2. 查看生词本

点击浮动按钮旁边的"生词本"按钮，或点击右下角的生词本图标，打开生词本管理面板。

### 3. 搜索单词

在生词本面板的搜索框中输入关键词，可以搜索：
- 原始文本
- 翻译结果
- 语法点拨
- 上下文语境

### 4. 删除单词

- **单个删除**：点击单词卡片右上角的删除按钮
- **批量删除**：勾选多个单词，点击"删除选中"按钮

### 5. 导出数据

支持两种导出格式：
- **JSON**：完整的结构化数据，包含所有字段
- **CSV**：表格格式，方便在 Excel 中打开

## 数据结构

### WordbookEntry（生词本条目）

```typescript
interface WordbookEntry {
  id: string                    // 唯一标识符
  originalText: string           // 原始文本
  translation: string            // 翻译结果
  grammar?: string              // 语法点拨（可选）
  context?: string              // 上下文语境（可选）
  phonetic?: string             // 音标（可选）
  createdAt: number            // 创建时间（时间戳）
  lastViewedAt: number         // 最后查看时间（时间戳）
  viewCount: number            // 查看次数
  tags?: string[]              // 标签（可选，用于分类）
}
```

### WordbookStorage（存储结构）

```typescript
interface WordbookStorage {
  words: WordbookEntry[]        // 单词列表
  version: number              // 版本号（用于数据迁移）
  createdAt: number           // 创建时间
  updatedAt: number           // 最后更新时间
}
```

## 存储机制

### Chrome Storage API

使用 `chrome.storage.local` 存储数据：

- **容量限制**：约 10MB（足够存储大量单词）
- **数据持久化**：即使浏览器关闭也不会丢失
- **异步操作**：所有操作都是异步的，不会阻塞 UI
- **跨标签页同步**：同一插件的不同 Content Script 可以共享数据

### 存储键名

```typescript
const STORAGE_KEY = 'context_ai_wordbook'
```

## API 使用

### 保存单词

```typescript
import { wordbookService } from '@/services/wordbook'

const result = await wordbookService.addWord({
  originalText: 'Hello',
  translation: '你好',
  grammar: '问候语',
  context: '日常用语'
})
```

### 获取所有单词

```typescript
const words = await wordbookService.getAllWords()
```

### 搜索单词

```typescript
const results = await wordbookService.searchWords('hello')
```

### 删除单词

```typescript
await wordbookService.removeWord(wordId)
```

### 导出数据

```typescript
// 导出为 JSON
const json = await wordbookService.exportToJSON()

// 导出为 CSV
const csv = await wordbookService.exportToCSV()
```

## 使用 Hook

### useWordbook Hook

```typescript
import { useWordbook } from '@/content/hooks/useWordbook'

function MyComponent() {
  const {
    words,           // 单词列表
    isLoading,       // 加载状态
    error,           // 错误信息
    saveWord,        // 保存单词
    removeWord,      // 删除单词
    searchWords,     // 搜索单词
    refresh,         // 刷新列表
    exportData       // 导出数据
  } = useWordbook()

  // 保存单词
  const handleSave = async () => {
    const success = await saveWord(translationResult)
    if (success) {
      console.log('保存成功！')
    }
  }
}
```

## 消息传递

### Content Script → Background Script

```typescript
// 保存单词
const response = await chrome.runtime.sendMessage({
  type: 'SAVE_WORD',
  data: translationResult
})

// 获取生词本
const response = await chrome.runtime.sendMessage({
  type: 'GET_WORDBOOK'
})

// 删除单词
const response = await chrome.runtime.sendMessage({
  type: 'REMOVE_WORD',
  id: wordId
})

// 搜索单词
const response = await chrome.runtime.sendMessage({
  type: 'SEARCH_WORDS',
  query: 'hello'
})

// 导出数据
const response = await chrome.runtime.sendMessage({
  type: 'EXPORT_WORDBOOK',
  format: 'json' // 或 'csv'
})
```

## 性能优化

### 1. 防重复保存

如果单词已存在（基于原始文本），会更新查看时间和次数，而不是创建新条目。

```typescript
const existingIndex = storage.words.findIndex(
  word => word.originalText.toLowerCase() === translationResult.originalText.toLowerCase()
)
```

### 2. 最新优先

新保存的单词会添加到列表最前面，方便快速访问。

```typescript
storage.words.unshift(newEntry)
```

### 3. 客户端搜索

搜索在客户端进行，不需要服务器请求，响应速度快。

## 数据迁移

如果未来需要修改数据结构，可以使用 `version` 字段进行数据迁移：

```typescript
if (storage.version < 2) {
  // 迁移逻辑
  storage.words = storage.words.map(word => {
    // 添加新字段或修改结构
    return { ...word, newField: defaultValue }
  })
  storage.version = 2
}
```

## 常见问题

### Q: 数据会丢失吗？

A: 不会。数据存储在 `chrome.storage.local`，即使浏览器关闭也不会丢失。只有在以下情况才会丢失：
- 卸载插件
- 清除浏览器数据（选择清除扩展数据）
- 手动调用 `clearAll()`

### Q: 可以导入数据吗？

A: 目前不支持导入，但可以通过以下方式手动导入：
1. 导出现有数据（JSON 格式）
2. 修改 JSON 文件
3. 使用 Chrome DevTools 的 Storage 面板手动导入

### Q: 数据有大小限制吗？

A: `chrome.storage.local` 的容量限制约为 10MB。对于生词本来说，这个容量足够存储数万个单词。

### Q: 可以同步到云端吗？

A: 目前不支持云端同步。如果需要，可以：
1. 导出数据（JSON/CSV）
2. 手动备份到云盘
3. 或使用 Chrome Sync Storage（需要修改代码）

## 未来扩展

可以添加的功能：
1. **标签系统**：给单词添加标签，方便分类
2. **复习提醒**：根据遗忘曲线提醒复习
3. **学习统计**：显示学习进度和统计信息
4. **云端同步**：同步到服务器
5. **导入功能**：从文件导入单词
6. **学习模式**：测试模式、闪卡模式等

## 参考资料

- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
