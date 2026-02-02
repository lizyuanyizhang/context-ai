import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'

// Vite 配置文件：用于构建 Chrome 插件
// 使用 @crxjs/vite-plugin 可以将 Manifest V3 和 React 代码打包成浏览器插件格式
export default defineConfig({
  plugins: [
    react(), // React 插件：支持 JSX/TSX 语法转换
    crx({ manifest }) // CRX 插件：将项目打包成 Chrome Extension (.crx) 格式
  ],
  // 构建配置
  build: {
    // 输出目录：打包后的文件会放在 dist 文件夹
    outDir: 'dist',
    // 代码压缩：生产环境自动压缩代码，减小插件体积
    minify: true,
    // 源码映射：开发时方便调试，生产环境可关闭
    sourcemap: process.env.NODE_ENV === 'development'
  }
})
