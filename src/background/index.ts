/**
 * Background Service Worker
 * 负责处理翻译与生词本相关的消息，并充当内容脚本与服务之间的桥梁
 */

import { translateTextWithConfig, enhanceTranslationWithConfig, detectTextLanguage, QwenApiError, type ProviderConfig } from '../services/qwenApi'
import { getApiConfig } from '../services/apiConfig'
import { PROVIDER_MAP, type ProviderId } from '../config/providers'
import { wordbookService } from '../services/wordbook'
import { preTranslate } from '../services/preTranslate'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 翻译主流程：支持预翻译（可选）+ 大模型增强
  if (message.type === 'TRANSLATE') {
    const { text, sourceLang, targetLang = 'zh' } = message as { text: string; sourceLang?: 'en'|'de'|'fr'|'ja'|'es'|'zh'; targetLang?: 'en'|'de'|'fr'|'es'|'ja'|'zh' }
    const tabId = sender.tab?.id
    ;(async () => {
      try {
        const config = await getApiConfig()
        const providerDef = PROVIDER_MAP[config.selectedProvider as ProviderId]
        const opt = (config.providers?.[config.selectedProvider as ProviderId]) || { apiKey: '', baseUrl: '', model: '' }
        const providerConfig: ProviderConfig = {
          baseUrl: (opt.baseUrl && opt.baseUrl.trim()) || providerDef.defaultBaseUrl,
          apiKey: opt.apiKey || '',
          model: (opt.model && opt.model.trim()) || providerDef.defaultModel
        }

        // 决定源语言：优先 message.sourceLang，否则快速检测
        const detected = sourceLang ?? detectTextLanguage(text)
        const actualSource = detected

        // 预翻译：可选（用于秒级反馈）
        if (tabId && !config.preTranslateOnly) {
          try {
            const draft = await preTranslate(text, actualSource, targetLang)
            chrome.tabs.sendMessage(tabId, {
              type: 'TRANSLATE_PARTIAL',
              data: { translation: draft.translation, originalText: text }
            })
          } catch { /* 忽略预翻译失败，继续走大模型 */ }
        }

        // 主翻译
        const result = await translateTextWithConfig(providerConfig, text, actualSource, targetLang)
        const finalResult = {
          ...result,
          originalText: text,
          detectedLang: actualSource,
          targetLanguage: targetLang
        }
        sendResponse({ success: true, data: finalResult })
      } catch (error) {
        const msg = error instanceof QwenApiError ? error.message : (error instanceof Error ? error.message : '翻译失败，请稍后重试')
        sendResponse({ success: false, error: { message: msg } })
      }
    })()
    return true
  }

  // 生词本：保存
  if (message.type === 'SAVE_WORD') {
    wordbookService.addWord(message.data)
      .then(entry => sendResponse({ success: true, data: entry }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '保存失败' } }))
    return true
  }

  // 生词本：获取
  if (message.type === 'GET_WORDBOOK') {
    wordbookService.getAllWords()
      .then(words => sendResponse({ success: true, data: words }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '获取失败' } }))
    return true
  }

  // 生词本：搜索
  if (message.type === 'SEARCH_WORDS') {
    wordbookService.searchWords(message.query)
      .then(words => sendResponse({ success: true, data: words }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '搜索失败' } }))
    return true
  }

  // 生词本：删除
  if (message.type === 'REMOVE_WORD') {
    wordbookService.removeWord(message.id)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '删除失败' } }))
    return true
  }

  // 生词本：导出
  if (message.type === 'EXPORT_WORDBOOK') {
    const format = message.format === 'csv' ? 'csv' : 'json'
    const task = format === 'csv' ? wordbookService.exportToCSV() : wordbookService.exportToJSON()
    task
      .then(data => sendResponse({ success: true, data, format }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '导出失败' } }))
    return true
  }

  // 生词本：更新学习状态（闪卡）
  if (message.type === 'UPDATE_STUDY_STATUS') {
    wordbookService.updateStudyStatus(message.id, message.rating)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '更新失败' } }))
    return true
  }

  // 生词本：获取需要复习的词
  if (message.type === 'GET_WORDS_TO_REVIEW') {
    wordbookService.getWordsToReview()
      .then(words => sendResponse({ success: true, data: words }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '获取失败' } }))
    return true
  }

  // 生词本：更新查看时间/次数（曝光记一次）
  if (message.type === 'UPDATE_VIEW_TIME') {
    wordbookService.updateViewTime(message.id)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: { message: err instanceof Error ? err.message : '更新失败' } }))
    return true
  }

  return false
})
