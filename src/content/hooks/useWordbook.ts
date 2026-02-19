/**
 * 生词本 Hook
 * 
 * 这个自定义 Hook 封装了生词本相关的操作：
 * 1. 保存单词
 * 2. 获取单词列表
 * 3. 删除单词
 * 4. 搜索单词
 * 5. 导出数据
 */

import { useState, useCallback, useEffect } from 'react'
import { WordbookEntry } from '../../services/wordbook'
import { TranslationResult } from '../components/TranslationPanel'

/**
 * 生词本 Hook 的返回值
 */
export interface UseWordbookReturn {
  // 单词列表
  words: WordbookEntry[]
  // 是否正在加载
  isLoading: boolean
  // 错误信息
  error: string | null
  // 保存单词
  saveWord: (result: TranslationResult) => Promise<boolean>
  // 删除单词
  removeWord: (id: string) => Promise<boolean>
  // 搜索单词
  searchWords: (query: string) => Promise<void>
  // 刷新列表
  refresh: () => Promise<void>
  // 导出数据
  exportData: (format: 'json' | 'csv') => Promise<string | null>
}

/**
 * 生词本 Hook
 * 
 * @returns 生词本状态和函数
 */
export function useWordbook(): UseWordbookReturn {
  // 单词列表
  const [words, setWords] = useState<WordbookEntry[]>([])
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  
  // 错误信息
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取生词本列表
   */
  const fetchWords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_WORDBOOK'
      })
      
      if (response?.success) {
        setWords(response.data || [])
      } else {
        throw new Error(response?.error?.message || '获取生词本失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取生词本失败'
      setError(errorMessage)
      console.error('获取生词本错误：', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 保存单词
   */
  const saveWord = useCallback(async (result: TranslationResult): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    
    try {
      // 💡 验证数据完整性：确保 originalText 和 translation 都存在且非空
      // 使用 trim() 去除首尾空白，但保留内部空白（德语等语言可能有空格）
      const trimmedOriginal = result.originalText?.trim() || ''
      const trimmedTranslation = result.translation?.trim() || ''
      
      if (!trimmedOriginal || trimmedOriginal.length === 0) {
        console.error('[Content] 保存失败：originalText 为空', { originalText: result.originalText })
        throw new Error('缺少原始文本（originalText）或文本为空')
      }
      if (!trimmedTranslation || trimmedTranslation.length === 0) {
        console.error('[Content] 保存失败：translation 为空', { translation: result.translation })
        throw new Error('缺少翻译结果（translation）或翻译为空')
      }
      
      // 💡 确保传递给后台的数据已经 trim 处理
      const cleanedResult = {
        ...result,
        originalText: trimmedOriginal,
        translation: trimmedTranslation
      }
      
      console.log('[Content] 准备保存单词：', {
        originalText: result.originalText.substring(0, 50),
        translation: result.translation.substring(0, 50),
        sourceLanguage: result.sourceLanguage,
        hasGrammar: !!result.grammar,
        hasContext: !!result.context
      })
      
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        data: cleanedResult
      }).catch((error) => {
        // 处理 Extension context invalidated 错误
        if (error.message && error.message.includes('Extension context invalidated')) {
          throw new Error('Extension context invalidated. 请刷新页面后重试。')
        }
        throw error
      })
      
      console.log('[Content] 保存响应：', response)
      
      if (!response) {
        throw new Error('未收到响应，请检查插件是否正常运行')
      }
      
      if (response.success) {
        // 刷新列表
        await fetchWords()
        console.log('[Content] 保存成功，已刷新列表')
        return true
      } else {
        throw new Error(response.error?.message || '保存失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存失败'
      setError(errorMessage)
      console.error('[Content] 保存单词错误：', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [fetchWords])

  /**
   * 删除单词
   */
  const removeWord = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REMOVE_WORD',
        id: id
      })
      
      if (response?.success) {
        // 刷新列表
        await fetchWords()
        return true
      } else {
        throw new Error(response?.error?.message || '删除失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除失败'
      setError(errorMessage)
      console.error('删除单词错误：', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [fetchWords])

  /**
   * 搜索单词
   */
  const searchWords = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      // 如果查询为空，显示所有单词
      await fetchWords()
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_WORDS',
        query: query.trim()
      })
      
      if (response?.success) {
        setWords(response.data || [])
      } else {
        throw new Error(response?.error?.message || '搜索失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索失败'
      setError(errorMessage)
      console.error('搜索单词错误：', err)
    } finally {
      setIsLoading(false)
    }
  }, [fetchWords])

  /**
   * 刷新列表
   */
  const refresh = useCallback(async () => {
    await fetchWords()
  }, [fetchWords])

  /**
   * 导出数据
   */
  const exportData = useCallback(async (format: 'json' | 'csv'): Promise<string | null> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_WORDBOOK',
        format: format
      })
      
      if (response?.success) {
        return response.data
      } else {
        throw new Error(response?.error?.message || '导出失败')
      }
    } catch (err) {
      console.error('导出错误：', err)
      return null
    }
  }, [])

  // 组件挂载时获取列表
  // 💡 导师小课堂：useEffect 在组件挂载时执行，确保每次打开插件都能加载最新的生词本数据
  // chrome.storage.local 是持久化存储，数据会一直保存，所以这里读取的是之前保存的所有数据
  useEffect(() => {
    console.log('[useWordbook] 组件挂载，开始加载生词本数据')
    fetchWords()
  }, [fetchWords])

  // 监听存储变化：当其他组件（如 App.tsx）保存单词后，自动刷新列表
  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      console.log('[useWordbook] 存储变化事件：', { areaName, changes: Object.keys(changes) })
      if (areaName === 'local' && changes.context_ai_wordbook) {
        console.log('[useWordbook] 检测到生词本存储变化，自动刷新列表', changes.context_ai_wordbook)
        // 延迟一小段时间确保存储已完全写入
        setTimeout(() => {
          fetchWords()
        }, 100)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    console.log('[useWordbook] 已注册存储变化监听器')
    return () => {
      chrome.storage.onChanged.removeListener(listener)
      console.log('[useWordbook] 已移除存储变化监听器')
    }
  }, [fetchWords])

  return {
    words,
    isLoading,
    error,
    saveWord,
    removeWord,
    searchWords,
    refresh,
    exportData
  }
}
