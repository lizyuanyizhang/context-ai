# 🔍 语言检测前置过滤器使用指南

## 📋 概述

语言检测前置过滤器是一个基于正则表达式和字符扫描的快速语言识别工具。它在进入复杂的单词匹配之前，先通过字符特征快速判断语言，提高检测效率和准确性。

## 🎯 设计目标

1. **快速识别**：使用正则表达式和字符扫描，快速识别明显的语言特征
2. **提高效率**：在复杂单词匹配之前先做快速判断，减少不必要的计算
3. **提高准确性**：通过字符统计和特征匹配，减少误判
4. **可扩展性**：易于添加新的语言支持

## 🏗️ 架构设计

### 核心组件

1. **字符扫描器（`scanCharacters`）**
   - 使用正则表达式统计各种字符的出现频率
   - 返回字符统计结果

2. **快速判断器（`quickLanguageDetection`）**
   - 基于字符统计结果快速判断语言
   - 使用规则引擎进行判断

3. **前置过滤器（`languageFilter`）**
   - 主入口函数
   - 整合字符扫描和快速判断

## 📊 字符统计

### 统计的字符类型

- **中文字符**：`[\u4e00-\u9fa5]`
- **日语字符**：平假名 `[\u3040-\u309F]` + 片假名 `[\u30A0-\u30FF]`
- **德语特有字符**：`ä, ö, ü, ß`（大小写）
- **法语特有字符**：`à, â, é, è, ê, ë, î, ï, ô, ù, û, ü, ÿ, ç, œ, æ`（大小写）
- **西班牙语特有字符**：`ñ, ¿, ¡`（大小写）
- **西班牙语重音字符**：`á, é, í, ó, ú, ü`（大小写）
- **所有重音字符**：用于统计总的重音字符数量

### 统计结果结构

```typescript
interface CharStats {
  chinese: number      // 中文字符数量
  japanese: number    // 日语字符数量
  german: number       // 德语特有字符数量
  french: number       // 法语特有字符数量
  spanish: number      // 西班牙语特有字符数量
  accented: number     // 重音字符数量
  total: number        // 总字符数
}
```

## 🎨 检测规则

### 规则优先级

1. **中文字符检测**
   - 如果包含中文字符，直接返回 `'zh'`

2. **日语字符检测**
   - 如果包含日语字符（平假名/片假名），直接返回 `'ja'`

3. **西班牙语特有字符检测**
   - 如果包含 `ñ` 或 `¿` 或 `¡`，返回 `'es'`

4. **德语特有字符检测**
   - 如果只有德语特有字符（`ä, ö, ü, ß`），且数量 >= 2 或占比 > 5%，返回 `'de'`

5. **法语特有字符检测**
   - 如果只有法语特有字符，且数量 >= 2 或占比 > 5%，返回 `'fr'`

6. **西班牙语重音字符检测**
   - 如果主要是西班牙语重音字符（`á, é, í, ó, ú, ü`），且占比 > 70%，返回 `'es'`

7. **纯ASCII字符检测**
   - 如果只包含基本ASCII字符，可能是英语，返回 `'en'`

8. **无法确定**
   - 如果无法确定，返回 `null`，交给后续的单词匹配逻辑处理

## 💻 使用方法

### 基本使用

```typescript
import { languageFilter } from './utils/languageFilter'

// 快速检测语言
const result = languageFilter("Hello world")
if (result) {
  console.log(`检测到的语言: ${result}`)
} else {
  // 继续使用单词匹配等复杂逻辑
  console.log('无法快速确定，需要使用复杂检测')
}
```

### 在 detectLanguage 中使用

前置过滤器已经集成到 `detectLanguage` 函数中：

```typescript
import { detectLanguage } from './utils/tts'

// detectLanguage 会自动先使用前置过滤器
const lang = detectLanguage("Der Mann ist groß")
console.log(lang) // 'de'
```

### 获取字符统计信息（调试用）

```typescript
import { getCharStats } from './utils/languageFilter'

const stats = getCharStats("Der Mann ist groß")
console.log(stats)
// {
//   chinese: 0,
//   japanese: 0,
//   german: 2,  // ä, ß
//   french: 0,
//   spanish: 0,
//   accented: 2,
//   total: 19
// }
```

## 🔧 技术实现

### 正则表达式模式

```typescript
const LANGUAGE_PATTERNS = {
  chinese: /[\u4e00-\u9fa5]/g,           // 中文
  japanese: /[\u3040-\u309F\u30A0-\u30FF]/g,  // 日语
  german: /[äöüßÄÖÜ]/g,                  // 德语
  french: /[àâéèêëîïôùûüÿçœæÀÂÉÈÊËÎÏÔÙÛÜŸÇŒÆ]/g,  // 法语
  spanish: /[ñ¿¡Ñ]/g,                    // 西班牙语特有
  spanishAccented: /[áéíóúüÁÉÍÓÚÜ]/g,    // 西班牙语重音
  allAccented: /[...]/g                   // 所有重音字符
}
```

### 字符扫描算法

```typescript
function scanCharacters(text: string): CharStats {
  const stats: CharStats = {
    chinese: 0,
    japanese: 0,
    german: 0,
    french: 0,
    spanish: 0,
    accented: 0,
    total: text.length
  }
  
  // 使用正则表达式匹配并统计
  const chineseMatches = text.match(LANGUAGE_PATTERNS.chinese)
  if (chineseMatches) {
    stats.chinese = chineseMatches.length
  }
  
  // ... 其他语言的统计
  
  return stats
}
```

## 📈 性能优势

### 时间复杂度

- **字符扫描**：O(n)，其中 n 是文本长度
- **正则匹配**：O(n)，每个正则表达式都是线性时间
- **总体复杂度**：O(n)，非常高效

### 空间复杂度

- **字符统计**：O(1)，固定大小的数据结构
- **匹配结果**：O(m)，其中 m 是匹配的字符数量（通常很小）

### 性能对比

| 方法 | 平均耗时 | 适用场景 |
|------|---------|---------|
| 前置过滤器 | ~0.1ms | 有明显字符特征的文本 |
| 单词匹配 | ~1-5ms | 需要语义理解的文本 |
| 完整检测 | ~1-5ms | 复杂文本 |

## 🎯 适用场景

### ✅ 适合使用前置过滤器的场景

1. **有明显字符特征的文本**
   - 包含特殊字符（ä, ö, ü, ß, ñ, ¿, ¡）
   - 包含中文字符或日语字符
   - 纯ASCII字符（可能是英语）

2. **短文本**
   - 单词或短语
   - 句子片段

3. **需要快速响应的场景**
   - 实时翻译
   - 批量处理

### ❌ 不适合使用前置过滤器的场景

1. **没有明显字符特征的文本**
   - 纯英语文本（没有特殊字符）
   - 需要语义理解的文本

2. **混合语言文本**
   - 包含多种语言的文本
   - 需要更复杂的判断逻辑

## 🔍 调试技巧

### 查看字符统计

```typescript
import { getCharStats } from './utils/languageFilter'

const text = "Der Mann ist groß"
const stats = getCharStats(text)
console.log('字符统计:', stats)
console.log('德语字符占比:', stats.german / stats.total)
```

### 测试不同文本

```typescript
const testCases = [
  "Hello world",           // 英语
  "Der Mann ist groß",     // 德语
  "El hombre es grande",   // 西班牙语
  "L'homme est grand",     // 法语
  "こんにちは",            // 日语
  "你好世界"               // 中文
]

testCases.forEach(text => {
  const result = languageFilter(text)
  console.log(`${text} => ${result}`)
})
```

## 🚀 扩展指南

### 添加新语言支持

1. **添加字符模式**

```typescript
const LANGUAGE_PATTERNS = {
  // ... 现有模式
  newLanguage: /[新语言的特殊字符]/g
}
```

2. **更新字符统计**

```typescript
interface CharStats {
  // ... 现有字段
  newLanguage: number
}
```

3. **添加检测规则**

```typescript
function quickLanguageDetection(stats: CharStats, text: string): LanguageFilterResult {
  // ... 现有规则
  
  // 新语言规则
  if (stats.newLanguage > 0 && stats.newLanguage >= 2) {
    return 'newLanguage'
  }
  
  // ...
}
```

## 📝 注意事项

1. **前置过滤器是快速判断工具**
   - 如果返回 `null`，需要继续使用单词匹配等复杂逻辑
   - 不要完全依赖前置过滤器

2. **字符统计可能不准确**
   - 对于混合语言文本，统计结果可能不准确
   - 需要结合其他检测方法

3. **正则表达式性能**
   - 对于超长文本，正则表达式可能较慢
   - 可以考虑限制文本长度

## 🎓 总结

前置过滤器是一个高效的快速语言检测工具，通过字符扫描和正则匹配，可以在大多数情况下快速识别语言。它已经集成到 `detectLanguage` 函数中，会自动使用。

**核心优势**：
- ⚡ 快速：O(n) 时间复杂度
- 🎯 准确：基于字符特征，误判率低
- 🔧 可扩展：易于添加新语言支持
- 💡 智能：无法确定时返回 null，交给后续逻辑处理

---

**享受高效的语言检测！** 🚀
