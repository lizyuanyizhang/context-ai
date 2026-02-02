# 快速测试指南

## 快速开始

### 1. 安装和构建

```bash
# 安装依赖
npm install

# 构建项目
npm run build
```

### 2. 加载插件

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

### 3. 测试保存功能

1. **打开任意英文网页**（如：https://www.bbc.com/news）
2. **选中一段英文文字**（例如："Hello, how are you?"）
3. **点击"翻译"按钮**
4. **等待翻译完成**（可能需要几秒钟）
5. **点击"保存到生词本"按钮**
6. **观察是否显示成功提示** ✅

### 4. 测试查看功能

1. **点击"生词本"按钮**（在翻译按钮旁边，或右下角）
2. **检查是否显示刚才保存的单词**
3. **验证信息是否完整**：
   - 原始文本
   - 翻译结果
   - 语法点拨（如果有）
   - 上下文（如果有）
   - 创建时间
   - 查看次数

### 5. 测试搜索功能

1. **在生词本搜索框中输入关键词**
2. **测试搜索原始文本**：输入英文单词
3. **测试搜索翻译**：输入中文
4. **清空搜索框**：应该显示所有单词

### 6. 测试删除功能

#### 单个删除
1. **点击单词卡片右上角的删除按钮**（垃圾桶图标）
2. **确认删除**
3. **验证单词已从列表中消失**

#### 批量删除
1. **勾选多个单词的复选框**
2. **点击"删除选中 (N)"按钮**
3. **确认删除**
4. **验证选中的单词全部删除**

### 7. 测试导出功能

#### 导出 JSON
1. **点击"导出 JSON"按钮**
2. **检查下载的文件**：`生词本_YYYY-MM-DD.json`
3. **打开文件**，验证数据格式

#### 导出 CSV
1. **点击"导出 CSV"按钮**
2. **检查下载的文件**：`生词本_YYYY-MM-DD.csv`
3. **用 Excel 打开**，验证数据

## 调试工具

### 在 Background Script 控制台测试

1. 打开 `chrome://extensions/`
2. 找到插件，点击"检查视图" → "Service Worker"
3. 在控制台中运行以下命令：

```javascript
// 查看所有存储数据
chrome.storage.local.get(null, console.log)

// 查看生词本数据
chrome.storage.local.get(['context_ai_wordbook'], (data) => {
  console.log('生词本：', JSON.stringify(data.context_ai_wordbook, null, 2))
})

// 手动添加测试数据
chrome.storage.local.get(['context_ai_wordbook'], (data) => {
  const wordbook = data.context_ai_wordbook || {
    words: [],
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  wordbook.words.push({
    id: 'test-' + Date.now(),
    originalText: 'Hello',
    translation: '你好',
    grammar: '问候语',
    context: '日常用语',
    createdAt: Date.now(),
    lastViewedAt: Date.now(),
    viewCount: 1
  })
  
  chrome.storage.local.set({ context_ai_wordbook: wordbook }, () => {
    console.log('✅ 测试数据已添加')
  })
})

// 清空生词本
chrome.storage.local.remove(['context_ai_wordbook'], () => {
  console.log('✅ 生词本已清空')
})
```

### 在 Content Script 控制台测试

1. 打开任意网页
2. 按 F12 打开开发者工具
3. 在控制台中运行：

```javascript
// 测试保存单词
chrome.runtime.sendMessage({
  type: 'SAVE_WORD',
  data: {
    originalText: 'Test Word',
    translation: '测试单词',
    grammar: '测试语法',
    context: '测试上下文'
  }
}, (response) => {
  console.log('保存响应：', response)
})

// 测试获取生词本
chrome.runtime.sendMessage({
  type: 'GET_WORDBOOK'
}, (response) => {
  console.log('生词本：', response)
})

// 测试搜索
chrome.runtime.sendMessage({
  type: 'SEARCH_WORDS',
  query: 'test'
}, (response) => {
  console.log('搜索结果：', response)
})
```

## 常见问题

### Q: 保存后没有显示成功提示？

**检查**：
1. 打开浏览器控制台（F12），查看是否有错误
2. 检查 Background Script 控制台
3. 验证 API Key 是否配置正确

### Q: 生词本面板打不开？

**检查**：
1. 点击按钮后，检查控制台是否有错误
2. 验证 `showWordbook` 状态是否正确设置
3. 检查组件是否正确渲染

### Q: 搜索不工作？

**检查**：
1. 验证搜索关键词是否正确传递
2. 检查消息传递是否正常
3. 查看 Background Script 控制台的错误信息

### Q: 导出文件损坏？

**检查**：
1. 验证 CSV 转义是否正确
2. 检查 Blob 创建是否正确
3. 查看文件内容是否完整

## 测试检查清单

完成以下测试：

- [ ] ✅ 保存单词到生词本
- [ ] ✅ 查看生词本列表
- [ ] ✅ 搜索单词（原始文本）
- [ ] ✅ 搜索单词（翻译）
- [ ] ✅ 单个删除单词
- [ ] ✅ 批量删除单词
- [ ] ✅ 导出 JSON
- [ ] ✅ 导出 CSV
- [ ] ✅ 重复保存（应该更新而不是创建新条目）
- [ ] ✅ 空生词本显示

## 预期结果

### 保存功能
- ✅ 点击保存按钮后显示成功提示
- ✅ 按钮文字变为"✅ 已保存"
- ✅ 3 秒后提示自动消失

### 查看功能
- ✅ 生词本面板正常打开
- ✅ 显示所有保存的单词
- ✅ 单词信息完整显示

### 搜索功能
- ✅ 实时搜索，输入时立即显示结果
- ✅ 搜索匹配多个字段
- ✅ 清空搜索显示所有单词

### 删除功能
- ✅ 单个删除正常
- ✅ 批量删除正常
- ✅ 删除后数据从存储中移除

### 导出功能
- ✅ JSON 导出正常，数据完整
- ✅ CSV 导出正常，可以用 Excel 打开
- ✅ 文件名格式正确

## 性能测试

保存 50+ 个单词后测试：
- [ ] 列表渲染流畅
- [ ] 搜索响应快速
- [ ] 导出功能正常
- [ ] 没有明显的卡顿

## 报告问题

如果发现问题，请记录：
1. **问题描述**：详细描述问题
2. **复现步骤**：如何复现问题
3. **预期行为**：应该发生什么
4. **实际行为**：实际发生了什么
5. **控制台错误**：如果有错误信息，请复制
6. **Chrome 版本**：浏览器版本
7. **插件版本**：当前插件版本
