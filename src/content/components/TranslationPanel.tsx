/**
 * 翻译结果面板组件
 * 
 * 这个组件负责显示：
 * 1. 翻译结果
 * 2. 语法点拨
 * 3. 上下文语境分析
 * 4. 音标
 * 5. 语音朗读按钮
 * 6. 保存到生词本按钮
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX, Loader2, X, Minus, Maximize2, Minimize2, ExternalLink } from 'lucide-react'
import { ttsManager, detectLanguage, segmentTextByQuotedOriginal, LANGUAGE_CONFIGS, type SupportedLanguage } from '../../utils/tts'

/**
 * 翻译结果数据结构
 * 这个结构对应通义千问 API 返回的 JSON 格式
 */
export interface TranslationResult {
  // 翻译结果
  translation: string
  // 语法点拨
  grammar?: string
  // 上下文语境分析
  context?: string
  // 音标（IPA 国际音标）
  phonetic?: string
  // 读音助记（中文谐音或拼音标注）
  pronunciation?: string
  /** 哲学术语时：Stanford Encyclopedia of Philosophy 词条链接 */
  sepLink?: string
  // 原始文本
  originalText: string
  /** 是否为预翻译阶段（仅译文先到，语法/语境等仍在加载） */
  isPartial?: boolean
  /** 保存时的源语言，供生词本朗读时使用，避免 detectLanguage(originalText) 误判 */
  sourceLanguage?: SourceLangCode
}

/** 翻译 API 支持的源语言（不含中文） */
type SourceLangCode = 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh'

const SOURCE_LANG_LABELS: Record<SourceLangCode, string> = {
  en: '英语',
  de: '德语',
  fr: '法语',
  ja: '日语',
  es: '西班牙语',
  zh: '中文'
}

/**
 * 过滤掉第一句分析性的总结文字（如"这是德语新闻报道的标准翻译，遵循了..."）
 * 这些文字通常出现在编号之前，是AI生成的总结性描述
 */
function removeIntroductoryAnalysis(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed

  // 匹配模式：以"这是"、"遵循了"、"体现了"、"翻译体现了"等开头的总结性句子
  // 这些句子通常以句号、冒号或换行结束，且后面跟着编号
  const introPatterns = [
    /^这是[^。：\n]*?(?:的标准翻译|的翻译|翻译)[^。：\n]*?[。：\n]/,
    /^[^。：\n]*?遵循了[^。：\n]*?原则[^。：\n]*?[。：\n]/,
    /^[^。：\n]*?体现了[^。：\n]*?标准[^。：\n]*?[。：\n]/,
    /^翻译体现了[^。：\n]*?[。：\n]/,
    /^这是[^。：\n]*?[。：\n]/,
  ]

  for (const pattern of introPatterns) {
    const match = trimmed.match(pattern)
    if (match) {
      // 检查匹配后的内容是否以编号开头（1) 或 1.）
      const afterMatch = trimmed.slice(match[0].length).trim()
      if (afterMatch.match(/^\d+[\)）\.．]/)) {
        return afterMatch
      }
    }
  }

  // 如果没有匹配到模式，尝试查找第一个编号，删除编号之前的所有内容
  const firstNumberMatch = trimmed.match(/(\d+[\)）\.．])/)
  if (firstNumberMatch && firstNumberMatch.index && firstNumberMatch.index > 0) {
    const beforeNumber = trimmed.slice(0, firstNumberMatch.index).trim()
    // 如果编号前的内容看起来像是总结性描述（包含"翻译"、"标准"、"原则"等关键词）
    if (beforeNumber.match(/翻译|标准|原则|遵循|体现|这是/)) {
      return trimmed.slice(firstNumberMatch.index).trim()
    }
  }

  return trimmed
}

/**
 * 将「语法点拨」「上下文语境」按编号拆成多段，每段单独一块并换行显示
 * 支持：1.信: / 2.语境分析: 以及 1) 2) 3) 这类编号，便于阅读
 * 改进：支持用分号分隔的多个点，确保每一点单独一行
 */
function parseNumberedBlocks(text: string): Array<{ title?: string; content: string }> {
  // 先过滤掉第一句分析性的总结文字
  const cleaned = removeIntroductoryAnalysis(text)
  const trimmed = cleaned.trim()
  if (!trimmed) return []

  // 改进：先尝试按「1.」「2.」或「1)」「2)」切分，即使它们在同一行用分号分隔
  // 使用更精确的正则表达式，确保能识别用分号分隔的多个点
  const numberedPattern = /(\d+[\.．\)）]\s*[^;；\n]*?)(?=[;；]|\d+[\.．\)）]|$)/g
  const matches = Array.from(trimmed.matchAll(numberedPattern))
  
  if (matches.length > 1) {
    const blocks: Array<{ title?: string; content: string }> = []
    for (const match of matches) {
      const fullText = match[0].trim()
      if (!fullText) continue
      
      // 尝试匹配编号和内容
      const parenMatch = fullText.match(/^(\d+[\)）])\s*(.*)/)
      if (parenMatch) {
        blocks.push({ title: parenMatch[1], content: parenMatch[2].trim() })
        continue
      }
      
      const dotMatch = fullText.match(/^(\d+[\.．]\s*[^：:]*[：:]?)\s*(.*)/)
      if (dotMatch) {
        blocks.push({ title: dotMatch[1].trim(), content: dotMatch[2].trim() })
        continue
      }
      
      // 如果没有匹配到编号格式，直接作为内容
      blocks.push({ content: fullText })
    }
    if (blocks.length > 0) return blocks
  }

  // 回退到原来的逻辑：先尝试按「1)」「2)」或「1）」「2）」切分（半角/全角括号编号，常见于语法点拨）
  const byParen = trimmed.split(/(?=\d+[\)）]\s*)/)
  if (byParen.length > 1) {
    const blocks: Array<{ title?: string; content: string }> = []
    for (const part of byParen) {
      const s = part.trim()
      if (!s) continue
      const m = s.match(/^(\d+[\)）])\s*([\s\S]*)/)
      if (m) {
        // 如果内容中包含分号分隔的多个点，进一步分割
        const content = m[2].trim()
        if (content.includes(';') || content.includes('；')) {
          // 按分号分割，但保留第一个点的编号
          const parts = content.split(/[;；]/).filter(p => p.trim())
          if (parts.length > 1) {
            blocks.push({ title: m[1], content: parts[0].trim() })
            // 为后续的点添加编号
            for (let i = 1; i < parts.length; i++) {
              const nextNum = parseInt(m[1]) + i
              blocks.push({ title: `${nextNum}.`, content: parts[i].trim() })
            }
          } else {
            blocks.push({ title: m[1], content })
          }
        } else {
          blocks.push({ title: m[1], content })
        }
      } else {
        blocks.push({ content: s })
      }
    }
    if (blocks.length > 0) return blocks
  }

  // 再按「1.xxx:」「2.xxx:」切分
  const byNumber = trimmed.split(/(?=\d+[\.．]\s*[^\n]*[：:])/)
  const blocks: Array<{ title?: string; content: string }> = []
  for (const part of byNumber) {
    const s = part.trim()
    if (!s) continue
    const match = s.match(/^(\d+[\.．]\s*[^\n]+[：:])([\s\S]*)/)
    if (match) {
      const content = match[2].trim()
      // 如果内容中包含分号分隔的多个点，进一步分割
      if (content.includes(';') || content.includes('；')) {
        const parts = content.split(/[;；]/).filter(p => p.trim())
        if (parts.length > 1) {
          blocks.push({ title: match[1].trim(), content: parts[0].trim() })
          // 为后续的点添加编号
          for (let i = 1; i < parts.length; i++) {
            const nextNum = parseInt(match[1].match(/\d+/)![0]) + i
            blocks.push({ title: `${nextNum}.`, content: parts[i].trim() })
          }
        } else {
          blocks.push({ title: match[1].trim(), content })
        }
      } else {
        blocks.push({ title: match[1].trim(), content })
      }
    } else {
      blocks.push({ content: s })
    }
  }
  if (blocks.length > 1) return blocks

  // 若没有匹配到编号，则按双换行分段
  if (blocks.length === 1 && !blocks[0].title && blocks[0].content.includes('\n\n')) {
    return blocks[0].content.split(/\n\s*\n/).map(p => ({ content: p.trim() })).filter(p => p.content)
  }
  return blocks
}

interface TranslationPanelProps {
  /** 锚点位置（视口坐标），支持 bottom+left（面板在选中文字上方）或 top+left；不传则居中显示 */
  anchorPosition?: { top?: number; bottom?: number; left: number } | null
  // 选中的原始文本
  text: string
  // 翻译结果（可选，如果还没有翻译完成）
  result?: TranslationResult
  // 是否正在加载翻译
  isLoading?: boolean
  // 错误信息（可选）
  error?: string | null
  // 保存成功状态
  saveSuccess?: boolean
  // 本次翻译使用的源语言（由自动检测或用户选择）
  sourceLanguage?: SourceLangCode
  // 用户选择其他语言后重新翻译的回调
  onRetranslateWithLang?: (lang: SourceLangCode) => void
  // 关闭面板的回调函数
  onClose: () => void
  // 保存到生词本的回调函数
  onSave?: (result: TranslationResult) => void
}

/** 面板显示模式：正常 / 最小化（只显示标题条）/ 最大化（更宽） */
type PanelMode = 'normal' | 'minimized' | 'maximized'

const PANEL_WIDTH = 480
const PANEL_MAX_HEIGHT = 560
const PANEL_MARGIN = 16
const MIN_PANEL_WIDTH = 320
const MIN_PANEL_HEIGHT = 280
const RESIZE_HANDLE_WIDTH = 6
/** 字体统一（与图二英语场景一致）：主内容 15px、标签 12px、正文/次要 13px */
const FONT_MAIN_PX = 15
const FONT_LABEL_PX = 12
const FONT_BODY_PX = 13

function TranslationPanel({
  anchorPosition = null,
  text,
  result,
  isLoading = false,
  error = null,
  saveSuccess = false,
  sourceLanguage,
  onRetranslateWithLang,
  onClose,
  onSave
}: TranslationPanelProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>('normal')
  // 是否正在播放原文语音（独立状态）
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false)
  // 是否正在播放翻译语音（独立状态）
  const [isPlayingTranslation, setIsPlayingTranslation] = useState(false)
  // 是否正在播放语法点拨 / 上下文语境
  const [isPlayingGrammar, setIsPlayingGrammar] = useState(false)
  const [isPlayingContext, setIsPlayingContext] = useState(false)
  
  // 面板内“重新翻译”时选择的语言（用于下拉框受控）
  const [retranslateLang, setRetranslateLang] = useState<SourceLangCode>('en')
  
  // 显示用的语言：优先用外部传入的 sourceLanguage，否则本地检测
  const [detectedLang, setDetectedLang] = useState<SupportedLanguage>('en')

  const [draggedPosition, setDraggedPosition] = useState<{ top?: number; left?: number; bottom?: number } | null>(null)
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null)
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef({ active: false, dir: '', startX: 0, startY: 0, startW: 0, startH: 0 })
  const resizeRafRef = useRef<number | null>(null)
  const resizeMouseRef = useRef({ x: 0, y: 0 })
  // 保证 RAF 回调里始终能拿到最新的 setPanelSize，避免闭包陈旧
  const setPanelSizeRef = useRef(setPanelSize)
  setPanelSizeRef.current = setPanelSize

  // 移除 React 事件处理，完全使用原生事件监听器（避免冲突）

  useEffect(() => {
    // 拖动状态管理
    let isDraggingActive = false // 标记是否正在拖动过程中
    let headerElement: HTMLElement | null = null
    let wasDragging = false // 标记是否真正拖动过
    let rafId: number | null = null // requestAnimationFrame ID
    let currentMouseX = 0 // 当前鼠标 X 坐标（用于 RAF）
    let currentMouseY = 0 // 当前鼠标 Y 坐标（用于 RAF）
    let isRafRunning = false // RAF 循环是否正在运行
    
    // 性能优化：缓存面板尺寸，避免重复计算
    let panelWidth = 0
    let panelHeight = 0
    
    // 关键优化：使用 transform 直接操作 DOM，避免 React 状态更新延迟
    // 参考 Cursor 等专业应用：拖动过程中直接操作 DOM，只在拖动结束时更新状态
    const updatePosition = () => {
      if (!panelRef.current || !dragRef.current.isDragging) {
        isRafRunning = false
        panelWidth = 0
        panelHeight = 0
        return
      }
      
      // 只在首次或尺寸变化时更新缓存（性能优化）
      if (panelWidth === 0 || panelHeight === 0) {
        const rect = panelRef.current.getBoundingClientRect()
        panelWidth = rect.width
        panelHeight = rect.height
      }
      
      // 计算相对移动距离（最佳实践：使用相对移动而非绝对位置）
      const dx = currentMouseX - dragRef.current.startX
      const dy = currentMouseY - dragRef.current.startY
      
      // 计算新位置
      const newLeft = dragRef.current.startLeft + dx
      const newTop = dragRef.current.startTop + dy
      
      // 边界检测（使用缓存的尺寸，避免重复 getBoundingClientRect）
      const MIN_MARGIN = 8
      const maxLeft = window.innerWidth - panelWidth - MIN_MARGIN
      const maxTop = window.innerHeight - panelHeight - MIN_MARGIN
      const left = Math.max(MIN_MARGIN, Math.min(maxLeft, newLeft))
      const top = Math.max(MIN_MARGIN, Math.min(maxTop, newTop))
      
      // 关键优化：直接操作 DOM，使用 transform（性能更好，不会触发重排）
      // 这避免了 React 状态更新的延迟，消除"来回拉扯"的问题
      if (panelRef.current) {
        panelRef.current.style.transform = `translate(${left}px, ${top}px)`
        panelRef.current.style.left = '0'
        panelRef.current.style.top = '0'
      }
      
      // 继续 RAF 循环
      rafId = requestAnimationFrame(updatePosition)
    }
    
    // mousemove 事件处理：只存储坐标，不进行 DOM 操作
    const onMouseMove = (e: MouseEvent) => {
      if (!panelRef.current || !isDraggingActive) return
      
      // 最佳实践：在 mousemove 中只存储坐标，不进行 DOM 操作
      currentMouseX = e.clientX
      currentMouseY = e.clientY
      
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const DRAG_THRESHOLD = 3 // 拖动阈值，防止误触
      
      // 判断是否超过拖动阈值
      if (!dragRef.current.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragRef.current.isDragging = true
        wasDragging = true
        
        // 开始拖动时，只在标题栏区域阻止文本选择
        // 不阻止整个 body，避免影响内容区域的文字选择
        if (headerElement) {
          headerElement.style.userSelect = 'none'
          headerElement.style.webkitUserSelect = 'none'
          headerElement.style.cursor = 'grabbing'
        }
        
        // 关键：不在拖动时设置整个面板的 userSelect: 'none'
        // 因为这会覆盖内容区域的 userSelect: 'text'
        // 只设置标题栏的 userSelect: 'none' 即可
        
        // 启动 RAF 循环（只启动一次，持续运行）
        if (!isRafRunning) {
          isRafRunning = true
          rafId = requestAnimationFrame(updatePosition)
        }
        
        // 只在拖动区域阻止默认行为，防止选中文字
        // 检查事件目标是否在拖动区域
        const target = e.target as HTMLElement
        const isDragHandle = target.closest('[data-drag-handle]')
        if (isDragHandle) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
      
      // 如果正在拖动，阻止所有默认行为和事件冒泡
      // 但只在拖动区域（标题栏）才阻止，内容区域允许文字选择
      if (dragRef.current.isDragging) {
        const target = e.target as HTMLElement
        const isDragHandle = target.closest('[data-drag-handle]')
        // 只有在拖动区域才阻止，内容区域允许文字选择
        if (isDragHandle) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }
    
    // mouseup 事件处理：结束拖动
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      
      // 停止 RAF 循环
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
        isRafRunning = false
      }
      
      // 恢复文本选择：恢复标题栏和面板的 userSelect
      if (headerElement) {
        headerElement.style.userSelect = 'none' // 标题栏保持不可选中
        headerElement.style.webkitUserSelect = 'none'
        headerElement.style.cursor = 'grab'
      }
      
      // 恢复内容区域的文字选择能力
      // 注意：不设置面板根元素的 userSelect，让内容区域自己的样式生效
      if (panelRef.current) {
        panelRef.current.style.userSelect = ''
        panelRef.current.style.webkitUserSelect = ''
      }
      
      const hadDragged = dragRef.current.isDragging || wasDragging
      dragRef.current.isDragging = false
      isDraggingActive = false
      
      // 如果真正拖动过，阻止点击事件传播，防止触发其他操作
      // 但只在拖动区域（标题栏）才阻止，内容区域允许文字选择
      if (hadDragged) {
        const target = e.target as HTMLElement
        const isDragHandle = target.closest('[data-drag-handle]')
        // 只有在拖动区域才阻止，内容区域允许文字选择
        if (isDragHandle) {
          e.preventDefault()
          e.stopPropagation()
        }
        
        // 关键优化：拖动结束时，从 transform 读取最终位置，更新 React 状态
        // 这样避免了拖动过程中的状态更新延迟，消除"来回拉扯"
        if (panelRef.current) {
          const rect = panelRef.current.getBoundingClientRect()
          // 从实际 DOM 位置读取最终位置（transform 已经应用）
          const finalLeft = rect.left
          const finalTop = rect.top
          
          // 重置 transform，使用 left/top 定位（保持一致性）
          panelRef.current.style.transform = 'none'
          panelRef.current.style.left = `${finalLeft}px`
          panelRef.current.style.top = `${finalTop}px`
          
          // 更新 React 状态（只在拖动结束时更新一次）
          setDraggedPosition({ left: finalLeft, top: finalTop })
        }
      }
      
      // 重置状态
      wasDragging = false
      currentMouseX = 0
      currentMouseY = 0
    }
    
    // mousedown 事件处理：仅当按下点在「标题栏」内时才启动拖动，内容区按下不启动（实现 Cursor 式：内容区可自由选字）
    const handleMouseDown = (e: MouseEvent) => {
      if (!panelRef.current) return
      const target = e.target as HTMLElement
      if (target.closest('button')) return
      const dragHandleEl = panelRef.current.querySelector('[data-drag-handle]') as HTMLElement
      if (!dragHandleEl || !dragHandleEl.contains(target)) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      isDraggingActive = true
      wasDragging = false
      
      // 初始化鼠标坐标（用于 RAF）
      currentMouseX = e.clientX
      currentMouseY = e.clientY
      
      // 计算当前位置：优先使用拖动位置，否则使用当前 rect 位置
      const rect = panelRef.current.getBoundingClientRect()
      const currentLeft = draggedPosition?.left ?? rect.left
      const currentTop = draggedPosition?.top ?? (draggedPosition?.bottom 
        ? window.innerHeight - draggedPosition.bottom - rect.height 
        : rect.top)
      
      // 初始化拖动引用
      dragRef.current = {
        isDragging: false,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: currentLeft,
        startTop: currentTop
      }
      
      // 只在标题栏区域阻止文本选择，不影响内容区域
      if (headerElement) {
        headerElement.style.userSelect = 'none'
        headerElement.style.webkitUserSelect = 'none'
        headerElement.style.cursor = 'grab'
      }
      
      // 返回 false 确保事件被完全处理
      return false
    }
    
    // 绑定事件监听器：使用 requestAnimationFrame 确保 DOM 已渲染
    const bindEvents = () => {
      if (panelRef.current) {
        headerElement = panelRef.current.querySelector('[data-drag-handle]') as HTMLElement
        if (headerElement) {
          headerElement.addEventListener('mousedown', handleMouseDown, { capture: true, passive: false })
          headerElement.style.cursor = 'grab'
        }
      }
    }
    
    // 使用 requestAnimationFrame 确保 DOM 已渲染后再绑定事件
    const rafIdForBinding = requestAnimationFrame(() => {
      bindEvents()
    })
    
    // 使用捕获阶段监听全局事件，确保先处理拖动事件
    window.addEventListener('mousemove', onMouseMove, { capture: true, passive: false })
    window.addEventListener('mouseup', onMouseUp, { capture: true, passive: false })
    
    return () => {
      // 清理：取消 RAF
      cancelAnimationFrame(rafIdForBinding)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      // 清理：移除事件监听器
      if (headerElement) {
        headerElement.removeEventListener('mousedown', handleMouseDown, { capture: true } as EventListenerOptions)
        headerElement.style.cursor = ''
      }
      window.removeEventListener('mousemove', onMouseMove, { capture: true } as EventListenerOptions)
      window.removeEventListener('mouseup', onMouseUp, { capture: true } as EventListenerOptions)
      
      // 清理：恢复文本选择能力
      if (headerElement) {
        headerElement.style.userSelect = ''
        headerElement.style.webkitUserSelect = ''
        headerElement.style.cursor = ''
      }
      // 不设置面板根元素的 userSelect，让内容区域自己的样式生效
      if (panelRef.current) {
        panelRef.current.style.userSelect = ''
        panelRef.current.style.webkitUserSelect = ''
      }
    }
  }, [draggedPosition])

  // 拖动边框改变窗口大小：仅右、下、右下角
  // 采用「state 为唯一数据源」：拖拽过程中在 RAF 里更新 setPanelSize，避免 React 重渲染时用旧 state 覆盖尺寸导致再次拖拽失效
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const maxW = () => Math.min(window.innerWidth - PANEL_MARGIN * 2, 900)
    const maxH = () => Math.min(window.innerHeight - PANEL_MARGIN * 2, 0.9 * window.innerHeight)
    const clampSize = (w: number, h: number) => ({
      width: Math.max(MIN_PANEL_WIDTH, Math.min(maxW(), w)),
      height: Math.max(MIN_PANEL_HEIGHT, Math.min(maxH(), h))
    })
    const updateResize = () => {
      if (!resizeRef.current.active) {
        if (resizeRafRef.current) {
          cancelAnimationFrame(resizeRafRef.current)
          resizeRafRef.current = null
        }
        return
      }
      const { dir, startX, startY, startW, startH } = resizeRef.current
      const { x, y } = resizeMouseRef.current
      let w = startW
      let h = startH
      if (dir === 'e' || dir === 'se') w = startW + (x - startX)
      if (dir === 's' || dir === 'se') h = startH + (y - startY)
      const { width, height } = clampSize(w, h)
      setPanelSizeRef.current({ width, height })
      resizeRafRef.current = requestAnimationFrame(updateResize)
    }
    const onResizeMove = (e: MouseEvent) => {
      if (!resizeRef.current.active) return
      resizeMouseRef.current = { x: e.clientX, y: e.clientY }
      if (!resizeRafRef.current) resizeRafRef.current = requestAnimationFrame(updateResize)
    }
    const onResizeUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (!resizeRef.current.active) return
      const rect = panelRef.current?.getBoundingClientRect()
      if (rect && panelRef.current) {
        const { width, height } = clampSize(rect.width, rect.height)
        setPanelSize({ width, height })
      }
      resizeRef.current.active = false
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onResizeMove, true)
      window.removeEventListener('mouseup', onResizeUp, true)
    }
    const onResizeDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const dir = target.getAttribute('data-resize-handle')
      if (!dir || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const rect = panel.getBoundingClientRect()
      resizeRef.current = { active: true, dir, startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height }
      resizeMouseRef.current = { x: e.clientX, y: e.clientY }
      document.body.style.cursor = target.style.cursor || 'se-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onResizeMove, true)
      window.addEventListener('mouseup', onResizeUp, true)
    }
    panel.addEventListener('mousedown', onResizeDown, true)
    return () => {
      resizeRef.current.active = false
      panel.removeEventListener('mousedown', onResizeDown, true)
      window.removeEventListener('mousemove', onResizeMove, true)
      window.removeEventListener('mouseup', onResizeUp, true)
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  // 组件挂载时检测语言（仅当未传入 sourceLanguage 时用于展示/朗读）
  useEffect(() => {
    const lang = detectLanguage(text)
    setDetectedLang(lang)
  }, [text])
  
  // 用于朗读原文的语言：有 sourceLanguage 则用其对应 SupportedLanguage，否则用 detectedLang
  const langForSpeak: SupportedLanguage = sourceLanguage ?? detectedLang
  // 原文的语速配置：用于统一所有发音位置的语速（翻译、语法、语境都对齐原文语速）
  const originalRate = LANGUAGE_CONFIGS[langForSpeak].rate

  /**
   * 处理语音朗读按钮点击（朗读原文）
   * 
   * 这个函数用于朗读原始选中的文本
   */
  const handleSpeakOriginal = () => {
    // 如果正在播放翻译，先停止
    if (isPlayingTranslation) {
      ttsManager.stop()
      setIsPlayingTranslation(false)
    }
    
    // 如果正在播放原文，停止播放
    if (isPlayingOriginal) {
      ttsManager.stop()
      setIsPlayingOriginal(false)
      return
    }
    
    // 朗读原文：优先使用本次翻译的源语言（用户可能手动选过），否则用检测语言
    setIsPlayingOriginal(true)
    
    ttsManager.speak(
      text,
      langForSpeak,
      // 播放结束回调
      () => {
        setIsPlayingOriginal(false)
      },
      // 播放错误回调
      (error) => {
        console.error('语音播放失败：', error)
        setIsPlayingOriginal(false)
        // 显示错误提示
        alert(`语音播放失败：${error.message}\n请检查浏览器设置或系统语音配置`)
      }
    )
  }
  
  /**
   * 处理语音朗读按钮点击（朗读翻译结果）
   * 
   * 这个函数用于朗读翻译后的文本
   * 
   * 关键：翻译结果的语言就是目标语言，应该使用检测到的翻译结果语言来播放语音
   * 例如：英语翻译成德语后，应该用德语语音播放，而不是英语语音
   */
  const handleSpeakTranslation = () => {
    if (!result || !result.translation) {
      return
    }
    
    // 如果正在播放原文，先停止
    if (isPlayingOriginal) {
      ttsManager.stop()
      setIsPlayingOriginal(false)
    }
    
    // 如果正在播放翻译，停止播放
    if (isPlayingTranslation) {
      ttsManager.stop()
      setIsPlayingTranslation(false)
      return
    }
    
    // 检测翻译结果的语言（这就是目标语言）
    // 例如：英语翻译成德语，翻译结果就是德语，应该用德语语音播放
    const translationLang = detectLanguage(result.translation)
    
    // 直接使用检测到的翻译结果语言来播放语音
    // 这样无论翻译成什么语言，都能用正确的语音播放
    const langToUse: SupportedLanguage = translationLang
    
    // 开始播放
    setIsPlayingTranslation(true)
    
    ttsManager.speak(
      result.translation,
      langToUse, // 使用翻译结果的语言，确保用正确的语音播放
      // 播放结束回调
      () => {
        setIsPlayingTranslation(false)
      },
      // 播放错误回调
      (error) => {
        console.error('语音播放失败：', error)
        setIsPlayingTranslation(false)
        
        // 如果是中文不支持的错误，提供更友好的提示
        if (error.message.includes('不支持中文语音')) {
          alert('系统不支持中文语音。\n\n解决方案：\n1. macOS: 系统偏好设置 → 辅助功能 → 朗读内容 → 管理语音\n2. Windows: 设置 → 时间和语言 → 语音 → 管理语音\n3. 或使用原文的语音朗读功能')
        } else {
          alert(`语音播放失败：${error.message}\n请检查浏览器设置或系统语音配置`)
        }
      },
      originalRate // 统一语速：对齐原文语速
    )
  }

  /**
   * 处理停止播放原文
   */
  const handleStopOriginal = () => {
    ttsManager.stop()
    setIsPlayingOriginal(false)
  }

  /**
   * 处理停止播放翻译
   */
  const handleStopTranslation = () => {
    ttsManager.stop()
    setIsPlayingTranslation(false)
  }

  /**
   * 播放语法点拨语音。
   * 「」圈出的原文用源语言（如日语）读，其余用翻译语种（如中文）读；无「」时整段用目标语言。
   */
  const handleSpeakGrammar = () => {
    if (!result?.grammar) return
    if (isPlayingOriginal) { ttsManager.stop(); setIsPlayingOriginal(false) }
    if (isPlayingTranslation) { ttsManager.stop(); setIsPlayingTranslation(false) }
    if (isPlayingContext) { ttsManager.stop(); setIsPlayingContext(false) }
    if (isPlayingGrammar) {
      ttsManager.stop()
      setIsPlayingGrammar(false)
      return
    }
    const sourceLang = langForSpeak
    const targetLang: SupportedLanguage = result.translation
      ? detectLanguage(result.translation)
      : detectLanguage(result.grammar)
    const segments = segmentTextByQuotedOriginal(result.grammar, sourceLang, targetLang)
    setIsPlayingGrammar(true)
    ttsManager.speakSegments(
      segments,
      () => setIsPlayingGrammar(false),
      (err) => {
        console.error('语法点拨语音播放失败：', err)
        setIsPlayingGrammar(false)
      },
      originalRate // 统一语速：对齐原文语速
    )
  }

  /**
   * 播放上下文语境语音。
   * 与语法点拨一致：「」内用源语言读，「」外用目标语言读。
   */
  const handleSpeakContext = () => {
    if (!result?.context) return
    if (isPlayingOriginal) { ttsManager.stop(); setIsPlayingOriginal(false) }
    if (isPlayingTranslation) { ttsManager.stop(); setIsPlayingTranslation(false) }
    if (isPlayingGrammar) { ttsManager.stop(); setIsPlayingGrammar(false) }
    if (isPlayingContext) {
      ttsManager.stop()
      setIsPlayingContext(false)
      return
    }
    const sourceLang = langForSpeak
    const targetLang: SupportedLanguage = result.translation
      ? detectLanguage(result.translation)
      : detectLanguage(result.context)
    const segments = segmentTextByQuotedOriginal(result.context, sourceLang, targetLang)
    setIsPlayingContext(true)
    ttsManager.speakSegments(
      segments,
      () => setIsPlayingContext(false),
      (err) => {
        console.error('上下文语境语音播放失败：', err)
        setIsPlayingContext(false)
      },
      originalRate // 统一语速：对齐原文语速
    )
  }

  /** 停止播放语法点拨 */
  const handleStopGrammar = () => {
    ttsManager.stop()
    setIsPlayingGrammar(false)
  }

  /** 停止播放上下文语境 */
  const handleStopContext = () => {
    ttsManager.stop()
    setIsPlayingContext(false)
  }

  /**
   * 处理保存到生词本：带上当前源语言，生词本复习时用该语言读原文/「」内，避免误判
   */
  const handleSave = () => {
    if (result && onSave) {
      // 💡 确保 originalText 始终存在：优先使用 result.originalText，否则使用 text prop
      // 这对于德语等语言很重要，因为 originalText 可能在某些情况下丢失
      const originalTextToSave = result.originalText?.trim() || text?.trim() || ''
      
      if (!originalTextToSave) {
        console.error('[TranslationPanel] 保存失败：无法获取原始文本', { 
          resultOriginalText: result.originalText, 
          textProp: text 
        })
        alert('保存失败：无法获取原始文本，请重试')
        return
      }
      
      if (!result.translation?.trim()) {
        console.error('[TranslationPanel] 保存失败：翻译结果为空', { translation: result.translation })
        alert('保存失败：翻译结果为空，请重试')
        return
      }
      
      // 💡 确保 sourceLanguage 正确设置：优先使用传入的 sourceLanguage，否则使用检测到的语言
      const sourceLangToSave = sourceLanguage ?? detectedLang
      
      console.log('[TranslationPanel] 准备保存单词：', {
        originalText: originalTextToSave.substring(0, 50),
        translation: result.translation.substring(0, 50),
        sourceLanguage: sourceLangToSave,
        hasGrammar: !!result.grammar,
        hasContext: !!result.context
      })
      
      onSave({ 
        ...result, 
        originalText: originalTextToSave,
        sourceLanguage: sourceLangToSave
      })
    }
  }

  const maxPanelWidth = () => Math.min(window.innerWidth - PANEL_MARGIN * 2, 900)
  const maxPanelHeight = () => Math.min(window.innerHeight - PANEL_MARGIN * 2, Math.round(0.9 * window.innerHeight))
  const effectiveWidth = panelSize
    ? Math.max(MIN_PANEL_WIDTH, Math.min(maxPanelWidth(), panelSize.width))
    : PANEL_WIDTH
  const effectiveHeight = panelSize
    ? Math.max(MIN_PANEL_HEIGHT, Math.min(maxPanelHeight(), panelSize.height))
    : undefined

  const panelStyle = draggedPosition
    ? (() => {
        const base: React.CSSProperties = {
          position: 'fixed',
          left: draggedPosition.left,
          top: draggedPosition.top,
          bottom: draggedPosition.bottom,
          width: panelMode === 'maximized' ? 'min(95vw, 56rem)' : effectiveWidth + 'px',
          maxWidth: panelMode === 'maximized' ? 'min(95vw, 56rem)' : effectiveWidth + 'px',
          ...(effectiveHeight != null && panelMode !== 'minimized' ? { height: effectiveHeight + 'px' } : {}),
          maxHeight: panelMode === 'minimized' ? 'none' : (effectiveHeight ?? Math.min(560, window.innerHeight * 0.85)) + 'px',
          padding: 0, // 移除外层 padding，由头部和内容区域各自管理
          animation: draggedPosition.left && draggedPosition.top ? 'none' : 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // 拖动后禁用动画，避免闪烁
          pointerEvents: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--notion-border-strong) transparent',
          transform: 'none', // 拖动结束后使用 left/top，拖动过程中由 RAF 直接操作 transform
          willChange: 'transform', // 提示浏览器优化 transform（拖动时使用）
          transition: 'none' // 拖动时禁用过渡动画，提升性能
        }
        return base
      })()
    : anchorPosition
    ? (() => {
        const left = Math.max(PANEL_MARGIN, Math.min(anchorPosition.left, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN))
        const base: React.CSSProperties = {
          position: 'fixed',
          left,
          width: panelMode === 'maximized' ? 'min(95vw, 56rem)' : effectiveWidth + 'px',
          maxWidth: panelMode === 'maximized' ? 'min(95vw, 56rem)' : effectiveWidth + 'px',
          ...(effectiveHeight != null && panelMode !== 'minimized' ? { height: effectiveHeight + 'px' } : {}),
          padding: 0,
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--notion-border-strong) transparent'
        }
        if (anchorPosition.top != null) {
          base.top = Math.min(anchorPosition.top, window.innerHeight - 200)
          const availableHeight = window.innerHeight - anchorPosition.top - PANEL_MARGIN
          base.maxHeight = panelMode === 'minimized' ? undefined : Math.min(PANEL_MAX_HEIGHT, Math.max(400, Math.min(window.innerHeight * 0.85, availableHeight))) + 'px'
        } else if (anchorPosition.bottom != null) {
          base.bottom = anchorPosition.bottom
          const availableHeight = window.innerHeight - anchorPosition.bottom - PANEL_MARGIN
          base.maxHeight = panelMode === 'minimized' ? undefined : Math.min(PANEL_MAX_HEIGHT, Math.max(400, Math.min(window.innerHeight * 0.95, availableHeight))) + 'px'
        }
        return base
      })()
    : (() => {
        const base: React.CSSProperties = {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: panelMode === 'maximized' ? 'min(95vw, 56rem)' : effectiveWidth + 'px',
          maxWidth: panelMode === 'maximized' ? 'min(95vw, 56rem)' : effectiveWidth + 'px',
          ...(effectiveHeight != null && panelMode !== 'minimized' ? { height: effectiveHeight + 'px' } : {}),
          maxHeight: panelMode === 'minimized' ? 'none' : (effectiveHeight ?? Math.min(PANEL_MAX_HEIGHT, window.innerHeight * 0.85)) + 'px',
          padding: panelMode === 'minimized' ? '12px 16px' : '18px 20px',
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--notion-border-strong) transparent'
        }
        return base
      })()

  // 豆包风格：面板直接浮在页面上，没有全屏遮罩层
  // 面板使用 position: fixed 和合适的 z-index，背景网页保持完全可见
  return (
    <div
      ref={panelRef}
      id="translation-panel-root"
      className="notion-panel"
      style={{
        ...panelStyle,
        borderRadius: '16px',
        background: 'rgba(255, 242, 248, 0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(220, 190, 200, 0.35)',
        zIndex: 1000001, // 确保面板在页面内容之上，但不在单独的遮罩层
        pointerEvents: 'auto',
        // 移除 userSelect: 'none'，允许内容区域选中文字
        display: 'flex', // 使用 flex 布局
        flexDirection: 'column', // 垂直排列
        overflow: 'hidden' // 外层不滚动，只让内容区域滚动
      }}
      onClick={(e) => {
        // 阻止点击事件冒泡，防止触发其他操作
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        // 允许标题栏的拖动处理，不阻止事件传播
        // 只有在非拖动区域才阻止事件传播
        const target = e.target as HTMLElement
        const isDragHandle = target.closest('[data-drag-handle]')
        // 如果是拖动区域，不阻止事件，让拖动逻辑处理
        // 如果不是拖动区域（内容区域），阻止事件冒泡，但不阻止默认行为（允许文字选择）
        if (!isDragHandle) {
          e.stopPropagation()
          // 不调用 preventDefault()，允许文字选择
        }
      }}
    >
        {/* 头部：Cursor 风格 - macOS 窗口控制按钮 + 标题 + 加入生词本（可拖动，固定在顶部） */}
        <div 
          className="flex items-center flex-shrink-0" 
          data-drag-handle
          style={{ 
            position: 'sticky', // 使用 sticky 定位，固定在顶部
            top: 0, // 固定在顶部
            zIndex: 10, // 确保头部在内容之上
            background: 'rgba(255, 238, 245, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            marginBottom: panelMode === 'minimized' ? 0 : 16, 
            paddingBottom: panelMode === 'minimized' ? 0 : 12, 
            borderBottom: panelMode === 'minimized' ? 'none' : '1px solid rgba(220, 190, 200, 0.3)',
            paddingLeft: panelMode === 'minimized' ? '12px' : '16px',
            paddingRight: panelMode === 'minimized' ? '12px' : '16px',
            paddingTop: panelMode === 'minimized' ? '8px' : '10px',
            cursor: 'default',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            borderRadius: '16px 16px 0 0'
          }}
          // 移除 React 事件处理，完全使用原生事件监听器
        >
          {/* macOS 风格的窗口控制按钮（Traffic Lights）- 左对齐 */}
          <div className="flex items-center gap-2 mr-3" style={{ flexShrink: 0 }}>
            {/* 红色关闭按钮 */}
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-all"
              style={{
                background: '#ff5f57', // macOS 红色
                border: '0.5px solid rgba(0, 0, 0, 0.15)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ff4747'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ff5f57'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="关闭"
              title="关闭"
            />
            {/* 黄色最小化按钮 */}
            <button
              onClick={() => setPanelMode(panelMode === 'minimized' ? 'normal' : 'minimized')}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-all"
              style={{
                background: '#ffbd2e', // macOS 黄色
                border: '0.5px solid rgba(0, 0, 0, 0.15)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ffb020'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffbd2e'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={panelMode === 'minimized' ? '展开' : '最小化'}
              title={panelMode === 'minimized' ? '展开' : '最小化'}
            />
            {/* 绿色最大化按钮 */}
            {panelMode !== 'minimized' && (
              <button
                onClick={() => setPanelMode(panelMode === 'maximized' ? 'normal' : 'maximized')}
                className="w-3 h-3 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: '#28c940', // macOS 绿色
                  border: '0.5px solid rgba(0, 0, 0, 0.15)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#1fb832'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#28c940'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={panelMode === 'maximized' ? '还原' : '最大化'}
                title={panelMode === 'maximized' ? '还原' : '最大化'}
              />
            )}
          </div>
          
          {/* 标题 */}
          <h2 className="font-medium" style={{ color: 'rgba(0, 0, 0, 0.75)', letterSpacing: '-0.01em', flex: 1, fontSize: FONT_LABEL_PX + 'px' }}>
            翻译结果
          </h2>
          
          {/* 加入生词本按钮（移到顶部右侧，Cursor 风格 - 更和谐的设计） */}
          {panelMode !== 'minimized' && result && onSave && (
            <button
              onClick={handleSave}
              disabled={saveSuccess}
              className="px-2.5 py-1 font-medium disabled:opacity-60 disabled:cursor-not-allowed rounded transition-all flex items-center justify-center gap-1.5"
              style={{
                fontSize: FONT_BODY_PX + 'px',
                background: saveSuccess 
                  ? 'rgba(31, 184, 50, 0.15)'
                  : 'rgba(240, 200, 215, 0.5)',
                color: saveSuccess 
                  ? '#1fb832'
                  : 'rgba(0, 0, 0, 0.75)',
                border: saveSuccess 
                  ? '1px solid rgba(31, 184, 50, 0.3)'
                  : '1px solid rgba(220, 180, 195, 0.5)',
                boxShadow: 'none',
                letterSpacing: '-0.01em',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
              onMouseEnter={(e) => {
                if (!saveSuccess && !e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'rgba(235, 185, 205, 0.6)'
                  e.currentTarget.style.borderColor = 'rgba(220, 180, 195, 0.7)'
                  e.currentTarget.style.color = 'rgba(0, 0, 0, 0.85)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = saveSuccess 
                  ? 'rgba(31, 184, 50, 0.15)' 
                  : 'rgba(240, 200, 215, 0.5)'
                e.currentTarget.style.borderColor = saveSuccess 
                  ? 'rgba(31, 184, 50, 0.3)'
                  : 'rgba(220, 180, 195, 0.5)'
                e.currentTarget.style.color = saveSuccess 
                  ? '#1fb832'
                  : 'rgba(0, 0, 0, 0.75)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {saveSuccess ? (
                <>
                  <span style={{ fontSize: FONT_BODY_PX + 'px' }}>✓</span>
                  <span>已加入</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.75 }}>
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>加入生词本</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 内容区域：可滚动，允许文字选中和复制 */}
        <div 
          className="translation-panel-content"
          style={{
            flex: 1, // 占据剩余空间
            overflowY: 'auto', // 允许垂直滚动
            overflowX: 'hidden', // 禁止水平滚动
            minHeight: 0, // 确保 flex 子元素可以缩小
            paddingLeft: panelMode === 'minimized' ? '16px' : '20px', // 与面板 padding 对齐
            paddingRight: panelMode === 'minimized' ? '16px' : '20px', // 与面板 padding 对齐
            paddingBottom: panelMode === 'minimized' ? '12px' : '18px', // 与面板 padding 对齐
            userSelect: 'text', // 允许文字选中
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text'
          }}
          onMouseDown={(e) => {
            // 内容区域的点击不阻止事件，允许文字选择
            // 但阻止事件冒泡到面板外层，避免触发其他操作
            e.stopPropagation()
            // 不调用 preventDefault()，允许文字选择
          }}
        >
        {panelMode !== 'minimized' && (
        <>
        {/* 原文区块 */}
        <div className="notion-card mb-3 p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_LABEL_PX + 'px' }}>
                选中的文字
              </p>
              <p className="font-medium mb-1 leading-relaxed break-words whitespace-pre-wrap" style={{ color: 'var(--notion-text)', wordBreak: 'break-word', overflowWrap: 'anywhere', fontSize: FONT_MAIN_PX + 'px' }}>
                {text}
              </p>
              {/* 调试信息：显示文本长度和预览 */}
              {process.env.NODE_ENV === 'development' && (
                <p className="mt-1 opacity-50" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
                  调试: 文本长度 {text.length}, 预览: {text.substring(0, 50)}...
                </p>
              )}
              {result?.phonetic && (
                <p className="mt-0.5 mb-1.5 font-mono" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
                  /{result.phonetic}/
                </p>
              )}
              <p className="mt-1.5" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
                {sourceLanguage != null ? '翻译自：' + SOURCE_LANG_LABELS[sourceLanguage] : '检测语言：' + (
                  detectedLang === 'en' ? '英语' :
                  detectedLang === 'de' ? '德语' :
                  detectedLang === 'fr' ? '法语' :
                  detectedLang === 'ja' ? '日语' :
                  detectedLang === 'es' ? '西班牙语' : '中文'
                )}
              </p>
              {onRetranslateWithLang && result && !isLoading && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>识别错了？</span>
                  <select
                    value={retranslateLang}
                    onChange={(e) => setRetranslateLang(e.target.value as SourceLangCode)}
                    className="rounded px-2 py-1 outline-none cursor-pointer"
                    style={{
                      fontSize: FONT_BODY_PX + 'px',
                      background: 'var(--notion-bg)',
                      color: 'var(--notion-text)',
                      border: '1px solid var(--notion-border-strong)'
                    }}
                    aria-label="选择语言重新翻译"
                  >
                    {(Object.keys(SOURCE_LANG_LABELS) as SourceLangCode[]).map((lang) => (
                      <option key={lang} value={lang}>{SOURCE_LANG_LABELS[lang]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRetranslateWithLang(retranslateLang)}
                    className="px-3 py-1.5 font-medium rounded-lg transition-all"
                    style={{
                      fontSize: FONT_BODY_PX + 'px',
                      background: 'var(--notion-accent)',
                      color: '#fff',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(24, 144, 255, 0.25)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(24, 144, 255, 0.35)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(24, 144, 255, 0.25)'
                    }}
                  >
                    按此语言重新翻译
                  </button>
                </div>
              )}
            </div>
            {/* 朗读原文：蓝色圆形（播放中红色）/ 灰色（停止） */}
            <button
              onClick={isPlayingOriginal ? handleStopOriginal : handleSpeakOriginal}
              className="ml-3 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-colors"
              style={{
                background: isPlayingOriginal ? 'var(--notion-error)' : 'var(--notion-accent)',
                color: '#fff'
              }}
              aria-label={isPlayingOriginal ? '停止播放' : '播放原文语音'}
              title={isPlayingOriginal ? '停止播放' : '播放原文语音'}
            >
              {isPlayingOriginal ? (
                <VolumeX className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Volume2 className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--notion-accent)' }} strokeWidth={2} />
            <span className="mt-3" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
              正在翻译...
            </span>
          </div>
        )}

        {/* 错误状态 */}
        {error && !isLoading && (
          <div className="notion-card p-4 border-l-4" style={{ borderLeftColor: 'var(--notion-error)' }}>
            <div className="flex items-start gap-2">
              <span style={{ color: 'var(--notion-error)', fontSize: FONT_BODY_PX + 'px' }}>⚠️</span>
              <div className="flex-1">
                <h3 className="font-medium mb-1" style={{ color: 'var(--notion-text)', fontSize: FONT_LABEL_PX + 'px' }}>
                  翻译失败
                </h3>
                <p className="leading-relaxed" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_BODY_PX + 'px' }}>{error}</p>
                {error.includes('API Key') && (
                  <p className="mt-2" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
                    请在 .env 中设置 VITE_QWEN_API_KEY
                  </p>
                )}
                {error.includes('Extension context invalidated') && (
                  <div className="mt-2 space-y-1" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_BODY_PX + 'px' }}>
                    <p>可尝试：刷新页面，或到 chrome://extensions/ 重新加载插件。</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="notion-btn-primary px-3 py-1.5"
                style={{ fontSize: FONT_BODY_PX + 'px' }}
              >
                刷新页面
              </button>
              {error.includes('Extension context invalidated') && (
                <button
                  onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_EXTENSIONS_PAGE' }).catch(() => window.open('chrome://extensions/', '_blank'))}
                  className="notion-btn-secondary px-3 py-1.5"
                  style={{ fontSize: FONT_BODY_PX + 'px' }}
                >
                  重新加载插件
                </button>
              )}
            </div>
          </div>
        )}

        {/* 翻译结果区域 */}
        {result && !isLoading && (
          <div className="space-y-3">
            <div className="notion-divider" />
            {/* 翻译（豆包风格：更柔和的卡片） */}
            <div className="notion-card p-4" style={{ borderRadius: '12px', background: 'rgba(255, 248, 252, 0.7)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_LABEL_PX + 'px' }}>
                    翻译
                  </p>
                  <p className="font-medium mb-1.5 leading-relaxed break-words whitespace-pre-wrap" style={{ color: 'var(--notion-text)', wordBreak: 'break-word', overflowWrap: 'anywhere', fontSize: FONT_MAIN_PX + 'px' }}>
                    {result.translation}
                  </p>
                  {result.pronunciation && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--notion-border)' }}>
                      <p className="font-medium mb-1" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_LABEL_PX + 'px' }}>
                        Pronunciation Guide
                      </p>
                      <p className="font-mono leading-relaxed" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
                        {result.pronunciation}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={isPlayingTranslation ? handleStopTranslation : handleSpeakTranslation}
                  className="ml-3 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-colors"
                  style={{
                    background: isPlayingTranslation ? 'var(--notion-error)' : 'var(--notion-accent)',
                    color: '#fff'
                  }}
                  aria-label={isPlayingTranslation ? '停止播放' : '播放翻译语音'}
                  title={isPlayingTranslation ? '停止播放' : '播放翻译语音'}
                >
                  {isPlayingTranslation ? (
                    <VolumeX className="w-4 h-4" strokeWidth={2} />
                  ) : (
                    <Volume2 className="w-4 h-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            {/* Stanford 哲学百科 (SEP)：哲学术语时显示词条链接，并始终提供站内搜索入口 */}
            {(result.sepLink || text?.trim()) && (
              <div className="notion-card p-3" style={{ borderRadius: '12px', background: 'rgba(255, 248, 252, 0.5)' }}>
                <p className="font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_LABEL_PX + 'px' }}>
                  Stanford 哲学百科 (SEP)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {result.sepLink && (
                    <a
                      href={result.sepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                      style={{
                        fontSize: FONT_BODY_PX + 'px',
                        color: 'var(--notion-accent)',
                        background: 'rgba(24, 144, 255, 0.08)',
                        border: '1px solid rgba(24, 144, 255, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(24, 144, 255, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(24, 144, 255, 0.08)'
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                      查看词条
                    </a>
                  )}
                  <a
                    href={`https://plato.stanford.edu/search/search?query=${encodeURIComponent(text?.trim() ?? '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                    style={{
                      fontSize: FONT_BODY_PX + 'px',
                      color: 'var(--notion-text-secondary)',
                      background: 'var(--notion-bg)',
                      border: '1px solid var(--notion-border)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--notion-border)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--notion-bg)'
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                    在 SEP 中搜索
                  </a>
                </div>
              </div>
            )}

            {(result.grammar || result.isPartial) && (
              <div className="notion-card p-4" style={{ borderRadius: '12px', background: 'rgba(255, 248, 252, 0.7)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-medium uppercase tracking-wide" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_LABEL_PX + 'px' }}>
                    语法点拨
                  </p>
                  {result.grammar && (
                    <button
                      onClick={isPlayingGrammar ? handleStopGrammar : handleSpeakGrammar}
                      className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-colors"
                      style={{
                        background: isPlayingGrammar ? 'var(--notion-error)' : 'var(--notion-accent)',
                        color: '#fff'
                      }}
                      aria-label={isPlayingGrammar ? '停止播放' : '播放语法点拨语音'}
                      title={isPlayingGrammar ? '停止播放' : '播放语法点拨语音'}
                    >
                      {isPlayingGrammar ? (
                        <VolumeX className="w-4 h-4" strokeWidth={2} />
                      ) : (
                        <Volume2 className="w-4 h-4" strokeWidth={2} />
                      )}
                    </button>
                  )}
                </div>
                <div
                  style={{
                    color: 'var(--notion-text)',
                    fontSize: FONT_BODY_PX + 'px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                    lineHeight: 1.7,
                    maxWidth: '100%'
                  }}
                >
                  {result.grammar ? (
                    parseNumberedBlocks(result.grammar).map((block, i) => (
                      <div key={i} className="mb-2.5 last:mb-0" style={{ display: 'block' }}>
                        {block.title ? (
                          // 每一点单独一行显示，参考上下文语境的排版
                          <p className="mb-0 whitespace-pre-wrap break-words" style={{ display: 'block' }}>
                            <span className="font-semibold" style={{ color: 'var(--notion-text-secondary)' }}>
                              {block.title}
                            </span>
                            <span style={{ marginLeft: '0.25rem', display: 'inline' }}>{block.content || '\u00A0'}</span>
                          </p>
                        ) : (
                          <p className="mb-0 whitespace-pre-wrap break-words" style={{ display: 'block' }}>{block.content || '\u00A0'}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>加载中…</p>
                  )}
                </div>
              </div>
            )}

            {(result.context || result.isPartial) && (
              <div className="notion-card p-4" style={{ borderRadius: '12px', background: 'rgba(255, 248, 252, 0.7)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-medium uppercase tracking-wide" style={{ color: 'var(--notion-text-secondary)', fontSize: FONT_LABEL_PX + 'px' }}>
                    上下文语境
                  </p>
                  {result.context && (
                    <button
                      onClick={isPlayingContext ? handleStopContext : handleSpeakContext}
                      className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-colors"
                      style={{
                        background: isPlayingContext ? 'var(--notion-error)' : 'var(--notion-accent)',
                        color: '#fff'
                      }}
                      aria-label={isPlayingContext ? '停止播放' : '播放上下文语境语音'}
                      title={isPlayingContext ? '停止播放' : '播放上下文语境语音'}
                    >
                      {isPlayingContext ? (
                        <VolumeX className="w-4 h-4" strokeWidth={2} />
                      ) : (
                        <Volume2 className="w-4 h-4" strokeWidth={2} />
                      )}
                    </button>
                  )}
                </div>
                <div
                  style={{
                    color: 'var(--notion-text)',
                    fontSize: FONT_BODY_PX + 'px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                    lineHeight: 1.7,
                    maxWidth: '100%'
                  }}
                >
                  {result.context ? (
                    parseNumberedBlocks(result.context).map((block, i) => (
                      <div key={i} className="mb-2 last:mb-0">
                        {block.title ? (
                          // 编号和文字在同一行显示，不换行
                          <p className="mb-0 whitespace-pre-wrap break-words">
                            <span className="font-semibold" style={{ color: 'var(--notion-text-secondary)' }}>
                              {block.title}
                            </span>
                            <span style={{ marginLeft: '0.25rem' }}>{block.content || '\u00A0'}</span>
                          </p>
                        ) : (
                          <p className="mb-0 whitespace-pre-wrap break-words">{block.content || '\u00A0'}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>加载中…</p>
                  )}
                </div>
              </div>
            )}

            {/* 保存成功：小尺寸提示，与插件淡粉风格一致，约 3 秒后自动消失，无需点击 */}
            {saveSuccess && (
              <div
                className="flex items-center gap-2 mt-3"
                style={{
                  padding: '6px 10px',
                  background: 'rgba(255, 242, 248, 0.98)',
                  borderRadius: '10px',
                  border: '1px solid rgba(220, 190, 200, 0.35)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  fontSize: FONT_BODY_PX + 'px',
                  color: 'rgba(0, 0, 0, 0.75)'
                }}
              >
                <span style={{ color: 'rgba(31, 184, 50, 0.9)', fontSize: '14px' }}>✓</span>
                <span className="font-medium">已保存到生词本</span>
              </div>
            )}
          </div>
        )}

        {!result && !isLoading && (
          <div className="text-center py-8" style={{ color: 'var(--notion-text-tertiary)', fontSize: FONT_BODY_PX + 'px' }}>
            等待翻译结果...
          </div>
        )}
        </>
        )}
        </div>

        {/* 边框拖拽缩放：右、下、右下角，仅非最小化时显示 */}
        {panelMode !== 'minimized' && (
          <>
            <div
              data-resize-handle="e"
              role="presentation"
              className="absolute top-0 bottom-0 right-0 z-20"
              style={{
                width: RESIZE_HANDLE_WIDTH + 'px',
                cursor: 'ew-resize',
                background: 'transparent'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 190, 200, 0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            />
            <div
              data-resize-handle="s"
              role="presentation"
              className="absolute left-0 right-0 bottom-0 z-20"
              style={{
                height: RESIZE_HANDLE_WIDTH + 'px',
                cursor: 'ns-resize',
                background: 'transparent'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 190, 200, 0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            />
            <div
              data-resize-handle="se"
              role="presentation"
              className="absolute bottom-0 right-0 z-30 rounded-br-[15px]"
              style={{
                width: RESIZE_HANDLE_WIDTH * 2 + 'px',
                height: RESIZE_HANDLE_WIDTH * 2 + 'px',
                cursor: 'nwse-resize',
                background: 'transparent'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 190, 200, 0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            />
          </>
        )}
      </div>
  )
}

export default TranslationPanel
