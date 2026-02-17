/**
 * 多 API 服务商配置
 * 支持：千问、DeepSeek、豆包、Kimi、智谱、Gemini、ChatGPT、Grok
 * 均按 OpenAI 兼容接口调用（同一套 messages + model）
 */

export type ProviderId =
  | 'qwen'      // 千问
  | 'deepseek'  // DeepSeek
  | 'doubao'    // 豆包
  | 'kimi'      // Kimi
  | 'zhipu'     // 智谱
  | 'gemini'    // Gemini
  | 'openai'    // ChatGPT
  | 'grok'      // Grok

export interface ProviderDef {
  id: ProviderId
  name: string
  defaultBaseUrl: string
  defaultModel: string
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'qwen', name: '千问 (通义)', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  { id: 'deepseek', name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { id: 'doubao', name: '豆包 (字节)', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-1.5-pro-32k' },
  { id: 'kimi', name: 'Kimi (月之暗面)', defaultBaseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  { id: 'zhipu', name: '智谱 (GLM)', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  { id: 'gemini', name: 'Gemini (Google)', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-1.5-flash' },
  { id: 'openai', name: 'ChatGPT (OpenAI)', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { id: 'grok', name: 'Grok (xAI)', defaultBaseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-2-latest' }
]

export const PROVIDER_MAP: Record<ProviderId, ProviderDef> = PROVIDERS.reduce((acc, p) => {
  acc[p.id] = p
  return acc
}, {} as Record<ProviderId, ProviderDef>)
