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
import { BookOpen } from 'lucide-react'
import TranslationPanel, { TranslationResult } from './components/TranslationPanel'
import FloatingButtonContainer from './components/FloatingButtonContainer'
import WordbookPanel from './components/WordbookPanel'
import { useTextSelection } from './hooks/useTextSelection'
import { useTranslation } from './hooks/useTranslation'
import { useWordbook } from './hooks/useWordbook'
import { createHighlight, removeHighlight, clearAllHighlights } from './utils/selectionHighlight'
import { detectLanguage, ttsManager } from '../utils/tts'
import { hybridLanguageDetect } from '../utils/hybridLanguageDetector'

function App() {
  // 使用自定义 Hook 管理文字选择
  // 这个 Hook 封装了所有选择相关的逻辑：监听、位置计算、边界处理等
  const { selectedText, buttonPosition, clearSelection } = useTextSelection({
    minLength: 2, // 最少 2 个字符
    maxLength: 500, // 最多 500 个字符
    debounceDelay: 300, // 防抖延迟 300ms，给用户更多时间完成选择
    enabled: true // 启用选择功能
  })
  
  // 使用翻译 Hook 管理翻译状态和调用
  const { result, isLoading, error, translate, clear } = useTranslation()
  
  // 使用生词本 Hook 管理生词本操作
  const { saveWord } = useWordbook()
  
  // 是否显示结果面板
  const [showPanel, setShowPanel] = useState(false)
  
  // 是否显示生词本面板
  const [showWordbook, setShowWordbook] = useState(false)
  
  // 保存成功提示状态
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // 是否正在播放语音
  const [isPlaying, setIsPlaying] = useState(false)
  
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
  
  // 处理浮动按钮点击：显示翻译结果面板并开始翻译
  const handleButtonClick = async () => {
    // 保存当前要翻译的文本
    const textToTranslate = selectedText
    
    // 如果没有选中文字，直接返回
    if (!textToTranslate || textToTranslate.trim().length === 0) {
      return
    }
    
    // 更新当前翻译的文本引用
    currentTranslatingTextRef.current = textToTranslate
    
    // 显示翻译面板
    setShowPanel(true)
    
    // 清除高亮（面板显示后不再需要高亮）
    if (highlightIdRef.current) {
      removeHighlight(highlightIdRef.current)
      highlightIdRef.current = ''
    }
    
    // 立即清除之前的翻译结果和错误（确保显示新的加载状态）
    clear()
    
    // 检测语言并开始翻译
    // 使用混合架构语言检测（FastText + 字符扫描 + LLM）
    const detectionResult = await hybridLanguageDetect(textToTranslate)
    const detectedLang = detectionResult.language
    
    // 记录检测结果（用于调试）
    console.log('[Context AI] 语言检测结果:', {
      text: textToTranslate,
      language: detectedLang,
      confidence: detectionResult.confidence,
      method: detectionResult.method,
      reasoning: detectionResult.reasoning
    })
    
    // 将检测到的语言映射到翻译 API 支持的语言
    // 如果检测到中文，使用英语作为默认源语言（因为中文通常不需要翻译）
    const apiLang: 'en' | 'de' | 'fr' | 'ja' | 'es' = detectedLang === 'zh' ? 'en' : detectedLang
    
    // 开始翻译
    await translate(textToTranslate, apiLang)
    
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
  
  // 当面板关闭时，清除翻译结果
  const handlePanelClose = () => {
    setShowPanel(false)
    clear() // 清除翻译结果和错误
    // 停止语音播放（如果正在播放）
    ttsManager.stop()
    setIsPlaying(false)
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
    
    // 检测语言
    const detectedLang = detectLanguage(selectedText)
    
    // 开始播放
    setIsPlaying(true)
    
    ttsManager.speak(
      selectedText,
      detectedLang,
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
          onTranslate={handleButtonClick}
          onPronounce={handlePronounce}
          onOpenWordbook={() => setShowWordbook(true)}
        />
      )}

      {/* 如果没有选中文字，显示生词本入口（固定在右下角，苹果风格） */}
      {!buttonPosition && !showPanel && (
        <button
          onClick={() => setShowWordbook(true)}
          className="fixed bottom-6 right-6 text-white px-5 py-3 rounded-2xl font-medium text-sm flex items-center gap-2 z-[999999] transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, var(--forest-accent) 0%, var(--forest-accent-hover) 100%)',
            boxShadow: '0 8px 24px rgba(52, 199, 89, 0.4)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(52, 199, 89, 0.5)'
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(52, 199, 89, 0.4)'
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
          }}
          title="打开生词本"
          aria-label="打开生词本"
        >
          <BookOpen className="w-5 h-5" />
          <span>生词本</span>
        </button>
      )}

      {/* 翻译结果面板：显示翻译、语法、上下文等信息 */}
      {showPanel && selectedText && (
        <TranslationPanel
          text={selectedText}
          result={result || undefined}
          isLoading={isLoading}
          error={error}
          onClose={handlePanelClose}
          onSave={async (result) => {
            // 保存到生词本
            const success = await saveWord(result)
            if (success) {
              setSaveSuccess(true)
              // 3 秒后隐藏成功提示
              setTimeout(() => setSaveSuccess(false), 3000)
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
