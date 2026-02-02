/**
 * 浮动按钮组件
 * 
 * 这个组件负责显示在选中文字上方的浮动按钮
 * 包含动画效果和视觉反馈
 */

import React from 'react'
import { Search, Loader2 } from 'lucide-react'

interface FloatingButtonProps {
  // 按钮的位置
  x: number
  y: number
  // 是否正在加载（显示加载动画）
  isLoading?: boolean
  // 点击回调
  onClick: () => void
  // 按钮文本（可选，默认 "翻译"）
  text?: string
}

function FloatingButton({
  x,
  y,
  isLoading = false,
  onClick,
  text = '翻译'
}: FloatingButtonProps) {
  return (
    <div
      className="context-ai-floating-button"
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translateX(-50%)', // 居中显示
        zIndex: 1000000, // 确保在最上层
        pointerEvents: 'auto' // 确保可以点击
      }}
      // 阻止事件冒泡，避免触发页面的点击事件
      onClick={(e) => {
        e.stopPropagation()
        if (!isLoading) {
          onClick()
        }
      }}
      onMouseDown={(e) => {
        // 阻止 mousedown 事件，避免影响文字选择
        e.stopPropagation()
      }}
    >
      <button
        disabled={isLoading}
        className={`
          flex items-center gap-2
          bg-blue-500 hover:bg-blue-600 
          active:bg-blue-700
          disabled:bg-blue-400
          text-white 
          px-4 py-2 
          rounded-lg 
          shadow-lg
          transition-all duration-200
          transform hover:scale-105 active:scale-95
          border-none outline-none
          cursor-pointer
          font-medium
          text-sm
        `}
        aria-label="翻译选中的文字"
        title="点击翻译选中的文字"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>翻译中...</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            <span>{text}</span>
          </>
        )}
      </button>
    </div>
  )
}

export default FloatingButton
