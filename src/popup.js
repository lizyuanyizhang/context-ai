/**
 * Popup 脚本：选择服务商后只显示该家的 API Key，保存即可使用
 */
(function () {
  var STORAGE_KEY = 'context_ai_api_config'
  var PROVIDERS = [
    { id: 'qwen', name: '通义千问', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
    { id: 'deepseek', name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
    { id: 'doubao', name: '豆包', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-1.5-pro-32k' },
    { id: 'kimi', name: 'Kimi', defaultBaseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
    { id: 'zhipu', name: '智谱 GLM', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
    { id: 'gemini', name: 'Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-1.5-flash' },
    { id: 'openai', name: 'ChatGPT (OpenAI)', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
    { id: 'grok', name: 'Grok (xAI)', defaultBaseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-2-latest' }
  ]

  function getDefaultConfig() {
    var providers = {}
    PROVIDERS.forEach(function (p) {
      providers[p.id] = { apiKey: '', baseUrl: '', model: '' }
    })
    return { selectedProvider: 'qwen', providers: providers, preTranslateOnly: false }
  }

  function getProvider(id) {
    return PROVIDERS.filter(function (p) { return p.id === id })[0] || PROVIDERS[0]
  }

  function updateApiKeyHint() {
    var apiKeyEl = document.getElementById('apiKeyInput')
    var hintEl = document.getElementById('apiKeyHint')
    if (!apiKeyEl || !hintEl) return
    
    var apiKey = (apiKeyEl.value && apiKeyEl.value.trim()) ? apiKeyEl.value.trim() : ''
    var selectedIdEl = document.getElementById('selectedProvider')
    var selectedId = selectedIdEl ? selectedIdEl.value : 'qwen'
    var provider = getProvider(selectedId)
    
    if (apiKey) {
      // 如果已填入 API Key，隐藏提示
      hintEl.style.display = 'none'
      hintEl.classList.remove('empty')
    } else {
      // 如果未填入，显示提示
      hintEl.style.display = 'block'
      hintEl.classList.add('empty')
      // 根据服务商显示不同的提示文字
      var hintText = '请填入你的 ' + provider.name + ' API Key 以使用翻译功能'
      hintEl.textContent = hintText
    }
  }

  function fillCurrentForm(config, selectedId) {
    config = config || getDefaultConfig()
    selectedId = selectedId || config.selectedProvider || 'qwen'
    var provider = getProvider(selectedId)
    var opt = (config.providers && config.providers[selectedId]) || {}
    var apiKeyEl = document.getElementById('apiKeyInput')
    var baseUrlEl = document.getElementById('baseUrlInput')
    var modelEl = document.getElementById('modelInput')
    if (apiKeyEl) {
      apiKeyEl.value = opt.apiKey || ''
      apiKeyEl.placeholder = provider ? '请填入你的 ' + provider.name + ' API Key' : '请填入你的 API Key'
      // 更新提示显示
      updateApiKeyHint()
    }
    if (baseUrlEl) {
      baseUrlEl.value = opt.baseUrl || ''
      baseUrlEl.placeholder = provider ? (provider.defaultBaseUrl || '留空使用默认') : '留空使用默认'
    }
    if (modelEl) {
      modelEl.value = opt.model || ''
      modelEl.placeholder = provider ? (provider.defaultModel || '留空使用默认') : '留空使用默认'
    }
  }

  function loadConfig() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      var sel = document.getElementById('selectedProvider')
      if (sel) sel.value = 'qwen'
      fillCurrentForm(getDefaultConfig(), 'qwen')
      return
    }
    chrome.storage.local.get(STORAGE_KEY, function (raw) {
      var config = raw && raw[STORAGE_KEY] && raw[STORAGE_KEY].selectedProvider
        ? raw[STORAGE_KEY]
        : getDefaultConfig()
      var sel = document.getElementById('selectedProvider')
      if (sel) sel.value = config.selectedProvider || 'qwen'
      fillCurrentForm(config, config.selectedProvider)
      var preOnly = document.getElementById('preTranslateOnly')
      if (preOnly) preOnly.checked = !!config.preTranslateOnly
    })
  }

  function showHint(message, isError) {
    var hint = document.getElementById('saveHint')
    if (!hint) return
    hint.textContent = message
    hint.className = 'visible'
    hint.style.color = isError ? '#eb5757' : '#0f7b6c'
    setTimeout(function () {
      hint.className = ''
      hint.style.color = ''
    }, 3000)
  }

  function saveConfig(e) {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    var selectedIdEl = document.getElementById('selectedProvider')
    var apiKeyEl = document.getElementById('apiKeyInput')
    var baseUrlEl = document.getElementById('baseUrlInput')
    var modelEl = document.getElementById('modelInput')
    var saveBtn = document.getElementById('saveBtn')
    if (!selectedIdEl || !apiKeyEl || !saveBtn) return

    var selectedId = selectedIdEl.value
    var apiKey = (apiKeyEl.value && apiKeyEl.value.trim()) ? apiKeyEl.value.trim() : ''
    var baseUrl = (baseUrlEl && baseUrlEl.value) ? baseUrlEl.value.trim() : ''
    var model = (modelEl && modelEl.value) ? modelEl.value.trim() : ''

    saveBtn.disabled = true
    saveBtn.textContent = '保存中…'

    function done() {
      saveBtn.disabled = false
      saveBtn.textContent = '保存并开始使用'
    }

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      showHint('无法访问扩展存储', true)
      done()
      return
    }

    var preOnlyEl = document.getElementById('preTranslateOnly')
    var preTranslateOnly = preOnlyEl ? preOnlyEl.checked : false

    try {
      chrome.storage.local.get(STORAGE_KEY, function (raw) {
        var config
        try {
          config = (raw && raw[STORAGE_KEY] && raw[STORAGE_KEY].providers)
            ? { selectedProvider: raw[STORAGE_KEY].selectedProvider || 'qwen', providers: raw[STORAGE_KEY].providers, preTranslateOnly: raw[STORAGE_KEY].preTranslateOnly }
            : getDefaultConfig()
        } catch (err) {
          config = getDefaultConfig()
        }
        config.selectedProvider = selectedId
        config.preTranslateOnly = preTranslateOnly
        if (!config.providers) config.providers = {}
        if (!config.providers[selectedId]) config.providers[selectedId] = { apiKey: '', baseUrl: '', model: '' }
        config.providers[selectedId].apiKey = apiKey
        config.providers[selectedId].baseUrl = baseUrl
        config.providers[selectedId].model = model

        var payload = {}
        payload[STORAGE_KEY] = config
        chrome.storage.local.set(payload, function () {
          done()
          if (chrome.runtime && chrome.runtime.lastError) {
            showHint('保存失败：' + chrome.runtime.lastError.message, true)
            return
          }
          showHint('已保存，可直接使用', false)
        })
      })
    } catch (err) {
      showHint('保存出错：' + (err && err.message ? err.message : String(err)), true)
      done()
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadConfig()

    var sel = document.getElementById('selectedProvider')
    if (sel) {
      sel.addEventListener('change', function () {
        chrome.storage.local.get(STORAGE_KEY, function (raw) {
          var config = raw && raw[STORAGE_KEY] && raw[STORAGE_KEY].selectedProvider
            ? raw[STORAGE_KEY]
            : getDefaultConfig()
          fillCurrentForm(config, sel.value)
        })
      })
    }

    // 监听 API Key 输入框的变化，实时更新提示
    var apiKeyEl = document.getElementById('apiKeyInput')
    if (apiKeyEl) {
      apiKeyEl.addEventListener('input', updateApiKeyHint)
      apiKeyEl.addEventListener('blur', updateApiKeyHint)
      apiKeyEl.addEventListener('focus', updateApiKeyHint)
    }

    var saveBtn = document.getElementById('saveBtn')
    if (saveBtn) {
      saveBtn.setAttribute('type', 'button')
      saveBtn.addEventListener('click', function (e) {
        saveConfig(e)
        return false
      })
    }

    var openSettings = document.getElementById('openSettings')
    if (openSettings) {
      openSettings.addEventListener('click', function () {
        if (chrome.runtime && chrome.tabs) {
          chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id })
        }
      })
    }
  })
})()
