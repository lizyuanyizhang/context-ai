# 语音朗读功能使用说明

## 功能概述

Context AI 插件使用浏览器原生的 **Web Speech API** (`window.speechSynthesis`) 实现语音朗读功能。

## 为什么选择 Web Speech API？

### ✅ 优点

1. **完全免费**：不需要第三方 API 密钥，不产生任何费用
2. **低延迟**：本地处理，无需网络请求，响应速度快（< 100ms）
3. **隐私保护**：文本不会发送到外部服务器，数据完全本地处理
4. **离线可用**：不依赖网络连接，随时可用
5. **零配置**：浏览器内置支持，无需额外安装

### ⚠️ 限制

1. **语音质量**：可能不如专业 TTS 服务（如 Google Cloud TTS、Azure TTS）
2. **语种支持**：取决于操作系统和浏览器，不同平台支持不同
3. **浏览器差异**：Chrome、Firefox、Safari 的实现可能有细微差异

## 支持的语言

- **英语** (en-US)：美式英语发音
- **德语** (de-DE)：标准德语发音

## 使用方法

### 1. 自动语言检测

插件会自动检测选中文本的语言：

```typescript
import { detectLanguage } from '@/utils/tts'

const text = "Hello, how are you?"
const lang = detectLanguage(text) // 返回 'en'

const germanText = "Guten Tag, wie geht es Ihnen?"
const lang2 = detectLanguage(germanText) // 返回 'de'
```

**检测规则**：
- 检查德语特有字符：ä, ö, ü, ß
- 检查常见德语单词：der, die, das, und, ist 等
- 默认返回英语（如果无法确定）

### 2. 播放语音

#### 方式一：使用 TTS Manager（推荐）

```typescript
import { ttsManager } from '@/utils/tts'

// 播放文本（自动检测语言）
ttsManager.speak('Hello, world!')

// 指定语言
ttsManager.speak('Guten Tag', 'de')

// 带回调函数
ttsManager.speak(
  'Hello',
  'en',
  () => console.log('播放完成'),
  (error) => console.error('播放失败', error)
)
```

#### 方式二：使用便捷函数

```typescript
import { speakText } from '@/utils/tts'

// 快速播放
speakText('Hello, world!')
speakText('Guten Tag', 'de')
```

### 3. 控制播放

```typescript
import { ttsManager } from '@/utils/tts'

// 暂停（某些浏览器可能不支持）
ttsManager.pause()

// 恢复
ttsManager.resume()

// 停止
ttsManager.stop()

// 检查状态
if (ttsManager.isSpeaking()) {
  console.log('正在播放')
}

if (ttsManager.isPaused()) {
  console.log('已暂停')
}
```

## 在 UI 中使用

### 基本示例

```tsx
import React, { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { ttsManager } from '@/utils/tts'

function SpeakButton({ text }: { text: string }) {
  const [isPlaying, setIsPlaying] = useState(false)

  const handleClick = () => {
    if (isPlaying) {
      ttsManager.stop()
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      ttsManager.speak(
        text,
        undefined, // 自动检测语言
        () => setIsPlaying(false), // 播放完成
        () => setIsPlaying(false)  // 播放失败
      )
    }
  }

  return (
    <button onClick={handleClick}>
      {isPlaying ? <VolumeX /> : <Volume2 />}
    </button>
  )
}
```

## 浏览器兼容性

| 浏览器 | 支持情况 | 备注 |
|--------|---------|------|
| Chrome | ✅ 完全支持 | 推荐使用 |
| Edge | ✅ 完全支持 | 基于 Chromium |
| Firefox | ✅ 支持 | 部分功能可能有限制 |
| Safari | ✅ 支持 | macOS/iOS |
| Opera | ✅ 支持 | 基于 Chromium |

## 常见问题

### Q: 为什么没有声音？

A: 检查以下几点：
1. 系统音量是否开启
2. 浏览器标签页是否被静音
3. 浏览器是否支持 SpeechSynthesis API
4. 操作系统是否安装了对应的语音包

### Q: 如何更换语音？

A: Web Speech API 使用系统默认语音。要更换：
- **Windows**: 设置 → 时间和语言 → 语音 → 管理语音
- **macOS**: 系统偏好设置 → 辅助功能 → 朗读内容
- **Linux**: 取决于发行版，通常需要安装 `espeak` 或 `festival`

### Q: 可以自定义语速和音调吗？

A: 可以！在 `src/utils/tts.ts` 中的 `LANGUAGE_CONFIGS` 可以调整：
- `rate`: 语速（0.1-10，1.0 是正常速度）
- `pitch`: 音调（0-2，1.0 是正常音调）
- `volume`: 音量（0-1，1.0 是最大音量）

### Q: 支持其他语言吗？

A: 可以扩展！在 `src/utils/tts.ts` 中添加新的语言配置：

```typescript
const LANGUAGE_CONFIGS = {
  // ... 现有配置
  fr: {
    lang: 'fr-FR',
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0
  }
}
```

## 技术细节

### SpeechSynthesis API 工作原理

1. **创建 Utterance**：`new SpeechSynthesisUtterance(text)`
2. **配置参数**：语言、语速、音调、音量
3. **选择语音**：从系统可用语音中选择匹配的
4. **播放**：调用 `speechSynthesis.speak(utterance)`

### 事件生命周期

```
speak() → onstart → 播放中 → onend
                ↓
            onerror (如果出错)
```

## 性能优化建议

1. **单例模式**：使用 `ttsManager` 单例，避免多个实例
2. **及时清理**：播放完成后清理 `currentUtterance` 引用
3. **避免重复播放**：播放前先调用 `stop()` 停止当前播放

## 参考资料

- [MDN: SpeechSynthesis API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [Web Speech API Specification](https://wicg.github.io/speech-api/)
- [BCP 47 语言标签](https://tools.ietf.org/html/bcp47)
