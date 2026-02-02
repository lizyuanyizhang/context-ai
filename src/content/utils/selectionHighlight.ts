/**
 * 选中文字高亮工具
 * 
 * 这个工具类用于在选中文字周围添加高亮效果
 * 帮助用户更清楚地看到选中的内容
 * 
 * 注意：由于 Content Script 运行在隔离环境中，
 * 我们不能直接修改网页的 DOM 样式，所以使用覆盖层的方式
 */

/**
 * 创建高亮覆盖层
 * 
 * 在选中文字上方创建一个半透明的覆盖层，实现高亮效果
 * 
 * @param range - 选中文字的 Range 对象
 * @returns 高亮元素的 ID（用于后续清除）
 */
export function createHighlight(range: Range): string {
  // 获取选中文字的矩形区域
  const rect = range.getBoundingClientRect()
  
  // 如果矩形无效（选中文字不可见），不创建高亮
  if (rect.width === 0 && rect.height === 0) {
    return ''
  }
  
  // 生成唯一 ID
  const highlightId = `context-ai-highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // 创建高亮元素
  const highlight = document.createElement('div')
  highlight.id = highlightId
  highlight.className = 'context-ai-selection-highlight'
  
  // 设置样式
  // 使用 fixed 定位避免页面闪动，相对于视口定位
  highlight.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 2px;
    pointer-events: none;
    z-index: 999999;
    transition: opacity 0.2s ease;
    will-change: opacity;
  `
  
  // 添加到页面
  document.body.appendChild(highlight)
  
  // 添加淡入动画
  requestAnimationFrame(() => {
    highlight.style.opacity = '1'
  })
  
  return highlightId
}

/**
 * 清除高亮
 * 
 * @param highlightId - 高亮元素的 ID
 */
export function removeHighlight(highlightId: string): void {
  if (!highlightId) {
    return
  }
  
  const element = document.getElementById(highlightId)
  if (element) {
    // 淡出动画
    element.style.opacity = '0'
    element.style.transition = 'opacity 0.2s ease'
    
    // 动画结束后移除元素
    setTimeout(() => {
      element.remove()
    }, 200)
  }
}

/**
 * 清除所有高亮
 */
export function clearAllHighlights(): void {
  const highlights = document.querySelectorAll('.context-ai-selection-highlight')
  highlights.forEach((highlight) => {
    const element = highlight as HTMLElement
    element.style.opacity = '0'
    setTimeout(() => {
      element.remove()
    }, 200)
  })
}
