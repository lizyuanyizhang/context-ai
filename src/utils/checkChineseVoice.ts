/**
 * 检查系统是否支持中文语音
 * 
 * 这个工具函数用于检测浏览器是否支持中文语音合成
 */

/**
 * 检查系统是否支持指定语言的语音
 * 
 * @param lang - 语言代码（如 'zh-CN', 'en-US'）
 * @returns 是否支持该语言的语音
 */
export function checkLanguageSupport(lang: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false
  }
  
  const synthesis = window.speechSynthesis
  const voices = synthesis.getVoices()
  
  // 检查是否有匹配的语音
  const langPrefix = lang.split('-')[0] // 'zh-CN' -> 'zh'
  return voices.some(voice => voice.lang.startsWith(langPrefix))
}

/**
 * 获取支持中文的语音列表
 * 
 * @returns 中文语音列表
 */
export function getChineseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return []
  }
  
  const synthesis = window.speechSynthesis
  const voices = synthesis.getVoices()
  
  // 过滤出中文语音（zh-CN, zh-TW, zh-HK 等）
  return voices.filter(voice => {
    const lang = voice.lang.toLowerCase()
    return lang.startsWith('zh')
  })
}

/**
 * 检查系统是否支持中文语音
 * 
 * @returns 是否支持中文语音
 */
export function supportsChineseVoice(): boolean {
  return checkLanguageSupport('zh-CN')
}
