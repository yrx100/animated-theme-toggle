# 动画实现与代码审查参考

添加、修改或审查明暗主题过渡动画代码时，请阅读本文件。它说明每种预设的实现方式，并定义代码生成后的浏览器兼容性、操作系统行为、流畅性、性能、无障碍与降级行为审查清单。

## 目录

- [核心实现原则](#核心实现原则)
- [预设实现说明](#预设实现说明)
- [动画代码审查清单](#动画代码审查清单)

## 核心实现原则

- 仅当 `document.startViewTransition` 可用、用户未启用 `prefers-reduced-motion: reduce`，且已解析主题确实会变化时播放动画。
- 不要为不支持的浏览器添加备用动画；立即更新 `data-theme`、`color-scheme` 和应用状态。
- 将主题状态分为两层：`mode` 保存用户选择（`"light" | "dark" | "system"`），`resolved` 保存渲染值（`"light" | "dark"`）。
- 坐标类预设从点击或指针位置开始；没有事件坐标时，使用视口中心。
- 从距离最远的视口角计算揭示半径，以覆盖整个屏幕：

```ts
Math.hypot(
  Math.max(x, window.innerWidth - x),
  Math.max(y, window.innerHeight - y),
)
```

- 切至浅色时，动画作用于 `::view-transition-new(root)`，使新的浅色主题从点击点进入。
- 切至深色时，动画作用于 `::view-transition-old(root)`，使旧浅色主题向点击点收缩，露出深色主题。
- 在 `::view-transition-old(root)` 与 `::view-transition-new(root)` 上设置 `animation: none` 和 `mix-blend-mode: normal`，关闭浏览器默认交叉淡入淡出，避免与自定义 `clip-path` 动画冲突。
- 使用 `fill: "forwards"`，避免过渡树移除前出现一帧闪烁。
- 保存返回的 `Animation` 并在 `transition.finished` 后取消。带 `forwards` 的动画若仍附着在根元素上，浏览器在下次切换创建同一 View Transition 伪元素时会重新应用其最终 clip path。
- 在 SSR 项目中，必须用仅客户端生命周期钩子、客户端组件或动态导入保护 `window`、`document`、`matchMedia` 和 `localStorage` 访问。

## 预设实现说明

`circle`（圆形揭示）：

- 使用 View Transition API。
- 从点击点将 `circle(0px at x y)` 动画至 `circle(radius at x y)`。
- 浅色进入时正放；深色进入时反放，使旧浅色表面收缩。
- 作为最安全的默认预设，兼容性与性能表现最佳。

`diagonal`（对角擦除）：

- 使用 View Transition API。
- 使用 `clip-path: polygon(...)`，起始坐标位于视口外，并延伸至对侧边缘之外。
- 通过明暗方向逻辑反转同一组关键帧，不维护两组关键帧。
- 确保多边形坐标覆盖整个视口，避免宽屏和移动端边缘出现缝隙。

`spotlight`（柔和聚光灯）：

- 使用 View Transition API。
- 以点击点圆形揭示为基础，仅加入轻微的 `opacity` 和 `brightness` 变化。
- 避免大面积 `blur()`、`backdrop-filter`、重阴影或复杂全屏滤镜；它们常会导致移动设备掉帧。
- 确认聚光范围覆盖整个视口，且最终帧恢复正常亮度。

`page-flip`（水平翻页）：

- 使用 View Transition API。
- 为水平揭示，从 `clip-path: inset(0 100% 0 0)` 动画至 `inset(0 0 0 0)`。
- 添加轻微 `translateX` 和 `skewX`，营造翻页感。
- 不要默认使用全屏 3D 旋转；在低性能设备、Windows 显示缩放和 iOS Safari 上更容易卡顿或使文字发虚。

`curtain`（中间幕布）：

- 使用 View Transition API。
- 将 `clip-path: inset(0 50% 0 50%)` 动画至 `inset(0 0 0 0)`，使图层从中心向两侧打开。
- 反放时从两侧向中心闭合。
- 适用于没有自然点击起点的控件，如设置面板或固定工具栏。

## 动画代码审查清单

审查生成或修改后的动画代码时，先按严重程度列出发现，并尽可能标注文件与行号。若未发现问题，也应明确说明，并指出残余风险或尚未覆盖的浏览器/设备。

兼容性：

- 实现是否保留动画浏览器下限：Chrome 111+、Edge 111+、Firefox 144+、Safari 18+、iOS Safari 18+、Opera 97+、Samsung Internet 22+？
- 当浏览器低于下限、缺少 `document.startViewTransition` 或启用 `prefers-reduced-motion: reduce` 时，代码是否直接更新主题而非尝试 polyfill？
- SSR、SSG 和基于 Node 的测试代码是否避免未经保护的 `window`、`document`、`matchMedia` 与 `localStorage` 访问？
- `localStorage` 的读写是否通过 `try/catch` 包裹，避免隐私模式、WebView 和受阻存储破坏主题切换？
- 验证计划是否在可行时包含 iOS Safari、桌面 Safari、Android Chrome、Samsung Internet、Windows 高 DPI/显示缩放以及 macOS 系统明暗主题变化？

流畅性：

- 是否禁用了浏览器默认 View Transition 交叉淡入淡出，以免干扰自定义 `clip-path` 动画？
- `::view-transition-old(root)` 与 `::view-transition-new(root)` 是否按当前方向正确叠放？
- 是否使用 `fill: "forwards"`，避免清理前结束帧闪烁？
- 每个带 `forwards` 的伪元素动画是否在 `transition.finished` 后取消，避免最终 clip path 泄露至下次过渡？
- 坐标类动画是否从点击点开始，并合理降级至视口中心？
- 每个预设的方向是否正确：浅转深应收缩旧浅色表面以露出深色；深转浅应揭示新的浅色表面？
- 快速重复切换、视口尺寸变化和系统主题变化时，是否避免残留属性与状态不匹配？

性能：

- 优先动画化 `clip-path`、`opacity` 与轻微 `transform` 变化，避免 `width`、`height`、`left`、`top`、`box-shadow` 或其他触发布局/高开销绘制的属性。
- 避免大面积 `blur()`、`backdrop-filter`、复杂 SVG 滤镜、全屏遮罩组合和过度混合模式。
- 不要使用 `setInterval` 或 `requestAnimationFrame` 在每一帧修改大量 DOM 节点；优先 Web Animations API 或 CSS 动画。
- 过渡完成或控制器销毁时，清理临时 DOM、事件监听器、计时器与根数据属性。
- 检查低性能移动设备、中低端 Android 硬件，以及浏览器缩放/显示缩放下的掉帧、闪烁、滚动条跳动和文字发虚。

无障碍：

- 遵循 `prefers-reduced-motion`。
- 确保主题控件可通过键盘访问，并且不只依靠颜色传达状态。
- 不要让临时过渡层阻断交互或屏幕阅读器焦点。
- 在根元素或 CSS 中设置 `color-scheme`，使表单控件、滚动条与原生 UI 遵循已解析主题。

验证：

- 运行项目常规 `lint`、`typecheck`、`build` 或等效检查。
- 在支持 View Transitions 的浏览器中，当预设存在时依次切换 `circle`、`diagonal`、`spotlight`、`page-flip` 和 `curtain`。
- 在 DevTools 中临时删除或覆盖 `document.startViewTransition`，确认降级路径更新主题时没有错误。
- 在操作系统或浏览器级别启用减少动态效果，确认所有空间动画都会停止。
- 至少快速切换 20 次，确认不存在残留覆盖层、监听器泄漏、主题状态不匹配或明显内存增长。
- 按 `浅色 -> 深色 -> 等待动画结束 -> 浅色` 切换。确认第二次过渡的 `::view-transition-old(root)` 没有残留 `clip-path`，深色快照在揭示区域外保持可见，页面不会变成空白浅色画布。
