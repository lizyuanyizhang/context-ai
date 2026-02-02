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

import React, { useState, useEffect } from 'react'
import { Volume2, VolumeX, Loader2, X } from 'lucide-react'
import { ttsManager, detectLanguage, type SupportedLanguage } from '../../utils/tts'

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
  // 原始文本
  originalText: string
}

interface TranslationPanelProps {
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
  // 关闭面板的回调函数
  onClose: () => void
  // 保存到生词本的回调函数
  onSave?: (result: TranslationResult) => void
}

function TranslationPanel({
  text,
  result,
  isLoading = false,
  error = null,
  saveSuccess = false,
  onClose,
  onSave
}: TranslationPanelProps) {
  // 是否正在播放语音
  const [isPlaying, setIsPlaying] = useState(false)
  
  // 检测到的语言类型
  const [detectedLang, setDetectedLang] = useState<SupportedLanguage>('en')

  // 组件挂载时检测语言
  useEffect(() => {
    const lang = detectLanguage(text)
    setDetectedLang(lang)
  }, [text])

  /**
   * 处理语音朗读按钮点击（朗读原文）
   * 
   * 这个函数用于朗读原始选中的文本
   */
  const handleSpeakOriginal = () => {
    // 朗读原文，使用检测到的语言
    setIsPlaying(true)
    
    ttsManager.speak(
      text,
      detectedLang,
      // 播放结束回调
      () => {
        setIsPlaying(false)
      },
      // 播放错误回调
      (error) => {
        console.error('语音播放失败：', error)
        setIsPlaying(false)
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
   * 注意：为了保持一致性，如果原文和翻译是同一语言，
   * 我们会使用相同的语言设置，确保使用同一个语音引擎
   */
  const handleSpeakTranslation = () => {
    if (!result || !result.translation) {
      return
    }
    
    // 检测翻译结果的语言
    const translationLang = detectLanguage(result.translation)
    
    // 为了保持一致性，如果原文和翻译是同一语言，使用相同的语言设置
    // 这样可以确保使用同一个语音引擎，声音一致
    // 如果翻译是中文，使用中文语音；否则使用检测到的语言
    const langToUse: SupportedLanguage = translationLang === 'zh' ? 'zh' : detectedLang
    
    // 开始播放
    setIsPlaying(true)
    
    ttsManager.speak(
      result.translation,
      langToUse, // 使用统一的语言设置，确保语音一致
      // 播放结束回调
      () => {
        setIsPlaying(false)
      },
      // 播放错误回调
      (error) => {
        console.error('语音播放失败：', error)
        setIsPlaying(false)
        
        // 如果是中文不支持的错误，提供更友好的提示
        if (error.message.includes('不支持中文语音')) {
          alert('系统不支持中文语音。\n\n解决方案：\n1. macOS: 系统偏好设置 → 辅助功能 → 朗读内容 → 管理语音\n2. Windows: 设置 → 时间和语言 → 语音 → 管理语音\n3. 或使用原文的语音朗读功能')
        } else {
          alert(`语音播放失败：${error.message}\n请检查浏览器设置或系统语音配置`)
        }
      }
    )
  }

  /**
   * 处理停止播放
   */
  const handleStop = () => {
    ttsManager.stop()
    setIsPlaying(false)
  }

  /**
   * 处理保存到生词本
   */
  const handleSave = () => {
    if (result && onSave) {
      onSave(result)
      // 可以显示成功提示
      alert('已保存到生词本！')
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[1000001]"
      style={{
        // 苹果风格遮罩：使用更柔和的绿色调，营造森林感
        background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.3) 0%, rgba(107, 159, 120, 0.2) 100%)',
        // 添加平滑的过渡动画，避免闪动
        animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        // 使用更强的毛玻璃效果（苹果风格）
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        // 确保遮罩层不会阻止点击关闭
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        // 点击遮罩层时关闭面板
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="glass-effect rounded-3xl p-5 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          // 添加面板出现的动画（苹果风格：缩放+滑入）
          animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          // 阻止点击事件冒泡到遮罩层
          pointerEvents: 'auto',
          // 滚动条样式（苹果风格）
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(107, 159, 120, 0.3) transparent'
        }}
        onClick={(e) => {
          // 阻止点击面板内容时关闭
          e.stopPropagation()
        }}
      >
        {/* 头部：标题和关闭按钮（苹果风格） */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--forest-dark)' }}>
            翻译结果
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--apple-text-secondary)' }}
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 原始文本区域（森林风格卡片） */}
        <div className="forest-card mb-4 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--forest-medium)' }}>
                选中的文字
              </p>
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--apple-text)' }}>
                {text}
              </p>
              {/* 音标显示在原文下面（小字） */}
              {result?.phonetic && (
                <p className="text-xs mt-0.5 mb-1.5 font-mono" style={{ color: 'var(--forest-medium)', opacity: 0.8 }}>
                  /{result.phonetic}/
                </p>
              )}
              {/* 显示检测到的语言 */}
              <p className="text-xs mt-1.5" style={{ color: 'var(--apple-text-secondary)' }}>
                检测语言：{
                  detectedLang === 'en' ? '英语' :
                  detectedLang === 'de' ? '德语' :
                  detectedLang === 'fr' ? '法语' :
                  detectedLang === 'ja' ? '日语' :
                  detectedLang === 'es' ? '西班牙语' :
                  '中文'
                }
              </p>
            </div>
            {/* 语音朗读按钮：朗读原文（苹果风格） */}
            <button
              onClick={isPlaying ? handleStop : handleSpeakOriginal}
              className="ml-3 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0"
              style={{
                background: isPlaying 
                  ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)'
                  : 'linear-gradient(135deg, var(--forest-accent) 0%, var(--forest-accent-hover) 100%)',
                boxShadow: '0 4px 12px rgba(52, 199, 89, 0.3)'
              }}
              aria-label={isPlaying ? '停止播放' : '播放原文语音'}
              title={isPlaying ? '停止播放' : '播放原文语音'}
            >
              {isPlaying ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* 加载状态（苹果风格） */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--forest-accent)' }} />
              <div className="absolute inset-0 w-7 h-7 border-2 border-transparent border-t-current rounded-full animate-spin opacity-50"></div>
            </div>
            <span className="mt-3 text-xs font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
              正在翻译...
            </span>
          </div>
        )}

        {/* 错误状态（苹果风格） */}
        {error && !isLoading && (
          <div className="forest-card p-4 rounded-2xl border-l-4" style={{ borderLeftColor: '#ff6b6b' }}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-500 text-base">⚠️</span>
              </div>
              <div className="ml-2.5 flex-1">
                <h3 className="text-xs font-medium text-red-800 mb-1">
                  翻译失败
                </h3>
                <p className="text-xs text-red-700">{error}</p>
                {error.includes('API Key') && (
                  <p className="text-xs text-red-600 mt-2">
                    提示：请在 .env 文件中设置 VITE_QWEN_API_KEY
                  </p>
                )}
                {error.includes('Extension context invalidated') && (
                  <div className="text-xs text-red-600 mt-2 space-y-1">
                    <p>这个错误通常发生在：</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Background Service Worker 被浏览器暂停</li>
                      <li>插件被重新加载</li>
                      <li>页面长时间未使用</li>
                    </ul>
                    <p className="mt-2 font-medium">解决方案：</p>
                    <ol className="list-decimal list-inside ml-2">
                      <li>刷新页面（推荐）</li>
                      <li>或重新加载插件（chrome://extensions/）</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => {
                  // 刷新页面
                  window.location.reload()
                }}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors"
              >
                刷新页面
              </button>
              {error.includes('Extension context invalidated') && (
                <button
                  onClick={() => {
                    // 打开扩展管理页面
                    chrome.runtime.sendMessage({ type: 'OPEN_EXTENSIONS_PAGE' }).catch(() => {
                      // 如果消息失败，直接打开
                      window.open('chrome://extensions/', '_blank')
                    })
                  }}
                  className="px-3 py-1.5 border border-red-300 hover:bg-red-100 text-red-700 rounded-lg text-xs transition-colors"
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
            {/* 翻译结果（森林风格卡片） */}
            <div className="forest-card p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(107, 159, 120, 0.1) 0%, rgba(143, 185, 159, 0.05) 100%)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--forest-medium)' }}>
                    翻译
                  </p>
                  <p className="text-base font-semibold mb-2 leading-relaxed" style={{ color: 'var(--apple-text)' }}>
                    {result.translation}
                  </p>
                  {/* 读音助记显示在翻译下面 */}
                  {result.pronunciation && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(107, 159, 120, 0.15)' }}>
                      <p className="text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: 'var(--forest-medium)' }}>
                        🔊 Pronunciation Guide
                      </p>
                      <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--apple-text-secondary)' }}>
                        {result.pronunciation}
                      </p>
                    </div>
                  )}
                </div>
                {/* 语音朗读按钮：朗读翻译结果（苹果风格） */}
                <button
                  onClick={isPlaying ? handleStop : handleSpeakTranslation}
                  className="ml-3 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0"
                  style={{
                    background: isPlaying 
                      ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)'
                      : 'linear-gradient(135deg, var(--forest-accent) 0%, var(--forest-accent-hover) 100%)',
                    boxShadow: '0 4px 12px rgba(52, 199, 89, 0.3)'
                  }}
                  aria-label={isPlaying ? '停止播放' : '播放翻译语音'}
                  title={isPlaying ? '停止播放' : '播放翻译语音'}
                >
                  {isPlaying ? (
                    <VolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* 语法点拨（森林风格卡片） */}
            {result.grammar && (
              <div className="forest-card p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.08) 0%, rgba(107, 159, 120, 0.05) 100%)' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52, 199, 89, 0.15)' }}>
                    <span className="text-base">💡</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--forest-medium)' }}>
                      语法点拨
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--apple-text)' }}>
                      {result.grammar}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 上下文语境（森林风格卡片） */}
            {result.context && (
              <div className="forest-card p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(74, 124, 89, 0.08) 0%, rgba(107, 159, 120, 0.05) 100%)' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(74, 124, 89, 0.15)' }}>
                    <span className="text-base">🌿</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--forest-medium)' }}>
                      上下文语境
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--apple-text)' }}>
                      {result.context}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮区域（苹果风格） */}
            <div className="space-y-2 pt-4 mt-4" style={{ borderTop: '1px solid rgba(107, 159, 120, 0.2)' }}>
              {/* 保存成功提示（苹果风格） */}
              {saveSuccess && (
                <div className="forest-card p-2.5 rounded-xl text-xs flex items-center gap-2" style={{ background: 'rgba(52, 199, 89, 0.1)' }}>
                  <span className="text-base">✅</span>
                  <span style={{ color: 'var(--forest-medium)', fontWeight: 500 }}>
                    已保存到生词本！
                  </span>
                </div>
              )}
              
              <div className="flex gap-2.5">
                <button
                  onClick={handleSave}
                  disabled={saveSuccess}
                  className="flex-1 apple-button text-white px-5 py-2.5 rounded-xl font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveSuccess ? '✅ 已保存' : '📚 保存到生词本'}
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-medium text-xs transition-all duration-200"
                  style={{
                    border: '1px solid rgba(107, 159, 120, 0.3)',
                    color: 'var(--forest-medium)',
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 159, 120, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 如果没有结果且不在加载中，显示占位内容 */}
        {!result && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <p>等待翻译结果...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TranslationPanel
