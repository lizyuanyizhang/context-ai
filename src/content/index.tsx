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
import './index.css'

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
  // 创建一个容器 div，用于挂载我们的 React 应用
  // 这个 div 会被注入到网页中，但不会影响原有页面布局
  const container = document.createElement('div')
  container.id = 'context-ai-root'
  
  // 将容器添加到 body，这样我们的浮动按钮和面板就能显示在页面上
  document.body.appendChild(container)
  
  // 调试日志：确认 Content Script 已加载
  console.log('[Context AI] Content Script 已加载')
  
  // 使用 React 18 的 createRoot API 创建根节点
  // 这是 React 18 的新方式，相比之前的 ReactDOM.render 性能更好
  const root = createRoot(container)
  
  // 渲染我们的主应用组件
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
