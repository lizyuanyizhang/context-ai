/**
 * 快速预翻译服务（LibreTranslate）
 *
 * 类比：像餐厅先上一杯水、再慢慢上主菜——先给用户即时译文，再让大模型补充语法/语境。
 * 参考：Google 翻译等产品通过「小模型/规则 + 缓存」先返回结果，再用大模型做质量增强。
 */

const LIBRE_TRANSLATE_URL = 'https://libretranslate.com/translate'

/** 我们支持的源语言 → LibreTranslate 的 source 参数（ISO 639-1） */
const SOURCE_MAP = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  ja: 'ja',
  es: 'es'
} as const

/** 目标语言映射 */
const TARGET_MAP: Record<'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh', string> = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
  ja: 'ja',
  zh: 'zh'
}

export interface PreTranslateResult {
  translation: string
}

const PRE_TRANSLATE_TIMEOUT_MS = 3000

/**
 * 调用 LibreTranslate 做快速预翻译（无需 API Key，有频率限制）
 * 6 秒超时，失败时抛出错误，调用方可静默回退到仅用大模型
 */
export async function preTranslate(
  text: string,
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh' = 'en',
  targetLang: 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' = 'zh'
): Promise<PreTranslateResult> {
  const source = sourceLang === 'zh' ? 'zh' : (SOURCE_MAP[sourceLang] ?? 'en')
  const target = TARGET_MAP[targetLang] ?? 'zh'
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PRE_TRANSLATE_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(LIBRE_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text'
      }),
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LibreTranslate ${res.status}: ${err}`)
  }
  const data = await res.json()
  const translation = data?.translatedText
  if (typeof translation !== 'string') {
    throw new Error('LibreTranslate 返回格式异常')
  }
  return { translation }
}
