# 快速调试检查清单

## 立即检查（5 分钟）

### 1. 检查插件是否加载

打开浏览器控制台（F12），输入：

```javascript
document.getElementById('context-ai-root')
```

**应该看到**：`<div id="context-ai-root">...</div>`

**如果看到 `null`**：Content Script 没有注入，需要重新加载插件

### 2. 检查控制台日志

在控制台中应该看到：
```
[Context AI] Content Script 已加载
```

如果没有看到，说明脚本没有执行。

### 3. 测试文字选择

1. **用鼠标拖选一段文字**（至少 2 个字符）
2. 释放鼠标
3. 在控制台中应该看到：
```
[Context AI] 检测到文字选择：...
```

### 4. 检查选择对象

在控制台中输入：

```javascript
window.getSelection()?.toString()
```

选择一些文字后运行，应该返回选中的文字。

### 5. 手动触发选择检测

```javascript
// 先选择一些文字，然后运行：
document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
```

### 6. 检查 Background Script

1. 打开 `chrome://extensions/`
2. 找到 "Context AI"
3. 点击"检查视图" → "Service Worker"
4. 查看控制台是否有错误

## 常见问题快速修复

### 问题：完全没有反应

**检查清单**：
- [ ] 插件是否启用？
- [ ] 是否重新加载了插件？
- [ ] 是否刷新了网页？
- [ ] 控制台是否有错误？

### 问题：选择文字后没有按钮

**检查清单**：
- [ ] 选择的文字是否超过 2 个字符？
- [ ] 选择的文字是否少于 500 个字符？
- [ ] 是否在插件组件内部选择？（不应该）
- [ ] 控制台是否有 `[Context AI] 检测到文字选择` 日志？

### 问题：按钮位置不对

**检查清单**：
- [ ] 页面是否有 CSS 冲突？
- [ ] 是否使用了 iframe？（iframe 需要特殊处理）
- [ ] 页面是否有 transform 或 perspective？

## 测试网站

在不同网站测试，确认是否是网站特定的问题：

- ✅ Google.com
- ✅ Wikipedia.org
- ✅ GitHub.com
- ❓ BBC.com（可能有特殊处理）

## 如果还是不行

1. **完全重新安装插件**：
   - 在 `chrome://extensions/` 中移除插件
   - 重新加载 `dist` 目录

2. **检查构建输出**：
   ```bash
   npm run build
   ```
   确认没有错误

3. **检查 manifest.json**：
   打开 `dist/manifest.json`，确认配置正确

4. **提供调试信息**：
   - 控制台的完整错误信息
   - 浏览器版本
   - 插件版本
   - 测试的网站
