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

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCopy()
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 1500)
  }

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
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(55, 53, 47, 0.08)',
        borderRadius: '12px', // 豆包风格：更大的圆角
        padding: '8px 4px', // 更紧凑的内边距
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)', // 更柔和的阴影
        gap: '2px' // 元素之间的间距
      }}
      onClick={(e) => {
        // 阻止点击事件冒泡，避免影响文字选择
        e.stopPropagation()
      }}
    >
      {/* 拖动把手（豆包风格：左侧两条竖线） */}
      <div
        style={{
          width: '3px',
          height: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '3px',
          margin: '0 8px 0 6px',
          cursor: 'grab',
          opacity: 0.4
        }}
        title="拖动工具栏"
      >
        <div style={{ width: '1px', height: '4px', background: 'var(--notion-text-secondary)', borderRadius: '1px' }} />
        <div style={{ width: '1px', height: '4px', background: 'var(--notion-text-secondary)', borderRadius: '1px' }} />
      </div>
      {/* 源语言选择（豆包风格：更简洁的下拉框） */}
      <select
        value={manualSourceLang}
        onChange={(e) => onManualSourceLangChange(e.target.value as ManualSourceLang)}
        disabled={isLoading}
        className="rounded-md px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer disabled:opacity-50 transition-all"
        style={{
          background: 'transparent',
          color: 'var(--notion-text-secondary)',
          border: 'none',
          marginRight: '4px'
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.color = 'var(--notion-text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--notion-text-secondary)'
        }}
        title="选择原文语言（识别不准时可手动选择）"
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'transparent',
            color: isLoading ? 'var(--notion-text-tertiary)' : 'var(--notion-text)'
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = 'rgba(55, 53, 47, 0.06)'
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
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <Languages className="w-4 h-4" strokeWidth={2.5} />
          )}
          <span className="text-sm font-medium" style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>
            {shouldShowTargetLangMenu ? '翻译为' : '翻译'}
          </span>
          {shouldShowTargetLangMenu && !isLoading && (
            <ChevronDown 
              className="w-3 h-3" 
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
              border: '1px solid rgba(55, 53, 47, 0.12)',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
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
                  e.currentTarget.style.background = 'rgba(55, 53, 47, 0.08)'
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

      {/* 分隔线（豆包风格：更细更淡） */}
      <div style={{ width: '1px', height: '18px', background: 'rgba(55, 53, 47, 0.12)', margin: '0 2px' }} />

      {/* 发音按钮（豆包风格） */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPronounce()
        }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: isPlaying ? 'var(--notion-accent)' : 'var(--notion-text)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(55, 53, 47, 0.06)'
          e.currentTarget.style.transform = 'scale(1.02)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.transform = 'scale(1)'
        }}
        aria-label={isPlaying ? '停止播放' : '发音'}
        title={isPlaying ? '停止播放' : '发音'}
      >
        {isPlaying ? (
          <>
            <VolumeX className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-sm font-medium" style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>停止</span>
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-sm font-medium" style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>发音</span>
          </>
        )}
      </button>

      <div style={{ width: '1px', height: '18px', background: 'rgba(55, 53, 47, 0.12)', margin: '0 2px' }} />

      {/* 复制按钮（豆包风格） */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: copySuccess ? 'var(--notion-success)' : 'var(--notion-text)'
        }}
        onMouseEnter={(e) => {
          if (!copySuccess) {
            e.currentTarget.style.background = 'rgba(55, 53, 47, 0.06)'
            e.currentTarget.style.transform = 'scale(1.02)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.transform = 'scale(1)'
        }}
        aria-label={copySuccess ? '已复制' : '复制'}
        title={copySuccess ? '已复制' : '复制到剪贴板'}
      >
        {copySuccess ? (
          <>
            <Check className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-sm font-medium" style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>已复制</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-sm font-medium" style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>复制</span>
          </>
        )}
      </button>

      <div style={{ width: '1px', height: '18px', background: 'rgba(55, 53, 47, 0.12)', margin: '0 2px' }} />

      {/* 生词本按钮（豆包风格） */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpenWordbook()
        }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border-none outline-none cursor-pointer"
        style={{
          background: 'transparent',
          color: 'var(--notion-text)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(55, 53, 47, 0.06)'
          e.currentTarget.style.transform = 'scale(1.02)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.transform = 'scale(1)'
        }}
        aria-label="加入生词本"
        title="加入生词本"
      >
        <BookOpen className="w-4 h-4" strokeWidth={2.5} />
        <span className="text-sm font-medium" style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>加入生词本</span>
      </button>
    </div>
  )
}

export default FloatingButtonContainer
