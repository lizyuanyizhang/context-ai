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

// 复制 popup.js（popup 使用外部脚本以通过扩展 CSP，避免「打开扩展设置页」点不动）
const srcPopupJs = `${rootDir}/src/popup.js`
const distSrcDir = `${rootDir}/dist/src`
const distPopupJs = `${rootDir}/dist/src/popup.js`

try {
  mkdirSync(distCssDir, { recursive: true })
  copyFileSync(srcCss, distCss)
  console.log('✅ CSS 文件已复制到 dist 目录')
} catch (error) {
  console.error('❌ 复制 CSS 文件失败：', error.message)
  process.exit(1)
}

try {
  mkdirSync(distSrcDir, { recursive: true })
  copyFileSync(srcPopupJs, distPopupJs)
  console.log('✅ popup.js 已复制到 dist 目录')
} catch (error) {
  console.error('❌ 复制 popup.js 失败：', error.message)
  process.exit(1)
}
