/**
 * 文字选择 Hook
 * 
 * 这个自定义 Hook 封装了文字选择的所有逻辑：
 * 1. 监听用户选择文字
 * 2. 计算选中文字的位置
 * 3. 处理边界情况（按钮超出视口）
 * 4. 处理页面滚动
 * 5. 防抖处理，避免频繁触发
 * 
 * 为什么使用自定义 Hook？
 * - 代码复用：逻辑可以在多个组件中使用
 * - 关注点分离：UI 逻辑和业务逻辑分离
 * - 易于测试：可以单独测试这个 Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 选中文字的位置信息
 */
export interface SelectionPosition {
  // 按钮的 X 坐标（相对于页面）
  x: number
  // 按钮的 Y 坐标（相对于页面）
  y: number
  // 选中文字的矩形区域（相对于视口）
  rect: DOMRect
  // 选中文字的内容
  text: string
  // 选中文字的 Range 对象（用于高亮等操作）
  range: Range
}

/**
 * useTextSelection Hook 的返回值
 */
export interface UseTextSelectionReturn {
  // 选中的文字
  selectedText: string
  // 按钮位置（null 表示不显示按钮）
  buttonPosition: SelectionPosition | null
  // 清除选择（手动清除选中状态）
  clearSelection: () => void
}

/**
 * 计算浮动按钮的最佳位置
 * 
 * 策略：
 * 1. 优先显示在选中文字的上方中间
 * 2. 如果上方空间不足，显示在下方
 * 3. 如果按钮会超出视口，调整位置使其完全可见
 * 
 * @param rect - 选中文字的矩形区域（相对于视口）
 * @param buttonHeight - 按钮的高度（像素）
 * @param buttonWidth - 按钮的宽度（像素）
 * @param spacing - 按钮与文字的间距（像素）
 * @returns 按钮的位置坐标
 */
function calculateButtonPosition(
  rect: DOMRect,
  buttonHeight: number = 40,
  buttonWidth: number = 80,
  spacing: number = 10
): { x: number; y: number; placement: 'top' | 'bottom' } {
  // 获取视口尺寸
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // 计算按钮的水平位置：选中文字的中心
  let x = rect.left + rect.width / 2
  
  // 确保按钮不会超出视口左右边界
  // 按钮宽度的一半 + 一些边距
  const minX = buttonWidth / 2 + 10
  const maxX = viewportWidth - buttonWidth / 2 - 10
  x = Math.max(minX, Math.min(maxX, x))
  
  // 计算垂直位置
  // 优先显示在上方
  const topY = rect.top - buttonHeight - spacing
  const bottomY = rect.bottom + spacing
  
  // 判断上方是否有足够空间
  // 如果上方空间不足（按钮会超出视口顶部），则显示在下方
  let y: number
  let placement: 'top' | 'bottom'
  
  if (topY >= 0) {
    // 上方有足够空间
    y = topY
    placement = 'top'
  } else {
    // 上方空间不足，显示在下方
    y = bottomY
    placement = 'bottom'
    
    // 如果下方也超出视口，调整到视口内
    if (y + buttonHeight > viewportHeight) {
      y = Math.max(10, viewportHeight - buttonHeight - 10)
    }
  }
  
  // 使用 fixed 定位，不需要加上滚动距离
  // fixed 定位是相对于视口的，这样按钮会始终显示在正确的位置
  return {
    x: x, // fixed 定位相对于视口，不需要加 scrollX
    y: y, // fixed 定位相对于视口，不需要加 scrollY
    placement
  }
}

/**
 * 检查选择是否有效
 * 
 * 有效选择的条件：
 * 1. 有选中的文字
 * 2. 文字长度在合理范围内（2-500 字符）
 * 3. 不是在我们的组件内部选择的（避免循环触发）
 * 
 * @param selection - 浏览器的 Selection 对象
 * @returns 是否有效
 */
function isValidSelection(selection: Selection | null): boolean {
  if (!selection || selection.rangeCount === 0) {
    return false
  }
  
  const text = selection.toString().trim()
  
  // 检查文字长度：太短或太长都不处理
  if (text.length < 2 || text.length > 500) {
    return false
  }
  
  // 检查是否在我们的组件内部选择
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  
  // 向上查找，看是否在 #context-ai-root 内部
  let node: Node | null = container.nodeType === Node.TEXT_NODE 
    ? container.parentElement 
    : container as Element
  
  while (node) {
    if (node instanceof Element && node.id === 'context-ai-root') {
      return false // 在我们的组件内部，忽略
    }
    node = node.parentElement
  }
  
  return true
}

/**
 * 文字选择 Hook
 * 
 * @param options - 配置选项
 * @returns 选择状态和清除函数
 */
export function useTextSelection(options: {
  // 最小文字长度（默认 2）
  minLength?: number
  // 最大文字长度（默认 500）
  maxLength?: number
  // 防抖延迟（毫秒，默认 100）
  debounceDelay?: number
  // 是否启用（默认 true）
  enabled?: boolean
} = {}): UseTextSelectionReturn {
  const {
    minLength = 2,
    maxLength = 500,
    debounceDelay = 100,
    enabled = true
  } = options

  // 选中的文字内容
  const [selectedText, setSelectedText] = useState<string>('')
  
  // 按钮位置信息
  const [buttonPosition, setButtonPosition] = useState<SelectionPosition | null>(null)
  
  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 当前选中的 Range 引用（用于高亮等操作）
  const currentRangeRef = useRef<Range | null>(null)
  
  // 鼠标按下时间戳（用于检测选择是否稳定）
  const mouseDownTimeRef = useRef<number>(0)
  
  // 上一次选择的文本（用于检测选择是否变化）
  const lastSelectedTextRef = useRef<string>('')

  /**
   * 检查选择范围是否合理
   * 
   * 避免选择范围过大（比如误选了整段文字）
   * 
   * @param range - 选择范围
   * @returns 是否合理
   */
  const isSelectionReasonable = useCallback((range: Range): boolean => {
    // 获取选择区域的矩形
    const rect = range.getBoundingClientRect()
    
    // 如果选择区域的高度超过 100px，可能是误选了多行
    // 但允许较长的单行选择（比如 URL 或长单词）
    if (rect.height > 100) {
      // 检查是否跨越了多个元素
      const startContainer = range.startContainer
      const endContainer = range.endContainer
      
      // 如果起始和结束容器不同，可能是跨元素选择
      if (startContainer !== endContainer) {
        // 计算跨越的元素数量
        let elementCount = 0
        let node: Node | null = startContainer
        
        while (node && node !== endContainer) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            elementCount++
          }
          node = node.nextSibling || node.parentNode
        }
        
        // 如果跨越了超过 3 个元素，可能是误选
        if (elementCount > 3) {
          return false
        }
      }
    }
    
    return true
  }, [])

  /**
   * 处理文字选择（仅在 mouseup 时调用，确保选择已完成）
   * 
   * 使用防抖处理，避免用户快速选择时频繁触发
   */
  const handleSelection = useCallback(() => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // 设置新的定时器，增加延迟以确保选择稳定
    debounceTimerRef.current = setTimeout(() => {
      const selection = window.getSelection()
      
      // 调试日志
      if (selection && selection.toString().trim().length > 0) {
        console.log('[Context AI] 检测到文字选择：', selection.toString().substring(0, 50))
      }
      
      // 检查选择是否有效
      if (!isValidSelection(selection)) {
        if (selection && selection.toString().trim().length > 0) {
          console.log('[Context AI] 选择无效，已忽略')
        }
        setButtonPosition(null)
        setSelectedText('')
        currentRangeRef.current = null
        lastSelectedTextRef.current = ''
        return
      }
      
      // 获取选中的文字
      const text = selection!.toString().trim()
      
      // 检查选择是否与上次相同（避免重复处理）
      if (text === lastSelectedTextRef.current) {
        return
      }
      
      // 再次检查长度（双重保险）
      if (text.length < minLength || text.length > maxLength) {
        setButtonPosition(null)
        setSelectedText('')
        currentRangeRef.current = null
        lastSelectedTextRef.current = ''
        return
      }
      
      // 获取选中范围
      const range = selection!.getRangeAt(0)
      
      // 检查选择范围是否合理
      if (!isSelectionReasonable(range)) {
        console.log('[Context AI] 选择范围过大，可能是误选，已忽略')
        setButtonPosition(null)
        setSelectedText('')
        currentRangeRef.current = null
        lastSelectedTextRef.current = ''
        return
      }
      
      // 获取选中文字的矩形区域（相对于视口）
      const rect = range.getBoundingClientRect()
      
      // 检查矩形是否有效（宽度和高度都应该大于 0）
      if (rect.width === 0 && rect.height === 0) {
        setButtonPosition(null)
        setSelectedText('')
        currentRangeRef.current = null
        lastSelectedTextRef.current = ''
        return
      }
      
      // 计算按钮位置
      const buttonPos = calculateButtonPosition(rect)
      
      // 保存选中文字和位置
      setSelectedText(text)
      setButtonPosition({
        x: buttonPos.x,
        y: buttonPos.y,
        rect: rect,
        text: text,
        range: range.cloneRange() // 克隆 Range，避免被后续操作影响
      })
      
      // 保存 Range 引用（用于高亮）
      currentRangeRef.current = range.cloneRange()
      
      // 保存当前选择的文本
      lastSelectedTextRef.current = text
    }, debounceDelay)
  }, [minLength, maxLength, debounceDelay, isSelectionReasonable])
  
  /**
   * 处理选择变化（仅用于清除选择，不用于设置选择）
   * 
   * 当选择被清除时，隐藏按钮
   */
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    
    // 如果选择为空，清除按钮
    if (!selection || selection.toString().trim().length === 0) {
      // 延迟清除，避免在 mouseup 之前清除
      setTimeout(() => {
        const currentSelection = window.getSelection()
        if (!currentSelection || currentSelection.toString().trim().length === 0) {
          setButtonPosition(null)
          setSelectedText('')
          currentRangeRef.current = null
          lastSelectedTextRef.current = ''
        }
      }, 50)
    }
  }, [])
  
  /**
   * 处理鼠标按下
   * 
   * 记录按下时间，用于检测选择是否稳定
   */
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // 如果点击的是我们的组件，不处理
    const target = e.target as HTMLElement
    if (target.closest('#context-ai-root')) {
      return
    }
    
    // 记录鼠标按下时间
    mouseDownTimeRef.current = Date.now()
  }, [])

  /**
   * 清除选择
   */
  const clearSelection = useCallback(() => {
    // 清除浏览器选择
    if (window.getSelection) {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
      }
    }
    
    // 清除状态
    setButtonPosition(null)
    setSelectedText('')
    currentRangeRef.current = null
    lastSelectedTextRef.current = ''
  }, [])

  /**
   * 处理鼠标释放（用户完成选择）
   * 
   * 这是主要的触发点，确保用户已经完成选择操作
   */
  const handleMouseUp = useCallback((e: MouseEvent) => {
    // 如果点击的是我们的组件，不处理
    const target = e.target as HTMLElement
    if (target.closest('#context-ai-root')) {
      return
    }
    
    // 检查鼠标按下和释放的时间间隔
    // 如果间隔太短（小于 50ms），可能是误触，忽略
    const timeSinceMouseDown = Date.now() - mouseDownTimeRef.current
    if (timeSinceMouseDown < 50) {
      return
    }
    
    // 延迟处理，确保浏览器已经更新选择状态
    setTimeout(() => {
      handleSelection()
    }, 50)
  }, [handleSelection])
  
  /**
   * 处理页面点击
   * 点击页面其他地方时，隐藏按钮
   */
  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    
    // 如果点击的是我们的组件，不处理
    if (target.closest('#context-ai-root')) {
      return
    }
    
    // 如果点击的不是选中文字，清除选择
    const selection = window.getSelection()
    if (!selection || selection.toString().trim().length === 0) {
      setButtonPosition(null)
      setSelectedText('')
      currentRangeRef.current = null
      lastSelectedTextRef.current = ''
    }
  }, [])

  /**
   * 处理页面滚动
   * 滚动时更新按钮位置
   */
  const handleScroll = useCallback(() => {
    if (!buttonPosition) {
      return
    }
    
    // 重新计算位置
    handleSelection()
  }, [buttonPosition, handleSelection])

  /**
   * 处理窗口大小变化
   * 窗口大小变化时，重新计算按钮位置
   */
  const handleResize = useCallback(() => {
    if (!buttonPosition) {
      return
    }
    
    // 重新计算位置
    handleSelection()
  }, [buttonPosition, handleSelection])

  // 设置事件监听器
  useEffect(() => {
    if (!enabled) {
      return
    }

    // 监听鼠标按下事件（记录按下时间）
    document.addEventListener('mousedown', handleMouseDown, true)
    
    // 监听鼠标释放事件（用户选择文字后释放鼠标）
    // 这是主要的触发点，确保用户已经完成选择操作
    document.addEventListener('mouseup', handleMouseUp, true)
    
    // 监听键盘选择事件（用户使用 Shift+方向键选择文字）
    document.addEventListener('keyup', (e) => {
      // 如果按下了 Shift 键，可能是键盘选择
      if (e.shiftKey || e.key === 'Shift') {
        // 延迟处理，确保选择已完成
        setTimeout(() => {
          handleSelection()
        }, 100)
      }
    })
    
    // 监听选择变化事件（仅用于清除选择，不用于设置选择）
    document.addEventListener('selectionchange', handleSelectionChange)
    
    // 监听点击事件（点击其他地方时隐藏按钮）
    document.addEventListener('click', handleClick, true) // 使用捕获阶段，确保先处理
    
    // 监听滚动事件（更新按钮位置）
    window.addEventListener('scroll', handleScroll, true) // 使用捕获阶段，捕获所有滚动
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)

    // 清理函数：移除事件监听器
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mouseup', handleMouseUp, true)
      document.removeEventListener('keyup', handleSelection)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      
      // 清除防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [enabled, handleMouseDown, handleMouseUp, handleSelection, handleSelectionChange, handleClick, handleScroll, handleResize])

  return {
    selectedText,
    buttonPosition,
    clearSelection
  }
}
