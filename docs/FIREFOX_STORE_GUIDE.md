# Firefox 上架完整步骤

按顺序完成以下步骤即可将 Context AI 上架到 Firefox 扩展商店（addons.mozilla.org）。

---

## 第一步：准备隐私政策页面

Firefox 要求扩展有可公开访问的隐私政策链接。

### 方法 A：使用 GitHub Pages（推荐）

1. 确保项目已推送到 GitHub
2. 进入仓库 → **Settings** → **Pages**
3. **Source** 选择 `Deploy from a branch`
4. **Branch** 选择 `main`，**Folder** 选择 `/docs`
5. 点击 **Save**，等待 1–2 分钟
6. 隐私政策链接为：
   ```
   https://你的GitHub用户名.github.io/仓库名/privacy-policy.html
   ```
   例如：`https://yourname.github.io/context-ai/privacy-policy.html`

### 方法 B：使用 Gitee / 自有站点

将 `docs/privacy-policy.html` 部署到任意可公网访问的地址，记下完整 URL。

---

## 第二步：构建并打包扩展

在项目根目录执行：

```bash
# 1. 安装依赖（如未安装）
npm install

# 2. 构建
npm run build

# 3. 打包为 zip（在 dist 目录内打包，确保 manifest 在根目录）
cd dist
zip -r ../context-ai-firefox.zip . -x "*.DS_Store"
cd ..
```

得到 `context-ai-firefox.zip` 即为要上传的文件。

> ⚠️ **注意**：zip 内应为 `manifest.json`、`src/` 等文件，不能多一层 `dist/` 目录。

---

## 第三步：注册 / 登录 Firefox 开发者账号

1. 打开 [addons.mozilla.org](https://addons.mozilla.org)
2. 点击右上角 **Log in**
3. 使用 **Mozilla Account** 登录（没有则 **Register** 注册）
4. 登录后进入 [Add-ons Developer Hub](https://addons.mozilla.org/developers/)

---

## 第四步：提交扩展

1. 在开发者中心点击 **Submit Your First Add-on** 或 **Submit a New Add-on**
2. 选择 **On this site**（在 AMO 上架，用户可搜索安装）
3. 点击 **Select a file**，选择 `context-ai-firefox.zip`
4. 等待校验结束
   - ✅ 全部通过：可继续
   - ⚠️ 仅有警告：尽量处理，尤其是安全和隐私相关
   - ❌ 有错误：必须修复后再上传
5. 选择兼容平台（一般勾选 **Firefox** 和 **Firefox for Android**）
6. 点击 **Continue**
7. **是否需要提供源代码**：如使用压缩/混淆代码，选 **Yes** 并上传源码 zip；普通 build 通常选 **No**
8. 点击 **Continue**

---

## 第五步：填写商店信息

在「Describe Add-on」页面填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| **Name** | 扩展名称 | Context AI |
| **Summary** | 简短描述（约 1 句） | 智能外语学习助手 - 选中文字即可获得翻译、语法点拨和上下文语境分析 |
| **Description** | 详细说明（功能介绍、使用方式） | 选中网页上的外语文字，即可获得 AI 翻译、语法点拨、音标、上下文分析... |
| **License** | 开源协议 | MIT License 等 |
| **Support email** | 支持邮箱 | your@email.com |
| **Support website** | 项目主页 / GitHub | https://github.com/用户名/仓库名 |
| **This add-on has a privacy policy** | ✅ 勾选 | - |
| **Privacy Policy URL** | 隐私政策链接 | 第一步得到的 URL |
| **Notes for Reviewers** | 审核说明（可选） | 如：需用户在 popup 中填入 API Key 才能使用翻译；生词本仅本地存储 |

---

## 第六步：提交并等待审核

1. 检查所有必填项
2. 点击 **Submit Version**
3. 等待邮件通知
4. 审核通过后，扩展会出现在 [addons.mozilla.org](https://addons.mozilla.org) 并可供安装

---

## 常见问题

### Q：上传后提示 manifest 错误？

- 检查 zip 根目录是否包含 `manifest.json`
- 确认 `browser_specific_settings.gecko.id` 已配置

### Q：审核被拒怎么办？

- 查看邮件中的具体原因
- 常见情况：隐私政策不完整、权限说明不清、需要提供源代码

### Q：如何更新版本？

- 登录 AMO → 进入该扩展页面 → **New Version** → 上传新的 zip

---

## 快速检查清单

- [ ] 隐私政策 URL 可正常访问
- [ ] `npm run build` 成功
- [ ] zip 内 manifest 在根目录
- [ ] Mozilla 账号已登录
- [ ] 商店信息全部填写
- [ ] 隐私政策 URL 已填写并勾选
