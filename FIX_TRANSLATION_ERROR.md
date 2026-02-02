# 翻译错误修复说明

## 问题：Extension context invalidated

### 错误原因

"Extension context invalidated" 错误通常发生在以下情况：

1. **Background Service Worker 被浏览器暂停**
   - Chrome 会在 Service Worker 不活跃时自动暂停它
   - 当页面长时间未使用时，Service Worker 可能被暂停

2. **插件被重新加载**
   - 在 `chrome://extensions/` 中重新加载插件
   - 更新插件后

3. **Content Script 与 Background Script 连接断开**
   - Content Script 尝试与已失效的 Background Script 通信
   - 导致消息传递失败

### 已实施的修复

#### 1. 改进错误检测和处理

- ✅ 检测 `chrome.runtime.lastError`
- ✅ 特殊处理 "Extension context invalidated" 错误
- ✅ 提供清晰的错误提示和解决方案

#### 2. 保持 Service Worker 活跃

- ✅ 添加心跳机制（每 20 秒）
- ✅ 防止 Service Worker 被浏览器暂停
- ✅ 保持 Background Script 与 Content Script 的连接

#### 3. 改进用户提示

- ✅ 显示详细的错误说明
- ✅ 提供"刷新页面"按钮
- ✅ 提供"重新加载插件"按钮（如果适用）

### 使用说明

#### 如果遇到 "Extension context invalidated" 错误：

**方法 1：刷新页面（推荐）**
1. 点击错误提示中的"刷新页面"按钮
2. 或按 `F5` 刷新页面
3. 重新选择文字进行翻译

**方法 2：重新加载插件**
1. 打开 `chrome://extensions/`
2. 找到 "Context AI" 插件
3. 点击"重新加载"按钮（🔄）
4. 刷新测试网页

**方法 3：检查 Background Script**
1. 打开 `chrome://extensions/`
2. 找到 "Context AI"
3. 点击"检查视图" → "Service Worker"
4. 查看是否有错误信息

### 预防措施

插件现在会自动：
- ✅ 每 20 秒发送心跳，保持 Service Worker 活跃
- ✅ 检测连接状态
- ✅ 提供友好的错误提示

### 技术细节

#### 心跳机制

```typescript
// 每 20 秒发送一次心跳
setInterval(() => {
  chrome.storage.local.get(['context_ai_heartbeat'], () => {
    chrome.storage.local.set({ 
      context_ai_heartbeat: Date.now() 
    })
  })
}, 20000)
```

#### 错误检测

```typescript
// 检测 Extension context invalidated
if (chrome.runtime.lastError) {
  const lastError = chrome.runtime.lastError.message || ''
  if (lastError.includes('Extension context invalidated')) {
    // 处理错误
  }
}
```

### 测试步骤

1. **重新构建插件**：
   ```bash
   npm run build
   ```

2. **重新加载插件**：
   - 在 `chrome://extensions/` 中重新加载插件

3. **测试翻译**：
   - 选择一段英文文字
   - 点击"翻译"按钮
   - 应该能正常翻译

4. **测试错误恢复**：
   - 如果遇到错误，点击"刷新页面"
   - 应该能恢复正常

### 如果问题仍然存在

1. **检查 Background Script**：
   - 打开 Service Worker 控制台
   - 查看是否有错误

2. **检查 API Key**：
   - 确认 `.env` 文件中已配置 API Key
   - 确认 API Key 有效

3. **检查网络连接**：
   - 确认能访问通义千问 API
   - 检查防火墙设置

4. **提供调试信息**：
   - 控制台的完整错误信息
   - Background Script 控制台的错误
   - 浏览器版本和插件版本

### 常见问题

**Q: 为什么会出现这个错误？**
A: 这是 Chrome Extension 的正常行为。当 Background Service Worker 被暂停时，Content Script 无法与之通信。

**Q: 心跳机制会影响性能吗？**
A: 不会。心跳操作非常轻量，每 20 秒只执行一次简单的存储操作。

**Q: 可以完全避免这个错误吗？**
A: 不能完全避免，但通过心跳机制可以大大减少发生的频率。

**Q: 如果刷新页面后还是不行？**
A: 尝试重新加载插件，或检查 Background Script 是否有其他错误。
