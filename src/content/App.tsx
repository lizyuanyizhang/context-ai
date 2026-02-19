/**
 * Content Script 主应用组件
 * 
 * 这个组件负责：
 * 1. 监听用户选择文字的事件（使用自定义 Hook）
 * 2. 显示浮动按钮（使用 FloatingButton 组件）
 * 3. 管理翻译结果面板的显示/隐藏
 * 4. 调用翻译 API（将在 Step 4 中实现）
 * 5. 显示选中文字的高亮效果
 */

import React, { useState, useEffect, useRef } from 'react'
import TranslationPanel, { TranslationResult } from './components/TranslationPanel'
import FloatingButtonContainer from './components/FloatingButtonContainer'
import WordbookPanel from './components/WordbookPanel'
import { useTextSelection } from './hooks/useTextSelection'
import { useTranslation } from './hooks/useTranslation'
import { useWordbook } from './hooks/useWordbook'
import { createHighlight, removeHighlight, clearAllHighlights } from './utils/selectionHighlight'
import { detectLanguage, ttsManager } from '../utils/tts'
import { hybridLanguageDetect } from '../utils/hybridLanguageDetector'

/** 用户可选的源语言：自动检测 或 指定语言（与翻译 API 一致，不含中文） */
export type ManualSourceLang = 'auto' | 'en' | 'de' | 'fr' | 'ja' | 'es'

function App() {
  // 是否显示结果面板（需要在 useTextSelection 之前声明，因为 useTextSelection 需要用到它）
  const [showPanel, setShowPanel] = useState(false)
  
  // 使用自定义 Hook 管理文字选择
  // 这个 Hook 封装了所有选择相关的逻辑：监听、位置计算、边界处理等
  const { selectedText, buttonPosition, clearSelection, restoreSelection } = useTextSelection({
    minLength: 2, // 最少 2 个字符
    maxLength: 8000, // 支持整段翻译（单词、句子、段落均可）
    debounceDelay: 300,
    enabled: true,
    // 翻译面板打开时锁定选区，避免点击面板内导致选区被清空、面板消失
    keepSelectionWhenPanelOpen: showPanel
  })
  
  // 使用翻译 Hook 管理翻译状态和调用
  const { result, isLoading, error, translate, clear } = useTranslation()
  
  // 使用生词本 Hook 管理生词本操作
  const { saveWord } = useWordbook()
  // 翻译面板锚点：在选中文字下方显示（方便拖动），{ top, left } 或 { bottom, left } 为视口坐标
  const [panelAnchor, setPanelAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  
  // 是否显示生词本面板
  const [showWordbook, setShowWordbook] = useState(false)
  
  // 保存成功提示状态
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // 是否正在播放语音
  const [isPlaying, setIsPlaying] = useState(false)
  
  // 用户手动选择的源语言（'auto' 表示使用自动检测）
  const [manualSourceLang, setManualSourceLang] = useState<ManualSourceLang>('auto')
  
  // 当前翻译结果使用的源语言（用于在面板中显示「翻译自：英语」及重新翻译）
  const [resultSourceLang, setResultSourceLang] = useState<'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh' | null>(null)
  
  // 高亮元素的 ID 引用（用于清除高亮）
  const highlightIdRef = useRef<string>('')

  // 移除高亮效果（用户反馈不需要选中框）
  // 如果需要高亮，可以取消下面的注释
  /*
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (highlightIdRef.current) {
        removeHighlight(highlightIdRef.current)
        highlightIdRef.current = ''
      }
      
      if (buttonPosition && buttonPosition.range) {
        requestAnimationFrame(() => {
          const highlightId = createHighlight(buttonPosition.range)
          highlightIdRef.current = highlightId
        })
      }
    }, 50)
    
    return () => {
      clearTimeout(timeoutId)
      clearAllHighlights()
    }
  }, [buttonPosition])
  */
  
  // 清除所有高亮（组件卸载时）
  useEffect(() => {
    return () => {
      clearAllHighlights()
    }
  }, [])

  // 当前翻译的文本引用（用于确保翻译的是最新选择的文字）
  const currentTranslatingTextRef = useRef<string>('')
  
  // 仅当用户点击工具栏「翻译」时打开面板并翻译，选中文字时只弹出工具栏，不自动打开翻译面板
  // 支持指定目标语言（targetLang），如果不指定则默认翻译为中文
  const handleTranslateClick = async (targetLang?: 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh') => {
    // 保存当前要翻译的文本
    const textToTranslate = selectedText
    
    // 如果没有选中文字，直接返回
    if (!textToTranslate || textToTranslate.trim().length === 0) {
      return
    }
    
    // 更新当前翻译的文本引用
    currentTranslatingTextRef.current = textToTranslate
    
    // 调试日志：检查选中的文本
    console.log('[Context AI] 准备翻译的文本:', {
      selectedText: selectedText,
      textToTranslate: textToTranslate,
      textLength: textToTranslate.length,
      preview: textToTranslate.substring(0, 100)
    })
    
    // 在选中文字下方显示翻译面板（方便拖动）：面板顶部对齐选区底部
    if (buttonPosition?.rect) {
      const rect = buttonPosition.rect
      const padding = 12 // 增加间距，让面板更明显
      const panelWidth = 480 // 更新为新的默认宽度
      const left = Math.max(padding, Math.min(rect.left, window.innerWidth - panelWidth - padding))
      // 使用 top 定位，显示在文字下方
      const top = rect.bottom + padding
      setPanelAnchor({ top, left })
    } else {
      setPanelAnchor(null)
    }
    setShowPanel(true)
    
    // 保存当前的 Range，以便后续恢复选择状态
    // 注意：不清除高亮，保持选中状态可见
    
    // 立即清除之前的翻译结果和错误（确保显示新的加载状态）
    clear()
    
    // 恢复选择状态，确保用户选中的文字保持高亮
    // 使用 setTimeout 确保在下一个事件循环中执行，避免被其他操作覆盖
    setTimeout(() => {
      restoreSelection()
    }, 50)
    
    // 确定源语言和目标语言
    let apiLang: 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh'
    let targetLanguage: 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' = 'zh' // 默认翻译为中文
    
    if (targetLang) {
      // 如果指定了目标语言，需要确定源语言
      targetLanguage = targetLang
      
      // 确定源语言：用户手动选择优先，否则使用自动检测
      if (manualSourceLang !== 'auto') {
        apiLang = manualSourceLang
        console.log('[Context AI] 使用用户选择源语言:', apiLang, '翻译为:', targetLang)
      } else {
        // 使用混合架构语言检测（FastText + 字符扫描 + LLM）
        const detectionResult = await hybridLanguageDetect(textToTranslate)
        const detectedLang = detectionResult.language
        console.log('[Context AI] 语言检测结果:', {
          text: textToTranslate.substring(0, 100),
          language: detectedLang,
          confidence: detectionResult.confidence,
          method: detectionResult.method,
          targetLang
        })
        // 如果检测到中文，源语言就是中文；否则使用检测到的语言
        apiLang = detectedLang === 'zh' ? 'zh' : detectedLang
      }
    } else {
      // 默认情况：外语翻译为中文
      if (manualSourceLang !== 'auto') {
        apiLang = manualSourceLang
        console.log('[Context AI] 使用用户选择语言:', apiLang)
      } else {
        // 使用混合架构语言检测（FastText + 字符扫描 + LLM）
        const detectionResult = await hybridLanguageDetect(textToTranslate)
        const detectedLang = detectionResult.language
        console.log('[Context AI] 语言检测结果:', {
          text: textToTranslate.substring(0, 100),
          language: detectedLang,
          confidence: detectionResult.confidence,
          method: detectionResult.method
        })
        // 如果检测到中文，源语言就是中文；否则使用检测到的语言
        apiLang = detectedLang === 'zh' ? 'zh' : detectedLang
      }
    }
    
    setResultSourceLang(apiLang)
    
    // 在翻译开始前再次恢复选择（防止语言检测过程中选择被清除）
    setTimeout(() => {
      restoreSelection()
    }, 100)
    
    // 开始翻译（传递目标语言）
    await translate(textToTranslate, apiLang, targetLanguage)
    
    // 翻译完成后，再次恢复选择状态，确保选中文字保持高亮
    setTimeout(() => {
      restoreSelection()
    }, 100)
    
    // 翻译完成后，再次检查是否还是当前要翻译的文本
    // 如果用户在这期间选择了新文字，忽略这次翻译结果
    if (currentTranslatingTextRef.current !== textToTranslate) {
      console.log('[Context AI] 翻译完成时已选择新文字，忽略旧结果')
      return
    }
  }
  
  // 当选中文字变化时，清除之前的翻译（如果面板已打开）
  useEffect(() => {
    if (showPanel && selectedText !== currentTranslatingTextRef.current) {
      // 用户选择了新文字，清除旧翻译
      clear()
      currentTranslatingTextRef.current = ''
    }
  }, [selectedText, showPanel, clear])

  // 当翻译结果更新时，恢复选择状态（确保选中文字保持高亮）
  useEffect(() => {
    if (result && showPanel) {
      // 翻译完成后，恢复选择状态
      setTimeout(() => {
        restoreSelection()
      }, 100)
    }
  }, [result, showPanel, restoreSelection])

  // 当翻译结果更新时，恢复选择状态（确保选中文字保持高亮）
  useEffect(() => {
    if (result && showPanel) {
      // 翻译完成后，恢复选择状态
      setTimeout(() => {
        restoreSelection()
      }, 100)
    }
  }, [result, showPanel, restoreSelection])
  
  // 当面板关闭时，清除翻译结果和锚点
  const handlePanelClose = () => {
    setShowPanel(false)
    setPanelAnchor(null)
    setResultSourceLang(null)
    clear() // 清除翻译结果和错误
    ttsManager.stop()
    setIsPlaying(false)
  }
  
  // 复制选中文字到剪贴板，便于用户粘贴到任意位置（不翻译时也可用）
  const handleCopy = async () => {
    if (!selectedText || selectedText.trim().length === 0) return
    try {
      await navigator.clipboard.writeText(selectedText.trim())
    } catch (err) {
      console.error('[Context AI] 复制失败:', err)
      alert('复制失败，请检查浏览器是否允许剪贴板访问')
    }
  }

  // 从浮动工具栏点击「生词本」：仅打开生词本面板，不自动保存当前选中内容
  const handleOpenWordbookFromToolbar = () => {
    setShowWordbook(true)
  }

  // 处理发音按钮点击：直接朗读选中的文本（支持停止播放）
  const handlePronounce = () => {
    // 如果正在播放，停止播放
    if (isPlaying) {
      ttsManager.stop()
      setIsPlaying(false)
      return
    }
    
    if (!selectedText || selectedText.trim().length === 0) {
      return
    }
    
    // 语言：用户手动选择优先，否则自动检测
    const langForTts = manualSourceLang !== 'auto'
      ? manualSourceLang
      : detectLanguage(selectedText)
    
    setIsPlaying(true)
    
    ttsManager.speak(
      selectedText,
      langForTts,
      // 播放结束回调（包括用户主动停止）
      () => {
        setIsPlaying(false)
      },
      // 播放错误回调（不包括用户主动停止的情况）
      (error) => {
        console.error('语音播放失败：', error)
        setIsPlaying(false)
        alert(`语音播放失败：${error.message}\n请检查浏览器设置或系统语音配置`)
      }
    )
  }

  return (
    <>
      {/* 浮动工具栏：当用户选中文字时显示（线条风格） */}
      {buttonPosition && !showPanel && (
        <FloatingButtonContainer
          x={buttonPosition.x}
          y={buttonPosition.y}
          isLoading={isLoading}
          isPlaying={isPlaying}
          manualSourceLang={manualSourceLang}
          onManualSourceLangChange={setManualSourceLang}
          onTranslate={handleTranslateClick}
          onPronounce={handlePronounce}
          onCopy={handleCopy}
          onOpenWordbook={handleOpenWordbookFromToolbar}
          selectedText={selectedText}
        />
      )}

      {/* 翻译结果面板：在选中文字下方显示，方便用户对照查看 */}
      {showPanel && selectedText && (
        <TranslationPanel
          anchorPosition={panelAnchor}
          text={selectedText}
          result={result || undefined}
          isLoading={isLoading}
          error={error}
          sourceLanguage={resultSourceLang ?? undefined}
          onRetranslateWithLang={(lang) => {
            setResultSourceLang(lang)
            translate(selectedText, lang)
          }}
          onClose={handlePanelClose}
          onSave={async (result) => {
            try {
              // 💡 验证数据完整性：确保 originalText 和 translation 都存在
              const originalText = result.originalText?.trim() || ''
              const translation = result.translation?.trim() || ''
              
              if (!originalText) {
                console.error('[App] 保存失败：originalText 为空', { result })
                alert('保存失败：原始文本为空，请重试')
                return
              }
              
              if (!translation) {
                console.error('[App] 保存失败：translation 为空', { result })
                alert('保存失败：翻译结果为空，请重试')
                return
              }
              
              console.log('[App] 保存单词到生词本：', {
                originalText: originalText.substring(0, 50),
                translation: translation.substring(0, 50),
                sourceLanguage: result.sourceLanguage,
                hasGrammar: !!result.grammar,
                hasContext: !!result.context,
                originalTextLength: originalText.length,
                translationLength: translation.length
              })
              
              // 💡 确保传递给 saveWord 的数据已经清理过
              const cleanedResult = {
                ...result,
                originalText,
                translation
              }
              
              const success = await saveWord(cleanedResult)
              console.log('[App] saveWord 返回结果：', success)
              if (success) {
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
                console.log('[App] 保存成功，已显示成功提示')
                // 不自动弹出生词本，用户可点击工具栏「生词本」再打开
                // 存储监听会自动刷新 WordbookPanel
              } else {
                console.error('[App] 保存失败：saveWord 返回 false')
                const errorMsg = '保存到生词本失败，请检查控制台查看详细错误信息'
                console.error('[App] 错误详情：', errorMsg)
                alert(errorMsg)
              }
            } catch (err) {
              console.error('[App] 保存单词异常：', err)
              const errorMsg = `保存到生词本失败：${err instanceof Error ? err.message : '未知错误'}`
              console.error('[App] 异常详情：', {
                error: err,
                result: result ? {
                  hasOriginalText: !!result.originalText,
                  hasTranslation: !!result.translation,
                  sourceLanguage: result.sourceLanguage
                } : 'result is null'
              })
              alert(errorMsg)
            }
          }}
          saveSuccess={saveSuccess}
        />
      )}

      {/* 生词本面板 */}
      <WordbookPanel
        isOpen={showWordbook}
        onClose={() => setShowWordbook(false)}
      />
    </>
  )
}

export default App
