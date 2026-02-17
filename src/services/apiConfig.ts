/**
 * API 配置存储
 * 使用 chrome.storage.local 保存用户选择的服务商及各家的 API Key / BaseURL / Model
 */

import type { ProviderId } from '../config/providers'

const STORAGE_KEY = 'context_ai_api_config'

export interface ProviderOption {
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface ApiConfig {
  selectedProvider: ProviderId
  providers: Partial<Record<ProviderId, ProviderOption>>
  /** 为 true 时仅使用预翻译（LibreTranslate），不调用大模型 */
  preTranslateOnly?: boolean
}

const DEFAULT_CONFIG: ApiConfig = {
  selectedProvider: 'qwen',
  providers: {}
}

export async function getApiConfig(): Promise<ApiConfig> {
  const raw = await chrome.storage.local.get(STORAGE_KEY)
  const stored = raw[STORAGE_KEY]
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_CONFIG }
  }
  return {
    selectedProvider: (stored.selectedProvider as ProviderId) || DEFAULT_CONFIG.selectedProvider,
    providers: typeof stored.providers === 'object' ? stored.providers : {},
    preTranslateOnly: !!stored.preTranslateOnly
  }
}

export async function setApiConfig(config: ApiConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config })
}

export async function setSelectedProvider(provider: ProviderId): Promise<void> {
  const config = await getApiConfig()
  config.selectedProvider = provider
  await setApiConfig(config)
}

export async function setProviderOption(
  provider: ProviderId,
  option: Partial<ProviderOption>
): Promise<void> {
  const config = await getApiConfig()
  if (!config.providers[provider]) {
    config.providers[provider] = { apiKey: '', baseUrl: undefined, model: undefined }
  }
  Object.assign(config.providers[provider]!, option)
  await setApiConfig(config)
}
