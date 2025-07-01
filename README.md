# AO3 汉化插件

一个简单的用户脚本，旨在中文化 [Archive of Our Own](https://archiveofourown.org/) 界面，集成了 AI 翻译功能，让你的阅读体验更加流畅。

## ✨ 主要功能

- **界面汉化**
  - 对 AO3 网站的导航、按钮、表单、提示信息等进行本地化处理。
- **可配置项**
  - 可按需启用 AI 翻译功能。
  - 支持自定义翻译词典，确保人名、专有名词翻译准确。

## 🔧 安装

1.  在浏览器中安装一个用户脚本管理器，推荐使用 [Tampermonkey](https://www.tampermonkey.net/) 。
2.  开启浏览器 “管理扩展” 中的 “开发人员模式”。
3.  选择一个版本进行安装：
    - [远程版](https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/main.user.js)
    - [本地版](https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/local.user.js)
4.  注意：介于可能存在的网络问题，建议优先使用包含了词库的 [本地版](https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/local.user.js) 。

## 📖 使用说明

- 安装脚本后，访问 [AO3 网站](https://archiveofourown.org/) ，界面将自动变为中文。
- 如需使用 AI 翻译功能，请点击浏览器右上角 `Tampermonkey 图标` -> `AO3 汉化插件` -> `启用 ChatGLM 翻译功能` -> `设置 ChatGLM API Key` 。在作品页面，你会看到新增的“翻译简介”、“翻译注释”、“翻译正文”等按钮，点击即可使用。

## 🤝 贡献与反馈

如果你发现了任何翻译错漏、脚本 Bug，或者有功能建议，欢迎通过 [Issues](https://github.com/V-Lipset/ao3-chinese/issues) 页面提交反馈！

## 📄 许可证

本脚本基于 [GPL-3.0 License](./LICENSE) 许可证开源。

## 🙏 特别鸣谢
- [Github 汉化插件](https://github.com/maboloshi/github-chinese)