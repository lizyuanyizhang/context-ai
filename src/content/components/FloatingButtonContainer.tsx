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
import { Languages, Volume2, VolumeX, BookOpen, Loader2, Copy, Check, ChevronDown } from 'lucide-react'
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
  const menuRef = useRef<HTMLDivElement>(null)
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
  
  // 生成可用的目标语言列表（排除源语言本身）
  const getAvailableTargetLanguages = (sourceLang: SupportedLang | null): TargetLang[] => {
    const allLangs: SupportedLang[] = ['en', 'de', 'fr', 'es', 'ja', 'zh']
    if (!sourceLang) {
      // 如果无法检测源语言，默认显示所有语言（用户可以选择）
      return allLangs
    }
    // 排除源语言本身
    return allLangs.filter(lang => lang !== sourceLang) as TargetLang[]
  }
  
  const availableTargetLangs = getAvailableTargetLanguages(detectedSourceLang)
  
  // 是否显示目标语言菜单（如果检测到支持的语言，且不是中文，或者用户手动选择了语言）
  const shouldShowTargetLangMenu = detectedSourceLang !== null || manualSourceLang !== 'auto'
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowTargetLangMenu(false)
      }
    }
    
    if (showTargetLangMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showTargetLangMenu])

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
  }, [x, y])

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
        background: 'rgba(255, 242, 248, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(220, 190, 200, 0.35)',
        borderRadius: '12px',
        padding: '4px 3px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)',
        gap: '1px',
        width: 'max-content',
        minWidth: 'fit-content',
        maxWidth: '95vw',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        isolation: 'isolate'
      }}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
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
        <div style={{ width: '1.5px', height: '3px', background: 'rgba(180, 140, 150, 0.4)', borderRadius: '1px' }} />
        <div style={{ width: '1.5px', height: '3px', background: 'rgba(180, 140, 150, 0.4)', borderRadius: '1px' }} />
      </div>
      {/* 小标志图标（优化：更小） */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded overflow-hidden"
        style={{
          width: '20px',
          height: '20px',
          marginRight: '4px',
          background: 'rgba(255, 248, 252, 0.9)',
          border: '1px solid rgba(220, 190, 200, 0.3)'
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
      {/* 源语言选择（优化：更紧凑，减小长度，固定宽度） */}
      <select
        value={manualSourceLang}
        onChange={(e) => onManualSourceLangChange(e.target.value as ManualSourceLang)}
        disabled={isLoading}
        className="rounded px-1.5 py-0.5 font-medium outline-none cursor-pointer disabled:opacity-50 transition-all"
        style={{
          background: 'transparent',
          color: 'var(--notion-text-secondary)',
          border: 'none',
          marginRight: '2px',
          fontSize: '11px',
          letterSpacing: '-0.01em',
          width: '68px',
          minWidth: '68px',
          maxWidth: '68px',
          paddingRight: '16px',
          boxSizing: 'border-box',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.color = 'var(--notion-text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--notion-text-secondary)'
        }}
        title="选择原文语言"
        aria-label="选择原文语言"
      >
        {(Object.keys(SOURCE_LANG_LABELS) as ManualSourceLang[]).map((lang) => (
          <option key={lang} value={lang}>
            {SOURCE_LANG_LABELS[lang]}
          </option>
        ))}
      </select>

      {/* 翻译按钮（豆包风格：图标+文字，hover 背景，支持下拉菜单） */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation()
            if (isLoading) return
            
            // 如果检测到支持的语言，显示目标语言选择菜单；否则直接翻译为中文
            if (shouldShowTargetLangMenu) {
              setShowTargetLangMenu(!showTargetLangMenu)
            } else {
              onTranslate() // 默认翻译为中文
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
              e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)'
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
              background: 'rgba(255, 242, 248, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(220, 190, 200, 0.35)',
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
                  e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)'
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

      <div style={{ width: '1px', height: '12px', background: 'rgba(220, 190, 200, 0.35)', margin: '0 1px' }} />

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
          e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)'
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

      <div style={{ width: '1px', height: '12px', background: 'rgba(220, 190, 200, 0.35)', margin: '0 1px' }} />

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
            e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)'
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

      <div style={{ width: '1px', height: '12px', background: 'rgba(220, 190, 200, 0.35)', margin: '0 1px' }} />

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
          e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)'
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
    </div>
  )
}

export default FloatingButtonContainer
