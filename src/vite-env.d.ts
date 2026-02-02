/// <reference types="vite/client" />

/**
 * Vite 环境变量类型定义
 * 
 * 这个文件告诉 TypeScript 如何识别 import.meta.env 中的变量
 * 比如 import.meta.env.VITE_QWEN_API_KEY
 */

interface ImportMetaEnv {
  // 通义千问 API 密钥
  readonly VITE_QWEN_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
