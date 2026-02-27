/**
 * 通义千问 API 配置文件
 * 
 * 通义千问是阿里云的大语言模型服务，通过 OpenAI 兼容接口调用
 * 这样我们可以使用标准的 fetch API，就像调用 OpenAI 一样简单
 */

// API 基础地址：通义千问的 OpenAI 兼容模式端点
// 为什么用兼容模式？因为 OpenAI 的 API 格式是业界标准，兼容模式让我们可以用相同的代码调用不同的模型
export const QWEN_API_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

// API 密钥：上架商店时仅使用用户填入（popup 设置），不读取 .env，避免泄露
// 本地开发若需默认值，可在 .env 设置，但 build 产物不应包含密钥
export const QWEN_API_KEY = ''

// 默认使用的模型：qwen-turbo 是通义千问的快速响应模型，适合翻译场景
// qwen-plus 更准确但更慢，qwen-max 最准确但最慢
export const QWEN_MODEL = 'qwen-turbo'

/**
 * API 请求配置
 */
export const API_CONFIG = {
  // temperature（温度）：控制输出的随机性，范围 0-2
  // 0.3 = 更确定性的输出（适合翻译，我们希望每次翻译结果一致）
  // 1.0 = 平衡创造性和准确性
  // 2.0 = 非常创造性（不适合翻译场景）
  temperature: 0.3,
  
  // top_p（核采样）：另一种控制随机性的方式，范围 0-1
  // 0.9 = 只考虑概率最高的 90% 的词汇（适合翻译，保证准确性）
  // 1.0 = 考虑所有词汇（可能产生不相关的词）
  top_p: 0.9,
  
  // max_tokens：最大返回 token 数
  max_tokens: 1000,
  // 单词/短语场景下减少生成长度，加快响应
  max_tokens_short: 400,
  // 翻译请求超时（毫秒），避免长时间无响应
  translationTimeoutMs: 14000
}

/**
 * 构建完整的 API 请求 URL
 * @param endpoint - API 端点（如 'chat/completions'）
 * @returns 完整的 API URL
 */
export function getApiUrl(endpoint: string): string {
  return `${QWEN_API_BASE_URL}/${endpoint}`
}

/**
 * 构建请求头
 * @returns 包含认证信息的请求头
 */
export function getApiHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    // Authorization 头：Bearer token 是 OAuth 2.0 标准格式
    // 通义千问使用这种方式进行身份验证
    'Authorization': `Bearer ${QWEN_API_KEY}`
  }
}
