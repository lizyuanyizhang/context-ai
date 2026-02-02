# 故障排查指南

## 问题：选中文字后插件没有显示浮动按钮

### 检查步骤

#### 1. 确认插件已正确加载

1. 打开 `chrome://extensions/`
2. 找到 "Context AI" 插件
3. 确认插件已启用（开关是打开的）
4. 检查是否有错误提示（红色错误信息）

#### 2. 检查 Content Script 是否注入

1. 打开任意网页（如 bbc.com）
2. 按 `F12` 打开开发者工具
3. 切换到 "Console"（控制台）标签
4. 输入以下代码并回车：

```javascript
// 检查我们的容器是否存在
document.getElementById('context-ai-root')
```

**预期结果**：应该返回一个 DOM 元素，而不是 `null`

如果返回 `null`，说明 Content Script 没有正确注入。

#### 3. 检查是否有 JavaScript 错误

在控制台中查看是否有红色错误信息。常见错误：

- `Cannot read property 'xxx' of undefined`
- `Module not found`
- `chrome.runtime is not defined`

#### 4. 验证文字选择方式

**重要**：插件监听的是**鼠标选择文字**，不是复制操作！

**正确的使用方式**：
1. 用鼠标**拖选**文字（按住左键拖动）
2. 释放鼠标后，浮动按钮应该出现

**不支持的方式**：
- ❌ 使用 Ctrl+C 复制（不会触发）
- ❌ 双击选择单词（可能不会触发，取决于网站）

#### 5. 检查选择是否被阻止

某些网站可能会阻止文字选择。测试方法：

1. 在网页上尝试选择文字
2. 如果无法选择（文字无法高亮），说明网站阻止了选择
3. 这种情况下插件无法工作

#### 6. 检查最小/最大长度限制

插件只处理 2-500 个字符的文字选择：
- 少于 2 个字符：不会显示按钮
- 多于 500 个字符：不会显示按钮

#### 7. 手动测试事件监听

在控制台中运行以下代码来测试：

```javascript
// 测试选择检测
document.addEventListener('mouseup', () => {
  const selection = window.getSelection()
  console.log('选中文字：', selection?.toString())
  console.log('选择范围：', selection?.rangeCount)
})

// 然后选择一些文字，看看控制台是否有输出
```

#### 8. 检查插件权限

1. 打开 `chrome://extensions/`
2. 找到 "Context AI"
3. 点击"详细信息"
4. 确认以下权限已授予：
   - ✅ 存储
   - ✅ 访问活动标签页
   - ✅ 在所有网站上运行脚本

#### 9. 重新加载插件

1. 在 `chrome://extensions/` 中
2. 点击插件的"重新加载"按钮（🔄）
3. 刷新测试网页
4. 重新尝试选择文字

#### 10. 检查 Background Script

1. 在 `chrome://extensions/` 中
2. 找到 "Context AI"
3. 点击"检查视图" → "Service Worker"
4. 查看是否有错误信息

### 常见问题解决方案

#### 问题 1: Content Script 没有注入

**症状**：`document.getElementById('context-ai-root')` 返回 `null`

**解决方案**：
1. 检查 `manifest.json` 中的 `content_scripts` 配置
2. 确认 `matches` 包含目标网站
3. 重新构建并重新加载插件

#### 问题 2: 事件监听器没有触发

**症状**：选择文字后没有任何反应

**可能原因**：
- 网站阻止了事件冒泡
- 网站使用了 Shadow DOM
- 网站动态加载内容

**解决方案**：
- 尝试在其他网站测试（如 Google、Wikipedia）
- 检查控制台是否有错误

#### 问题 3: 按钮位置不正确

**症状**：按钮显示在错误的位置或看不到

**解决方案**：
- 检查页面是否有 CSS 冲突
- 检查 z-index 设置
- 尝试滚动页面

### 调试代码

在 Content Script 控制台中运行以下代码来调试：

```javascript
// 1. 检查容器
console.log('容器：', document.getElementById('context-ai-root'))

// 2. 检查选择
const selection = window.getSelection()
console.log('当前选择：', selection?.toString())
console.log('选择范围数：', selection?.rangeCount)

// 3. 手动触发选择事件
document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

// 4. 检查事件监听器
// 在 Sources 标签中设置断点，然后选择文字
```

### 联系支持

如果以上步骤都无法解决问题，请提供以下信息：

1. **Chrome 版本**：`chrome://version/`
2. **插件版本**：在 `chrome://extensions/` 中查看
3. **错误信息**：控制台中的完整错误信息
4. **测试网站**：在哪个网站测试的
5. **操作步骤**：详细描述你做了什么

### 临时解决方案

如果插件无法正常工作，可以：

1. **使用右键菜单**（如果实现了）：
   - 选中文字
   - 右键点击
   - 选择"翻译"

2. **使用快捷键**（如果实现了）：
   - 选中文字
   - 按快捷键（如 Ctrl+Shift+T）

3. **手动打开面板**：
   - 点击插件图标
   - 输入文字进行翻译
