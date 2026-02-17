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
  // 恢复选择（重新应用保存的 Range，保持选中状态）
  restoreSelection: () => void
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
 * 2. 文字长度在合理范围内（2 字～8000 字，支持整段）
 * 3. 不是在我们的组件内部选择的（避免循环触发）
 */
function isValidSelection(selection: Selection | null, maxLen: number): boolean {
  if (!selection || selection.rangeCount === 0) {
    return false
  }
  const text = selection.toString().trim()
  if (text.length < 2 || text.length > maxLen) {
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
  // 最大文字长度（默认 8000，支持整段翻译）
  maxLength?: number
  // 防抖延迟（毫秒，默认 100）
  debounceDelay?: number
  // 是否启用（默认 true）
  enabled?: boolean
  // 为 true 时（如翻译面板已打开）：选区为空也不清空状态，避免点击面板内导致面板消失
  keepSelectionWhenPanelOpen?: boolean
} = {}): UseTextSelectionReturn {
  const {
    minLength = 2,
    maxLength = 8000,
    debounceDelay = 100,
    enabled = true,
    keepSelectionWhenPanelOpen = false
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
  // 最近一次 mouseup 时间戳（用于避免紧随其后的 click 清空刚选中的内容）
  const lastMouseUpTimeRef = useRef<number>(0)
  
  // 上一次选择的文本（用于检测选择是否变化）
  const lastSelectedTextRef = useRef<string>('')
  
  // Cursor 风格：标记是否正在拖拽选择（mousedown 到 mouseup 之间）
  // 在拖拽选择过程中，不更新按钮位置，避免窗口跟着动
  const isSelectingRef = useRef<boolean>(false)

  /**
   * Cursor 风格：智能优化选择范围
   * 
   * 如果选择范围在单词中间，尝试对齐到单词边界
   * 这样可以避免选中不完整的单词
   */
  const optimizeSelectionRange = useCallback((range: Range): Range => {
    try {
      const optimizedRange = range.cloneRange()
      const startContainer = optimizedRange.startContainer
      const endContainer = optimizedRange.endContainer
      
      // 只在文本节点上优化
      if (startContainer.nodeType === Node.TEXT_NODE && endContainer.nodeType === Node.TEXT_NODE) {
        const startText = startContainer.textContent || ''
        const endText = endContainer.textContent || ''
        const startOffset = optimizedRange.startOffset
        const endOffset = optimizedRange.endOffset
        
        // 检查起始位置：如果不在单词边界，尝试向前对齐到单词边界
        if (startOffset > 0 && startOffset < startText.length) {
          const charBefore = startText[startOffset - 1]
          const charAt = startText[startOffset]
          // 如果前一个字符是字母/数字，当前字符也是字母/数字，说明在单词中间
          const isWordChar = (c: string) => /[\w\u4e00-\u9fa5]/.test(c)
          if (isWordChar(charBefore) && isWordChar(charAt)) {
            // 向前查找单词边界
            let newStart = startOffset
            while (newStart > 0 && isWordChar(startText[newStart - 1])) {
              newStart--
            }
            if (newStart !== startOffset) {
              optimizedRange.setStart(startContainer, newStart)
            }
          }
        }
        
        // 检查结束位置：如果不在单词边界，尝试向后对齐到单词边界
        if (endOffset > 0 && endOffset < endText.length) {
          const charBefore = endText[endOffset - 1]
          const charAt = endText[endOffset]
          const isWordChar = (c: string) => /[\w\u4e00-\u9fa5]/.test(c)
          if (isWordChar(charBefore) && isWordChar(charAt)) {
            // 向后查找单词边界
            let newEnd = endOffset
            while (newEnd < endText.length && isWordChar(endText[newEnd])) {
              newEnd++
            }
            if (newEnd !== endOffset) {
              optimizedRange.setEnd(endContainer, newEnd)
            }
          }
        }
      }
      
      return optimizedRange
    } catch (e) {
      console.warn('[Context AI] 优化选择范围失败，使用原始范围', e)
      return range
    }
  }, [])

  /**
   * 检查选择范围是否可接受
   * 
   * Cursor 风格：更严格的检查，确保选择范围精确合理
   * 
   * 检查项：
   * 1. Range 的矩形区域大小是否合理（不超过视口的 80%）
   * 2. Range 跨越的元素数量是否过多（避免选择整个页面）
   * 3. Range 的起始和结束节点是否在合理范围内
   */
const isSelectionReasonable = useCallback((range: Range): boolean => {
    try {
      // 获取选择范围的矩形区域
      const rect = range.getBoundingClientRect()
      
      // 检查矩形区域是否过大（超过视口的 80% 可能是误选）
      const MAX_REASONABLE_WIDTH = window.innerWidth * 0.8
      const MAX_REASONABLE_HEIGHT = window.innerHeight * 0.6
      
      if (rect.width > MAX_REASONABLE_WIDTH || rect.height > MAX_REASONABLE_HEIGHT) {
        console.log('[Context AI] 选择矩形区域过大，可能是误选', {
          width: rect.width,
          height: rect.height,
          maxWidth: MAX_REASONABLE_WIDTH,
          maxHeight: MAX_REASONABLE_HEIGHT
        })
        return false
      }
      
      // 检查 Range 跨越的元素数量
      // 如果跨越的元素过多，可能是选择了整个容器
      const startContainer = range.startContainer
      const endContainer = range.endContainer
      
      // 如果起始和结束容器相同，且是文本节点，通常是正常选择
      if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
        return true
      }
      
      // 检查起始和结束节点之间的 DOM 距离
      // 如果它们相距太远（比如跨越了多个主要容器），可能是误选
      let startElement: Element | null = startContainer.nodeType === Node.TEXT_NODE
        ? startContainer.parentElement
        : startContainer as Element
      
      let endElement: Element | null = endContainer.nodeType === Node.TEXT_NODE
        ? endContainer.parentElement
        : endContainer as Element
      
      if (!startElement || !endElement) {
        return true // 无法判断，允许通过
      }
      
      // 计算两个元素之间的 DOM 层级距离
      // 如果它们有共同的祖先，检查这个祖先是否过大
      const commonAncestor = range.commonAncestorContainer
      if (commonAncestor && commonAncestor.nodeType === Node.ELEMENT_NODE) {
        const ancestorElement = commonAncestor as Element
        const ancestorRect = ancestorElement.getBoundingClientRect()
        
        // 如果共同祖先的矩形区域远大于选择的矩形区域，可能是误选
        const AREA_RATIO_THRESHOLD = 3 // 如果祖先区域是选择区域的 3 倍以上，可能是误选
        const selectionArea = rect.width * rect.height
        const ancestorArea = ancestorRect.width * ancestorRect.height
        
        if (selectionArea > 0 && ancestorArea / selectionArea > AREA_RATIO_THRESHOLD) {
          // 但如果选择的矩形区域本身很小，可能是正常的
          if (rect.width < 200 && rect.height < 100) {
            return true // 选择区域小，允许通过
          }
          
          console.log('[Context AI] 选择范围与共同祖先区域比例异常，可能是误选', {
            selectionArea,
            ancestorArea,
            ratio: ancestorArea / selectionArea
          })
          return false
        }
      }
      
      return true
    } catch (e) {
      console.warn('[Context AI] isSelectionReasonable 检查出错', e)
      return true // 出错时允许通过，避免误判
    }
  }, [])

  /**
   * 处理文字选择（仅在 mouseup 时调用，确保选择已完成）
   * 
   * Cursor 风格：只在选择完成后更新按钮位置，避免拖拽时窗口跟着动
   * 
   * 使用防抖处理，避免用户快速选择时频繁触发
   */
  const handleSelection = useCallback(() => {
    // Cursor 风格：如果正在拖拽选择，不更新按钮位置
    // 这样可以避免从上到下选中文字时，窗口跟着动
    if (isSelectingRef.current) {
      return
    }
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // 设置新的定时器，增加延迟以确保选择稳定
    debounceTimerRef.current = setTimeout(() => {
      // 再次检查：如果选择过程中状态变化，不更新
      if (isSelectingRef.current) {
        return
      }
      const selection = window.getSelection()
      
      // 调试日志
      if (selection && selection.toString().trim().length > 0) {
        console.log('[Context AI] 检测到文字选择：', selection.toString().substring(0, 50))
      }
      
      // 检查选择是否有效（例如是否在插件内部选字）
      if (!isValidSelection(selection, maxLength)) {
        if (selection && selection.toString().trim().length > 0) {
          console.log('[Context AI] 选择无效（如在插件内选字），保持当前面板状态')
        }
        // 选区在插件内部时不清空状态，避免用户在翻译面板上选中/复制时面板闪退
        return
      }
      
      // 获取选中范围
      let range = selection!.getRangeAt(0)
      
      // Cursor 风格：优化选择范围，对齐到单词边界
      // 这样可以避免选中不完整的单词，提供更精确的选择体验
      range = optimizeSelectionRange(range)
      
      // 检查选择范围是否合理（先检查范围，再获取文本）
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
      
      // Cursor 风格：精确获取文本，参考 Cursor IDE 的选中逻辑
      // 1. 使用 Range API 精确提取文本
      // 2. 智能去除首尾空白和换行
      // 3. 确保选择范围精确，不会选中多余内容
      let text: string
      try {
        // 方法1：使用 Range 的 cloneContents() 获取精确的文本节点内容
        // 这比 toString() 更精确，可以避免选中多余的空格和换行
        const clonedContents = range.cloneContents()
        const tempDiv = document.createElement('div')
        tempDiv.appendChild(clonedContents)
        
        // 获取文本内容，并智能处理空白字符
        let rawText = tempDiv.textContent || tempDiv.innerText || ''
        
        // Cursor 风格：智能去除首尾空白，但保留中间的空白
        // 使用正则表达式去除首尾的空白字符（包括空格、制表符、换行等）
        text = rawText.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '')
        
        // 如果提取的文本为空，回退到 range.toString()
        if (!text || text.length === 0) {
          text = range.toString().trim()
        }
        
        // 如果还是为空，使用 selection.toString()
        if (!text || text.length === 0) {
          console.warn('[Context AI] Range 提取文本为空，使用 selection.toString()')
          text = selection!.toString().trim()
        }
      } catch (e) {
        // 如果 Range 操作失败，回退到 selection.toString()
        console.warn('[Context AI] Range 操作失败，使用 selection.toString()', e)
        text = selection!.toString().trim()
      }
      
      // Cursor 风格：进一步优化文本，去除多余的空白字符
      // 将多个连续空白字符（包括空格、制表符、换行）替换为单个空格
      // 但保留换行符（如果用户选择了多行文本）
      if (text) {
        // 检查是否包含换行符（多行选择）
        const hasNewlines = text.includes('\n')
        if (hasNewlines) {
          // 多行文本：保留换行符，但规范化空白字符
          text = text.replace(/[ \t]+/g, ' ') // 将多个空格/制表符替换为单个空格
                     .replace(/\n[ \t]+/g, '\n') // 去除换行后的空格
                     .replace(/[ \t]+\n/g, '\n') // 去除换行前的空格
        } else {
          // 单行文本：去除所有多余的空白字符
          text = text.replace(/\s+/g, ' ').trim()
        }
      }
      
      // 调试日志：检查获取的文本
      console.log('[Context AI] 获取到的选中文本:', {
        textLength: text.length,
        preview: text.substring(0, 100),
        rectWidth: rect.width,
        rectHeight: rect.height,
        rangeStart: range.startContainer.nodeName,
        rangeEnd: range.endContainer.nodeName
      })
      
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
      
      // isSelectionReasonable 已经检查了矩形区域，这里不需要重复检查
      
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
  }, [minLength, maxLength, debounceDelay, isSelectionReasonable, optimizeSelectionRange])
  
  /**
   * 处理选择变化：清空时隐藏按钮；有选区时延迟再读一次并展示（兜底，解决 mouseup 时选区尚未更新的情况）
   * 
   * Cursor 风格：在用户拖拽选择过程中（isSelectingRef.current === true），
   * 不更新按钮位置，避免窗口跟着动。只在选择完成后（mouseup）才更新。
   */
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    
    if (text.length === 0) {
      // 如果正在选择中，不清空按钮（避免拖拽过程中按钮消失）
      if (isSelectingRef.current) {
        return
      }
      
      setTimeout(() => {
        if (Date.now() - lastMouseUpTimeRef.current < 200) return
        const currentSelection = window.getSelection()
        if (!currentSelection || currentSelection.toString().trim().length === 0) {
          // 翻译面板打开时锁定选区，不清空，避免点击面板内导致面板消失
          if (keepSelectionWhenPanelOpen) return
          // 若焦点仍在插件内（如翻译面板），不清空，避免面板闪退
          if (document.activeElement?.closest('#context-ai-root')) return
          setButtonPosition(null)
          setSelectedText('')
          currentRangeRef.current = null
          lastSelectedTextRef.current = ''
        }
      }, 50)
      return
    }
    
    // Cursor 风格：如果正在选择中，延迟处理，避免拖拽时窗口跟着动
    // 但确保选择完成后能正常显示按钮
    if (isSelectingRef.current) {
      // 延迟处理，等待 mouseup 完成后再更新
      // 增加延迟时间，确保 isSelectingRef.current 已经设置为 false
      setTimeout(() => {
        // 再次检查选择状态和文本，确保选择已完成
        const currentSelection = window.getSelection()
        const currentText = currentSelection?.toString().trim() ?? ''
        if (!isSelectingRef.current && currentText.length >= minLength && currentText.length <= maxLength) {
          handleSelection()
        }
      }, 250)
      return
    }
    
    // 选择已完成，正常处理
    if (text.length >= minLength && text.length <= maxLength) {
      setTimeout(() => {
        handleSelection()
      }, 80)
    }
  }, [minLength, maxLength, handleSelection, keepSelectionWhenPanelOpen])
  
  /**
   * 处理鼠标按下
   * 
   * Cursor 风格：标记开始选择，在选择过程中不更新按钮位置
   */
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // 如果点击的是我们的组件，不处理
    const target = e.target as HTMLElement
    if (target.closest('#context-ai-root')) {
      return
    }
    
    // 记录鼠标按下时间
    mouseDownTimeRef.current = Date.now()
    
    // Cursor 风格：标记开始拖拽选择
    // 在拖拽选择过程中，不更新按钮位置，避免窗口跟着动
    isSelectingRef.current = true
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
   * 恢复选择（重新应用保存的 Range，保持选中状态）
   * 
   * 这个函数用于在翻译过程中和翻译完成后恢复用户的选择状态
   * 确保用户选中的文字始终保持高亮显示
   */
  const restoreSelection = useCallback(() => {
    // 如果没有保存的 Range，无法恢复
    if (!currentRangeRef.current) {
      return false
    }

    try {
      const selection = window.getSelection()
      if (!selection) {
        return false
      }

      // 清除当前选择
      selection.removeAllRanges()

      // 检查 Range 是否仍然有效（DOM 节点是否还在）
      const range = currentRangeRef.current
      try {
        // 尝试访问 Range 的节点，如果节点已被移除，会抛出异常
        const startContainer = range.startContainer
        const endContainer = range.endContainer
        
        // 检查节点是否还在 DOM 中
        if (!document.contains(startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentElement : startContainer as Element)) {
          console.warn('[Context AI] Range 的起始节点已不在 DOM 中，无法恢复选择')
          return false
        }
        if (!document.contains(endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentElement : endContainer as Element)) {
          console.warn('[Context AI] Range 的结束节点已不在 DOM 中，无法恢复选择')
          return false
        }

        // 重新设置 Range 的边界（因为 DOM 可能已变化）
        const newRange = document.createRange()
        newRange.setStart(range.startContainer, range.startOffset)
        newRange.setEnd(range.endContainer, range.endOffset)

        // 应用选择
        selection.addRange(newRange)
        
        console.log('[Context AI] 成功恢复选择状态')
        return true
      } catch (e) {
        console.warn('[Context AI] 恢复选择失败，Range 可能已失效', e)
        return false
      }
    } catch (e) {
      console.warn('[Context AI] 恢复选择时出错', e)
      return false
    }
  }, [])

  /**
   * 根据当前事件或文档获取选区（主文档或 iframe 内）
   * 部分页面主文档无选区，需从 event.target 所在 document 取
   */
  const getSelectionFromEvent = useCallback((e: MouseEvent): Selection | null => {
    const doc = (e.target as Node)?.ownerDocument ?? document
    try {
      return doc.getSelection?.() ?? window.getSelection()
    } catch {
      return window.getSelection()
    }
  }, [])

  /**
   * 处理鼠标释放（用户完成选择）
   * 浏览器可能在 mouseup 之后才更新选区，故先尝试同步读取，若无则下一帧再读一次
   */
  const handleMouseUp = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('#context-ai-root')) {
      return
    }
    const timeSinceMouseDown = Date.now() - mouseDownTimeRef.current
    if (timeSinceMouseDown < 50) {
      // 如果按下时间太短，可能是点击而不是拖拽选择，标记选择完成
      isSelectingRef.current = false
      return
    }

    lastMouseUpTimeRef.current = Date.now()
    
    // Cursor 风格：标记选择完成
    // 延迟设置为 false，确保 selectionchange 事件处理完成后再允许更新
    // 延迟时间设置为 150ms，给 selectionchange 事件足够的时间处理
    setTimeout(() => {
      isSelectingRef.current = false
      
      // 选择完成后，主动触发一次选择处理，确保按钮能显示
      // 延迟一点时间，确保选择状态已经稳定
      setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim() ?? ''
        if (text.length >= minLength && text.length <= maxLength) {
          handleSelection()
        }
      }, 50)
    }, 150)

    const tryApplySelection = (selection: Selection | null) => {
      if (!selection || selection.rangeCount === 0) return
      
      const text = selection.toString().trim()
      if (text.length < minLength || text.length > maxLength) return
      if (!isValidSelection(selection, maxLength)) return
      const range = selection.getRangeAt(0)
      
      // Cursor 风格：优化选择范围，对齐到单词边界
      const optimizedRange = optimizeSelectionRange(range)
      
      if (!isSelectionReasonable(optimizedRange)) return
      const rect = optimizedRange.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return

      const rangeClone = optimizedRange.cloneRange()
      const rectClone = optimizedRange.getBoundingClientRect()
      
      // 使用优化后的范围重新提取文本
      const optimizedText = optimizedRange.toString().trim()
      if (optimizedText === lastSelectedTextRef.current) return

      const buttonPos = calculateButtonPosition(rectClone)
      setSelectedText(optimizedText)
      setButtonPosition({
        x: buttonPos.x,
        y: buttonPos.y,
        rect: rectClone,
        text: optimizedText,
        range: rangeClone
      })
      currentRangeRef.current = rangeClone
      lastSelectedTextRef.current = optimizedText
    }

    const selFromEvent = getSelectionFromEvent(e)
    const selFromWindow = window.getSelection()
    tryApplySelection(selFromEvent ?? selFromWindow)

    if (!selFromEvent?.toString().trim() && !selFromWindow?.toString().trim()) {
      requestAnimationFrame(() => {
        const sel = window.getSelection()
        tryApplySelection(sel)
      })
    }
  }, [minLength, maxLength, isSelectionReasonable, getSelectionFromEvent, optimizeSelectionRange])
  
  /**
   * 处理页面点击：点击页面其他地方时隐藏按钮
   * 若点击紧接在 mouseup 之后（约 150ms 内），不清除，避免选字后释放鼠标触发的 click 误关浮动栏
   * 如果点击在翻译面板上，不清除，避免拖动时误关闭
   */
  const handleClick = useCallback((e: MouseEvent) => {
    // 如果点击在插件组件上（包括翻译面板），不清除选择，避免拖动时误关闭
    const target = e.target as HTMLElement
    if (target.closest('#context-ai-root') || target.closest('#translation-panel-root')) {
      return
    }
    if (Date.now() - lastMouseUpTimeRef.current < 150) {
      return
    }
    // 翻译面板打开时不因选区为空而清空，避免误触导致面板消失
    if (keepSelectionWhenPanelOpen) return
    const selection = window.getSelection()
    if (!selection || selection.toString().trim().length === 0) {
      setButtonPosition(null)
      setSelectedText('')
      currentRangeRef.current = null
      lastSelectedTextRef.current = ''
    }
  }, [keepSelectionWhenPanelOpen])

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
    clearSelection,
    restoreSelection
  }
}
