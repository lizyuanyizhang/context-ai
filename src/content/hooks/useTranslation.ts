/**
 * 翻译 Hook
 * 
 * 这个自定义 Hook 封装了翻译相关的逻辑：
 * 1. 调用 Background Script 进行翻译
 * 2. 管理加载状态
 * 3. 处理错误
 * 4. 缓存翻译结果（可选）
 */

import { useState, useCallback, useRef } from 'react'
import { TranslationResult } from '../components/TranslationPanel'

/**
 * 翻译 Hook 的返回值
 */
export interface UseTranslationReturn {
  // 翻译结果
  result: TranslationResult | null
  // 是否正在加载
  isLoading: boolean
  // 错误信息
  error: string | null
  // 执行翻译
  translate: (text: string, sourceLang?: 'en' | 'de' | 'fr' | 'ja' | 'es') => Promise<void>
  // 清除结果和错误
  clear: () => void
}

/**
 * 翻译 Hook
 * 
 * @returns 翻译状态和函数
 */
export function useTranslation(): UseTranslationReturn {
  // 翻译结果
  const [result, setResult] = useState<TranslationResult | null>(null)
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  
  // 错误信息
  const [error, setError] = useState<string | null>(null)
  
  // 当前请求的引用（用于取消请求）
  // 添加 requestId 确保每次请求都是唯一的
  const currentRequestRef = useRef<{ text: string; requestId: string } | null>(null)

  /**
   * 执行翻译
   * 
   * @param text - 要翻译的文本
   * @param sourceLang - 源语言（可选）
   */
  const translate = useCallback(async (text: string, sourceLang?: 'en' | 'de' | 'fr' | 'ja' | 'es') => {
    // 如果文本为空，直接返回
    if (!text || text.trim().length === 0) {
      setError('翻译文本不能为空')
      return
    }
    
    // 保存当前请求（用于检查是否被取消）
    // 使用时间戳确保每次请求都是唯一的
    const requestId = `${text.trim()}-${Date.now()}`
    currentRequestRef.current = { text, requestId }
    
    // 立即清除之前的结果和错误（确保显示新的加载状态）
    setResult(null)
    setError(null)
    
    // 设置加载状态
    setIsLoading(true)
    
    try {
      // 检查 chrome.runtime 是否可用
      // Extension context invalidated 错误通常发生在 Background Script 被重新加载后
      if (!chrome.runtime || !chrome.runtime.id) {
        throw new Error('Extension context invalidated. 请刷新页面后重试。')
      }
      
      // 发送消息到 Background Script
      // chrome.runtime.sendMessage：Chrome Extension API，用于发送消息
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        text: text.trim(),
        sourceLang: sourceLang
      }).catch((error) => {
        // 处理 chrome.runtime.sendMessage 的错误
        // Extension context invalidated 是常见错误
        if (error.message && error.message.includes('Extension context invalidated')) {
          throw new Error('Extension context invalidated. 请刷新页面后重试。')
        }
        // 检查是否是连接错误
        if (chrome.runtime.lastError) {
          const lastError = chrome.runtime.lastError.message || ''
          if (lastError.includes('Extension context invalidated') || 
              lastError.includes('message port closed')) {
            throw new Error('Extension context invalidated. 请刷新页面后重试。')
          }
          throw new Error(`连接失败：${lastError}`)
        }
        throw error
      })
      
      // 检查请求是否被取消（用户可能选择了新的文字）
      // 使用 requestId 确保是同一个请求
      if (!currentRequestRef.current || 
          currentRequestRef.current.text !== text.trim() ||
          currentRequestRef.current.requestId !== requestId) {
        console.log('[Translation] 请求已被取消或已过期，忽略响应')
        return // 请求已被取消，不更新状态
      }
      
      // 检查响应
      if (!response) {
        // 检查是否有 lastError
        if (chrome.runtime.lastError) {
          const lastError = chrome.runtime.lastError.message || ''
          if (lastError.includes('Extension context invalidated')) {
            throw new Error('Extension context invalidated. 请刷新页面后重试。')
          }
          throw new Error(`未收到响应：${lastError}`)
        }
        throw new Error('未收到响应，请检查插件是否正常运行。请尝试刷新页面。')
      }
      
      if (response.success) {
        // 成功：保存翻译结果
        setResult({
          translation: response.data.translation,
          grammar: response.data.grammar,
          context: response.data.context,
          phonetic: response.data.phonetic,
          pronunciation: response.data.pronunciation,
          originalText: response.data.originalText || text
        })
      } else {
        // 失败：显示错误信息
        throw new Error(response.error?.message || '翻译失败')
      }
    } catch (err) {
      // 检查请求是否被取消
      if (!currentRequestRef.current || 
          currentRequestRef.current.text !== text.trim() ||
          currentRequestRef.current.requestId !== requestId) {
        console.log('[Translation] 请求已被取消，不更新错误状态')
        return // 请求已被取消，不更新错误状态
      }
      
      // 处理错误
      let errorMessage = '翻译失败，请稍后重试'
      
      if (err instanceof Error) {
        errorMessage = err.message
        // 特殊处理 Extension context invalidated 错误
        if (err.message.includes('Extension context invalidated')) {
          errorMessage = 'Extension context invalidated. 请刷新页面后重试。'
        }
      }
      
      setError(errorMessage)
      console.error('[Translation] 翻译错误：', err)
      
      // 如果是 Extension context invalidated 错误，提供更多帮助信息
      if (errorMessage.includes('Extension context invalidated')) {
        console.warn('[Context AI] Extension context invalidated. 这通常发生在：')
        console.warn('1. Background Service Worker 被浏览器暂停')
        console.warn('2. 插件被重新加载')
        console.warn('3. 页面长时间未使用')
        console.warn('解决方案：刷新页面或重新加载插件')
      }
    } finally {
      // 清除加载状态（如果请求未被取消）
      if (currentRequestRef.current?.text === text.trim() &&
          currentRequestRef.current?.requestId === requestId) {
        setIsLoading(false)
      }
    }
  }, [])

  /**
   * 清除结果和错误
   */
  const clear = useCallback(() => {
    setResult(null)
    setError(null)
    setIsLoading(false)
    currentRequestRef.current = null
  }, [])

  return {
    result,
    isLoading,
    error,
    translate,
    clear
  }
}
