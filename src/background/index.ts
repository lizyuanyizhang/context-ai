/**
 * Background Service Worker 入口文件
 * 
 * Background Script（在 Manifest V3 中称为 Service Worker）的作用：
 * 1. 处理插件的后台逻辑（如 API 调用、数据存储）
 * 2. 监听浏览器事件（如标签页切换、插件图标点击）
 * 3. 作为 Content Script 和 Popup 之间的通信桥梁
 * 
 * Service Worker 的特点：
 * - 生命周期短暂：不活跃时会被浏览器暂停，节省资源
 * - 不能直接访问 DOM：需要通过消息传递与 Content Script 通信
 * - 可以访问 Chrome APIs：如 storage、tabs、alarms 等
 * 
 * 为什么在 Background Script 中调用 API？
 * - Content Script 运行在网页环境中，可能受到 CORS 限制
 * - Background Script 有更高的权限，可以访问所有网站
 * - 集中管理 API 调用，便于错误处理和重试
 */

import { translateText, detectTextLanguage, QwenApiError } from '../services/qwenApi'
import { wordbookService } from '../services/wordbook'

// 监听来自 Content Script 的消息
// chrome.runtime.onMessage：Chrome Extension API，用于接收消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // message：发送的消息内容
  // sender：发送消息的上下文信息（如标签页 ID）
  // sendResponse：回调函数，用于回复消息

  // 处理翻译请求
  if (message.type === 'TRANSLATE') {
    // 异步处理：调用通义千问 API
    // 注意：异步操作必须返回 true，表示会异步调用 sendResponse
    handleTranslateRequest(message.text, message.sourceLang)
      .then((result) => {
        // 成功：返回翻译结果
        sendResponse({
          success: true,
          data: result
        })
      })
      .catch((error) => {
        // 失败：返回错误信息
        console.error('翻译失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof QwenApiError 
              ? error.message 
              : '翻译失败，请稍后重试',
            code: error instanceof QwenApiError ? error.code : 'UNKNOWN_ERROR'
          }
        })
      })
    
    // 返回 true 表示会异步调用 sendResponse
    // 这是 Chrome Extension 消息传递的要求
    return true
  }

  // 处理保存生词本请求
  if (message.type === 'SAVE_WORD') {
    // 异步处理：保存到 chrome.storage.local
    // 添加调试日志
    console.log('[Background] 收到保存生词本请求：', message.data)
    
    wordbookService.addWord(message.data)
      .then((entry) => {
        // 成功：返回保存的条目
        console.log('[Background] 保存成功：', entry)
        sendResponse({
          success: true,
          data: entry
        })
      })
      .catch((error) => {
        // 失败：返回错误信息
        console.error('[Background] 保存生词本失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '保存失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 处理获取生词本列表请求
  if (message.type === 'GET_WORDBOOK') {
    wordbookService.getAllWords()
      .then((words) => {
        sendResponse({
          success: true,
          data: words
        })
      })
      .catch((error) => {
        console.error('获取生词本失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '获取失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 处理删除单词请求
  if (message.type === 'REMOVE_WORD') {
    wordbookService.removeWord(message.id)
      .then(() => {
        sendResponse({
          success: true
        })
      })
      .catch((error) => {
        console.error('删除单词失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '删除失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 处理搜索单词请求
  if (message.type === 'SEARCH_WORDS') {
    wordbookService.searchWords(message.query)
      .then((words) => {
        sendResponse({
          success: true,
          data: words
        })
      })
      .catch((error) => {
        console.error('搜索单词失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '搜索失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 处理导出请求
  if (message.type === 'EXPORT_WORDBOOK') {
    const format = message.format || 'json' // 'json' 或 'csv'
    
    const exportPromise = format === 'csv'
      ? wordbookService.exportToCSV()
      : wordbookService.exportToJSON()
    
    exportPromise
      .then((data) => {
        sendResponse({
          success: true,
          data: data,
          format: format
        })
      })
      .catch((error) => {
        console.error('导出失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '导出失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 处理更新学习状态请求（闪卡模式）
  if (message.type === 'UPDATE_STUDY_STATUS') {
    const { id, status, isCorrect } = message
    
    wordbookService.updateStudyStatus(id, status, isCorrect)
      .then(() => {
        sendResponse({
          success: true
        })
      })
      .catch((error) => {
        console.error('更新学习状态失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '更新失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 处理获取需要复习的单词请求
  if (message.type === 'GET_WORDS_TO_REVIEW') {
    wordbookService.getWordsToReview()
      .then((words) => {
        sendResponse({
          success: true,
          data: words
        })
      })
      .catch((error) => {
        console.error('获取复习单词失败：', error)
        sendResponse({
          success: false,
          error: {
            message: error instanceof Error ? error.message : '获取失败，请稍后重试'
          }
        })
      })
    
    return true
  }

  // 如果没有匹配的消息类型，返回 false 表示不处理
  return false
})

/**
 * 处理翻译请求
 * 
 * @param text - 要翻译的文本
 * @param sourceLang - 源语言（可选，如果不提供会自动检测）
 * @returns 翻译结果
 */
async function handleTranslateRequest(
  text: string,
  sourceLang?: 'en' | 'de' | 'fr' | 'ja' | 'es'
): Promise<any> {
  // 如果没有指定源语言，自动检测
  const detectedLang = sourceLang || detectTextLanguage(text)
  
  // 调用翻译 API
  const result = await translateText(text, detectedLang)
  
  // 添加原始文本和检测到的语言
  return {
    ...result,
    originalText: text,
    detectedLang: detectedLang
  }
}

// 监听插件安装事件
chrome.runtime.onInstalled.addListener((details) => {
  // details.reason：安装原因
  // 'install'：首次安装
  // 'update'：更新插件
  // 'chrome_update'：Chrome 浏览器更新
  if (details.reason === 'install') {
    console.log('Context AI 插件已安装！')
    // 可以在这里初始化默认数据，如生词本结构
  } else if (details.reason === 'update') {
    console.log('Context AI 插件已更新！')
  }
})

// 保持 Service Worker 活跃
// 防止被浏览器暂停导致 Extension context invalidated 错误
// 每 20 秒发送一次心跳，保持连接活跃
setInterval(() => {
  // 简单的操作来保持 Service Worker 活跃
  chrome.storage.local.get(['context_ai_heartbeat'], () => {
    chrome.storage.local.set({ 
      context_ai_heartbeat: Date.now() 
    })
  })
}, 20000) // 20 秒
