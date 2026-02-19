# Context AI - 智能外语学习助手 / Intelligent Foreign Language Learning Assistant

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.2-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)

**一个强大的 Chrome 浏览器插件，帮助你轻松学习外语**  
**A powerful Chrome extension to help you learn foreign languages effortlessly**

[English](#english) | [中文](#中文)

</div>

---

## 中文 / Chinese

### 📖 项目简介

Context AI 是一款智能外语学习 Chrome 浏览器插件，支持多语言翻译和学习。只需在网页上选中文字，即可获得：

- 📖 **智能翻译**：通过通义千问 API 提供准确的翻译
- 💡 **语法点拨**：深入理解语法结构和用法
- 🌍 **上下文语境**：结合网页上下文分析词汇含义
- 🔊 **语音朗读**：使用浏览器原生 TTS 技术，支持多语种混合朗读
- 📚 **生词本**：一键保存，随时复习，支持导出

### ✨ 主要功能

#### 1. 多语言支持
- **源语言**：英语、德语、法语、日语、西班牙语、中文（自动检测或手动选择）
- **目标语言**：支持翻译为任意支持的语言

#### 2. 智能翻译
- 基于通义千问大模型的准确翻译
- 支持预翻译 + 大模型增强的混合架构
- 自动语言检测，也可手动指定

#### 3. 语法点拨
- 详细的语法结构分析
- 关键语法点说明
- 使用场景和注意事项

#### 4. 上下文语境
- 结合网页上下文分析
- 词汇在不同场景下的含义
- 现代用法和网络用语

#### 5. 语音朗读
- 浏览器原生 TTS（Text-to-Speech）
- 支持多语言混合文本的智能分段朗读
- 自动识别「」符号内的原文，使用源语言朗读
- 统一语速，流畅切换

#### 6. 生词本管理
- 一键保存翻译结果
- 本地存储，数据持久化
- 支持搜索、删除、导出（JSON/CSV）
- 闪卡学习模式

### 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **样式**: Tailwind CSS + 自定义样式
- **图标**: Lucide React
- **构建工具**: Vite + @crxjs/vite-plugin
- **API**: 通义千问 (DashScope) - OpenAI 兼容模式
- **存储**: Chrome Storage API
- **语音**: Web Speech API (SpeechSynthesis)

### 🚀 快速开始

#### 1. 安装依赖

```bash
npm install
```

#### 2. 配置 API Key

复制 `.env.example` 为 `.env`，并填入你的通义千问 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
VITE_QWEN_API_KEY=your_actual_api_key_here
```

**获取 API Key**：访问 [DashScope 控制台](https://dashscope.console.aliyun.com/)

#### 3. 开发模式

```bash
npm run dev
```

#### 4. 构建生产版本

```bash
npm run build
```

构建完成后，`dist` 目录就是可以加载到 Chrome 的插件包。

#### 5. 加载插件到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"（右上角开关）
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

#### 6. 设置网站权限

若出现「无法读取或更改网站的数据」，说明扩展当前没有该网页的访问权限，按下面任选一种方式打开权限：

- **方式一**：点击浏览器工具栏的 Context AI 图标，在弹出页中点击「打开扩展设置页」，在扩展详情里找到「网站权限」→ 选择「在所有网站上」。
- **方式二**：在扩展图标上右键 →「查看网站权限」→ 选择「在所有网站上」。

设置后刷新要翻译的网页即可选词使用。

### 📁 项目结构

```
├── src/
│   ├── manifest.json          # Chrome 插件清单文件
│   ├── config/                # 配置文件
│   │   └── api.ts             # API 配置
│   ├── content/               # Content Script（注入到网页的脚本）
│   │   ├── components/        # React 组件
│   │   │   ├── TranslationPanel.tsx    # 翻译结果面板
│   │   │   ├── FloatingButtonContainer.tsx  # 浮动工具栏
│   │   │   ├── WordbookPanel.tsx      # 生词本面板
│   │   │   └── FlashcardMode.tsx      # 闪卡学习模式
│   │   ├── hooks/            # 自定义 Hooks
│   │   │   ├── useTranslation.ts      # 翻译 Hook
│   │   │   ├── useWordbook.ts         # 生词本 Hook
│   │   │   └── useTextSelection.ts    # 文字选择 Hook
│   │   └── App.tsx           # 主应用组件
│   ├── background/           # Background Service Worker
│   │   └── index.ts          # 后台脚本入口
│   ├── services/             # 服务层
│   │   ├── qwenApi.ts        # 通义千问 API 调用
│   │   └── wordbook.ts       # 生词本数据服务
│   ├── utils/                # 工具函数
│   │   └── tts.ts            # 语音合成工具
│   └── icons/                # 图标资源
├── dist/                     # 构建输出目录
├── vite.config.ts            # Vite 配置
├── tsconfig.json             # TypeScript 配置
└── tailwind.config.js        # Tailwind CSS 配置
```

### 💡 使用说明

#### 基本使用流程

1. **选择文字**：在任意网页上选中你想要翻译的文字
2. **查看翻译**：点击浮动工具栏上的"翻译"按钮
3. **查看详情**：翻译面板会显示翻译、语法点拨、上下文语境等信息
4. **语音朗读**：点击喇叭图标可以听到语音朗读
5. **保存生词**：点击"加入生词本"按钮保存到生词本
6. **复习学习**：打开生词本，使用闪卡模式进行复习

#### 高级功能

- **多语言混合朗读**：当文本中包含「」符号时，符号内的内容会使用源语言朗读，其他内容使用目标语言朗读
- **自定义语速**：所有语音朗读统一使用原文语言的默认语速
- **导出数据**：生词本支持导出为 JSON 或 CSV 格式

### 🐛 常见问题

#### Q: 为什么选中文字后没有出现浮动按钮？
A: 请检查是否已设置网站权限为"在所有网站上"，并刷新页面。

#### Q: 翻译失败怎么办？
A: 请检查 `.env` 文件中的 API Key 是否正确配置，并确保网络连接正常。

#### Q: 语音朗读不工作？
A: 请检查浏览器的语音合成设置，某些浏览器可能需要手动启用 TTS 功能。

#### Q: 生词本数据丢失？
A: 数据存储在 Chrome 的本地存储中，卸载插件会清除数据。建议定期导出备份。

### 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 📄 许可证

MIT License

---

## English

### 📖 Project Introduction

Context AI is an intelligent foreign language learning Chrome browser extension that supports multi-language translation and learning. Simply select text on any webpage to get:

- 📖 **Smart Translation**: Accurate translation powered by Qwen API
- 💡 **Grammar Tips**: In-depth grammar structure and usage analysis
- 🌍 **Context Analysis**: Vocabulary meaning analysis based on webpage context
- 🔊 **Text-to-Speech**: Browser-native TTS technology with multi-language support
- 📚 **Wordbook**: One-click save, review anytime, export support

### ✨ Key Features

#### 1. Multi-Language Support
- **Source Languages**: English, German, French, Japanese, Spanish, Chinese (auto-detect or manual selection)
- **Target Languages**: Translate to any supported language

#### 2. Smart Translation
- Accurate translation based on Qwen large language model
- Hybrid architecture: pre-translation + LLM enhancement
- Automatic language detection or manual specification

#### 3. Grammar Tips
- Detailed grammar structure analysis
- Key grammar point explanations
- Usage scenarios and notes

#### 4. Context Analysis
- Context-based analysis combined with webpage content
- Word meanings in different scenarios
- Modern usage and internet slang

#### 5. Text-to-Speech
- Browser-native TTS (Text-to-Speech)
- Intelligent segmentation for mixed-language text
- Automatic recognition of original text within 「」symbols, read in source language
- Unified speech rate with smooth transitions

#### 6. Wordbook Management
- One-click save translation results
- Local storage with data persistence
- Search, delete, and export (JSON/CSV) support
- Flashcard learning mode

### 🛠️ Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Custom Styles
- **Icons**: Lucide React
- **Build Tool**: Vite + @crxjs/vite-plugin
- **API**: Qwen (DashScope) - OpenAI Compatible Mode
- **Storage**: Chrome Storage API
- **Speech**: Web Speech API (SpeechSynthesis)

### 🚀 Quick Start

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Configure API Key

Copy `.env.example` to `.env` and fill in your Qwen API Key:

```bash
cp .env.example .env
```

Edit `.env` file:
```
VITE_QWEN_API_KEY=your_actual_api_key_here
```

**Get API Key**: Visit [DashScope Console](https://dashscope.console.aliyun.com/)

#### 3. Development Mode

```bash
npm run dev
```

#### 4. Build Production Version

```bash
npm run build
```

After building, the `dist` directory is the Chrome extension package ready to load.

#### 5. Load Extension to Chrome

1. Open Chrome and visit `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` directory of the project

#### 6. Set Site Permissions

If you see "Cannot read or change site data", the extension doesn't have access to the webpage. Choose one of the following methods:

- **Method 1**: Click the Context AI icon in the browser toolbar, click "Open Extension Settings" in the popup, find "Site access" → Select "On all sites".
- **Method 2**: Right-click the extension icon → "View site permissions" → Select "On all sites".

After setting, refresh the webpage to use the translation feature.

### 📁 Project Structure

```
├── src/
│   ├── manifest.json          # Chrome extension manifest
│   ├── config/                # Configuration files
│   │   └── api.ts             # API configuration
│   ├── content/              # Content Script (injected into webpages)
│   │   ├── components/       # React components
│   │   │   ├── TranslationPanel.tsx    # Translation result panel
│   │   │   ├── FloatingButtonContainer.tsx  # Floating toolbar
│   │   │   ├── WordbookPanel.tsx      # Wordbook panel
│   │   │   └── FlashcardMode.tsx      # Flashcard learning mode
│   │   ├── hooks/            # Custom Hooks
│   │   │   ├── useTranslation.ts      # Translation Hook
│   │   │   ├── useWordbook.ts         # Wordbook Hook
│   │   │   └── useTextSelection.ts    # Text selection Hook
│   │   └── App.tsx           # Main application component
│   ├── background/           # Background Service Worker
│   │   └── index.ts          # Background script entry
│   ├── services/             # Service layer
│   │   ├── qwenApi.ts        # Qwen API calls
│   │   └── wordbook.ts       # Wordbook data service
│   ├── utils/                # Utility functions
│   │   └── tts.ts            # Text-to-speech utilities
│   └── icons/                # Icon resources
├── dist/                     # Build output directory
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
└── tailwind.config.js        # Tailwind CSS configuration
```

### 💡 Usage Guide

#### Basic Usage Flow

1. **Select Text**: Select the text you want to translate on any webpage
2. **View Translation**: Click the "Translate" button on the floating toolbar
3. **View Details**: The translation panel shows translation, grammar tips, context analysis, etc.
4. **Listen**: Click the speaker icon to hear text-to-speech
5. **Save Words**: Click "Add to Wordbook" to save to wordbook
6. **Review**: Open wordbook and use flashcard mode for review

#### Advanced Features

- **Mixed-Language Reading**: When text contains 「」symbols, content inside uses source language, other content uses target language
- **Custom Speech Rate**: All TTS uses the default rate of the source language
- **Export Data**: Wordbook supports export as JSON or CSV format

### 🐛 FAQ

#### Q: Why doesn't the floating button appear after selecting text?
A: Please check if site permissions are set to "On all sites" and refresh the page.

#### Q: What if translation fails?
A: Please check if the API Key in `.env` file is correctly configured and ensure network connection is normal.

#### Q: Text-to-speech not working?
A: Please check browser TTS settings. Some browsers may require manual TTS enablement.

#### Q: Wordbook data lost?
A: Data is stored in Chrome's local storage. Uninstalling the extension will clear data. Regular export backup is recommended.

### 🤝 Contributing

Issues and Pull Requests are welcome!

### 📄 License

MIT License

---

<div align="center">

**Made with ❤️ for language learners**

[GitHub](https://github.com/lizyuanyizhang/context-ai) · [Issues](https://github.com/lizyuanyizhang/context-ai/issues) · [Pull Requests](https://github.com/lizyuanyizhang/context-ai/pulls)

</div>
