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
      // 验证数据完整性
      if (!result.originalText) {
        throw new Error('缺少原始文本（originalText）')
      }
      if (!result.translation) {
        throw new Error('缺少翻译结果（translation）')
      }
      
      console.log('[Content] 准备保存单词：', result)
      
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        data: result
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
  useEffect(() => {
    fetchWords()
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
