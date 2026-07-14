# 浏览器支持

验证日期：2026-07-09。

本技能使用同文档 View Transitions 实现动画：

- `document.startViewTransition(...)`
- `::view-transition-old(root)`
- `::view-transition-new(root)`
- 带 `pseudoElement` 选项的 Web Animations API

主题切换的动画路径最低浏览器版本：

| 浏览器 | 最低版本 |
| --- | ---: |
| Chrome | 111 |
| Edge | 111 |
| Firefox | 144 |
| Safari | 18 |
| iOS Safari | 18 |
| Opera | 97 |
| Samsung Internet | 22 |

不支持的浏览器仍应立即应用最终主题状态。除非用户明确要求非原生的备用动画，否则不要添加 polyfill。

来源：

- MDN 说明 `Document.startViewTransition()` 用于启动同文档视图过渡，且建议在不支持时直接降级：https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
- Can I Use 按浏览器版本列出了 `Document API: startViewTransition` 支持情况：https://caniuse.com/mdn-api_document_startviewtransition
- Chrome Developers 介绍同文档 View Transitions，并列出 Chrome 111、Edge 111、Firefox 144 和 Safari 18 的支持情况：https://developer.chrome.com/docs/web-platform/view-transitions
