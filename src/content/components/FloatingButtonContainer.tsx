/**
 * 浮动工具栏组件（线条风格）
 * 
 * 参考图片中的线条风格UI设计：
 * - 水平工具栏样式
 * - 浅灰色背景，圆角矩形
 * - 线条图标（outline style）
 * - 图标 + 中文文字标签
 * - 垂直分隔线
 * 
 * 包含三个功能：
 * 1. 翻译
 * 2. 发音
 * 3. 生词本
 */

import React from 'react'
import { Languages, Volume2, VolumeX, BookOpen, Loader2 } from 'lucide-react'

interface FloatingButtonContainerProps {
  // 初始位置
  x: number
  y: number
  // 是否正在加载
  isLoading?: boolean
  // 是否正在播放语音
  isPlaying?: boolean
  // 翻译按钮点击回调
  onTranslate: () => void
  // 发音按钮点击回调
  onPronounce: () => void
  // 生词本按钮点击回调
  onOpenWordbook: () => void
}

function FloatingButtonContainer({
  x,
  y,
  isLoading = false,
  isPlaying = false,
  onTranslate,
  onPronounce,
  onOpenWordbook
}: FloatingButtonContainerProps) {
  return (
    <div
      className="context-ai-floating-button-container"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000000,
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        // 线条风格：浅灰色背景，圆角矩形
        background: 'rgba(245, 245, 247, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '12px',
        padding: '4px 8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}
      onClick={(e) => {
        // 阻止点击事件冒泡，避免影响文字选择
        e.stopPropagation()
      }}
    >
      {/* 翻译按钮 */}
      <button
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation()
          if (!isLoading) {
            onTranslate()
          }
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'transparent',
          color: isLoading ? 'var(--apple-text-secondary)' : 'var(--apple-text)'
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label="翻译"
        title="翻译"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
        ) : (
          <Languages className="w-4 h-4" strokeWidth={2} />
        )}
        <span className="text-sm font-medium">翻译</span>
      </button>

      {/* 垂直分隔线 */}
      <div
        style={{
          width: '1px',
          height: '24px',
          background: 'rgba(0, 0, 0, 0.1)',
          margin: '0 4px'
        }}
      />

      {/* 发音按钮（支持停止播放） */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPronounce()
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: isPlaying ? 'var(--forest-accent)' : 'var(--apple-text)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label={isPlaying ? '停止播放' : '发音'}
        title={isPlaying ? '停止播放' : '发音'}
      >
        {isPlaying ? (
          <>
            <VolumeX className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-medium">停止</span>
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-medium">发音</span>
          </>
        )}
      </button>

      {/* 垂直分隔线 */}
      <div
        style={{
          width: '1px',
          height: '24px',
          background: 'rgba(0, 0, 0, 0.1)',
          margin: '0 4px'
        }}
      />

      {/* 生词本按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpenWordbook()
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: 'var(--apple-text)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label="生词本"
        title="生词本"
      >
        <BookOpen className="w-4 h-4" strokeWidth={2} />
        <span className="text-sm font-medium">生词本</span>
      </button>
    </div>
  )
}

export default FloatingButtonContainer
