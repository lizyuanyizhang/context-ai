/**
 * 生词本存储服务
 * 
 * 这个服务类封装了生词本的所有数据操作：
 * 1. 保存单词到生词本
 * 2. 读取生词本列表
 * 3. 删除单词
 * 4. 搜索单词
 * 5. 导出数据
 * 
 * 使用 chrome.storage.local 存储数据：
 * - 容量限制：约 10MB（足够存储大量单词）
 * - 数据持久化：即使浏览器关闭也不会丢失
 * - 异步操作：所有操作都是异步的，不会阻塞 UI
 */

import { TranslationResult } from '../content/components/TranslationPanel'

/**
 * 单词掌握状态
 * - 'new': 新单词，未学习
 * - 'learning': 学习中
 * - 'mastered': 已掌握
 */
export type MasteryStatus = 'new' | 'learning' | 'mastered'

/**
 * 生词本条目数据结构
 * 扩展 TranslationResult，添加时间戳和 ID
 */
export interface WordbookEntry extends TranslationResult {
  // 唯一标识符
  id: string
  // 创建时间（时间戳，毫秒）
  createdAt: number
  // 最后查看时间（时间戳，毫秒）
  lastViewedAt: number
  // 查看次数
  viewCount: number
  // 标签（可选，用于分类）
  tags?: string[]
  // 学习相关字段（闪卡模式）
  // 掌握状态
  masteryStatus?: MasteryStatus
  // 学习次数（在闪卡模式中学习的次数）
  studyCount?: number
  // 正确次数（在闪卡模式中回答正确的次数）
  correctCount?: number
  // 下次复习时间（时间戳，毫秒）
  nextReviewAt?: number
  // 最后学习时间（时间戳，毫秒）
  lastStudiedAt?: number
}

/**
 * 生词本数据存储结构
 */
interface WordbookStorage {
  // 单词列表
  words: WordbookEntry[]
  // 版本号（用于数据迁移）
  version: number
  // 创建时间
  createdAt: number
  // 最后更新时间
  updatedAt: number
}

/**
 * 存储键名
 */
const STORAGE_KEY = 'context_ai_wordbook'

/**
 * 默认存储结构
 */
const DEFAULT_STORAGE: WordbookStorage = {
  words: [],
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now()
}

/**
 * 生词本服务类
 */
class WordbookService {
  /**
   * 获取生词本数据
   * 
   * @returns 生词本数据
   */
  async getWordbook(): Promise<WordbookStorage> {
    return new Promise((resolve, reject) => {
      // chrome.storage.local.get：异步获取存储的数据
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        // 检查是否有错误
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        
        // 如果没有数据，返回默认结构
        const data = result[STORAGE_KEY] as WordbookStorage | undefined
        resolve(data || DEFAULT_STORAGE)
      })
    })
  }

  /**
   * 保存生词本数据
   * 
   * @param storage - 要保存的数据
   */
  async saveWordbook(storage: WordbookStorage): Promise<void> {
    return new Promise((resolve, reject) => {
      // 更新更新时间
      storage.updatedAt = Date.now()
      
      // chrome.storage.local.set：异步保存数据
      chrome.storage.local.set({ [STORAGE_KEY]: storage }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      })
    })
  }

  /**
   * 添加单词到生词本
   * 
   * @param translationResult - 翻译结果
   * @returns 创建的条目
   */
  async addWord(translationResult: TranslationResult): Promise<WordbookEntry> {
    // 获取当前生词本
    const storage = await this.getWordbook()
    
    // 检查是否已存在（基于原始文本）
    const existingIndex = storage.words.findIndex(
      word => word.originalText.toLowerCase() === translationResult.originalText.toLowerCase()
    )
    
    if (existingIndex !== -1) {
      // 如果已存在，更新查看时间和次数
      const existing = storage.words[existingIndex]
      existing.lastViewedAt = Date.now()
      existing.viewCount += 1
      
      // 更新翻译结果（可能用户重新翻译了）
      Object.assign(existing, translationResult)
      
      // 保存
      await this.saveWordbook(storage)
      
      return existing
    }
    
    // 创建新条目
    // 确保 originalText 存在，如果不存在则使用 translation 作为备用
    const newEntry: WordbookEntry = {
      ...translationResult,
      originalText: translationResult.originalText || translationResult.translation || '',
      id: this.generateId(), // 生成唯一 ID
      createdAt: Date.now(),
      lastViewedAt: Date.now(),
      viewCount: 1,
      tags: []
    }
    
    // 验证必需字段
    if (!newEntry.originalText || !newEntry.translation) {
      throw new Error('翻译结果缺少必需字段：originalText 或 translation')
    }
    
    // 添加到列表（最新的在前面）
    storage.words.unshift(newEntry)
    
    // 保存
    await this.saveWordbook(storage)
    
    return newEntry
  }

  /**
   * 删除单词
   * 
   * @param id - 单词 ID
   */
  async removeWord(id: string): Promise<void> {
    const storage = await this.getWordbook()
    
    // 过滤掉要删除的单词
    storage.words = storage.words.filter(word => word.id !== id)
    
    // 保存
    await this.saveWordbook(storage)
  }

  /**
   * 批量删除单词
   * 
   * @param ids - 单词 ID 数组
   */
  async removeWords(ids: string[]): Promise<void> {
    const storage = await this.getWordbook()
    
    // 过滤掉要删除的单词
    storage.words = storage.words.filter(word => !ids.includes(word.id))
    
    // 保存
    await this.saveWordbook(storage)
  }

  /**
   * 获取所有单词
   * 
   * @returns 单词列表
   */
  async getAllWords(): Promise<WordbookEntry[]> {
    const storage = await this.getWordbook()
    return storage.words
  }

  /**
   * 搜索单词
   * 
   * @param query - 搜索关键词
   * @returns 匹配的单词列表
   */
  async searchWords(query: string): Promise<WordbookEntry[]> {
    const words = await this.getAllWords()
    const lowerQuery = query.toLowerCase()
    
    // 搜索原始文本、翻译结果、语法、上下文
    return words.filter(word => {
      return (
        word.originalText.toLowerCase().includes(lowerQuery) ||
        word.translation.toLowerCase().includes(lowerQuery) ||
        word.grammar?.toLowerCase().includes(lowerQuery) ||
        word.context?.toLowerCase().includes(lowerQuery)
      )
    })
  }

  /**
   * 更新单词查看时间
   * 
   * @param id - 单词 ID
   */
  async updateViewTime(id: string): Promise<void> {
    const storage = await this.getWordbook()
    const word = storage.words.find(w => w.id === id)
    
    if (word) {
      word.lastViewedAt = Date.now()
      word.viewCount += 1
      await this.saveWordbook(storage)
    }
  }

  /**
   * 清空生词本
   */
  async clearAll(): Promise<void> {
    await this.saveWordbook(DEFAULT_STORAGE)
  }

  /**
   * 导出为 JSON
   * 
   * @returns JSON 字符串
   */
  async exportToJSON(): Promise<string> {
    const storage = await this.getWordbook()
    return JSON.stringify(storage, null, 2)
  }

  /**
   * 导出为 CSV
   * 
   * @returns CSV 字符串
   */
  async exportToCSV(): Promise<string> {
    const words = await this.getAllWords()
    
    // CSV 表头
    const headers = ['原始文本', '翻译', '语法', '上下文', '音标', '读音助记', '创建时间', '查看次数']
    
    // CSV 行数据
    const rows = words.map(word => {
      return [
        this.escapeCSV(word.originalText),
        this.escapeCSV(word.translation),
        this.escapeCSV(word.grammar || ''),
        this.escapeCSV(word.context || ''),
        this.escapeCSV(word.phonetic || ''),
        this.escapeCSV(word.pronunciation || ''),
        new Date(word.createdAt).toLocaleString('zh-CN'),
        word.viewCount.toString()
      ]
    })
    
    // 组合 CSV
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ]
    
    return csvLines.join('\n')
  }

  /**
   * 转义 CSV 字段（处理逗号、引号、换行符）
   * 
   * @param field - 字段值
   * @returns 转义后的字段
   */
  private escapeCSV(field: string): string {
    // 如果包含逗号、引号或换行符，需要用引号包裹
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      // 转义引号：将 " 替换为 ""
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  /**
   * 生成唯一 ID
   * 
   * @returns 唯一 ID 字符串
   */
  private generateId(): string {
    // 使用时间戳 + 随机数生成唯一 ID
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 更新单词学习状态
   * 
   * @param id - 单词 ID
   * @param status - 掌握状态
   * @param isCorrect - 是否回答正确
   */
  async updateStudyStatus(
    id: string, 
    status: MasteryStatus, 
    isCorrect: boolean
  ): Promise<void> {
    const storage = await this.getWordbook()
    const word = storage.words.find(w => w.id === id)
    
    if (word) {
      // 更新学习状态
      word.masteryStatus = status
      word.lastStudiedAt = Date.now()
      word.studyCount = (word.studyCount || 0) + 1
      
      // 如果回答正确，增加正确次数
      if (isCorrect) {
        word.correctCount = (word.correctCount || 0) + 1
      }
      
      // 根据掌握状态和正确率设置下次复习时间
      // 使用简单的间隔复习算法：1天、3天、7天、14天、30天
      const intervals = [1, 3, 7, 14, 30] // 天数
      const correctRate = word.correctCount && word.studyCount 
        ? word.correctCount / word.studyCount 
        : 0
      
      // 根据正确率选择复习间隔
      let intervalIndex = 0
      if (correctRate >= 0.8) {
        intervalIndex = Math.min(4, Math.floor(correctRate * 5))
      } else if (correctRate >= 0.6) {
        intervalIndex = 2
      } else if (correctRate >= 0.4) {
        intervalIndex = 1
      }
      
      // 如果已掌握，设置较长的复习间隔
      if (status === 'mastered') {
        intervalIndex = 4 // 30天
      }
      
      const intervalDays = intervals[intervalIndex]
      word.nextReviewAt = Date.now() + intervalDays * 24 * 60 * 60 * 1000
      
      // 保存
      await this.saveWordbook(storage)
    }
  }

  /**
   * 获取需要复习的单词
   * 
   * @returns 需要复习的单词列表
   */
  async getWordsToReview(): Promise<WordbookEntry[]> {
    const words = await this.getAllWords()
    const now = Date.now()
    
    // 返回需要复习的单词（nextReviewAt <= now 或未设置）
    return words.filter(word => {
      return !word.nextReviewAt || word.nextReviewAt <= now
    })
  }

  /**
   * 获取统计信息
   * 
   * @returns 统计信息
   */
  async getStatistics(): Promise<{
    totalWords: number
    totalViews: number
    oldestWord: WordbookEntry | null
    newestWord: WordbookEntry | null
    wordsToReview: number
    masteredWords: number
    learningWords: number
  }> {
    const words = await this.getAllWords()
    const now = Date.now()
    
    return {
      totalWords: words.length,
      totalViews: words.reduce((sum, word) => sum + word.viewCount, 0),
      oldestWord: words.length > 0 
        ? words.reduce((oldest, word) => 
            word.createdAt < oldest.createdAt ? word : oldest
          )
        : null,
      newestWord: words.length > 0
        ? words.reduce((newest, word) =>
            word.createdAt > newest.createdAt ? word : newest
          )
        : null,
      wordsToReview: words.filter(w => !w.nextReviewAt || w.nextReviewAt <= now).length,
      masteredWords: words.filter(w => w.masteryStatus === 'mastered').length,
      learningWords: words.filter(w => w.masteryStatus === 'learning').length
    }
  }
}

/**
 * 导出单例实例
 */
export const wordbookService = new WordbookService()
