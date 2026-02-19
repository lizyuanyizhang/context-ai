/**
 * 语音朗读工具类 (Text-to-Speech Utility)
 * 
 * 为什么使用浏览器原生的 SpeechSynthesis API？
 * 1. **免费**：不需要第三方 API 密钥，不产生额外费用
 * 2. **低延迟**：本地处理，无需网络请求，响应速度快
 * 3. **隐私保护**：文本不会发送到外部服务器，数据更安全
 * 4. **离线可用**：不依赖网络连接，随时可用
 * 
 * 缺点：
 * - 语音质量可能不如专业 TTS 服务（如 Google Cloud TTS）
 * - 支持的语种和声音选项有限
 * - 不同浏览器的实现可能有差异
 * 
 * 但对于我们的使用场景（学习辅助），原生 API 已经足够好用了！
 */

// 导入前置过滤器（用于快速语言检测）
import { languageFilter } from './languageFilter'

/**
 * 支持的语言类型
 * SpeechSynthesis API 使用 BCP 47 语言标签（如 'en-US', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP', 'es-ES'）
 */
export type SupportedLanguage = 'en' | 'de' | 'zh' | 'fr' | 'ja' | 'es'

/**
 * 语言配置接口
 * 定义每种语言的语音参数
 */
interface LanguageConfig {
  // BCP 47 语言标签：浏览器用来选择正确的语音引擎
  lang: string
  // 语速：0.1（很慢）到 10（很快），1.0 是正常语速
  rate: number
  // 音调：0（最低）到 2（最高），1.0 是正常音调
  pitch: number
  // 音量：0（静音）到 1（最大），1.0 是最大音量
  volume: number
}

/**
 * 语言配置映射表
 * 为每种语言设置最佳的语音参数
 * 
 * 优化说明（让声音更年轻自然）：
 * - rate: 1.0 正常语速，更接近真实人声（年轻人口语速度）
 * - pitch: 1.1-1.15 提高音调，让声音更年轻、更有活力（1.0 太机械，1.2 太高）
 * - volume: 1.0 最大音量，确保清晰
 * 
 * 为什么这样设置？
 * - 年轻人的声音通常音调稍高（pitch 1.1-1.15）
 * - 正常语速（rate 1.0）比慢速（0.9）更自然、更有活力
 * - 这些参数组合能让声音听起来更年轻、更自然
 */
// 语速 0.95 更清晰、不易吞字；pitch 1.0 避免尖细/机械感（参考：过高易像“鸭子声”）
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  en: { lang: 'en-US', rate: 0.95, pitch: 1.0, volume: 1.0 },
  de: { lang: 'de-DE', rate: 0.95, pitch: 1.0, volume: 1.0 },
  zh: { lang: 'zh-CN', rate: 0.95, pitch: 1.0, volume: 1.0 },
  fr: { lang: 'fr-FR', rate: 0.95, pitch: 1.0, volume: 1.0 },
  ja: { lang: 'ja-JP', rate: 0.95, pitch: 1.0, volume: 1.0 },
  es: { lang: 'es-ES', rate: 0.95, pitch: 1.0, volume: 1.0 }
}

/**
 * 文本规范化：移除不应朗读的符号，替换易误读符号为可读词。
 * 移除：引号（""、''、「」）、省略号（...、…）、括号等标点符号
 * 替换：@ → "at"、# → "number" 等（避免中文读成「小老鼠」）
 */
function normalizeTextForTTS(text: string, lang: SupportedLanguage): string {
  if (!text) return text
  let out = text
  
  // 移除不应朗读的符号（直接删除，不替换）
  // 引号：中文引号「」、英文引号 "" ''、全角引号 "" ''、单引号 '' ''
  out = out.replace(/[""''「」『』《》]/g, '')
  // 省略号：... 和 …（中文省略号）
  out = out.replace(/\.{2,}/g, '') // 两个或更多点
  out = out.replace(/…/g, '') // 中文省略号
  // 括号：() [] {} （）【】等（保留内容，移除括号）
  out = out.replace(/[()[\]{}（）【】]/g, '')
  // 其他标点：破折号、连接号等（可选，根据需求）
  // out = out.replace(/[—–-]/g, ' ') // 破折号替换为空格
  
  // 替换易误读符号为可读词
  const atReadings: Record<SupportedLanguage, string> = {
    en: ' at ',
    de: ' at ',
    fr: ' at ',
    es: ' at ',
    ja: ' アット ',
    zh: ' 艾特 '
  }
  const hashReadings: Record<SupportedLanguage, string> = {
    en: ' number ',
    de: ' Nummer ',
    fr: ' numéro ',
    es: ' número ',
    ja: ' ナンバー ',
    zh: ' 井号 '
  }
  const readingAt = atReadings[lang] ?? ' at '
  const readingHash = hashReadings[lang] ?? ' number '
  out = out.replace(/@/g, readingAt)
  out = out.replace(/#/g, readingHash)
  
  // 清理多余空格（移除符号后可能留下多个空格）
  out = out.replace(/\s+/g, ' ').trim()
  
  return out
}

/**
 * 语言检测函数
 * 
 * 通过简单的规则判断文本是英语、德语、中文、法语、日语还是西班牙语
 * 这不是完美的检测方法，但对于常见场景已经足够
 * 
 * @param text - 要检测的文本
 * @returns 检测到的语言类型，如果无法确定则返回 'en'（默认英语）
 * 
 * 检测规则（按优先级）：
 * 1. 前置过滤器（快速字符扫描和正则匹配）
 * 2. 中文字符：[\u4e00-\u9fa5]（中文 Unicode 范围）
 * 3. 日语字符：[\u3040-\u309F\u30A0-\u30FF]（平假名和片假名）
 * 4. 西班牙语特有字符：ñ, á, é, í, ó, ú, ü, ¿, ¡（ñ 是最明显的特征）
 * 5. 法语特有字符：à, â, é, è, ê, ë, î, ï, ô, ù, û, ü, ÿ, ç, œ, æ
 * 6. 德语特有字符：ä, ö, ü, ß
 * 7. 常见单词匹配（西班牙语、法语、德语）
 * 8. 如果都没有，默认返回英语
 */
export function detectLanguage(text: string): SupportedLanguage {
  // 先使用前置过滤器快速判断
  const quickResult = languageFilter(text)
  if (quickResult) {
    return quickResult as SupportedLanguage
  }
  
  // 注意：如果需要使用混合架构（FastText + LLM），
  // 请使用 hybridLanguageDetect() 函数
  // import { hybridLanguageDetect } from './hybridLanguageDetector'
  
  // 重要：优先检测日语字符（平假名和片假名）
  // 必须在中文之前检测，因为日语文本可能包含汉字
  // 正则表达式：/[\u3040-\u309F\u30A0-\u30FF]/ 匹配平假名和片假名
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/
  if (japaneseChars.test(text)) {
    return 'ja'
  }
  
  // 检查中文字符（在日语之后，避免日语中的汉字被误判为中文）
  // 正则表达式：/[\u4e00-\u9fa5]/ 匹配任意一个中文字符
  const chineseChars = /[\u4e00-\u9fa5]/
  if (chineseChars.test(text)) {
    return 'zh'
  }
  
  // 转换为小写，方便比较
  const lowerText = text.toLowerCase()
  
  // 统计法语、德语和西班牙语特有字符的数量（用于更准确的判断）
  const frenchCharCount = (text.match(/[àâéèêëîïôùûüÿçœæÀÂÉÈÊËÎÏÔÙÛÜŸÇŒÆ]/g) || []).length
  const germanCharCount = (text.match(/[äöüßÄÖÜ]/g) || []).length
  const spanishCharCount = (text.match(/[ñáéíóúü¿¡ÑÁÉÍÓÚÜ]/g) || []).length
  
  // 检查常见法语单词（扩展列表，提高准确率）
  const frenchWords = /\b(le|la|les|un|une|des|et|ou|dans|sur|avec|pour|par|de|du|de la|est|sont|être|avoir|faire|aller|venir|voir|savoir|pouvoir|vouloir|devoir|falloir|il|elle|nous|vous|ils|elles|ce|ça|qui|que|quoi|où|comment|pourquoi|quand|combien|oui|non|merci|bonjour|au revoir|s'il vous plaît|excusez-moi|je|tu|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|leurs|cette|ces|tout|toute|tous|toutes|très|plus|moins|aussi|encore|déjà|toujours|jamais|maintenant|aujourd'hui|demain|hier|ici|là|où|comment|pourquoi|combien|beaucoup|peu|assez|trop|très|bien|mal|bon|mauvais|grand|petit|nouveau|vieux|jeune|vieille|beau|belle|joli|jolie)\b/i
  
  // 检查常见德语单词（改进：移除与英语重叠的单词，使用更独特的德语单词）
  // 注意：移除了 und, ist, sind, in, an, von, zu, auf, mit, für, pro, per, via 等与英语重叠的单词
  // 使用更独特的德语单词，如定冠词、动词变位、特有词汇等
  const germanWords = /\b(der|die|das|haben|sein|werden|können|müssen|sollten|wenn|aber|oder|durch|gegen|ohne|um|seit|während|wegen|trotz|statt|außer|innerhalb|außerhalb|dank|gemäß|entsprechend|zufolge|anlässlich|hinsichtlich|bezüglich|betreffs|einschließlich|exklusive|inklusive|kontra|bis|ich|du|er|sie|es|wir|ihr|mein|dein|sein|ihr|unser|euer|dieser|jener|welcher|alle|manche|viele|wenige|einige|keine|nicht|auch|noch|schon|immer|nie|jetzt|heute|morgen|gestern|hier|dort|wo|wie|warum|wann|was|wer|welche|welcher|welches|groß|klein|neu|alt|jung|schön|hässlich|gut|schlecht|viel|wenig|mehr|weniger|sehr|genug|nicht genug|über|unter|vor|nach|bei)\b/i
  
  // 检查常见英语单词（优先检测，避免误判为其他语言）
  // 使用更严格的英语单词列表，避免与西班牙语混淆
  const englishWords = /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|as|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|should|could|can|may|might|must|shall|this|that|these|those|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|its|our|their|what|which|who|whom|whose|where|when|why|how|all|some|any|many|much|more|most|few|little|less|least|good|bad|big|small|large|long|short|high|low|new|old|young|right|wrong|true|false|yes|no|not|very|too|so|also|just|only|even|still|yet|already|here|there|now|then|today|tomorrow|yesterday|always|never|often|sometimes|usually|well|better|best|worse|worst|much|more|most|very|quite|really|too|so|such|how|what|which|who|where|when|why|how|about|above|across|after|against|along|among|around|before|behind|below|beneath|beside|between|beyond|during|except|inside|outside|through|throughout|under|underneath|until|upon|within|without)\b/i
  
  // 检查常见西班牙语单词（改进：移除与英语/德语重叠的单词，使用更独特的西班牙语单词）
  // 注意：移除了 en, de, a, con, por, para, ir, ver, mi, tu, su, bien, mal, no 等重叠单词
  // 使用更独特的西班牙语单词，如定冠词、动词变位、特有词汇等
  const spanishWords = /\b(el|la|los|las|un|una|ser|estar|tener|hacer|venir|saber|poder|querer|deber|yo|tú|él|ella|nosotros|vosotros|ellos|ellas|este|ese|aquel|esta|esa|aquella|estos|esos|aquellos|estas|esas|aquellas|nuestro|vuestro|mío|tuyo|suyo|muy|más|menos|también|tampoco|siempre|nunca|ahora|hoy|mañana|ayer|aquí|allí|dónde|cómo|por qué|cuándo|cuánto|qué|quién|cuál|mucho|poco|bastante|demasiado|bueno|malo|grande|pequeño|nuevo|viejo|joven|hermoso|feo|gracias|por favor|de nada|hola|adiós|perdón|lo siento|sí)\b/i
  
  // 如果同时有多个语言的特有字符，根据数量判断
  const charCounts = [
    { lang: 'fr' as SupportedLanguage, count: frenchCharCount },
    { lang: 'de' as SupportedLanguage, count: germanCharCount },
    { lang: 'es' as SupportedLanguage, count: spanishCharCount }
  ].filter(item => item.count > 0)
  
  if (charCounts.length > 1) {
    // 按字符数量排序，选择最多的
    charCounts.sort((a, b) => b.count - a.count)
    // 如果最多的明显多于其他的，直接返回
    if (charCounts[0].count > charCounts[1].count) {
      return charCounts[0].lang
    }
    // 如果数量相近，检查常见单词
    if (charCounts[0].lang === 'fr' && frenchWords.test(lowerText) && !germanWords.test(lowerText) && !spanishWords.test(lowerText)) {
      return 'fr'
    }
    if (charCounts[0].lang === 'de' && germanWords.test(lowerText) && !frenchWords.test(lowerText) && !spanishWords.test(lowerText)) {
      return 'de'
    }
    if (charCounts[0].lang === 'es' && spanishWords.test(lowerText) && !frenchWords.test(lowerText) && !germanWords.test(lowerText)) {
      return 'es'
    }
  }
  
  // 检查西班牙语特有字符（ñ 是西班牙语最明显的特征，¿ 和 ¡ 也是）
  if (spanishCharCount > 0) {
    // 如果包含 ñ 或 ¿ 或 ¡，更可能是西班牙语
    if (/[ñ¿¡]/.test(text)) {
      return 'es'
    }
    // 如果只有重音符号，需要进一步检查单词
    if (spanishWords.test(lowerText) && !englishWords.test(lowerText)) {
      return 'es'
    }
  }
  
  // 检查法语特有字符
  if (frenchCharCount > 0) {
    if (frenchWords.test(lowerText) && !englishWords.test(lowerText)) {
      return 'fr'
    }
  }
  
  // 检查德语特有字符
  if (germanCharCount > 0) {
    if (germanWords.test(lowerText) && !englishWords.test(lowerText)) {
      return 'de'
    }
  }
  
  // 重要：改进的检测逻辑
  // 优先级：特殊字符 > 英语单词（如果无特殊字符）> 其他语言单词（需要更严格的匹配）
  
  // 检查常见英语单词
  const englishWordMatches = lowerText.match(englishWords) || []
  const englishWordCount = englishWordMatches.length
  
  // 检查常见德语单词
  const germanWordMatches = lowerText.match(germanWords) || []
  const germanWordCount = germanWordMatches.length
  
  // 检查常见法语单词
  const frenchWordMatches = lowerText.match(frenchWords) || []
  const frenchWordCount = frenchWordMatches.length
  
  // 检查常见西班牙语单词
  const spanishWordMatches = lowerText.match(spanishWords) || []
  const spanishWordCount = spanishWordMatches.length
  
  // 第一步：如果有特殊字符，优先根据特殊字符判断
  if (charCounts.length > 0) {
    // 按字符数量排序
    charCounts.sort((a, b) => b.count - a.count)
    
    // 如果最多的字符数量明显多于其他的，直接返回
    if (charCounts.length === 1 || charCounts[0].count > charCounts[1].count * 2) {
      return charCounts[0].lang
    }
    
    // 如果字符数量相近，需要结合单词匹配判断
    // 如果某个语言既有特殊字符，又有对应的单词匹配，优先返回该语言
    if (charCounts[0].lang === 'de' && germanWordCount > 0 && germanWordCount >= englishWordCount) {
      return 'de'
    }
    if (charCounts[0].lang === 'fr' && frenchWordCount > 0 && frenchWordCount >= englishWordCount) {
      return 'fr'
    }
    if (charCounts[0].lang === 'es' && spanishWordCount > 0 && spanishWordCount >= englishWordCount) {
      return 'es'
    }
    
    // 如果都没有单词匹配，返回字符最多的语言
    return charCounts[0].lang
  }
  
  // 第二步：如果没有特殊字符，优先检查英语
  // 如果英语单词数量 >= 3，且其他语言单词数量较少，返回英语
  if (englishWordCount >= 3) {
    const maxOtherLangCount = Math.max(spanishWordCount, frenchWordCount, germanWordCount)
    if (englishWordCount > maxOtherLangCount * 2) {
      return 'en'
    }
  }
  
  // 第三步：检查其他语言单词（需要更严格的匹配条件）
  // 德语：需要至少2个德语单词，且德语单词数量 > 英语单词数量
  if (germanWordCount >= 2 && germanWordCount > englishWordCount) {
    return 'de'
  }
  
  // 法语：需要至少2个法语单词，且法语单词数量 > 英语单词数量
  if (frenchWordCount >= 2 && frenchWordCount > englishWordCount) {
    return 'fr'
  }
  
  // 西班牙语：需要至少2个西班牙语单词，且西班牙语单词数量 > 英语单词数量
  if (spanishWordCount >= 2 && spanishWordCount > englishWordCount) {
    return 'es'
  }
  
  // 第四步：如果英语单词数量 > 0，且没有其他语言特征，返回英语
  if (englishWordCount > 0 && germanWordCount === 0 && frenchWordCount === 0 && spanishWordCount === 0) {
    return 'en'
  }
  
  // 默认返回英语（因为英语更常见）
  return 'en'
}

/** 按语言分段结果，用于混合语言 TTS 逐段朗读 */
export interface TTSSegment {
  text: string
  lang: SupportedLanguage
}

/**
 * 按书写系统将文本切分为语言段，避免「中文+日语」等混合内容用单一语音乱读/只读一部分。
 * 思路：先按字符类型分块（日语假名 / CJK 汉字 / 拉丁等），每块再检测语言。
 */
export function segmentTextByLanguage(text: string): TTSSegment[] {
  if (!text || !text.trim()) return []
  const segments: TTSSegment[] = []
  let i = 0
  const isJa = (c: string) => /[\u3040-\u309F\u30A0-\u30FF]/.test(c)
  const isCjk = (c: string) => /[\u4e00-\u9fa5]/.test(c)
  while (i < text.length) {
    const c = text[i]
    let type: 'ja' | 'cjk' | 'other'
    if (isJa(c)) type = 'ja'
    else if (isCjk(c)) type = 'cjk'
    else type = 'other'
    let j = i
    while (j < text.length) {
      const d = text[j]
      if (type === 'ja' && !isJa(d)) break
      if (type === 'cjk' && !isCjk(d)) break
      if (type === 'other' && (isJa(d) || isCjk(d))) break
      j++
    }
    const run = text.slice(i, j).trim()
    if (run.length > 0) {
      const lang: SupportedLanguage = type === 'ja' ? 'ja' : type === 'cjk' ? detectLanguage(run) : detectLanguage(run)
      segments.push({ text: run, lang })
    }
    i = j
  }
  return segments
}

/**
 * 按「」括号切分：括号内为原文（用源语言读），括号外为译文说明（用目标语言读）。
 * 优化：对「」外的内容也进行语言检测，识别其中夹杂的源语言词汇（如中文解释中的德语词）并用正确语言读。
 */
export function segmentTextByQuotedOriginal(
  text: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage
): TTSSegment[] {
  if (!text || !text.trim()) return []
  const segments: TTSSegment[] = []
  let i = 0
  const len = text.length
  while (i < len) {
    const open = text.indexOf('「', i)
    if (open === -1) {
      const rest = text.slice(i).trim()
      if (rest.length > 0) {
        // 「」外的内容：先按书写系统分段，再检测每段的语言
        // 如果检测到源语言特征（如德语词），用源语言读；否则用目标语言
        const subSegments = segmentTextByLanguage(rest)
        for (const sub of subSegments) {
          // 如果检测到的语言是源语言，用源语言读；否则用目标语言
          const lang = sub.lang === sourceLang ? sourceLang : targetLang
          segments.push({ text: sub.text, lang })
        }
      }
      break
    }
    const before = text.slice(i, open).trim()
    if (before.length > 0) {
      // 「」前的内容：同样分段检测
      const subSegments = segmentTextByLanguage(before)
      for (const sub of subSegments) {
        const lang = sub.lang === sourceLang ? sourceLang : targetLang
        segments.push({ text: sub.text, lang })
      }
    }
    const close = text.indexOf('」', open + 1)
    if (close === -1) {
      const rest = text.slice(open + 1).trim()
      if (rest.length > 0) segments.push({ text: rest, lang: sourceLang })
      break
    }
    const inside = text.slice(open + 1, close).trim()
    if (inside.length > 0) segments.push({ text: inside, lang: sourceLang })
    i = close + 1
  }
  return segments
}

/**
 * TTS 类：封装语音合成功能
 * 
 * 使用单例模式：确保整个应用只有一个 TTS 实例
 * 这样可以避免多个语音同时播放造成混乱
 */
class TTSManager {
  // 当前正在使用的语音合成对象
  private synthesis: SpeechSynthesis | null = null
  
  // 当前正在播放的 utterance（语音合成实例）
  private currentUtterance: SpeechSynthesisUtterance | null = null
  
  // 是否已初始化
  private initialized = false
  
  // 是否由用户主动停止播放（用于区分用户主动停止和真正的错误）
  private isUserStopped = false
  
  // 语音缓存：为每种语言缓存选择的语音，确保同一语言使用同一个语音引擎
  // 格式：{ 'en-US': SpeechSynthesisVoice, 'zh-CN': SpeechSynthesisVoice, ... }
  private voiceCache: Map<string, SpeechSynthesisVoice> = new Map()

  // 所有语音列表缓存：避免重复调用 getVoices()，提升启动速度
  private allVoicesCache: SpeechSynthesisVoice[] | null = null
  private voicesLoaded = false

  // 混合语言分段播放队列；stop() 会清空并触发 segmentOnEnd
  private segmentQueue: TTSSegment[] = []
  private segmentIndex = 0
  private segmentOnEnd?: () => void
  private segmentOnError?: (error: Error) => void
  private segmentUnifiedRate?: number // 分段播放的统一语速（用于对齐原文语速）

  /**
   * 初始化 TTS：预加载语音列表，减少首次播放延迟
   */
  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis
      this.initialized = true
      // 预加载语音列表：监听 voiceschanged 事件，提前加载所有语音
      this.preloadVoices()
    } else {
      console.warn('浏览器不支持 SpeechSynthesis API')
      this.initialized = false
    }
  }

  /**
   * 预加载语音列表：在用户首次点击发音前就加载好，减少启动延迟
   */
  private preloadVoices(): void {
    if (!this.synthesis) return
    
    // 立即尝试获取（某些浏览器第一次调用就能获取）
    const initialVoices = this.synthesis.getVoices()
    if (initialVoices.length > 0) {
      this.allVoicesCache = initialVoices
      this.voicesLoaded = true
      this.precomputeVoiceCache()
      console.log(`[TTS] 预加载完成：${initialVoices.length} 个语音`)
      return
    }

    // 如果为空，监听 voiceschanged 事件（Chrome 等需要用户交互后才能加载）
    const loadVoices = () => {
      const voices = this.synthesis?.getVoices() || []
      if (voices.length > 0 && !this.voicesLoaded) {
        this.allVoicesCache = voices
        this.voicesLoaded = true
        this.precomputeVoiceCache()
        console.log(`[TTS] 语音列表加载完成：${voices.length} 个语音`)
        // 移除监听器（只监听一次）
        this.synthesis?.removeEventListener('voiceschanged', loadVoices)
      }
    }
    
    this.synthesis.addEventListener('voiceschanged', loadVoices)
    
    // 如果 1 秒后还没加载，尝试手动触发（某些浏览器需要）
    setTimeout(() => {
      if (!this.voicesLoaded && this.synthesis) {
        const voices = this.synthesis.getVoices()
        if (voices.length > 0) {
          loadVoices()
        }
      }
    }, 1000)
  }

  /**
   * 预计算并缓存每种语言的最佳语音，避免每次 speak() 时重新计算
   */
  private precomputeVoiceCache(): void {
    if (!this.allVoicesCache) return
    
    const score = (v: SpeechSynthesisVoice): number => {
      const n = v.name.toLowerCase()
      if (n.includes('neural') || n.includes('premium') || n.includes('enhanced') || n.includes('natural')) return 100
      if (n.includes('google ') || n.includes('samantha') || n.includes('daniel') || n.includes('zira')) return 90
      if (n.includes('female') || n.includes('karen') || n.includes('tessa') || n.includes('victoria')) return 70
      if (v.localService) return 60
      if (n.includes('compact') || n.includes('mobile') || n.includes('robotic')) return 10
      return 50
    }

    // 为每种支持的语言预选最佳语音
    const langConfigs = ['en-US', 'de-DE', 'zh-CN', 'fr-FR', 'ja-JP', 'es-ES']
    for (const lang of langConfigs) {
      const langPrefix = lang.split('-')[0].toLowerCase()
      let candidates = this.allVoicesCache.filter(v => 
        v.lang.toLowerCase().startsWith(langPrefix)
      )
      
      if (langPrefix === 'en' && candidates.length > 1) {
        const noIndia = candidates.filter(v => {
          const vLang = v.lang.toLowerCase()
          return !(vLang === 'en-in' || vLang.includes('india') || (v.name && v.name.toLowerCase().includes('india')))
        })
        if (noIndia.length > 0) candidates = noIndia
        const us = candidates.filter(v => v.lang.toLowerCase().startsWith('en-us'))
        const gb = candidates.filter(v => v.lang.toLowerCase().startsWith('en-gb'))
        const rest = candidates.filter(v => !v.lang.toLowerCase().startsWith('en-us') && !v.lang.toLowerCase().startsWith('en-gb'))
        candidates = [...us, ...gb, ...rest]
      }
      
      if (candidates.length > 0) {
        const sorted = [...candidates].sort((a, b) => score(b) - score(a))
        this.voiceCache.set(lang, sorted[0])
      }
    }
  }

  /**
   * 检查是否支持 TTS
   * @returns 是否支持语音合成
   */
  isSupported(): boolean {
    return this.initialized && this.synthesis !== null
  }

  /**
   * 获取可用的语音列表（优化：优先使用缓存，减少延迟）
   * 
   * @param lang - 语言代码（如 'en-US', 'de-DE', 'zh-CN'）
   * @returns 该语言的可用语音列表
   */
  getVoices(lang?: string): SpeechSynthesisVoice[] {
    if (!this.synthesis) {
      return []
    }

    // 优先使用缓存的语音列表（如果已加载）
    let voices = this.allVoicesCache
    if (!voices || voices.length === 0) {
      // 缓存未加载，实时获取（首次调用或缓存失效）
      voices = this.synthesis.getVoices()
      if (voices.length > 0) {
        this.allVoicesCache = voices
        this.voicesLoaded = true
        // 如果缓存为空但这次获取到了，更新预计算缓存
        if (this.voiceCache.size === 0) {
          this.precomputeVoiceCache()
        }
      }
    }
    
    if (!lang) {
      return voices || []
    }

    const langPrefix = lang.split('-')[0].toLowerCase()
    let list = voices.filter(voice => {
      const voiceLang = voice.lang.toLowerCase()
      return voiceLang.startsWith(langPrefix)
    })

    // 英语时优先美/英口音，排除印度英语
    if (langPrefix === 'en' && list.length > 1) {
      const noIndia = list.filter(v => {
        const vLang = v.lang.toLowerCase()
        return !(vLang === 'en-in' || vLang.includes('india') || (v.name && v.name.toLowerCase().includes('india')))
      })
      if (noIndia.length > 0) {
        list = noIndia
      }
      const us = list.filter(v => v.lang.toLowerCase().startsWith('en-us'))
      const gb = list.filter(v => v.lang.toLowerCase().startsWith('en-gb'))
      const rest = list.filter(v => !v.lang.toLowerCase().startsWith('en-us') && !v.lang.toLowerCase().startsWith('en-gb'))
      list = [...us, ...gb, ...rest]
    }

    return list
  }
  
  /**
   * 检查系统是否支持指定语言的语音
   * 
   * @param lang - 语言代码（如 'zh-CN'）
   * @returns 是否支持
   */
  isLanguageSupported(lang: string): boolean {
    const voices = this.getVoices(lang)
    return voices.length > 0
  }

  /**
   * 播放文本语音
   * 
   * @param text - 要朗读的文本
   * @param language - 语言类型（可选，如果不提供会自动检测）
   * @param onEnd - 播放结束的回调函数
   * @param onError - 播放出错的回调函数
   * @param customRate - 自定义语速（可选，用于统一所有发音位置的语速）
   */
  speak(
    text: string,
    language?: SupportedLanguage,
    onEnd?: () => void,
    onError?: (error: Error) => void,
    customRate?: number
  ): void {
    // 检查是否支持
    if (!this.isSupported() || !this.synthesis) {
      const error = new Error('浏览器不支持语音合成功能')
      onError?.(error)
      return
    }

    // 如果文本为空，直接返回
    if (!text || text.trim().length === 0) {
      return
    }

    // 非分段播放时才在开始时 stop，避免 speakSegmented 链式调用时打断下一段
    if (this.segmentQueue.length === 0) {
      this.stop()
    }

    // 自动检测语言（如果没有指定）
    const detectedLang = language || detectLanguage(text)
    // 符号规范化：@ / # 等按语言转为可读词，避免中文读成「小老鼠」等
    text = normalizeTextForTTS(text, detectedLang)
    
    // 获取语言配置
    const config = LANGUAGE_CONFIGS[detectedLang]

    // 优化：优先使用缓存的语音，减少延迟
    // 如果缓存中有该语言的语音，直接使用，避免重复计算
    let availableVoices = this.getVoices(config.lang)
    
    // 如果语音列表为空且缓存未加载，尝试立即获取（某些浏览器首次调用需要用户交互）
    if (availableVoices.length === 0 && !this.voicesLoaded && this.synthesis) {
      const allVoices = this.synthesis.getVoices()
      if (allVoices.length > 0) {
        // 更新缓存并重新获取
        this.allVoicesCache = allVoices
        this.voicesLoaded = true
        this.precomputeVoiceCache()
        availableVoices = this.getVoices(config.lang)
      }
    }
    
    // 如果不支持该语言，尝试使用替代方案
    if (availableVoices.length === 0) {
      console.warn(`[TTS] 系统不支持 ${config.lang} 语言的语音`)
      
      // 如果是中文且不支持，提供详细的错误信息
      if (detectedLang === 'zh') {
        const error = new Error('系统不支持中文语音。\n\n解决方案：\n1. macOS: 系统偏好设置 → 辅助功能 → 朗读内容 → 管理语音 → 添加中文语音\n2. Windows: 设置 → 时间和语言 → 语音 → 管理语音 → 添加中文语音\n3. Linux: 安装中文 TTS 引擎（如 espeak-zh）')
        onError?.(error)
        return
      }
      
      // 其他语言不支持时，尝试使用英语作为替代
      if (detectedLang !== 'en') {
        console.warn(`使用英语语音作为替代`)
        const englishConfig = LANGUAGE_CONFIGS['en']
        const englishVoices = this.getVoices(englishConfig.lang)
        if (englishVoices.length > 0) {
          // 使用英语配置
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = englishConfig.lang
          utterance.rate = customRate ?? englishConfig.rate // 统一语速
          utterance.pitch = englishConfig.pitch
          utterance.volume = englishConfig.volume
          
          const localVoice = englishVoices.find(voice => voice.localService)
          if (localVoice) {
            utterance.voice = localVoice
          } else {
            utterance.voice = englishVoices[0]
          }
          
          // 设置事件监听器（优化：减少日志延迟）
          utterance.onstart = () => {
            // 开发环境才输出日志
            if (process.env.NODE_ENV === 'development') {
              console.log(`[TTS] 开始播放（英语替代）：${text.substring(0, 20)}...`)
            }
          }
          utterance.onend = () => {
            this.currentUtterance = null
            onEnd?.()
          }
          utterance.onerror = (event) => {
            console.error('[TTS] 语音播放出错：', event.error)
            this.currentUtterance = null
            onError?.(new Error(event.error || '未知错误'))
          }
          
          this.currentUtterance = utterance
          this.synthesis.speak(utterance)
          return
        }
      }
      
      // 如果连英语都不支持，报错
      const error = new Error(`系统不支持 ${config.lang} 语言的语音，且没有可用的替代语音`)
      onError?.(error)
      return
    }

    // 创建 SpeechSynthesisUtterance 对象
    // 这是浏览器提供的语音合成接口
    const utterance = new SpeechSynthesisUtterance(text)

    // 设置语言
    utterance.lang = config.lang

    // 设置语音参数：优先使用自定义语速（统一所有发音位置的语速），否则使用语言默认语速
    utterance.rate = customRate ?? config.rate // 语速
    utterance.pitch = config.pitch // 音调
    utterance.volume = config.volume // 音量

    // 优化：优先使用预计算的缓存语音，几乎零延迟
    if (availableVoices.length > 0) {
      let selectedVoice = this.voiceCache.get(config.lang)
      
      // 如果缓存中没有或不在可用列表中，快速选择（使用预计算的排序逻辑）
      if (!selectedVoice || !availableVoices.includes(selectedVoice)) {
        // 快速选择：优先使用第一个可用语音（getVoices 已排序）
        selectedVoice = availableVoices[0]
        // 更新缓存
        if (selectedVoice) {
          this.voiceCache.set(config.lang, selectedVoice)
        }
      }
      
      // 设置语音（如果已预加载，这一步几乎无延迟）
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }
    }

    // 设置事件监听器

    // 播放开始事件（优化：减少日志输出，降低延迟）
    utterance.onstart = () => {
      // 仅在开发环境输出详细日志
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TTS] 开始播放（${config.lang}）：${text.substring(0, 20)}...`)
      }
    }

    // 播放结束事件（优化：减少日志延迟）
    utterance.onend = () => {
      const wasUserStopped = this.isUserStopped
      this.currentUtterance = null
      this.isUserStopped = false
      // 直接调用 onEnd，不区分用户停止和正常结束（都是正常结束）
      onEnd?.()
    }

    // 播放错误事件
    utterance.onerror = (event) => {
      const errorCode = event.error
      const wasUserStopped = this.isUserStopped
      
      // 重置标志（无论是否用户停止）
      this.isUserStopped = false
      this.currentUtterance = null
      
      // 如果是用户主动停止导致的 'interrupted' 错误，不当作错误处理
      // 这是正常行为，不应该显示错误提示
      if (errorCode === 'interrupted' && wasUserStopped) {
        console.log('[TTS] 用户主动停止播放（interrupted 错误被忽略）')
        // 调用 onEnd 而不是 onError，表示正常结束
        onEnd?.()
        return
      }
      
      // 其他错误才真正当作错误处理
      console.error('[TTS] 语音播放出错：', errorCode)
      
      // 提供更详细的错误信息
      let errorMessage = '未知错误'
      
      if (errorCode === 'not-allowed') {
        errorMessage = '语音播放被拒绝，请检查浏览器权限设置'
      } else if (errorCode === 'synthesis-failed') {
        errorMessage = '语音合成失败，请检查系统语音配置'
      } else if (errorCode === 'synthesis-unavailable') {
        errorMessage = '语音合成不可用，请检查系统是否安装了语音包'
      } else if (errorCode === 'network') {
        errorMessage = '网络错误，请检查网络连接'
      } else if (errorCode === 'audio-busy') {
        errorMessage = '音频设备忙碌，请稍后重试'
      } else if (errorCode === 'interrupted') {
        // 如果不是用户主动停止的 interrupted，可能是其他原因
        errorMessage = '语音播放被中断'
      } else if (errorCode) {
        errorMessage = `语音播放失败：${errorCode}`
      }
      
      onError?.(new Error(errorMessage))
    }

    // 保存当前 utterance，方便后续控制（暂停、停止）
    this.currentUtterance = utterance

    // 开始播放
    this.synthesis.speak(utterance)
  }

  /**
   * 混合语言分段朗读：先按书写系统切分（日/中/拉丁等），再逐段用对应语言朗读，避免只读一部分或乱读。
   * @param text - 整段文本（可能含中文+日语等）
   * @param defaultLang - 可选；单段或无法分段时使用的语言
   * @param onEnd - 全部读完或用户停止时调用
   * @param onError - 任一段出错时调用
   * @param unifiedRate - 统一语速（可选，用于对齐原文语速）
   */
  speakSegmented(
    text: string,
    defaultLang?: SupportedLanguage,
    onEnd?: () => void,
    onError?: (error: Error) => void,
    unifiedRate?: number
  ): void {
    if (!this.isSupported() || !text?.trim()) {
      onEnd?.()
      return
    }
    const segments = segmentTextByLanguage(text)
    if (segments.length === 0) {
      onEnd?.()
      return
    }
    if (segments.length === 1) {
      const lang = defaultLang ?? segments[0].lang
      this.speak(segments[0].text, lang, onEnd, onError, unifiedRate)
      return
    }
    this.segmentQueue = segments
    this.segmentIndex = 0
    this.segmentOnEnd = onEnd
    this.segmentOnError = onError
    this.segmentUnifiedRate = unifiedRate
    this.speakNextSegment()
  }

  /**
   * 按预分段列表顺序朗读（用于「」圈出原文：圈内用源语言，圈外用目标语言）。
   * @param segments - 已切好的 { text, lang } 列表
   * @param onEnd - 全部读完或用户停止时调用
   * @param onError - 任一段出错时调用
   * @param unifiedRate - 统一语速（可选，用于对齐原文语速）
   */
  speakSegments(
    segments: TTSSegment[],
    onEnd?: () => void,
    onError?: (error: Error) => void,
    unifiedRate?: number
  ): void {
    if (!this.isSupported()) {
      onEnd?.()
      return
    }
    if (!segments || segments.length === 0) {
      onEnd?.()
      return
    }
    const filtered = segments.filter(s => s.text && s.text.trim().length > 0)
    if (filtered.length === 0) {
      onEnd?.()
      return
    }
    if (filtered.length === 1) {
      this.speak(filtered[0].text, filtered[0].lang, onEnd, onError, unifiedRate)
      return
    }
    this.segmentQueue = filtered
    this.segmentIndex = 0
    this.segmentOnEnd = onEnd
    this.segmentOnError = onError
    this.segmentUnifiedRate = unifiedRate
    this.speakNextSegment()
  }

  private speakNextSegment(): void {
    if (this.segmentIndex >= this.segmentQueue.length || !this.synthesis) {
      const done = this.segmentOnEnd
      this.segmentQueue = []
      this.segmentIndex = 0
      this.segmentOnEnd = undefined
      this.segmentOnError = undefined
      this.segmentUnifiedRate = undefined
      done?.()
      return
    }
    const seg = this.segmentQueue[this.segmentIndex]
    this.segmentIndex++
    this.speak(
      seg.text,
      seg.lang,
      () => {
        // 优化段间切换：使用极短延迟（20ms）让浏览器有时间切换不同语言的语音引擎
        setTimeout(() => this.speakNextSegment(), 20)
      },
      (err) => {
        this.segmentQueue = []
        this.segmentIndex = 0
        this.segmentOnError?.(err)
        this.segmentOnEnd?.()
        this.segmentOnEnd = undefined
        this.segmentOnError = undefined
        this.segmentUnifiedRate = undefined
      },
      this.segmentUnifiedRate // 使用统一语速
    )
  }

  /**
   * 暂停播放
   * 
   * 注意：SpeechSynthesis API 的 pause() 方法在某些浏览器中可能不支持
   * 如果浏览器不支持，会尝试停止并重新播放
   */
  pause(): void {
    if (!this.synthesis || !this.currentUtterance) {
      return
    }

    // 检查浏览器是否支持暂停功能
    if (this.synthesis.pause) {
      this.synthesis.pause()
    } else {
      // 如果不支持暂停，直接停止
      console.warn('浏览器不支持暂停功能，将停止播放')
      this.stop()
    }
  }

  /**
   * 恢复播放
   * 
   * 注意：需要先调用 pause() 才能 resume()
   */
  resume(): void {
    if (!this.synthesis || !this.currentUtterance) {
      return
    }

    // 检查浏览器是否支持恢复功能
    if (this.synthesis.resume) {
      this.synthesis.resume()
    } else {
      console.warn('浏览器不支持恢复功能')
    }
  }

  /**
   * 停止播放
   * 
   * 停止当前播放并清除 utterance
   * 
   * 注意：用户主动停止播放时，会设置 isUserStopped 标志
   * 这样在 onerror 事件中，如果是 'interrupted' 错误且是用户主动停止，
   * 就不会触发错误回调，而是正常结束
   */
  stop(): void {
    if (!this.synthesis) {
      return
    }

    // 标记为用户主动停止
    this.isUserStopped = true
    const onEnd = this.segmentOnEnd
    this.segmentQueue = []
    this.segmentIndex = 0
    this.segmentOnEnd = undefined
    this.segmentOnError = undefined
    this.segmentUnifiedRate = undefined

    // 停止所有正在播放的语音（含队列中的）
    this.synthesis.cancel()
    this.currentUtterance = null

    if (onEnd) onEnd()
  }
  
  /**
   * 清除语音缓存
   * 
   * 当需要重新选择语音时（例如用户切换了系统语音设置），可以调用此方法
   */
  clearVoiceCache(): void {
    this.voiceCache.clear()
    console.log('[TTS] 语音缓存已清除')
  }
  
  /**
   * 获取当前缓存的语音
   * 
   * @param lang - 语言代码（如 'en-US', 'zh-CN'）
   * @returns 缓存的语音，如果没有则返回 null
   */
  getCachedVoice(lang: string): SpeechSynthesisVoice | null {
    return this.voiceCache.get(lang) || null
  }

  /**
   * 检查是否正在播放
   * @returns 是否正在播放语音
   */
  isSpeaking(): boolean {
    if (!this.synthesis) {
      return false
    }
    
    // speaking 属性表示是否有语音正在播放或暂停
    return this.synthesis.speaking
  }

  /**
   * 检查是否已暂停
   * @returns 是否已暂停
   */
  isPaused(): boolean {
    if (!this.synthesis) {
      return false
    }
    
    // paused 属性表示是否处于暂停状态
    return this.synthesis.paused
  }
}

/**
 * 导出单例实例
 * 
 * 单例模式的好处：
 * - 确保整个应用只有一个 TTS 实例
 * - 避免多个语音同时播放
 * - 方便全局状态管理
 */
export const ttsManager = new TTSManager()

/**
 * 便捷函数：快速播放文本
 * 
 * 这是一个简化版的 speak 方法，方便快速使用
 * 
 * @param text - 要朗读的文本
 * @param language - 语言类型（可选）
 */
export function speakText(text: string, language?: SupportedLanguage): void {
  ttsManager.speak(text, language)
}
