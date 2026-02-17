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

import { translateTextWithConfig, enhanceTranslationWithConfig, detectTextLanguage, QwenApiError } from '../services/qwenApi'
import { getApiConfig } from '../services/apiConfig'
import { PROVIDER_MAP } from '../config/providers'
import type { ProviderId } from '../config/providers'
import { QWEN_API_BASE_URL, QWEN_API_KEY, QWEN_MODEL } from '../config/api'
import { wordbookService } from '../services/wordbook'
import { preTranslate } from '../services/preTranslate'

// 监听来自 Content Script 的消息
// chrome.runtime.onMessage：Chrome Extension API，用于接收消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // message：发送的消息内容
  // sender：发送消息的上下文信息（如标签页 ID）
  // sendResponse：回调函数，用于回复消息

  // 处理翻译请求（先预翻译再大模型增强，降低等待时间）
  if (message.type === 'TRANSLATE') {
    const tabId = sender.tab?.id
    handleTranslateRequest(message.text, message.sourceLang, tabId, message.targetLang)
      .then((result) => {
        sendResponse({
          success: true,
          data: result
        })
      })
      .catch((error) => {
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
 * 处理翻译请求：先尝试 LibreTranslate 预翻译（即时展示），再用大模型补充语法/语境/音标
 * 类比：Google 翻译等产品用「小模型/规则 + 缓存」先返回，再大模型做质量增强
 */
async function handleTranslateRequest(
  text: string,
  sourceLang?: 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh',
  tabId?: number,
  targetLang: 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' = 'zh'
): Promise<any> {
  // 确定源语言：如果指定了 sourceLang 且不是 'zh'，使用指定的；否则检测
  let detectedLang: 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh'
  if (sourceLang && sourceLang !== 'zh') {
    detectedLang = sourceLang
  } else if (sourceLang === 'zh') {
    detectedLang = 'zh'
  } else {
    detectedLang = detectTextLanguage(text)
  }
  
  const config = await getApiConfig()
  
  // 实际源语言：如果检测到中文，使用中文；否则使用检测到的语言
  const actualSourceLang = detectedLang === 'zh' ? 'zh' : detectedLang

  // 仅预翻译模式：只调 LibreTranslate，不调用大模型，无需 API Key，秒出结果
  if (config.preTranslateOnly) {
    try {
      // 预翻译需要根据目标语言调整
      const preTranslateSourceLang = targetLang !== 'zh' ? 'zh' : detectedLang
      const draft = await preTranslate(text, preTranslateSourceLang, targetLang)
      if (tabId != null) {
        chrome.tabs.sendMessage(tabId, {
          type: 'TRANSLATE_PARTIAL',
          data: {
            translation: draft.translation,
            originalText: text,
            grammar: undefined,
            context: undefined,
            phonetic: undefined,
            pronunciation: undefined
          }
        }).catch(() => {})
      }
      return {
        translation: draft.translation,
        grammar: undefined,
        context: undefined,
        phonetic: undefined,
        pronunciation: undefined,
        originalText: text,
        detectedLang
      }
    } catch (e) {
      throw new QwenApiError(
        '预翻译失败，请检查网络或关闭「仅预翻译」后使用大模型。',
        'PRE_TRANSLATE_FAILED'
      )
    }
  }

  const providerId = config.selectedProvider as ProviderId
  const def = PROVIDER_MAP[providerId]
  const opt = config.providers[providerId]
  let baseUrl = (opt?.baseUrl && opt.baseUrl.trim()) ? opt.baseUrl.trim() : (def?.defaultBaseUrl ?? '')
  let model = (opt?.model && opt.model.trim()) ? opt.model.trim() : (def?.defaultModel ?? '')
  let apiKey = opt?.apiKey?.trim() ?? ''
  if (providerId === 'qwen') {
    if (!apiKey && QWEN_API_KEY) apiKey = QWEN_API_KEY
    if (!baseUrl) baseUrl = QWEN_API_BASE_URL
    if (!model) model = QWEN_MODEL
  }

  if (!apiKey) {
    throw new QwenApiError(
      `未配置「${def?.name ?? providerId}」的 API Key。请点击扩展图标，在 API 设置中填写。`,
      'MISSING_API_KEY'
    )
  }

  const providerConfig = { baseUrl, apiKey, model }

  // 1. 预翻译：LibreTranslate 先出译文（可选）
  let draft: { translation: string } | null = null
  try {
    draft = await preTranslate(text, actualSourceLang, targetLang)
    if (draft && tabId != null) {
      chrome.tabs.sendMessage(tabId, {
        type: 'TRANSLATE_PARTIAL',
        data: {
          translation: draft.translation,
          originalText: text,
          grammar: undefined,
          context: undefined,
          phonetic: undefined,
          pronunciation: undefined
        }
      }).catch(() => {})
    }
  } catch (_) {
    // 预翻译失败则只走大模型
  }

  // 2. 大模型：增强或完整翻译；超时/失败时若有初稿则返回初稿
  let result: any
  try {
    // 如果源语言是中文，enhanceTranslationWithConfig 需要特殊处理（目前只支持外语→中文）
    // 对于中文→其他语言或其他语言之间的翻译，使用完整翻译
    if (actualSourceLang === 'zh' || targetLang !== 'zh') {
      // 中文→其他语言或其他语言之间的翻译，使用完整翻译
      result = await translateTextWithConfig(providerConfig, text, actualSourceLang, targetLang)
    } else {
      // 外语→中文，可以使用预翻译增强
      result = draft
        ? await enhanceTranslationWithConfig(providerConfig, text, actualSourceLang as 'en' | 'de' | 'fr' | 'ja' | 'es', draft.translation)
        : await translateTextWithConfig(providerConfig, text, actualSourceLang as 'en' | 'de' | 'fr' | 'ja' | 'es', targetLang)
    }
  } catch (err) {
    if (draft) {
      result = {
        translation: draft.translation,
        grammar: undefined,
        context: undefined,
        phonetic: undefined,
        pronunciation: undefined
      }
    } else {
      throw err
    }
  }
  return {
    ...result,
    originalText: text,
    detectedLang
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
