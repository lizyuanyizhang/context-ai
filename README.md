# Context AI - 智能外语学习助手

一个强大的 Chrome 浏览器插件，帮助你学习外语。选中网页上的英文或德文或中文或日语或法语或西班牙语，即可获得：
- 📖 **智能翻译**：通过通义千问 API 提供准确的翻译
- 💡 **语法点拨**：理解语法结构和用法
- 🌍 **上下文语境**：结合网页上下文分析词汇含义
- 🔊 **语音朗读**：使用浏览器原生 TTS 技术，支持多语种
- 📚 **生词本**：一键保存，随时复习

## 技术栈

- **前端框架**: React 18 + TypeScript
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **构建工具**: Vite + @crxjs/vite-plugin
- **API**: 通义千问 (DashScope) - OpenAI 兼容模式
- **存储**: Chrome Storage API

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env`，并填入你的通义千问 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
VITE_QWEN_API_KEY=your_actual_api_key_here
```

获取 API Key：访问 [DashScope 控制台](https://dashscope.console.aliyun.com/)

### 3. 开发模式

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
```

构建完成后，`dist` 目录就是可以加载到 Chrome 的插件包。

### 5. 加载插件到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"（右上角开关）
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

## 项目结构

```
├── src/
│   ├── manifest.json          # Chrome 插件清单文件
│   ├── config/                # 配置文件
│   │   └── api.ts             # 通义千问 API 配置
│   ├── content/               # Content Script（注入到网页的脚本）
│   ├── background/            # Background Service Worker
│   └── components/            # React 组件
├── dist/                      # 构建输出目录
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
└── tailwind.config.js         # Tailwind CSS 配置
```

## 功能说明

### 1. 文字选择与翻译
- 在任意网页选中英文或德文
- 自动弹出浮动按钮
- 点击按钮显示翻译结果面板

### 2. 语音朗读
- 使用浏览器原生 `SpeechSynthesis` API
- 自动识别语种（英语/德语）
- 点击喇叭图标即可播放

### 3. 生词本
- 一键保存到本地存储
- 数据存储在 `chrome.storage.local`
- 支持导出和查看

## 开发说明

本项目采用详细的注释风格，旨在帮助初学者理解：
- Chrome 插件开发原理
- TypeScript 类型系统
- React Hooks 使用
- 浏览器原生 API 调用
- 异步编程和错误处理

## 许可证

MIT License
