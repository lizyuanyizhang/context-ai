/**
 * Content Script 入口文件
 * 
 * Content Script 是注入到网页中的脚本，可以：
 * 1. 访问和修改网页的 DOM（文档对象模型）
 * 2. 监听网页事件（如鼠标选择文字）
 * 3. 与 Background Script 通信
 * 
 * 注意：Content Script 运行在隔离的环境中，不能直接访问网页的 JavaScript 变量
 * 但可以通过 DOM 操作与网页交互
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// 以字符串形式导入样式，稍后注入到 Shadow DOM，避免被宿主页面样式污染
import stylesText from './index.css?inline'

// 当页面加载完成后，初始化我们的 Content Script
// DOMContentLoaded：DOM 加载完成但图片等资源可能还在加载
// 这个时机比 window.onload 更早，用户体验更好
if (document.readyState === 'loading') {
  // 如果文档还在加载，等待加载完成
  document.addEventListener('DOMContentLoaded', init)
} else {
  // 如果文档已经加载完成，直接初始化
  init()
}

function init() {
  // 避免重复注入：如果已经存在宿主节点，直接返回
  if (document.getElementById('context-ai-shadow-host')) {
    return
  }

  // 1. 创建宿主元素，并挂载到 body
  const host = document.createElement('div')
  host.id = 'context-ai-shadow-host'
  document.body.appendChild(host)

  // 2. 为宿主创建 Shadow Root，用于完全隔离样式和结构
  const shadowRoot = host.attachShadow({ mode: 'open' })

  // 3. 将我们的样式注入到 Shadow Root 中
  try {
    // 优先使用 adoptedStyleSheets（现代浏览器支持，性能更好）
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(stylesText)
    const anyShadow = shadowRoot as any
    const currentSheets = (anyShadow.adoptedStyleSheets ?? []) as CSSStyleSheet[]
    anyShadow.adoptedStyleSheets = [...currentSheets, sheet]
  } catch {
    // 回退方案：直接插入 <style> 标签
    const styleEl = document.createElement('style')
    styleEl.textContent = stylesText
    shadowRoot.appendChild(styleEl)
  }

  // 4. 在 Shadow Root 内部创建真正的 React 挂载点
  const container = document.createElement('div')
  container.id = 'context-ai-root'
  shadowRoot.appendChild(container)

  console.log('[Context AI] Content Script 已加载（Shadow DOM 模式）')

  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
