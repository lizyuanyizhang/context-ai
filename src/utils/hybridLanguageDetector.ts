/**
 * 混合架构语言检测器
 * 
 * 三步检测流程：
 * 1. FastText极速识别：如果置信度 > 0.9，直接返回
 * 2. 正则表达式/字符扫描：检查日语假名(あ/ア)或中文汉字，区分中日韩
 * 3. 千问LLM：仅当本地识别置信度低时（如只有2个词），才请求LLM辅助判断
 * 
 * 设计优势：
 * - FastText：快速、准确，适合大多数场景（可选，需要安装 fasttext.wasm.js）
 * - 字符扫描：硬核方法，准确区分中日韩
 * - LLM：智能判断，处理边界情况
 */

import { languageFilter, getCharStats } from './languageFilter'
import { detectTextLanguageWithAI } from '../services/qwenApi'

/**
 * 支持的语言类型
 */
export type SupportedLanguage = 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh'

/**
 * 检测结果（包含置信度）
 */
export interface DetectionResult {
  language: SupportedLanguage
  confidence: number
  method: 'fasttext' | 'charscan' | 'llm' | 'fallback'
  reasoning?: string
}

/**
 * FastText模型实例（单例）
 */
let fastTextModel: any = null
let fastTextLoading = false
let fastTextLoadPromise: Promise<any> | null = null
let fastTextAvailable: boolean | null = null // null表示未检测，true/false表示检测结果

/**
 * 语言代码映射：FastText返回的ISO 639-1代码 -> 我们的语言代码
 */
const LANGUAGE_CODE_MAP: Record<string, SupportedLanguage> = {
  'en': 'en',
  'de': 'de',
  'fr': 'fr',
  'ja': 'ja',
  'es': 'es',
  'zh': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh'
}

/**
 * 检测FastText是否可用（延迟检测，避免模块加载时出错）
 */
async function checkFastTextAvailability(): Promise<boolean> {
  // 如果已经检测过，直接返回结果
  if (fastTextAvailable !== null) {
    return fastTextAvailable
  }
  
  try {
    // 使用动态导入，避免TypeScript编译时检查
    // 注意：需要在运行时环境中，FastText包必须已安装
    const fastTextModule = await (new Function('return import("fasttext.wasm.js")'))()
    if (fastTextModule) {
      fastTextAvailable = true
      return true
    }
  } catch (e) {
    // FastText不可用（包未安装或加载失败）
    fastTextAvailable = false
    return false
  }
  
  fastTextAvailable = false
  return false
}

/**
 * 初始化FastText模型
 * 
 * @returns FastText模型实例，如果FastText不可用则返回null
 */
async function initFastText(): Promise<any | null> {
  // 检查FastText是否可用
  const available = await checkFastTextAvailability()
  if (!available) {
    return null
  }
  
  // 如果已经加载，直接返回
  if (fastTextModel) {
    return fastTextModel
  }
  
  // 如果正在加载，等待加载完成
  if (fastTextLoading && fastTextLoadPromise) {
    return fastTextLoadPromise
  }
  
  // 开始加载
  fastTextLoading = true
  fastTextLoadPromise = (async () => {
    try {
      // 动态导入FastText
      const fastTextModule = await (new Function('return import("fasttext.wasm.js")'))() as any
      const { getLIDModel } = fastTextModule
      const lidModel = await getLIDModel()
      await lidModel.load()
      fastTextModel = lidModel
      fastTextLoading = false
      return lidModel
    } catch (error) {
      console.warn('FastText模型加载失败:', error)
      fastTextLoading = false
      fastTextLoadPromise = null
      fastTextAvailable = false // 标记为不可用
      return null
    }
  })()
  
  return fastTextLoadPromise
}

/**
 * 第一步：FastText极速识别
 * 
 * @param text - 要检测的文本
 * @returns 检测结果，如果置信度不足或FastText不可用则返回null
 */
async function detectWithFastText(text: string): Promise<DetectionResult | null> {
  // 检查FastText是否可用
  const available = await checkFastTextAvailability()
  if (!available) {
    return null
  }
  
  try {
    // 初始化FastText模型
    const model = await initFastText()
    
    // 如果模型加载失败，返回null
    if (!model) {
      return null
    }
    
    // 执行检测
    const result = await model.identify(text)
    
    // 获取置信度（FastText返回的是概率）
    const confidence = result.score || 0
    
    // 降低阈值：如果置信度 > 0.85，直接返回（提高FastText的使用率）
    if (confidence > 0.85) {
      const langCode = LANGUAGE_CODE_MAP[result.alpha2?.toLowerCase() || '']
      
      // 只返回我们支持的语言
      if (langCode && ['en', 'de', 'fr', 'ja', 'es', 'zh'].includes(langCode)) {
        return {
          language: langCode,
          confidence: confidence,
          method: 'fasttext',
          reasoning: `FastText检测，置信度: ${(confidence * 100).toFixed(1)}%`
        }
      }
    }
    
    // 置信度不足，返回null，继续下一步检测
    return null
  } catch (error) {
    console.warn('FastText检测失败，继续使用其他方法:', error)
    fastTextAvailable = false // 标记为不可用，避免重复尝试
    return null
  }
}

/**
 * 第二步：正则表达式/字符扫描（硬核方法，区分中日韩）
 * 
 * @param text - 要检测的文本
 * @returns 检测结果，如果无法确定则返回null
 */
function detectWithCharScan(text: string): DetectionResult | null {
  // 获取字符统计
  const stats = getCharStats(text)
  
  // 规则1：检查日语假名（最硬核的方法，优先级最高）
  // 平假名：あいうえお... (U+3040-U+309F)
  // 片假名：アイウエオ... (U+30A0-U+30FF)
  // 重要：日语假名是日语最独特的特征，必须优先检测
  if (stats.japanese > 0) {
    // 降低阈值：只要有假名就优先判断为日语
    // 因为假名是日语独有的，其他语言不使用
    const japaneseRatio = stats.japanese / stats.total
    if (japaneseRatio > 0.05 || stats.japanese >= 1) {
      return {
        language: 'ja',
        confidence: Math.min(0.98, 0.8 + japaneseRatio * 0.18),
        method: 'charscan',
        reasoning: `检测到${stats.japanese}个日语假名字符（平假名/片假名），这是日语最独特的特征`
      }
    }
  }
  
  // 规则2：检查中文汉字（最硬核的方法）
  // 中文汉字：[\u4e00-\u9fa5]
  // 重要：必须排除日语（日语也使用汉字，但通常伴随假名）
  if (stats.chinese > 0 && stats.japanese === 0) {
    // 如果包含中文汉字，且没有日语假名，返回中文
    const chineseRatio = stats.chinese / stats.total
    // 降低阈值：只要有汉字且没有假名，就判断为中文
    if (chineseRatio > 0.05 || stats.chinese >= 1) {
      return {
        language: 'zh',
        confidence: Math.min(0.98, 0.8 + chineseRatio * 0.18),
        method: 'charscan',
        reasoning: `检测到${stats.chinese}个中文字符，且无日语假名`
      }
    }
  }
  
  // 规则3：使用前置过滤器（字符特征检测）
  const filterResult = languageFilter(text)
  if (filterResult) {
    // 根据字符统计计算置信度
    let confidence = 0.75 // 提高基础置信度
    
    // 如果有对应的特殊字符，提高置信度
    if (filterResult === 'de' && stats.german > 0) {
      const germanRatio = stats.german / stats.total
      confidence = Math.min(0.95, 0.75 + germanRatio * 0.2)
    } else if (filterResult === 'fr' && stats.french > 0) {
      const frenchRatio = stats.french / stats.total
      confidence = Math.min(0.95, 0.75 + frenchRatio * 0.2)
    } else if (filterResult === 'es' && stats.spanish > 0) {
      const spanishRatio = stats.spanish / stats.total
      confidence = Math.min(0.95, 0.75 + spanishRatio * 0.2)
    } else if (filterResult === 'en') {
      // 英语：如果没有其他语言特征，置信度较高
      if (stats.german === 0 && stats.french === 0 && stats.spanish === 0 && stats.accented === 0) {
        confidence = 0.8
      }
    }
    
    // 只有置信度足够高才返回
    if (confidence > 0.75) {
      return {
        language: filterResult as SupportedLanguage,
        confidence: confidence,
        method: 'charscan',
        reasoning: `字符特征检测：${filterResult}，置信度${(confidence * 100).toFixed(1)}%`
      }
    }
  }
  
  // 无法确定，返回null
  return null
}

/**
 * 计算本地检测的置信度
 * 
 * @param text - 要检测的文本
 * @param charScanResult - 字符扫描结果（如果有）
 * @returns 置信度分数（0-1）
 */
function calculateLocalConfidence(text: string, charScanResult: DetectionResult | null = null): number {
  const stats = getCharStats(text)
  const words = text.trim().split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  
  // 如果字符扫描有明确结果，置信度较高
  if (charScanResult && charScanResult.confidence > 0.8) {
    return 0.85
  }
  
  // 如果有明显的字符特征，置信度较高
  if (stats.japanese > 0 || stats.chinese > 0) {
    return 0.85 // 日语假名和中文汉字是最硬核的特征
  }
  
  if (stats.german > 0 || stats.french > 0 || stats.spanish > 0) {
    // 特殊字符特征，根据数量判断
    const specialCharCount = stats.german + stats.french + stats.spanish
    const specialCharRatio = specialCharCount / stats.total
    if (specialCharRatio > 0.1 || specialCharCount >= 2) {
      return 0.8
    }
    return 0.6
  }
  
  // 如果单词数量 >= 5，置信度中等
  if (wordCount >= 5) {
    return 0.65
  }
  
  // 如果单词数量 >= 3，置信度中等偏低
  if (wordCount >= 3) {
    return 0.55
  }
  
  // 如果只有1-2个词，置信度低（需要LLM辅助）
  if (wordCount <= 2) {
    return 0.3
  }
  
  return 0.5
}

/**
 * 第三步：千问LLM辅助判断（仅当本地识别置信度低时）
 * 
 * @param text - 要检测的文本
 * @returns 检测结果
 */
async function detectWithLLM(text: string): Promise<DetectionResult> {
  try {
    const lang = await detectTextLanguageWithAI(text)
    return {
      language: lang,
      confidence: 0.85, // LLM检测的置信度
      method: 'llm',
      reasoning: '使用千问LLM结合上下文辅助判断'
    }
  } catch (error) {
    console.error('LLM检测失败:', error)
    // 如果LLM检测失败，返回默认结果
    return {
      language: 'en',
      confidence: 0.5,
      method: 'fallback',
      reasoning: 'LLM检测失败，使用默认英语'
    }
  }
}

/**
 * 混合架构语言检测（主函数）
 * 
 * 三步检测流程：
 * 1. FastText极速识别（置信度>0.9直接返回）
 * 2. 正则表达式/字符扫描（日语假名、中文汉字）
 * 3. 千问LLM（仅当本地识别置信度低时）
 * 
 * @param text - 要检测的文本
 * @returns 检测结果（包含语言、置信度、检测方法）
 * 
 * 使用示例：
 * ```typescript
 * const result = await hybridLanguageDetect("Der Mann ist groß")
 * console.log(result.language) // 'de'
 * console.log(result.confidence) // 0.95
 * console.log(result.method) // 'fasttext' 或 'charscan' 或 'llm'
 * ```
 */
export async function hybridLanguageDetect(text: string): Promise<DetectionResult> {
  // 如果文本为空或太短，返回默认结果
  if (!text || text.trim().length === 0) {
    return {
      language: 'en',
      confidence: 0.5,
      method: 'fallback',
      reasoning: '文本为空'
    }
  }
  
  // 第一步：FastText极速识别（如果可用）
  const fastTextResult = await detectWithFastText(text)
  // 降低阈值：置信度 > 0.85 就返回（提高FastText的使用率）
  if (fastTextResult && fastTextResult.confidence > 0.85) {
    return fastTextResult
  }
  
  // 第二步：正则表达式/字符扫描（硬核方法，区分中日韩）
  const charScanResult = detectWithCharScan(text)
  // 提高阈值：置信度 > 0.75 才返回（减少误判）
  if (charScanResult && charScanResult.confidence > 0.75) {
    return charScanResult
  }
  
  // 计算本地检测的置信度（传入字符扫描结果）
  const localConfidence = calculateLocalConfidence(text, charScanResult)
  
  // 第三步：如果本地识别置信度低（<0.7），使用LLM辅助判断
  // 提高阈值：<0.7 就使用LLM（更积极地使用LLM提高准确率）
  if (localConfidence < 0.7) {
    const llmResult = await detectWithLLM(text)
    return llmResult
  }
  
  // 如果本地置信度中等，返回字符扫描结果（如果有）
  if (charScanResult) {
    return charScanResult
  }
  
  // 如果FastText有结果但置信度不高，也可以返回
  if (fastTextResult) {
    return fastTextResult
  }
  
  // 最后兜底：返回默认英语
  return {
    language: 'en',
    confidence: 0.5,
    method: 'fallback',
    reasoning: '所有检测方法都无法确定，使用默认英语'
  }
}

/**
 * 同步版本的语言检测（仅使用字符扫描，不调用FastText和LLM）
 * 
 * 适用于需要同步返回的场景
 * 
 * @param text - 要检测的文本
 * @returns 检测结果
 */
export function hybridLanguageDetectSync(text: string): DetectionResult {
  const charScanResult = detectWithCharScan(text)
  
  if (charScanResult) {
    return charScanResult
  }
  
  // 默认返回英语
  return {
    language: 'en',
    confidence: 0.5,
    method: 'fallback',
    reasoning: '字符扫描无法确定，使用默认英语'
  }
}
