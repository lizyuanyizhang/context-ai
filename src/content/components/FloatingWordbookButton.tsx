/**
 * 可拖动的「加入生词本」浮动按钮
 * 风格与选中文字后的浮动工具栏一致。只在用户拖动并松开时移动位置，不跟随鼠标实时移动。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen } from 'lucide-react'

const DEFAULT_OFFSET = { x: 24, y: 24 }
const DRAG_THRESHOLD = 5
const MIN_MARGIN = 8

interface FloatingWordbookButtonProps {
  onClick: () => void
}

export default function FloatingWordbookButton({ onClick }: FloatingWordbookButtonProps) {
  const [position, setPosition] = useState(() => ({
    right: DEFAULT_OFFSET.x,
    bottom: DEFAULT_OFFSET.y
  }))
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = {
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY
    }
  }, [])

  useEffect(() => {
    const onMouseMove = (_e: MouseEvent) => {
      const { startX, startY } = dragRef.current
      const dx = _e.clientX - startX
      const dy = _e.clientY - startY
      if (!dragRef.current.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragRef.current.isDragging = true
      }
      // 不在此处更新 position：只在松开时移动，不跟随鼠标
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      const wasDragging = dragRef.current.isDragging
      dragRef.current.isDragging = false
      if (wasDragging) {
        (e.target as HTMLElement)?.closest?.('button')?.setAttribute?.('data-dragged', '1')
        // 仅在松开时更新位置：以松开时鼠标位置为参考，保证按钮仍在视口内
        const right = Math.max(MIN_MARGIN, Math.min(window.innerWidth - MIN_MARGIN, window.innerWidth - e.clientX))
        const bottom = Math.max(MIN_MARGIN, Math.min(window.innerHeight - MIN_MARGIN, window.innerHeight - e.clientY))
        setPosition({ right, bottom })
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if ((e.currentTarget.getAttribute('data-dragged') === '1')) {
      e.currentTarget.removeAttribute('data-dragged')
      e.preventDefault()
      return
    }
    e.currentTarget.removeAttribute('data-dragged')
    onClick()
  }, [onClick])

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      className="context-ai-floating-button-container flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm border cursor-grab active:cursor-grabbing"
      style={{
        position: 'fixed',
        right: position.right,
        bottom: position.bottom,
        zIndex: 999999,
        userSelect: 'none',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        color: 'var(--notion-text)',
        borderRadius: '12px', // 豆包风格：更大的圆角
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--notion-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--notion-surface)'
      }}
      title="加入生词本（可拖动）"
      aria-label="加入生词本"
    >
      <BookOpen className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
      <span>加入生词本</span>
    </button>
  )
}
