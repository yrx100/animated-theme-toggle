---
name: animated-theme-toggle
description: 为前端项目添加、改造或评审带动画的明暗主题切换。适用于黑白主题、深色模式、浅色模式、系统主题、主题持久化、可选过渡预设、主题动画实现与兼容性/性能评审。通过 View Transition API 提供动画，并为不支持的浏览器直接降级。
---

# 带动画的主题切换

## 概述

实现框架无关的浅色/深色主题系统，并提供可选过渡预设。该模式在 `document.documentElement` 上使用语义化 CSS 变量，保存 `"light" | "dark" | "system"` 模式，依据 `prefers-color-scheme` 解析系统偏好，遵循 `prefers-reduced-motion`，在不支持 View Transitions 时立即切换主题。

该技能适合应用壳、仪表盘、SaaS、编辑器，以及希望获得精致黑白主题切换、但无需兼容旧浏览器动画的前端项目。

## 浏览器下限

动画切换要求支持同文档 View Transition，即 `document.startViewTransition` 与 `::view-transition-old/new(root)`。

动画路径的最低浏览器版本（验证日期：2026-07-09）：

- Chrome 111+
- Edge 111+
- Firefox 144+
- Safari 18+
- iOS Safari 18+
- Opera 97+
- Samsung Internet 22+

低于以上版本时，不要通过 polyfill 或其他方式复刻动画；仍应正常更新主题，让界面立即完成切换。需要兼容性细节或带来源的浏览器列表时，参阅 `references/browser-support.md`。

## 工作流程

1. 检查目标项目并定位：
   - 应用启动代码或仅客户端入口；
   - 全局 CSS 或设计令牌文件；
   - 现有主题/设置状态管理；
   - 已有主题切换控件。
2. 优先沿用项目既有的状态与持久化方式。仅当项目缺少合适助手时，才使用 `assets/theme-transition.ts`。
3. 在 `:root` 与 `:root[data-theme="dark"]` 定义语义化颜色令牌，避免在组件中硬编码颜色。
4. 通过在 `document.documentElement` 上设置 `data-theme="light"` 或 `data-theme="dark"` 应用已解析主题。
5. 仅在浏览器支持且允许动画时，用 `document.startViewTransition(() => updateTheme())` 包裹主题变更。
6. 向切换控件传入点击或指针坐标，使坐标类动画从被点击的控件位置开始。
7. 验证两条路径：
   - 支持的浏览器：所选预设正常播放；
   - 不支持 API 或启用减少动态效果：主题立即切换。
8. 生成或修改动画代码后，阅读 `references/animation-implementation-review.md`，并按其中清单审查代码。

## 实现规则

- 添加、修改或评审预设动画代码前，必须阅读 `references/animation-implementation-review.md`；其中包含各预设的实现说明和动画代码审查清单。
- 主题模式与已解析主题应分离：
  - 模式：`"light" | "dark" | "system"`
  - 已解析主题：`"light" | "dark"`
- 使用 `system` 模式时，监听 `(prefers-color-scheme: dark)` 变化，并且只在模式为 `"system"` 时重新应用。
- 如项目需要可选动画风格，支持以下预设名称：
  - `circle`：从点击点开始的圆形揭示；
  - `diagonal`：对角擦除；
  - `spotlight`：从点击点开始的柔和光扫；
  - `page-flip`：水平翻页；
  - `curtain`：从中间向两侧展开的幕布。
- 坐标类预设应使用下列方式计算揭示半径：

```ts
Math.hypot(
  Math.max(x, window.innerWidth - x),
  Math.max(y, window.innerHeight - y),
)
```

- 使用 `data-theme-transition="expand|shrink"` 和 `data-theme-animation="<preset>"` 等根属性，控制伪元素层级与预设行为。
- 保持原 Drama 应用的方向：
  - 切至浅色：动画作用于 `::view-transition-new(root)`，让新的浅色主题从点击点扩散；
  - 切至深色：动画作用于 `::view-transition-old(root)`，让旧的浅色主题向点击点收束并露出深色主题。
- 在 `::view-transition-old(root)` 与 `::view-transition-new(root)` 上设置 `animation: none` 和 `mix-blend-mode: normal`，避免浏览器默认交叉淡入淡出干扰自定义 `clip-path` 动画。
- 使用 `fill: "forwards"`，避免过渡树移除前出现一帧闪烁。
- 保存返回的 `Animation`，并在 `transition.finished` 后调用 `cancel()`。不清理时，带 `forwards` 的 `clip-path` 会附着在根元素上，并在下一次主题切换复用 View Transition 伪元素时将其隐藏。
- 除非用户明确要求，否则不要为不支持的浏览器添加备用动画；预期降级方式是直接更新状态。
- 在 SSR 框架中，必须把所有 `window` 和 `document` 访问置于仅客户端的钩子、组件或动态导入之后。

### 强制动画清理约束

每个通过 `root.animate(..., { pseudoElement, fill: "forwards" })` 创建的动画都必须满足：

1. 返回并保留 `Animation` 实例。
2. 在 `transition.finished` 成功或失败后均取消该实例。
3. 在同一清理路径中移除临时的过渡方向和预设属性。
4. 不要依赖浏览器临时 View Transition 树的移除来销毁 Web Animation。带 `forwards` 的效果仍会附着在源元素上，并在下次创建相同伪元素时应用最终 `clip-path`。

所需形态：

```ts
let transitionAnimation: Animation | undefined;

void transition.ready.then(() => {
  transitionAnimation = root.animate(keyframes, options);
});

const cleanup = () => {
  transitionAnimation?.cancel();
  root.removeAttribute("data-theme-transition");
  root.removeAttribute("data-theme-animation");
};

void transition.finished.then(cleanup, cleanup);
```

## 动画代码审查

生成或修改动画代码后，加载 `references/animation-implementation-review.md` 并根据其清单审查实现。

审查动画实现时，应先给出具体发现及文件/行号，检查以下方面：

- 浏览器下限：动画路径仅在上述受支持版本运行；不支持浏览器和减少动态效果的用户立即获得最终主题。
- 跨浏览器行为：检查 View Transition 伪元素、带 `pseudoElement` 的 Web Animations API，以及 SSR 的仅客户端保护。
- 跨系统行为：在可行时检查 Windows、macOS、iOS Safari、Android Chrome/Samsung Internet，包括系统减少动态效果和系统主题变化。
- 流畅性：避免默认交叉淡入淡出冲突、单帧闪烁、错误的 z-index 层级、残留过渡属性与方向不一致。
- 性能：使用可合成或范围有限的视觉属性，避免动画期间触发布局，清除临时状态，避免大面积重度模糊、滤镜或遮罩。
- 无障碍：保持键盘可达，遵循 `prefers-reduced-motion`，设置 `color-scheme`，并防止过渡层阻断交互或辅助技术。

## 资源

- `assets/theme-transition.ts`：无依赖 TypeScript 控制器，提供 `THEME_ANIMATIONS`、`getAnimation()`、`setAnimation()`、`setMode(mode, event, animationOverride)` 和 `toggle(event, animationOverride)`。可直接复制到前端项目，或将函数迁移至既有状态管理。
- `assets/theme-transition.css`：多预设动画所需的语义令牌与 View Transition 伪元素层级起始样式。应与项目设计令牌合并，而不是覆盖无关样式。
- `references/animation-implementation-review.md`：各预设的实现说明，以及浏览器/操作系统兼容性、流畅性、性能、无障碍和降级行为的审查清单。生成或修改动画代码后必须阅读，并据此审查。

## 框架说明

React：

- 在 Vite/CRA 风格项目中，于 `createRoot().render(...)` 前调用 `controller.init()`；SSR 框架则在仅客户端 Provider 中调用。
- 将控制器放在模块作用域或 React context 中。
- 使用 `onClick={(event) => controller.toggle(event)}` 或 `controller.toggle(event, selectedAnimation)`。
- 通过本地 state、context、Zustand、Redux 或 `useSyncExternalStore` 订阅状态并重新渲染图标。

Vue：

- 在 `main.ts` 的 `app.mount(...)` 前初始化。
- 使用 `@click="controller.toggle($event)"` 或 `controller.toggle($event, selectedAnimation)`。
- 图标需要响应时，将 `controller.getResolvedTheme()` 映射至 `ref`。

Svelte/SvelteKit：

- 在 `onMount` 中初始化。
- 使用 `on:click={(event) => controller.toggle(event)}` 或 `controller.toggle(event, selectedAnimation)`。
- 将当前模式/已解析主题保存在可写 store 中。

原生 JavaScript：

- 导入或粘贴控制器。
- 调用 `const theme = createThemeController(); theme.init();`。
- 用 `button.addEventListener("click", (event) => theme.toggle(event));` 绑定按钮。
- 用 `theme.setAnimation(animationName)` 绑定动画控件。

## 验证

集成后运行项目的常规检查，通常是 `lint`、`typecheck` 和 `build`。

手动检查：

- 从侧边栏或页头按钮切换，确认坐标类预设从点击点开始。
- 遍历全部动画预设，确认降级路径仍会立即更新状态。
- 如果项目暴露三种模式，分别选择明确浅色/深色和系统模式。
- 在操作系统或浏览器级别启用减少动态效果，确认不会播放动画。
- 在 DevTools 中执行 `delete document.startViewTransition` 临时强制降级分支，或使用不支持的浏览器测试。
- 确认表单控件、滚动条和原生 UI 使用正确的 `color-scheme`。
- 严格按 `浅色 -> 深色 -> 等待完成 -> 浅色` 回归测试。第二次过渡中，`::view-transition-old(root)` 必须是 `clip-path: none`；旧深色页面应在扩散的浅色揭示区域外保持可见，且不得出现空白浅色画布。
