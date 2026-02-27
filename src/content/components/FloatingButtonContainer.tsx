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

import React, { useState, useRef, useEffect } from 'react'
import { Languages, Volume2, VolumeX, BookOpen, Loader2, Copy, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ManualSourceLang } from '../App'

/** 语言选项展示文案 */
const SOURCE_LANG_LABELS: Record<ManualSourceLang, string> = {
  auto: '自动检测',
  en: '英语',
  de: '德语',
  fr: '法语',
  ja: '日语',
  es: '西班牙语'
}

/** 所有支持的语言 */
export type SupportedLang = 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh'

/** 目标语言选项（支持所有语言） */
export type TargetLang = SupportedLang

/** 所有语言标签 */
const ALL_LANG_LABELS: Record<SupportedLang, string> = {
  en: '英语',
  de: '德语',
  fr: '法语',
  es: '西班牙语',
  ja: '日语',
  zh: '中文'
}

interface FloatingButtonContainerProps {
  // 初始位置
  x: number
  y: number
  // 是否正在加载
  isLoading?: boolean
  // 是否正在播放语音
  isPlaying?: boolean
  // 用户手动选择的源语言
  manualSourceLang: ManualSourceLang
  // 用户切换源语言时的回调
  onManualSourceLangChange: (lang: ManualSourceLang) => void
  // 翻译按钮点击回调（可选目标语言，如果不指定则默认翻译为中文）
  onTranslate: (targetLang?: TargetLang) => void
  // 发音按钮点击回调
  onPronounce: () => void
  // 复制按钮点击回调（复制选中文字到剪贴板）
  onCopy: () => void
  // 生词本按钮点击回调
  onOpenWordbook: () => void
  // 选中的文字（用于检测是否为中文）
  selectedText?: string
}

function FloatingButtonContainer({
  x,
  y,
  isLoading = false,
  isPlaying = false,
  manualSourceLang,
  onManualSourceLangChange,
  onTranslate,
  onPronounce,
  onCopy,
  onOpenWordbook,
  selectedText = ''
}: FloatingButtonContainerProps) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [showTargetLangMenu, setShowTargetLangMenu] = useState(false)
  const [showSourceLangMenu, setShowSourceLangMenu] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  /** 最小化时显示的头像：优先使用用户上传的 toolbar-avatar.png，加载失败则回退到 toolbar-logo.png */
  const [avatarSrc, setAvatarSrc] = useState(() => chrome.runtime.getURL('src/icons/toolbar-avatar.png'))
  const menuRef = useRef<HTMLDivElement>(null)
  const sourceLangMenuRef = useRef<HTMLDivElement>(null)
  // 拖动偏移：用户拖动工具栏后相对于初始 (x,y) 的偏移，与翻译窗口一致的流畅拖动
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
  })
  const rafIdRef = useRef<number | null>(null)
  const isRafRunningRef = useRef(false)
  const currentMouseRef = useRef({ x: 0, y: 0 })
  const wasDraggingRef = useRef(false)
  const isMouseDownOnHandleRef = useRef(false)
  const isMinimizedRef = useRef(isMinimized)
  isMinimizedRef.current = isMinimized

  // 每次进入最小化时优先尝试显示用户上传的头像
  useEffect(() => {
    if (isMinimized) setAvatarSrc(chrome.runtime.getURL('src/icons/toolbar-avatar.png'))
  }, [isMinimized])

  // 选择变化时：重置拖动偏移，仅清除「拖拽时」设置的内联宽高，不要动 left/top/transform（由 React 控制，清掉会丢位置导致插件不显示）
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 })
    const container = containerRef.current
    if (container) {
      container.style.width = ''
      container.style.minWidth = ''
      container.style.height = ''
      container.style.minHeight = ''
      container.style.boxSizing = ''
    }
    const handleEl = dragHandleRef.current
    if (handleEl) {
      handleEl.style.cursor = ''
      handleEl.style.userSelect = ''
    }
  }, [x, y, selectedText])

  // 检测选中文字的语言（简化版，用于决定是否显示目标语言菜单）
  // 使用简单的字符检测，更精确的语言检测在翻译时进行
  const detectSourceLanguage = (text: string): SupportedLang | null => {
    if (!text || text.trim().length === 0) return null
    
    // 检测日语（必须在中文之前）
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      return 'ja'
    }
    
    // 检测中文
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return 'zh'
    }
    
    // 检测法语特有字符
    if (/[àâéèêëîïôùûüÿçœæÀÂÉÈÊËÎÏÔÙÛÜŸÇŒÆ]/.test(text)) {
      return 'fr'
    }
    
    // 检测德语特有字符
    if (/[äöüßÄÖÜ]/.test(text)) {
      return 'de'
    }
    
    // 检测西班牙语特有字符
    if (/[ñáéíóúü¿¡ÑÁÉÍÓÚÜ]/.test(text)) {
      return 'es'
    }
    
    // 默认假设为英语（如果包含常见英语单词）
    if (/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|is|are|was|were|be|been|have|has|had|do|does|did|will|would|should|could|can|may|might|must|this|that|these|those|i|you|he|she|it|we|they)\b/i.test(text)) {
      return 'en'
    }
    
    // 如果无法确定，返回 null（不显示菜单，使用默认翻译为中文）
    return null
  }
  
  // 检测源语言
  const detectedSourceLang = detectSourceLanguage(selectedText)
  
  // 生成可用的目标语言列表（始终提供完整列表，符合“点击即下拉选择目标语言”的交互）
  const getAvailableTargetLanguages = (_sourceLang: SupportedLang | null): TargetLang[] => {
    return ['zh', 'en', 'de', 'fr', 'es', 'ja']
  }
  
  const availableTargetLangs = getAvailableTargetLanguages(detectedSourceLang)
  
  // 始终提供“翻译为 ▾”下拉交互
  const shouldShowTargetLangMenu = true
  
  // 点击外部关闭目标语言 / 源语言菜单
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      const path = (e as any).composedPath?.() as EventTarget[] | undefined
      const inTargetMenu = menuRef.current && path ? path.includes(menuRef.current) : (menuRef.current?.contains(e.target as Node) ?? false)
      const inSourceMenu = sourceLangMenuRef.current && path ? path.includes(sourceLangMenuRef.current) : (sourceLangMenuRef.current?.contains(e.target as Node) ?? false)
      if (!inTargetMenu) setShowTargetLangMenu(false)
      if (!inSourceMenu) setShowSourceLangMenu(false)
    }
    if (showTargetLangMenu || showSourceLangMenu) {
      document.addEventListener('pointerdown', handlePointerDownOutside, true)
      return () => {
        document.removeEventListener('pointerdown', handlePointerDownOutside, true)
      }
    }
  }, [showTargetLangMenu, showSourceLangMenu])

  // 与翻译窗口一致的流畅拖动：RAF 更新位置，只在拖动结束时写回状态
  useEffect(() => {
    const container = containerRef.current
    const handleEl = dragHandleRef.current
    if (!container || !handleEl) return
    const DRAG_THRESHOLD = 3
    const MIN_MARGIN = 8

    let tw = 0
    let th = 0
    const updatePosition = () => {
      if (!container || !dragRef.current.isDragging) {
        isRafRunningRef.current = false
        return
      }
      const dx = currentMouseRef.current.x - dragRef.current.startX
      const dy = currentMouseRef.current.y - dragRef.current.startY
      const newLeft = dragRef.current.startLeft + dx
      const newTop = dragRef.current.startTop + dy
      if (tw === 0 || th === 0) {
        const r = container.getBoundingClientRect()
        tw = r.width
        th = r.height
      }
      const maxLeft = window.innerWidth - tw - MIN_MARGIN
      const maxTop = window.innerHeight - th - MIN_MARGIN
      const left = Math.max(MIN_MARGIN, Math.min(maxLeft, newLeft))
      const top = Math.max(MIN_MARGIN, Math.min(maxTop, newTop))
      container.style.left = '0'
      container.style.top = '0'
      // 使用整数像素避免亚像素渲染导致形状扭曲
      container.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
      rafIdRef.current = requestAnimationFrame(updatePosition)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!container) return
      if (!isMouseDownOnHandleRef.current) return
      currentMouseRef.current = { x: e.clientX, y: e.clientY }
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (!dragRef.current.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragRef.current.isDragging = true
        wasDraggingRef.current = true
        handleEl.style.cursor = 'grabbing'
        handleEl.style.userSelect = 'none'
        if (!isRafRunningRef.current) {
          const rect = container.getBoundingClientRect()
          container.style.width = `${rect.width}px`
          container.style.minWidth = `${rect.width}px`
          container.style.height = `${rect.height}px`
          container.style.minHeight = `${rect.height}px`
          container.style.boxSizing = 'border-box'
          isRafRunningRef.current = true
          rafIdRef.current = requestAnimationFrame(updatePosition)
        }
      }
      if (dragRef.current.isDragging) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      isMouseDownOnHandleRef.current = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      isRafRunningRef.current = false
      handleEl.style.cursor = 'grab'
      handleEl.style.userSelect = ''
      const hadDragged = dragRef.current.isDragging || wasDraggingRef.current
      dragRef.current.isDragging = false
      wasDraggingRef.current = false

      // 最小化状态下，若未拖动则视为点击头像，展开工具栏
      if (isMinimizedRef.current && !hadDragged) {
        setIsMinimized(false)
      }

      if (hadDragged && container) {
        const rect = container.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top
        const newOffsetX = centerX - x
        const newOffsetY = centerY - y
        setDragOffset({ x: newOffsetX, y: newOffsetY })
        container.style.transform = 'translateX(-50%)'
        container.style.left = `${x + newOffsetX}px`
        container.style.top = `${y + newOffsetY}px`
        container.style.width = ''
        container.style.minWidth = ''
        container.style.height = ''
        container.style.minHeight = ''
        container.style.boxSizing = ''
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (!handleEl.contains(target)) return
      if (target.closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      isMouseDownOnHandleRef.current = true
      const rect = container.getBoundingClientRect()
      dragRef.current = {
        isDragging: false,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top
      }
      currentMouseRef.current = { x: e.clientX, y: e.clientY }
      handleEl.style.cursor = 'grab'
    }

    handleEl.addEventListener('mousedown', handleMouseDown, { capture: true, passive: false })
    window.addEventListener('mousemove', onMouseMove, { capture: true, passive: false })
    window.addEventListener('mouseup', onMouseUp, { capture: true, passive: false })

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      handleEl.removeEventListener('mousedown', handleMouseDown, { capture: true } as EventListenerOptions)
      window.removeEventListener('mousemove', onMouseMove, { capture: true } as EventListenerOptions)
      window.removeEventListener('mouseup', onMouseUp, { capture: true } as EventListenerOptions)
      handleEl.style.cursor = ''
      handleEl.style.userSelect = ''
    }
    // 依赖 isMinimized：最小化时 ref 会挂到头像容器，需重新绑定拖动监听，否则最小化后无法拖动
  }, [x, y, isMinimized])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCopy()
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 1500)
  }

  return (
    <div
      ref={containerRef}
      className="context-ai-floating-button-container"
      style={{
        position: 'fixed',
        left: `${x + dragOffset.x}px`,
        top: `${y + dragOffset.y}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000000,
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        userSelect: 'none',
        background: isMinimized ? 'transparent' : 'rgba(255, 255, 255, 0.98)',
        backdropFilter: isMinimized ? 'none' : 'blur(20px)',
        WebkitBackdropFilter: isMinimized ? 'none' : 'blur(20px)',
        border: isMinimized ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: isMinimized ? '50%' : '12px',
        padding: isMinimized ? '0' : '4px 3px',
        boxShadow: isMinimized ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)',
        gap: '1px',
        width: 'max-content',
        minWidth: 'fit-content',
        maxWidth: isMinimized ? 'none' : '95vw',
        maxHeight: 'min(80px, 20vh)',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        isolation: 'isolate',
        overflow: 'visible'
      }}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      {/* 最小化状态：仅显示用户上传的头像（点击展开，拖动可移动） */}
      {isMinimized ? (
        <div
          ref={dragHandleRef}
          data-drag-handle
          className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
          style={{
            width: '44px',
            height: '44px',
            cursor: 'grab',
            background: 'transparent',
            border: 'none'
          }}
          title="点击展开 / 拖动移动"
        >
          <img
            src={avatarSrc}
            alt=""
            width={44}
            height={44}
            style={{ objectFit: 'cover', display: 'block', pointerEvents: 'none', borderRadius: '50%' }}
            onError={() => setAvatarSrc(chrome.runtime.getURL('src/icons/toolbar-logo.png'))}
          />
        </div>
      ) : (
        <>
      {/* 最小化按钮（最左侧） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMinimized(true)
        }}
        className="flex items-center justify-center rounded flex-shrink-0 border-none outline-none cursor-pointer"
        style={{
          width: '22px',
          height: '22px',
          marginRight: '2px',
          background: 'transparent',
          color: 'var(--notion-text-tertiary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
          e.currentTarget.style.color = 'var(--notion-text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--notion-text-tertiary)'
        }}
        title="最小化"
        aria-label="最小化"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
      {/* 拖动把手（优化：更紧凑） */}
      <div
        ref={dragHandleRef}
        data-drag-handle
        style={{
          width: '16px',
          minWidth: '16px',
          height: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5px',
          margin: '0 1px 0 0',
          cursor: 'grab',
          opacity: 0.5,
          borderRadius: '3px',
          pointerEvents: 'auto',
          flexShrink: 0
        }}
        title="拖动工具栏"
      >
        <div style={{ width: '1.5px', height: '3px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '1px' }} />
        <div style={{ width: '1.5px', height: '3px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '1px' }} />
      </div>
      {/* 小标志图标（头像） */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded overflow-hidden"
        style={{
          width: '20px',
          height: '20px',
          marginRight: '4px',
          background: 'rgba(250, 250, 250, 0.98)',
          border: '1px solid rgba(0, 0, 0, 0.08)'
        }}
        title="Context AI"
        aria-hidden
      >
        <img
          src={chrome.runtime.getURL('src/icons/toolbar-logo.png')}
          alt=""
          width={18}
          height={18}
          style={{ objectFit: 'cover', display: 'block' }}
        />
      </div>
      {/* 源语言选择（下拉按钮，与翻译为一致） */}
      <div ref={sourceLangMenuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation()
            if (isLoading) return
            setShowSourceLangMenu((prev) => !prev)
            setShowTargetLangMenu(false)
          }}
          className="flex items-center gap-0.5 px-2 py-1 rounded transition-all border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'transparent',
            color: isLoading ? 'var(--notion-text-tertiary)' : 'var(--notion-text)',
            fontSize: '11px',
            minWidth: 'fit-content',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
          title="选择原文语言"
          aria-label="选择原文语言"
        >
          <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>
            {SOURCE_LANG_LABELS[manualSourceLang]}
          </span>
          <ChevronDown
            className="w-2.5 h-2.5"
            strokeWidth={2.5}
            style={{
              transform: showSourceLangMenu ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </button>
        {showSourceLangMenu && !isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '10px',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
              padding: '4px',
              minWidth: '100px',
              zIndex: 1000001,
              animation: 'fadeInUp 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(Object.keys(SOURCE_LANG_LABELS) as ManualSourceLang[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onManualSourceLangChange(lang)
                  setShowSourceLangMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all border-none outline-none cursor-pointer text-left"
                style={{
                  background: manualSourceLang === lang ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
                  color: 'var(--notion-text)',
                  fontSize: '13px',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = manualSourceLang === lang ? 'rgba(0, 0, 0, 0.06)' : 'transparent'
                }}
              >
                <span>{SOURCE_LANG_LABELS[lang]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 翻译按钮：有目标语言菜单时只展开下拉，不直接翻译；无菜单时点击即翻译为中文 */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation()
            if (isLoading) return

            if (shouldShowTargetLangMenu) {
              // 有目标语言菜单时：只展开/收起下拉，用户选择后再翻译
              setShowTargetLangMenu((prev) => !prev)
              setShowSourceLangMenu(false)
            } else {
              // 无目标语言菜单时：直接翻译为中文
              onTranslate()
            }
          }}
          className="flex items-center gap-0.5 px-2 py-1 rounded transition-all border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'transparent',
            color: isLoading ? 'var(--notion-text-tertiary)' : 'var(--notion-text)',
            fontSize: '11px',
            minWidth: 'fit-content',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
              e.currentTarget.style.transform = 'scale(1.02)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.transform = 'scale(1)'
          }}
          aria-label={shouldShowTargetLangMenu ? "翻译为其他语言" : "翻译为中文"}
          title={shouldShowTargetLangMenu ? "翻译为其他语言" : "翻译为中文"}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
          ) : (
            <Languages className="w-3 h-3" strokeWidth={2.5} />
          )}
          <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>
            {shouldShowTargetLangMenu ? '翻译为' : '翻译'}
          </span>
          {shouldShowTargetLangMenu && !isLoading && (
            <ChevronDown 
              className="w-2.5 h-2.5" 
              strokeWidth={2.5}
              style={{ 
                transform: showTargetLangMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          )}
        </button>
        
        {/* 目标语言选择菜单（当检测到支持的语言时显示） */}
        {shouldShowTargetLangMenu && showTargetLangMenu && !isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '10px',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
              padding: '4px',
              minWidth: '120px',
              zIndex: 1000001,
              animation: 'fadeInUp 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {availableTargetLangs.map((lang) => (
              <button
                key={lang}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowTargetLangMenu(false)
                  onTranslate(lang)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all border-none outline-none cursor-pointer text-left"
                style={{
                  background: 'transparent',
                  color: 'var(--notion-text)',
                  fontSize: '13px',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span>{ALL_LANG_LABELS[lang]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '12px', background: 'rgba(0, 0, 0, 0.1)', margin: '0 1px' }} />

      {/* 发音按钮（优化：更紧凑） */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPronounce()
        }}
        className="flex items-center gap-0.5 px-2 py-1 rounded transition-all border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: isPlaying ? 'var(--notion-accent)' : 'var(--notion-text)',
          fontSize: '11px',
          minWidth: 'fit-content',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label={isPlaying ? '停止播放' : '发音'}
        title={isPlaying ? '停止播放' : '发音'}
      >
        {isPlaying ? (
          <>
            <VolumeX className="w-3 h-3" strokeWidth={2.5} />
            <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>停止</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3 h-3" strokeWidth={2.5} />
            <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>发音</span>
          </>
        )}
      </button>

      <div style={{ width: '1px', height: '12px', background: 'rgba(0, 0, 0, 0.1)', margin: '0 1px' }} />

      {/* 复制按钮（优化：更紧凑） */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-0.5 px-2 py-1 rounded transition-all border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: copySuccess ? 'var(--notion-success)' : 'var(--notion-text)',
          fontSize: '11px',
          minWidth: 'fit-content',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          if (!copySuccess) {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label={copySuccess ? '已复制' : '复制'}
        title={copySuccess ? '已复制' : '复制到剪贴板'}
      >
        {copySuccess ? (
          <>
            <Check className="w-3 h-3" strokeWidth={2.5} />
            <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>已复制</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" strokeWidth={2.5} />
            <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>复制</span>
          </>
        )}
      </button>

      <div style={{ width: '1px', height: '12px', background: 'rgba(0, 0, 0, 0.1)', margin: '0 1px' }} />

      {/* 生词本按钮（优化：更紧凑） */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpenWordbook()
        }}
        className="flex items-center gap-0.5 px-2 py-1 rounded transition-all border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: 'var(--notion-text)',
          fontSize: '11px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label="生词本"
        title="生词本"
      >
        <BookOpen className="w-3 h-3" strokeWidth={2.5} />
        <span className="font-medium" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>生词本</span>
      </button>
        </>
      )}
    </div>
  )
}

export default FloatingButtonContainer
