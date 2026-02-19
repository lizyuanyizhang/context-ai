/**
 * 通义千问 API 服务类
 * 
 * 这个服务类封装了与通义千问 API 的所有交互：
 * 1. 构建请求
 * 2. 发送请求
 * 3. 解析响应
 * 4. 错误处理
 * 5. 重试机制
 */

import {
  QWEN_API_BASE_URL,
  QWEN_API_KEY,
  QWEN_MODEL,
  API_CONFIG,
  getApiUrl,
  getApiHeaders
} from '../config/api'

/** 带超时的 fetch：超时后 abort 并抛出 */
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = API_CONFIG.translationTimeoutMs ?? 14000
): Promise<Response> {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(to))
}

/**
 * 翻译结果数据结构
 * 对应通义千问返回的 JSON 格式
 */
export interface TranslationResponse {
  // 翻译结果（中文）
  translation: string
  // 语法点拨
  grammar?: string
  // 上下文语境分析
  context?: string
  // 音标（IPA 国际音标）
  phonetic?: string
  // 读音助记（中文谐音或拼音标注）
  pronunciation?: string
  /** 哲学术语时可选：Stanford Encyclopedia of Philosophy 词条链接，如 https://plato.stanford.edu/entries/aristotle/ */
  sepLink?: string
}

/**
 * API 错误类型
 */
export class QwenApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'QwenApiError'
  }
}

/**
 * 构建翻译提示词
 * 
 * 提示词（Prompt）是告诉 AI 模型要做什么的指令
 * 好的提示词应该：
 * 1. 清晰明确：告诉模型要做什么
 * 2. 格式要求：明确要求返回 JSON 格式
 * 3. 示例说明：提供示例帮助模型理解
 * 
 * @param text - 要翻译的文本
 * @param sourceLang - 源语言（'en', 'de', 'fr', 'ja', 'es'）
 * @returns 完整的提示词
 */
function buildTranslationPrompt(
  text: string, 
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh' = 'en',
  targetLang: 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' = 'zh'
): string {
  const langMap: Record<'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh', string> = {
    'en': '英语',
    'de': '德语',
    'fr': '法语',
    'ja': '日语',
    'es': '西班牙语',
    'zh': '中文'
  }
  const sourceLangName = langMap[sourceLang] || '英语'
  const targetLangName = langMap[targetLang] || '中文'
  
  // 如果是中文翻译为其他语言，使用专门的提示词
  if (sourceLang === 'zh' && targetLang !== 'zh') {
    return `你是一位资深的专业翻译家，精通"信、达、雅"的翻译标准。请将以下中文文本翻译成${targetLangName}，并提供详细的学习辅助信息。

**翻译标准：信、达、雅**
1. **信（准确）**：忠实于原文，准确传达原意，不增不减
2. **达（流畅）**：译文通顺流畅，符合${targetLangName}表达习惯，读起来自然
3. **雅（优美）**：译文优美典雅，有文采，适合原文的文体和风格

**翻译要求（非常重要）**：
1. **准确且地道**：翻译要准确、自然，使用地道的${targetLangName}表达
2. **文体匹配**：诗歌要有诗意，散文要流畅，口语要自然
3. **语境适配**：根据上下文选择最合适的翻译，避免生硬直译
4. **文化适应**：考虑文化差异，使用符合${targetLangName}文化背景的表达

学习辅助要求：
1. **语法点拨**：
   - 直接说明关键语法点，不要解释为什么这样翻译
   - 说明重要的语法结构、词序、时态、语态等
   - 避免使用"准确传达"、"符合...语序"等论证性表述

2. **上下文分析**：
   - 分析这个词/句子在上下文中的含义
   - 在不同场景下的用法
   - 可以举例说明

请严格按照以下 JSON 格式返回，不要添加任何其他内容：
{
  "translation": "翻译结果（必须遵循信、达、雅的标准，使用地道的${targetLangName}表达）",
  "grammar": "语法点拨（直接说明关键语法点，不要解释为什么这样翻译）",
  "context": "上下文语境分析（说明在不同场景下的用法，可以举例）",
  "phonetic": "",
  "pronunciation": ""
}

要翻译的中文文本：
${text}`
  }
  
  // 如果是其他语言翻译为中文，使用原有的详细提示词
  if (targetLang === 'zh') {
    return `你是一位资深的专业翻译家，精通"信、达、雅"的翻译标准，熟悉各类标准翻译和经典译本。请将以下${sourceLangName}文本翻译成中文，并提供详细的学习辅助信息。

**核心原则：优先使用标准翻译**
在翻译之前，必须按以下优先级检索并使用已有的标准翻译：

1. **经典文学作品/名家诗歌**（最高优先级）：
   - 必须检索并使用经典译本，不得自行翻译
   - **重要：准确识别作者**，特别注意区分容易混淆的作家：
     * 德语诗人：
       - 黑塞（Hermann Hesse）：《荒原狼》《悉达多》《玻璃珠游戏》，常用译本：张佩芬、杨武能、林克
       - 海涅（Heinrich Heine）：《德国，一个冬天的童话》《诗歌集》，常用译本：冯至、钱春绮、张玉书
       - 歌德（Johann Wolfgang von Goethe）：《浮士德》《少年维特的烦恼》，常用译本：钱春绮、冯至、绿原
       - 席勒（Friedrich Schiller）：《威廉·退尔》《阴谋与爱情》，常用译本：钱春绮、张玉书
     * 英语作家：
       - 莎士比亚 → 朱生豪、梁实秋、方平
       - 雪莱、拜伦 → 查良铮、江枫、杨德豫
       - 海明威 → 吴劳、林疑今
     * 法语作家：
       - 雨果、巴尔扎克 → 郑克鲁、李玉民、傅雷
     * 西班牙语作家：
       - 塞万提斯（Miguel de Cervantes）：《堂吉诃德》，常用译本：杨绛、董燕生
       - 加西亚·马尔克斯（Gabriel García Márquez）：《百年孤独》，常用译本：范晔、黄锦炎
       - 洛尔迦（Federico García Lorca）：《吉普赛谣曲集》，常用译本：戴望舒、赵振江
       - 聂鲁达（Pablo Neruda）：《二十首情诗和一首绝望的歌》，常用译本：陈黎、黄灿然
   - **识别方法**：
     * 根据文本内容、风格、主题判断作者
     * 黑塞的作品通常涉及精神探索、东方哲学、个人成长
     * 海涅的作品通常具有讽刺性、政治性、抒情性
     * 如果不确定，可以说明"疑似[作者名]的作品"
   - 选择最广为流传、最受认可的版本
   - 在"语法点拨"中必须准确注明："这是[作者名]的经典作品，此处使用的是[翻译家名]的经典译本"

2. **名言警句/经典引文**：
   - 检索并使用已有的标准翻译
   - 如："To be or not to be" → "生存还是毁灭"（朱生豪译）
   - 如："Carpe diem" → "及时行乐"（贺拉斯名言的标准翻译）

3. **习语/成语/固定搭配**：
   - 使用标准的中文对应表达
   - 如："break the ice" → "打破僵局"（标准习语翻译）
   - 如："piece of cake" → "小菜一碟"（标准习语翻译）

4. **专业术语/学术词汇**：
   - 使用行业标准译名
   - 参考权威词典（如《英汉大词典》《新英汉词典》等）
   - 如："artificial intelligence" → "人工智能"（标准术语）

**哲学术语与 Stanford Encyclopedia of Philosophy (SEP)**：
- 当选中文本为**哲学术语、哲学概念或哲学家/著作名**（如 epistemology, virtue ethics, Aristotle, Kant, 自由意志）时，必须在返回的 JSON 中提供 **sepLink** 字段，指向斯坦福哲学百科对应词条。
- SEP 词条 URL 格式：https://plato.stanford.edu/entries/<英文slug>/（slug 为词条英文名，小写、连字符，如 aristotle, virtue-ethics, free-will）。若你确知该词条存在且知道正确 slug，请直接给出完整 URL。
- 若不确定具体词条 slug，可给出 SEP 站内搜索链接：https://plato.stanford.edu/search/search?query=<原文或英文术语>，便于用户在该站搜索。
- 非哲学术语（日常用语、科技/经济非哲学义项等）不必提供 sepLink，或留空。

5. **常见短语/日常表达**：
   - 优先使用标准、地道的翻译
   - 参考权威翻译资料和词典

6. **普通文本**（最后选择）：
   - 只有在没有标准翻译的情况下，才自行翻译
   - 遵循"信、达、雅"标准

**翻译标准：信、达、雅**
1. **信（准确）**：忠实于原文，准确传达原意，不增不减
2. **达（流畅）**：译文通顺流畅，符合中文表达习惯，读起来自然
3. **雅（优美）**：译文优美典雅，有文采，适合原文的文体和风格

**翻译要求（非常重要）**：
1. **优先标准翻译**：有标准翻译的必须使用标准翻译，不得自行创造
2. **准确且地道**：翻译要准确、自然，使用地道的中文表达
3. **文体匹配**：诗歌要有诗意，散文要流畅，口语要自然
4. **语境适配**：根据上下文选择最合适的翻译，避免生硬直译
5. **专业准确**：专业术语必须使用标准译名
6. **文化适应**：考虑文化差异，使用符合中文文化背景的表达

**多义词与歧义消歧（重要）**：
- 英语等多义词需根据常见使用场景选择义项，避免仅取字面或单一领域释义。
- **takeaway**：在总结、列表、报告、会议纪要、技术文档、学习笔记等语境下，通常指「关键要点、核心要点、要点总结」，应译为「关键要点」「核心要点」「要点」等；仅在上下文明确涉及餐饮、外卖、外带时才译作「外卖」「外带」。
- **takeaway keywords / key takeaways**：在上述总结/文档语境下应译为「关键要点」「核心词」「要点关键词」等，不要译为「外卖关键词」。
- 类似地，**key points、main points、summary、highlights** 等优先按「要点、总结、重点」理解并翻译，除非上下文明确指向其他专业领域。

**语法点拨与上下文语境：何时加类型说明、何时直接写内容**
- **仅**在以下情况时，在语法点拨/上下文语境**开头**注明类型：
  * 经典文学、哲学、文学名著（如名家诗歌、小说、戏剧）→ 可写「这是[作者名]的经典作品，此处为[翻译家名]的经典译本」或「标准/经典翻译」
  * 名言警句、经典引文、习语成语、专业术语（科学、科技、经济、学术等）的标准译法 → 可写「这是标准译法/习语对应/术语译名」等
- **普通文本**（日常用语、口语、一般网页/邮件/社交媒体文字等）：
  * **禁止**在语法点拨开头写「这是普通文本的翻译。」或「这是普通文本。」等类型标签
  * **直接**从内容开始：语法点拨直接写「关键语法点：…」；上下文语境直接写场景、用法、举例等，不要任何「这是普通文本」类前缀

学习辅助要求：
1. **语法点拨**：
   - 若是经典作品/标准翻译（经典文学、哲学、文学、科学、科技、经济等领域的标准或经典译本），可先注明来源（作者、翻译家或「标准翻译」），再写语法要点
   - 若是标准习语/术语，可说明这是标准的中文对应表达，再写要点
   - 若是普通文本，**不要写「这是普通文本的翻译」**，**直接**说明关键语法点、词序、时态、语态等，不要解释为什么这样翻译，避免「准确传达」「符合…语序」等论证性表述
   - **准确识别作者**（仅文学作品）：注意区分黑塞（精神探索、东方哲学）与海涅（讽刺、政治、抒情）等；不确定时可写「疑似[作者名]的作品」

2. **上下文语境**：
   - 若是经典作品，可先说明是经典/标准语境，再分析创作背景、主题思想、文学价值、应用场景等
   - 若是标准习语/术语，可说明标准用法与场景
   - 若是普通文本，**不要写「这是普通文本。」**，**直接**分析该词/句在上下文中的含义、不同场景下的用法并举例
3. **音标**（重要）：
   - 如果是单词，必须提供准确的 IPA 国际音标
   - 英语：使用标准 IPA，如 "happy" → /ˈhæpi/
   - 德语：使用标准 IPA，如 "glücklich" → /ˈɡlʏkliç/
   - 法语：使用标准 IPA，如 "bonjour" → /bɔ̃ʒuʁ/
   - 日语：使用假名标注，如 "こんにちは" → こんにちは（konnichiwa）
   - 确保音标准确，参考权威词典（如牛津、朗文、柯林斯等）
4. **读音助记**：提供英文读音助记，帮助记忆发音
   - 使用英文发音提示方式，包括音节划分、重音位置、发音规则等
   - 英语：音节划分 + 重音提示，如 "hello" → "hel-LO" 或 "huh-LOH"（重音在第二个音节）
   - 德语：音节划分 + 发音提示，如 "glücklich" → "GLÜCK-lich"（重音在第一个音节）
   - 法语：音节划分 + 发音提示，如 "bonjour" → "bon-JOUR"（重音在第二个音节）
   - 西班牙语：音节划分 + 重音提示，如 "hola" → "HO-la"（重音在第一个音节），"español" → "es-pa-ÑOL"（重音在最后一个音节）
   - 日语：罗马音 + 音节划分，如 "こんにちは" → "kon-ni-chi-wa"（每个音节清晰）
   - 格式：使用连字符分隔音节，大写字母表示重音位置
   - 仅当是单词或短语时提供，句子不需要

示例风格：
- "cool" → "酷" 或 "很赞"（而不是"凉爽"）
- "awesome" → "太棒了" 或 "绝了"（而不是"令人敬畏的"）
- "trending" → "热门" 或 "刷屏"（而不是"趋势"）
- "vibe" → "氛围" 或 "感觉"（而不是"振动"）

请严格按照以下 JSON 格式返回，不要添加任何其他内容：
{
  "translation": "翻译结果（必须优先使用标准翻译：经典作品用经典译本，习语用标准表达，术语用标准译名。只有在没有标准翻译时才自行翻译，且必须遵循信、达、雅的标准）",
  "grammar": "语法点拨（仅当经典文学/哲学/文学/科技/经济等标准或经典翻译时，可注明「标准翻译」或作者与翻译家；普通文本时不要写「这是普通文本的翻译」，直接写「关键语法点：…」）",
  "context": "上下文语境分析（仅当经典或标准领域时可注明类型；普通文本时不要写「这是普通文本」，直接写场景、用法与举例）",
  "phonetic": "音标，仅当是单词时提供（IPA 国际音标，必须准确）",
  "pronunciation": "读音助记，仅当是单词或短语时提供（英文发音提示，包括音节划分和重音位置，如 hel-LO 或 huh-LOH）",
  "sepLink": "仅当为哲学术语/概念/哲学家时提供：Stanford Encyclopedia of Philosophy 词条完整 URL（如 https://plato.stanford.edu/entries/aristotle/）或 SEP 搜索链接（https://plato.stanford.edu/search/search?query=原文），非哲学内容留空或不填"
}

要翻译的${sourceLangName}文本：
${text}

请直接返回 JSON，不要添加任何解释或说明文字。`
  }
  
  // 如果是其他语言之间的翻译（非中文），使用通用提示词
  return `你是一位资深的专业翻译家，精通"信、达、雅"的翻译标准。请将以下${sourceLangName}文本翻译成${targetLangName}，并提供详细的学习辅助信息。

**翻译标准：信、达、雅**
1. **信（准确）**：忠实于原文，准确传达原意，不增不减
2. **达（流畅）**：译文通顺流畅，符合${targetLangName}表达习惯，读起来自然
3. **雅（优美）**：译文优美典雅，有文采，适合原文的文体和风格

**翻译要求（非常重要）**：
1. **准确且地道**：翻译要准确、自然，使用地道的${targetLangName}表达
2. **文体匹配**：诗歌要有诗意，散文要流畅，口语要自然
3. **语境适配**：根据上下文选择最合适的翻译，避免生硬直译
4. **文化适应**：考虑文化差异，使用符合${targetLangName}文化背景的表达

学习辅助要求：
1. **语法点拨**：
   - 直接说明关键语法点，不要解释为什么这样翻译
   - 说明重要的语法结构、词序、时态、语态等
   - 避免使用"准确传达"、"符合...语序"等论证性表述

2. **上下文分析**：
   - 分析这个词/句子在上下文中的含义
   - 在不同场景下的用法
   - 可以举例说明

请严格按照以下 JSON 格式返回，不要添加任何其他内容：
{
  "translation": "翻译结果（必须遵循信、达、雅的标准，使用地道的${targetLangName}表达）",
  "grammar": "语法点拨（直接说明关键语法点，不要解释为什么这样翻译）",
  "context": "上下文语境分析（说明在不同场景下的用法，可以举例）",
  "phonetic": "",
  "pronunciation": ""
}

要翻译的${sourceLangName}文本：
${text}`
}

/**
 * 构建「增强预翻译」提示词：已有机器翻译初稿，只让模型补充语法/语境/音标/读音，并可选润色译文
 * 类比：像先查字典得到释义，再请老师补充用法和例句——减少模型生成量，加快响应
 */
function buildEnhancementPrompt(
  text: string,
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es',
  draftTranslation: string
): string {
  const langMap: Record<'en' | 'de' | 'fr' | 'ja' | 'es', string> = {
    'en': '英语',
    'de': '德语',
    'fr': '法语',
    'ja': '日语',
    'es': '西班牙语'
  }
  const langName = langMap[sourceLang] || '英语'
  return `你是一位资深翻译与语言教师。下面是一段${langName}原文及其机器翻译初稿，请仅做「补充与润色」，不要重写整段。

**原文：**
${text}

**机器翻译初稿：**
${draftTranslation}

请完成以下任务（尽量简洁，以缩短回复）：
1. **translation**：若初稿已足够好则照抄；若有明显错误或更地道的译法，给出润色后的译文。
2. **grammar**：简要语法点拨（直接说明关键语法点，不要解释为什么这样翻译）。
3. **context**：简要上下文/用法说明；若该表达在互联网或现代用法中有常见说法，可一并提及。
4. **phonetic**：仅当原文为单词或短语时，给出 IPA 音标。
5. **pronunciation**：仅当原文为单词或短语时，给出读音助记（音节与重音）。

请严格按以下 JSON 返回，不要其他内容：
{
  "translation": "最终译文（可沿用初稿或润色）",
  "grammar": "语法点拨（简明）",
  "context": "上下文与用法（可含网络/现代用法）",
  "phonetic": "音标或留空",
  "pronunciation": "读音助记或留空"
}`
}

/** 判断是否为单词/短语（无空格或仅一段），用于走短 prompt 加快响应 */
function isSingleWordOrPhrase(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 30 && !/\s{2,}/.test(t)
}

/** 单词/短语专用极简增强 prompt，减少 token 与生成时间 */
function buildWordEnhancementPrompt(
  text: string,
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es',
  draftTranslation: string
): string {
  const langMap: Record<string, string> = { en: '英语', de: '德语', fr: '法语', ja: '日语', es: '西班牙语' }
  const langName = langMap[sourceLang] || '英语'
  return `原文（${langName}）：${text}\n初稿：${draftTranslation}\n请只返回一行 JSON（不要换行、不要解释）：{"translation":"最终译文","grammar":"一两句语法","context":"一两句用法","phonetic":"IPA音标或留空","pronunciation":"读音助记或留空"}`
}

/**
 * 解析 API 响应中的 JSON
 * 
 * 通义千问可能返回：
 * 1. 纯 JSON 字符串
 * 2. Markdown 代码块包裹的 JSON（```json ... ```）
 * 3. 包含其他文字的响应
 * 
 * 我们需要提取出纯 JSON 并解析
 * 
 * @param content - API 返回的内容
 * @returns 解析后的 TranslationResponse 对象
 */
function parseTranslationResponse(content: string): TranslationResponse {
  // 移除可能的 Markdown 代码块标记
  let jsonStr = content.trim()
  
  // 如果包含 ```json 或 ``` 标记，提取其中的内容
  const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim()
  }
  
  // 尝试提取 JSON 对象（使用正则表达式）
  // 匹配 { ... } 格式的 JSON
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0]
  }
  
  try {
    // 解析 JSON
    const parsed = JSON.parse(jsonStr) as TranslationResponse
    
    // 验证必需字段
    if (!parsed.translation) {
      throw new Error('响应中缺少 translation 字段')
    }
    
    return parsed
  } catch (error) {
    // 如果解析失败，尝试从文本中提取翻译
    // 这是一个容错机制，即使 JSON 解析失败也能获取基本翻译
    
    // 尝试查找 "translation": "..." 模式
    const translationMatch = jsonStr.match(/"translation"\s*:\s*"([^"]+)"/)
    if (translationMatch) {
      return {
        translation: translationMatch[1],
        grammar: extractField(jsonStr, 'grammar'),
        context: extractField(jsonStr, 'context'),
        phonetic: extractField(jsonStr, 'phonetic'),
        pronunciation: extractField(jsonStr, 'pronunciation'),
        sepLink: extractField(jsonStr, 'sepLink')
      }
    }
    
    // 如果都失败了，抛出错误
    throw new Error(`无法解析 API 响应：${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 从文本中提取 JSON 字段值
 * 
 * @param text - 包含 JSON 的文本
 * @param fieldName - 字段名
 * @returns 字段值，如果不存在返回 undefined
 */
function extractField(text: string, fieldName: string): string | undefined {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`, 'i')
  const match = text.match(regex)
  return match ? match[1] : undefined
}

/**
 * 按「服务商配置」调用 OpenAI 兼容接口进行翻译（多服务商统一入口）
 */
export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export async function translateTextWithConfig(
  providerConfig: ProviderConfig,
  text: string,
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es' | 'zh' = 'en',
  targetLang: 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' = 'zh',
  retries: number = 2
): Promise<TranslationResponse> {
  // 如果源语言和目标语言相同，抛出错误
  if (sourceLang === targetLang) {
    throw new QwenApiError('源语言和目标语言不能相同', 'INVALID_LANG_PAIR')
  }
  if (!providerConfig.apiKey?.trim()) {
    throw new QwenApiError(
      '未配置 API Key。请点击扩展图标，在设置中填写当前服务商的 API Key。',
      'MISSING_API_KEY'
    )
  }
  if (!text || text.trim().length === 0) {
    throw new QwenApiError('翻译文本不能为空', 'EMPTY_TEXT')
  }

  const prompt = buildTranslationPrompt(text.trim(), sourceLang, targetLang)
  const baseUrl = providerConfig.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  const requestBody = {
    model: providerConfig.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: API_CONFIG.temperature,
    top_p: API_CONFIG.top_p,
    max_tokens: API_CONFIG.max_tokens,
    response_format: { type: 'json_object' } as any
  }

  const timeoutMs = API_CONFIG.translationTimeoutMs ?? 14000
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
      }, timeoutMs)

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error?.message || errorMessage
        } catch { /* ignore */ }
        throw new QwenApiError(`API 请求失败：${errorMessage}`, 'API_ERROR', response.status)
      }

      const data = await response.json()
      if (!data.choices?.[0]?.message) {
        throw new QwenApiError('API 响应格式错误', 'INVALID_RESPONSE')
      }
      const content = data.choices[0].message.content
      if (!content) {
        throw new QwenApiError('API 响应中缺少内容', 'EMPTY_RESPONSE')
      }
      return parseTranslationResponse(content)
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError'
      lastError = error instanceof QwenApiError ? error : new QwenApiError(
        isAbort ? '翻译请求超时，请稍后重试' : (error instanceof Error ? error.message : '未知错误'),
        isAbort ? 'TIMEOUT' : 'UNKNOWN_ERROR'
      )
      if (attempt < retries && !isAbort) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
        continue
      }
    }
  }
  throw lastError || new QwenApiError('翻译失败：未知错误', 'UNKNOWN_ERROR')
}

/**
 * 基于预翻译初稿调用大模型「只增强不重译」：补充语法、语境、音标与读音，可选润色译文
 * 相比完整翻译 prompt 更短、生成更少，通常响应更快
 */
export async function enhanceTranslationWithConfig(
  providerConfig: ProviderConfig,
  text: string,
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es',
  draftTranslation: string,
  retries: number = 2
): Promise<TranslationResponse> {
  if (!providerConfig.apiKey?.trim()) {
    throw new QwenApiError(
      '未配置 API Key。请点击扩展图标，在设置中填写当前服务商的 API Key。',
      'MISSING_API_KEY'
    )
  }
  if (!text?.trim() || !draftTranslation?.trim()) {
    throw new QwenApiError('原文或初稿为空', 'EMPTY_TEXT')
  }

  const isShort = isSingleWordOrPhrase(text)
  const prompt = isShort
    ? buildWordEnhancementPrompt(text.trim(), sourceLang, draftTranslation.trim())
    : buildEnhancementPrompt(text.trim(), sourceLang, draftTranslation.trim())
  const maxTokens = isShort ? (API_CONFIG.max_tokens_short ?? 400) : API_CONFIG.max_tokens
  const baseUrl = providerConfig.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  const requestBody = {
    model: providerConfig.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: API_CONFIG.temperature,
    top_p: API_CONFIG.top_p,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' } as any
  }

  const timeoutMs = API_CONFIG.translationTimeoutMs ?? 14000
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
      }, timeoutMs)
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error?.message || errorMessage
        } catch { /* ignore */ }
        throw new QwenApiError(`API 请求失败：${errorMessage}`, 'API_ERROR', response.status)
      }
      const data = await response.json()
      if (!data.choices?.[0]?.message) {
        throw new QwenApiError('API 响应格式错误', 'INVALID_RESPONSE')
      }
      const content = data.choices[0].message.content
      if (!content) {
        throw new QwenApiError('API 响应中缺少内容', 'EMPTY_RESPONSE')
      }
      return parseTranslationResponse(content)
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError'
      lastError = error instanceof QwenApiError ? error : new QwenApiError(
        isAbort ? '请求超时' : (error instanceof Error ? error.message : '未知错误'),
        isAbort ? 'TIMEOUT' : 'UNKNOWN_ERROR'
      )
      if (attempt < retries && !isAbort) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
        continue
      }
    }
  }
  throw lastError || new QwenApiError('增强翻译失败：未知错误', 'UNKNOWN_ERROR')
}

/**
 * 调用通义千问 API 进行翻译（保留：兼容 .env 或未配置多服务商时的默认行为）
 */
export async function translateText(
  text: string,
  sourceLang: 'en' | 'de' | 'fr' | 'ja' | 'es' = 'en',
  retries: number = 2
): Promise<TranslationResponse> {
  if (!QWEN_API_KEY) {
    throw new QwenApiError(
      '未配置 API Key。请点击扩展图标，在设置中选择服务商并填写 API Key。',
      'MISSING_API_KEY'
    )
  }
  return translateTextWithConfig(
    {
      baseUrl: QWEN_API_BASE_URL,
      apiKey: QWEN_API_KEY,
      model: QWEN_MODEL
    },
    text,
    sourceLang,
    'zh', // 默认目标语言为中文
    retries
  )
}

/**
 * 使用AI增强型提示词工程检测文本语言
 * 
 * 使用Few-Shot学习和Chain of Thought方法，提高检测准确性
 * 
 * @param text - 要检测的文本
 * @returns Promise<检测到的语言>
 */
export async function detectTextLanguageWithAI(text: string): Promise<'en' | 'de' | 'fr' | 'ja' | 'es'> {
  // 构建增强型提示词
  const prompt = buildLanguageDetectionPrompt(text)
  
  try {
    const response = await fetch(getApiUrl('chat/completions'), {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的语言识别专家，擅长通过字符特征和语法结构识别语言。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // 低温度，确保结果稳定
        max_tokens: 200
      })
    })
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析AI返回的结果
    // AI应该返回JSON格式：{"language": "en", "reasoning": "..."}
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0])
        const lang = result.language?.toLowerCase()
        if (['en', 'de', 'fr', 'ja', 'es'].includes(lang)) {
          return lang as 'en' | 'de' | 'fr' | 'ja' | 'es'
        }
      } catch (e) {
        console.warn('解析AI返回结果失败:', e)
      }
    }
    
    // 如果无法解析，尝试从文本中提取语言代码
    const langMatch = content.match(/(?:语言|language)[：:]\s*([a-z]{2})/i)
    if (langMatch) {
      const lang = langMatch[1].toLowerCase()
      if (['en', 'de', 'fr', 'ja', 'es'].includes(lang)) {
        return lang as 'en' | 'de' | 'fr' | 'ja' | 'es'
      }
    }
    
    // 默认返回英语
    return 'en'
  } catch (error) {
    console.error('AI语言检测失败:', error)
    // 如果AI检测失败，回退到规则检测
    return detectTextLanguage(text)
  }
}

/**
 * 构建语言检测提示词（使用Few-Shot和Chain of Thought）
 * 
 * @param text - 要检测的文本
 * @returns 完整的提示词
 */
function buildLanguageDetectionPrompt(text: string): string {
  return `请分析以下文字的字符特征和语法结构，判断其最可能的语种。

## 分析步骤（Chain of Thought）：
1. **字符特征分析**：
   - 检查是否有重音符号（如 ä, ö, ü, ß, ñ, á, é, í, ó, ú）
   - 检查是否有特殊标点符号（如 ¿, ¡）
   - 检查是否有特定字符集（如平假名、片假名、汉字）

2. **语法结构分析**：
   - 检查是否有特定语言的助词或定冠词
   - 检查单词形态和语法特征
   - 检查句子结构

3. **综合判断**：
   - 根据字符特征和语法结构综合判断
   - 如果特征不明显，优先考虑最常见的语言

## Few-Shot示例（容易搞混的例子）：

### 示例1：
文本："The man is tall"
分析：
- 字符特征：只有基本ASCII字符，无重音符号
- 语法特征：包含英语定冠词"the"，动词"is"
- 判断：英语 (en)

### 示例2：
文本："Der Mann ist groß"
分析：
- 字符特征：包含德语特有字符"ß"，名词首字母大写"Mann"
- 语法特征：包含德语定冠词"der"，动词"ist"（德语sein的第三人称单数）
- 判断：德语 (de)

### 示例3：
文本："El hombre es grande"
分析：
- 字符特征：无特殊字符，但有重音符号的可能性
- 语法特征：包含西班牙语定冠词"el"，动词"es"（西班牙语ser的第三人称单数）
- 判断：西班牙语 (es)

### 示例4：
文本："L'homme est grand"
分析：
- 字符特征：包含法语特有字符"é"，有撇号"'"
- 语法特征：包含法语定冠词"l'"，动词"est"（法语être的第三人称单数）
- 判断：法语 (fr)

### 示例5（容易误判）：
文本："The man is in the house"
分析：
- 字符特征：只有基本ASCII字符
- 语法特征：包含英语定冠词"the"（出现2次），英语动词"is"
- 注意：虽然"in"在德语中也存在，但整体语法结构是英语
- 判断：英语 (en)

### 示例6（容易误判）：
文本："Der Mann ist in dem Haus"
分析：
- 字符特征：无特殊字符，但名词首字母大写
- 语法特征：包含德语定冠词"der"和"dem"（德语第三格），动词"ist"
- 注意：虽然"in"在英语中也存在，但"dem"是德语特有的第三格定冠词
- 判断：德语 (de)

## 待检测文本：
"${text}"

请按照上述步骤分析，并返回JSON格式：
{
  "language": "语言代码（en/de/fr/ja/es）",
  "reasoning": "分析过程和判断依据"
}`
}

/**
 * 检测文本语言（混合方案：先快速检测，不确定时使用AI）
 * 
 * 改进的语言检测（基于字符和常见单词）
 * 优先级：日语 > 中文 > 特殊字符 > 英语单词 > 其他语言单词
 * 
 * @param text - 要检测的文本
 * @param useAI - 是否在不确定时使用AI检测（默认false，保持向后兼容）
 * @returns 检测到的语言（如果useAI=true，返回Promise）
 */
export function detectTextLanguage(text: string): 'en' | 'de' | 'fr' | 'ja' | 'es' {
  // 重要：优先检测日语字符（平假名和片假名）
  // 必须在中文之前检测，因为日语文本可能包含汉字
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/
  if (japaneseChars.test(text)) {
    return 'ja'
  }
  
  // 检查中文字符（在日语之后，避免日语中的汉字被误判为中文）
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return 'en' // 中文默认使用英语翻译
  }
  
  // 转换为小写，方便比较
  const lowerText = text.toLowerCase()
  
  // 统计法语、德语和西班牙语特有字符的数量（用于更准确的判断）
  const frenchCharCount = (text.match(/[àâéèêëîïôùûüÿçœæÀÂÉÈÊËÎÏÔÙÛÜŸÇŒÆ]/g) || []).length
  const germanCharCount = (text.match(/[äöüßÄÖÜ]/g) || []).length
  const spanishCharCount = (text.match(/[ñáéíóúü¿¡ÑÁÉÍÓÚÜ]/g) || []).length
  
  // 检查常见英语单词（优先检测，避免误判为其他语言）
  // 使用更严格的英语单词列表，避免与西班牙语混淆
  const englishWords = /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|as|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|should|could|can|may|might|must|shall|this|that|these|those|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|its|our|their|what|which|who|whom|whose|where|when|why|how|all|some|any|many|much|more|most|few|little|less|least|good|bad|big|small|large|long|short|high|low|new|old|young|right|wrong|true|false|yes|no|not|very|too|so|also|just|only|even|still|yet|already|here|there|now|then|today|tomorrow|yesterday|always|never|often|sometimes|usually|well|better|best|worse|worst|much|more|most|very|quite|really|too|so|such|how|what|which|who|where|when|why|how|about|above|across|after|against|along|among|around|before|behind|below|beneath|beside|between|beyond|during|except|inside|outside|through|throughout|under|underneath|until|upon|within|without)\b/i
  
  // 检查常见法语单词（扩展列表，提高准确率）
  const frenchWords = /\b(le|la|les|un|une|des|et|ou|dans|sur|avec|pour|par|de|du|de la|est|sont|être|avoir|faire|aller|venir|voir|savoir|pouvoir|vouloir|devoir|falloir|il|elle|nous|vous|ils|elles|ce|ça|qui|que|quoi|où|comment|pourquoi|quand|combien|oui|non|merci|bonjour|au revoir|s'il vous plaît|excusez-moi|je|tu|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|leurs|cette|ces|tout|toute|tous|toutes|très|plus|moins|aussi|encore|déjà|toujours|jamais|maintenant|aujourd'hui|demain|hier|ici|là|où|comment|pourquoi|combien|beaucoup|peu|assez|trop|très|bien|mal|bon|mauvais|grand|petit|nouveau|vieux|jeune|vieille|beau|belle|joli|jolie)\b/i
  
  // 检查常见德语单词（改进：移除与英语重叠的单词，使用更独特的德语单词）
  // 注意：移除了 und, ist, sind, in, an, von, zu, auf, mit, für, pro, per, via 等与英语重叠的单词
  const germanWords = /\b(der|die|das|haben|sein|werden|können|müssen|sollten|wenn|aber|oder|durch|gegen|ohne|um|seit|während|wegen|trotz|statt|außer|innerhalb|außerhalb|dank|gemäß|entsprechend|zufolge|anlässlich|hinsichtlich|bezüglich|betreffs|einschließlich|exklusive|inklusive|kontra|bis|ich|du|er|sie|es|wir|ihr|mein|dein|sein|ihr|unser|euer|dieser|jener|welcher|alle|manche|viele|wenige|einige|keine|nicht|auch|noch|schon|immer|nie|jetzt|heute|morgen|gestern|hier|dort|wo|wie|warum|wann|was|wer|welche|welcher|welches|groß|klein|neu|alt|jung|schön|hässlich|gut|schlecht|viel|wenig|mehr|weniger|sehr|genug|nicht genug|über|unter|vor|nach|bei)\b/i
  
  // 检查常见西班牙语单词（改进：移除与英语/德语重叠的单词，使用更独特的西班牙语单词）
  // 注意：移除了 en, de, a, con, por, para, ir, ver, mi, tu, su, bien, mal, no 等重叠单词
  const spanishWords = /\b(el|la|los|las|un|una|ser|estar|tener|hacer|venir|saber|poder|querer|deber|yo|tú|él|ella|nosotros|vosotros|ellos|ellas|este|ese|aquel|esta|esa|aquella|estos|esos|aquellos|estas|esas|aquellas|nuestro|vuestro|mío|tuyo|suyo|muy|más|menos|también|tampoco|siempre|nunca|ahora|hoy|mañana|ayer|aquí|allí|dónde|cómo|por qué|cuándo|cuánto|qué|quién|cuál|mucho|poco|bastante|demasiado|bueno|malo|grande|pequeño|nuevo|viejo|joven|hermoso|feo|gracias|por favor|de nada|hola|adiós|perdón|lo siento|sí)\b/i
  
  // 如果同时有多个语言的特有字符，根据数量判断
  const charCounts = [
    { lang: 'fr' as const, count: frenchCharCount },
    { lang: 'de' as const, count: germanCharCount },
    { lang: 'es' as const, count: spanishCharCount }
  ].filter(item => item.count > 0)
  
  if (charCounts.length > 1) {
    // 按字符数量排序，选择最多的
    charCounts.sort((a, b) => b.count - a.count)
    // 如果最多的明显多于其他的，直接返回
    if (charCounts[0].count > charCounts[1].count) {
      return charCounts[0].lang
    }
    // 如果数量相近，检查常见单词
    if (charCounts[0].lang === 'fr' && frenchWords.test(lowerText) && !germanWords.test(lowerText) && !spanishWords.test(lowerText) && !englishWords.test(lowerText)) {
      return 'fr'
    }
    if (charCounts[0].lang === 'de' && germanWords.test(lowerText) && !frenchWords.test(lowerText) && !spanishWords.test(lowerText) && !englishWords.test(lowerText)) {
      return 'de'
    }
    if (charCounts[0].lang === 'es' && spanishWords.test(lowerText) && !frenchWords.test(lowerText) && !germanWords.test(lowerText) && !englishWords.test(lowerText)) {
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
  
  // 默认返回英语
  return 'en'
}

/**
 * 检测文本语言（使用AI增强检测，可选）
 * 
 * 这是一个独立的函数，可以在需要时调用AI进行更准确的检测
 * 
 * @param text - 要检测的文本
 * @returns Promise<检测到的语言>
 */
export async function detectTextLanguageWithAIEnhanced(text: string): Promise<'en' | 'de' | 'fr' | 'ja' | 'es'> {
  // 先使用快速检测
  const quickResult = detectTextLanguage(text)
  
  // 如果快速检测结果不确定（默认英语），且文本长度适中，使用AI检测
  // 避免对太短的文本使用AI（浪费资源）
  if (quickResult === 'en' && text.trim().length >= 5 && text.trim().length <= 500) {
    try {
      return await detectTextLanguageWithAI(text)
    } catch (error) {
      console.warn('AI语言检测失败，使用快速检测结果:', error)
      return quickResult
    }
  }
  
  return quickResult
}
