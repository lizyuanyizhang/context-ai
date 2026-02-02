/**
 * 构建后脚本：复制静态资源文件
 * 
 * 这个脚本确保 CSS 文件和其他静态资源被正确复制到 dist 目录
 */

import { copyFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = dirname(__dirname)

// 复制 CSS 文件
const srcCss = `${rootDir}/src/content/index.css`
const distCssDir = `${rootDir}/dist/src/content`
const distCss = `${distCssDir}/index.css`

try {
  // 创建目录（如果不存在）
  mkdirSync(distCssDir, { recursive: true })
  
  // 复制文件
  copyFileSync(srcCss, distCss)
  console.log('✅ CSS 文件已复制到 dist 目录')
} catch (error) {
  console.error('❌ 复制 CSS 文件失败：', error.message)
  process.exit(1)
}
