/**
 * 语言检测前置过滤器
 * 
 * 使用正则表达式和字符扫描快速识别语言特征
 * 在进入复杂的单词匹配之前，先做快速判断
 * 提高检测效率和准确性
 * 
 * 设计思路：
 * 1. 使用正则表达式快速匹配明显的语言特征（如特殊字符、字符集）
 * 2. 使用字符扫描统计各种字符的出现频率
 * 3. 根据统计结果快速判断语言
 * 4. 如果无法确定，返回 null，交给后续的单词匹配逻辑处理
 */

/**
 * 语言检测结果
 */
export type LanguageFilterResult = 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh' | null

/**
 * 字符统计结果
 */
interface CharStats {
  // 中文字符数量
  chinese: number
  // 日语字符数量（平假名+片假名）
  japanese: number
  // 德语特有字符数量（ä, ö, ü, ß）
  german: number
  // 法语特有字符数量
  french: number
  // 西班牙语特有字符数量（ñ, ¿, ¡）
  spanish: number
  // 重音字符数量（所有带重音的字符）
  accented: number
  // 总字符数
  total: number
}

/**
 * 语言特征正则表达式
 */
const LANGUAGE_PATTERNS = {
  // 中文字符：[\u4e00-\u9fa5]
  chinese: /[\u4e00-\u9fa5]/g,
  
  // 日语字符：平假名 [\u3040-\u309F] 和片假名 [\u30A0-\u30FF]
  japanese: /[\u3040-\u309F\u30A0-\u30FF]/g,
  
  // 德语特有字符：ä, ö, ü, ß（大小写）
  german: /[äöüßÄÖÜ]/g,
  
  // 法语特有字符：à, â, é, è, ê, ë, î, ï, ô, ù, û, ü, ÿ, ç, œ, æ（大小写）
  french: /[àâéèêëîïôùûüÿçœæÀÂÉÈÊËÎÏÔÙÛÜŸÇŒÆ]/g,
  
  // 西班牙语特有字符：ñ, ¿, ¡（大小写）
  spanish: /[ñ¿¡Ñ]/g,
  
  // 西班牙语重音字符：á, é, í, ó, ú, ü（大小写）
  spanishAccented: /[áéíóúüÁÉÍÓÚÜ]/g,
  
  // 所有重音字符（用于统计）
  allAccented: /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ]/g
}

/**
 * 统计文本中的字符特征
 * 
 * @param text - 要分析的文本
 * @returns 字符统计结果
 */
function scanCharacters(text: string): CharStats {
  const stats: CharStats = {
    chinese: 0,
    japanese: 0,
    german: 0,
    french: 0,
    spanish: 0,
    accented: 0,
    total: text.length
  }
  
  // 统计中文字符
  const chineseMatches = text.match(LANGUAGE_PATTERNS.chinese)
  if (chineseMatches) {
    stats.chinese = chineseMatches.length
  }
  
  // 统计日语字符
  const japaneseMatches = text.match(LANGUAGE_PATTERNS.japanese)
  if (japaneseMatches) {
    stats.japanese = japaneseMatches.length
  }
  
  // 统计德语特有字符
  const germanMatches = text.match(LANGUAGE_PATTERNS.german)
  if (germanMatches) {
    stats.german = germanMatches.length
  }
  
  // 统计法语特有字符
  const frenchMatches = text.match(LANGUAGE_PATTERNS.french)
  if (frenchMatches) {
    stats.french = frenchMatches.length
  }
  
  // 统计西班牙语特有字符（ñ, ¿, ¡）
  const spanishMatches = text.match(LANGUAGE_PATTERNS.spanish)
  if (spanishMatches) {
    stats.spanish = spanishMatches.length
  }
  
  // 统计所有重音字符
  const accentedMatches = text.match(LANGUAGE_PATTERNS.allAccented)
  if (accentedMatches) {
    stats.accented = accentedMatches.length
  }
  
  return stats
}

/**
 * 基于字符统计的快速语言判断
 * 
 * @param stats - 字符统计结果
 * @param text - 原始文本（用于特殊检查）
 * @returns 检测到的语言，如果无法确定返回 null
 */
function quickLanguageDetection(stats: CharStats, text: string): LanguageFilterResult {
  // 规则1：如果包含中文字符，返回中文
  if (stats.chinese > 0) {
    return 'zh'
  }
  
  // 规则2：如果包含日语字符，返回日语
  if (stats.japanese > 0) {
    return 'ja'
  }
  
  // 规则3：如果包含西班牙语特有字符（ñ, ¿, ¡），且数量明显，返回西班牙语
  if (stats.spanish > 0) {
    // ñ 是西班牙语最明显的特征
    if (/[ñÑ]/.test(text)) {
      return 'es'
    }
    // ¿ 和 ¡ 也是西班牙语的特征
    if (/[¿¡]/.test(text)) {
      return 'es'
    }
  }
  
  // 规则4：如果只有德语特有字符（ä, ö, ü, ß），且没有其他语言特征，返回德语
  if (stats.german > 0 && stats.french === 0 && stats.spanish === 0) {
    // 如果德语字符数量 >= 2，或者占总字符数的比例较高
    if (stats.german >= 2 || (stats.total > 0 && stats.german / stats.total > 0.05)) {
      return 'de'
    }
  }
  
  // 规则5：如果只有法语特有字符，且没有其他语言特征，返回法语
  if (stats.french > 0 && stats.german === 0 && stats.spanish === 0) {
    // 如果法语字符数量 >= 2，或者占总字符数的比例较高
    if (stats.french >= 2 || (stats.total > 0 && stats.french / stats.total > 0.05)) {
      return 'fr'
    }
  }
  
  // 规则6：如果只有西班牙语重音字符（á, é, í, ó, ú, ü），且数量明显，返回西班牙语
  if (stats.spanish === 0 && stats.accented > 0) {
    const spanishAccentedMatches = text.match(LANGUAGE_PATTERNS.spanishAccented)
    if (spanishAccentedMatches && spanishAccentedMatches.length >= 2) {
      // 检查是否主要是西班牙语重音字符
      const spanishAccentedRatio = spanishAccentedMatches.length / stats.accented
      if (spanishAccentedRatio > 0.7) {
        return 'es'
      }
    }
  }
  
  // 规则7：如果没有任何特殊字符，且文本长度较短，可能是英语
  if (stats.german === 0 && stats.french === 0 && stats.spanish === 0 && stats.accented === 0) {
    // 如果文本只包含基本ASCII字符，可能是英语
    if (/^[a-zA-Z0-9\s.,!?;:'"()-]+$/.test(text)) {
      return 'en'
    }
  }
  
  // 如果无法确定，返回 null，交给后续的单词匹配逻辑处理
  return null
}

/**
 * 语言检测前置过滤器
 * 
 * 使用正则表达式和字符扫描快速识别语言特征
 * 在进入复杂的单词匹配之前，先做快速判断
 * 
 * @param text - 要检测的文本
 * @returns 检测到的语言，如果无法确定返回 null
 * 
 * 使用示例：
 * ```typescript
 * const result = languageFilter("Hello world")
 * if (result) {
 *   return result  // 快速返回结果
 * } else {
 *   // 继续使用单词匹配等复杂逻辑
 * }
 * ```
 */
export function languageFilter(text: string): LanguageFilterResult {
  // 如果文本为空或太短，返回 null
  if (!text || text.trim().length === 0) {
    return null
  }
  
  // 如果文本太短（少于2个字符），默认返回英语
  if (text.trim().length < 2) {
    return 'en'
  }
  
  // 步骤1：字符扫描统计
  const stats = scanCharacters(text)
  
  // 步骤2：快速语言判断
  const result = quickLanguageDetection(stats, text)
  
  return result
}

/**
 * 获取字符统计信息（用于调试）
 * 
 * @param text - 要分析的文本
 * @returns 字符统计结果
 */
export function getCharStats(text: string): CharStats {
  return scanCharacters(text)
}
