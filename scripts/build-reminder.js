/**
 * 构建完成后提示：在 Chrome 中重新加载扩展，否则插件可能不显示
 */
console.log('\n  ⚠️  构建完成。请在 Chrome 中重新加载扩展：')
console.log('     1. 打开 chrome://extensions')
console.log('     2. 找到 Context AI，点击卡片上的「重新加载」按钮（🔄）')
console.log('     3. 若尚未加载，请选择「加载已解压的扩展程序」并选中本项目的 dist 目录\n')
process.exit(0)
