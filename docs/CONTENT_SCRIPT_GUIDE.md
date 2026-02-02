# Content Script 文字选择功能详解

## 功能概述

Content Script 是注入到网页中的脚本，负责监听用户的文字选择操作，并显示浮动按钮。本文档详细解释了实现原理和优化策略。

## 架构设计

### 1. 自定义 Hook：`useTextSelection`

**位置**：`src/content/hooks/useTextSelection.ts`

**职责**：
- 封装所有文字选择相关的逻辑
- 处理位置计算、边界检测、滚动更新
- 提供防抖处理，优化性能

**核心功能**：

```typescript
const { selectedText, buttonPosition, clearSelection } = useTextSelection({
  minLength: 2,      // 最少字符数
  maxLength: 500,    // 最多字符数
  debounceDelay: 100 // 防抖延迟（毫秒）
})
```

### 2. 浮动按钮组件：`FloatingButton`

**位置**：`src/content/components/FloatingButton.tsx`

**特点**：
- 使用 Lucide React 图标库
- 支持加载状态显示
- 包含动画效果（淡入、缩放）

### 3. 高亮工具：`selectionHighlight`

**位置**：`src/content/utils/selectionHighlight.ts`

**功能**：
- 在选中文字周围添加半透明覆盖层
- 提供淡入淡出动画
- 自动清理，避免内存泄漏

## 核心算法

### 位置计算算法

```typescript
function calculateButtonPosition(rect: DOMRect): Position {
  // 1. 计算水平位置：选中文字的中心
  let x = rect.left + rect.width / 2
  
  // 2. 边界检测：确保按钮不超出视口
  const minX = buttonWidth / 2 + 10
  const maxX = viewportWidth - buttonWidth / 2 - 10
  x = Math.max(minX, Math.min(maxX, x))
  
  // 3. 计算垂直位置：优先显示在上方
  const topY = rect.top - buttonHeight - spacing
  const bottomY = rect.bottom + spacing
  
  // 4. 智能选择：上方空间不足时显示在下方
  let y = topY >= 0 ? topY : bottomY
  
  // 5. 转换为绝对坐标（加上滚动距离）
  return {
    x: x + window.scrollX,
    y: y + window.scrollY
  }
}
```

### 选择验证算法

```typescript
function isValidSelection(selection: Selection): boolean {
  // 1. 检查是否有选中文字
  if (!selection || selection.rangeCount === 0) return false
  
  // 2. 检查文字长度
  const text = selection.toString().trim()
  if (text.length < 2 || text.length > 500) return false
  
  // 3. 检查是否在我们的组件内部选择（避免循环触发）
  const range = selection.getRangeAt(0)
  // ... 向上查找 DOM 树，检查是否在 #context-ai-root 内部
  
  return true
}
```

## 性能优化

### 1. 防抖处理（Debouncing）

**问题**：用户快速选择文字时，会触发大量事件

**解决方案**：使用防抖，延迟 100ms 执行

```typescript
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

const handleSelection = () => {
  // 清除之前的定时器
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current)
  }
  
  // 设置新的定时器
  debounceTimerRef.current = setTimeout(() => {
    // 处理选择逻辑
  }, 100)
}
```

### 2. 事件监听优化

**使用捕获阶段**：确保先于页面事件处理

```typescript
// 使用捕获阶段（第三个参数为 true）
document.addEventListener('click', handleClick, true)
window.addEventListener('scroll', handleScroll, true)
```

**及时清理**：组件卸载时移除所有监听器

```typescript
useEffect(() => {
  // 添加监听器
  document.addEventListener('mouseup', handleSelection)
  
  // 清理函数
  return () => {
    document.removeEventListener('mouseup', handleSelection)
    // 清除定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
  }
}, [])
```

### 3. Range 对象管理

**问题**：Range 对象是"活的"，DOM 变化会影响它

**解决方案**：克隆 Range 对象

```typescript
// 保存 Range 的克隆，避免被后续 DOM 操作影响
currentRangeRef.current = range.cloneRange()
```

## 边界情况处理

### 1. 按钮超出视口

**场景**：选中文字在页面边缘

**处理**：
- 水平方向：限制在视口内（左右各留 10px 边距）
- 垂直方向：上方空间不足时显示在下方

### 2. 页面滚动

**场景**：用户滚动页面时，按钮位置需要更新

**处理**：
- 监听 `scroll` 事件
- 重新计算按钮位置
- 使用防抖避免频繁更新

### 3. 窗口大小变化

**场景**：用户调整浏览器窗口大小

**处理**：
- 监听 `resize` 事件
- 重新计算按钮位置

### 4. 复杂选择场景

**场景**：跨元素选择、多行选择

**处理**：
- `getBoundingClientRect()` 会自动处理跨元素的情况
- 返回包含所有选中文字的矩形区域

## 用户体验优化

### 1. 视觉反馈

- **高亮效果**：选中文字周围添加半透明蓝色覆盖层
- **动画效果**：按钮淡入、轻微上浮
- **加载状态**：翻译时显示加载动画

### 2. 交互优化

- **点击外部关闭**：点击页面其他地方时隐藏按钮
- **阻止事件冒泡**：按钮点击不会触发页面事件
- **智能位置**：按钮自动选择最佳显示位置

### 3. 无障碍支持

- **ARIA 标签**：按钮包含 `aria-label` 和 `title`
- **键盘支持**：可以使用 Tab 键导航（浏览器默认支持）

## 常见问题

### Q: 为什么按钮有时不显示？

A: 可能的原因：
1. 选中文字太短（< 2 字符）或太长（> 500 字符）
2. 选中文字在我们的组件内部（避免循环触发）
3. 按钮位置计算错误（检查浏览器控制台错误）

### Q: 按钮位置不准确？

A: 检查以下几点：
1. 页面是否有 CSS transform 或 perspective（会影响位置计算）
2. 是否有 iframe（iframe 内的选择需要特殊处理）
3. 页面是否使用了自定义滚动容器

### Q: 性能问题？

A: 优化建议：
1. 增加防抖延迟（如果选择操作频繁）
2. 减少高亮动画的复杂度
3. 使用 `requestAnimationFrame` 优化动画

## 技术细节

### DOM 选择 API

```typescript
// 获取当前选择
const selection = window.getSelection()

// 获取选中的文字
const text = selection?.toString()

// 获取选中范围
const range = selection?.getRangeAt(0)

// 获取位置信息（相对于视口）
const rect = range?.getBoundingClientRect()
```

### 坐标系统

- **视口坐标**：`getBoundingClientRect()` 返回相对于视口的坐标
- **页面坐标**：需要加上 `window.scrollX` 和 `window.scrollY`
- **绝对定位**：使用 `position: absolute` + `left/top` 设置位置

### 事件处理

- **mouseup**：用户释放鼠标时触发（选择完成）
- **click**：点击事件（用于关闭按钮）
- **scroll**：页面滚动（更新按钮位置）
- **resize**：窗口大小变化（更新按钮位置）

## 扩展功能

### 未来可以添加的功能

1. **多语言支持**：检测更多语言（法语、西班牙语等）
2. **选择历史**：记录用户的选择历史
3. **快捷键支持**：使用键盘快捷键触发翻译
4. **自定义样式**：允许用户自定义按钮样式和位置
5. **选择预览**：显示选中文字的预览（在按钮中）

## 参考资料

- [MDN: Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)
- [MDN: Range API](https://developer.mozilla.org/en-US/docs/Web/API/Range)
- [React Hooks 文档](https://react.dev/reference/react)
- [Chrome Extension Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
