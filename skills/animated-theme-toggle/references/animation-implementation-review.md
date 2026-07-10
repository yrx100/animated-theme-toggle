# Animation Implementation and Code Review Reference

Read this file when adding, modifying, or reviewing animated light/dark theme transition code. It documents how each preset should be implemented and defines the post-generation review checklist for browser compatibility, operating-system behavior, smoothness, performance, accessibility, and fallback behavior.

## Table of Contents

- [Core Implementation Principles](#core-implementation-principles)
- [Preset Implementation Notes](#preset-implementation-notes)
- [Animation Code Review Checklist](#animation-code-review-checklist)

## Core Implementation Principles

- Play an animation only when `document.startViewTransition` is available, the user has not enabled `prefers-reduced-motion: reduce`, and the resolved theme will actually change.
- Do not add fallback animation for unsupported browsers. Update `data-theme`, `color-scheme`, and application state immediately.
- Keep theme state in two layers: `mode` stores the user's choice (`"light" | "dark" | "system"`), while `resolved` stores the rendered value (`"light" | "dark"`).
- Coordinate-based presets start from the click or pointer position. If no event coordinates are available, use the viewport center.
- Compute the reveal radius from the farthest viewport corner so the transition covers the full screen:

```ts
Math.hypot(
  Math.max(x, window.innerWidth - x),
  Math.max(y, window.innerHeight - y),
)
```

- When switching to light, animate `::view-transition-new(root)` so the new light theme enters from the click point.
- When switching to dark, animate `::view-transition-old(root)` so the old light theme shrinks back toward the click point and reveals dark.
- Disable the browser's default View Transition crossfade by setting `animation: none` and `mix-blend-mode: normal` on `::view-transition-old(root)` and `::view-transition-new(root)`.
- Use `fill: "forwards"` so the transition does not flicker for one frame before the transition tree is removed.
- In SSR projects, guard `window`, `document`, `matchMedia`, and `localStorage` access behind client-only lifecycle hooks, client components, or dynamic imports.

## Preset Implementation Notes

`circle`, circular reveal:

- Use the View Transition API.
- Animate `circle(0px at x y)` to `circle(radius at x y)` from the click point.
- Play forward when light enters; reverse when dark enters so the old light surface contracts.
- Use this as the safest default preset. It has the best compatibility and performance profile.

`diagonal`, diagonal wipe:

- Use the View Transition API.
- Use `clip-path: polygon(...)` with coordinates that begin outside the viewport and end beyond the opposite edge.
- Reverse the same keyframes through the light/dark direction logic instead of maintaining two keyframe sets.
- Ensure polygon coordinates over-cover the viewport so wide screens and mobile edges do not show gaps.

`spotlight`, soft spotlight:

- Use the View Transition API.
- Start with the click-origin circular reveal and add only subtle `opacity` and `brightness` changes.
- Avoid large `blur()`, `backdrop-filter`, heavy shadows, or complex full-screen filters. They commonly drop frames on mobile devices.
- Confirm the spotlight radius covers the whole viewport and the final frame returns to normal brightness.

`page-flip`, horizontal page turn:

- Use the View Transition API.
- Animate from `clip-path: inset(0 100% 0 0)` to `inset(0 0 0 0)` for the horizontal reveal.
- Add a small `translateX` and `skewX` to suggest page motion.
- Do not use full-screen 3D rotation as the default. It is more likely to stutter or blur text on low-power devices, Windows display scaling, and iOS Safari.

`curtain`, center curtain:

- Use the View Transition API.
- Animate `clip-path: inset(0 50% 0 50%)` to `inset(0 0 0 0)` so the layer opens from the center toward both sides.
- Reverse playback to close from the sides toward the center.
- Use this for controls that do not naturally provide a meaningful click origin, such as settings panels or fixed toolbars.

## Animation Code Review Checklist

When reviewing generated or modified animation code, list findings first, ordered by severity, with file and line references where possible. If no issues are found, state that clearly and call out residual risk or untested browser/device coverage.

Compatibility:

- Does the implementation preserve the animated browser floor: Chrome 111+, Edge 111+, Firefox 144+, Safari 18+, iOS Safari 18+, Opera 97+, Samsung Internet 22+?
- If the browser is below the floor, `document.startViewTransition` is missing, or `prefers-reduced-motion: reduce` is active, does the code update the theme directly instead of attempting a polyfill?
- Does SSR, SSG, and Node-based test code avoid unguarded access to `window`, `document`, `matchMedia`, and `localStorage`?
- Are `localStorage` reads and writes wrapped in `try/catch` so private mode, WebViews, and blocked storage do not break theme switching?
- Does the validation plan include iOS Safari, desktop Safari, Android Chrome, Samsung Internet, Windows high-DPI/display scaling, and macOS system light/dark changes where practical?

Smoothness:

- Is the browser's default View Transition crossfade disabled so it does not fight the custom `clip-path` animation?
- Are `::view-transition-old(root)` and `::view-transition-new(root)` stacked correctly for the current direction?
- Do animations use `fill: "forwards"` so the ending frame does not flash before cleanup?
- Do coordinate-based animations start from the click point, with a reasonable viewport-center fallback?
- Is direction correct for each preset: light-to-dark should reveal dark by contracting the old light surface, and dark-to-light should reveal the new light surface.
- Do rapid repeated toggles, viewport resizing, and system theme changes avoid stale attributes and state mismatches?

Performance:

- Prefer animating `clip-path`, `opacity`, and small `transform` changes. Avoid animating `width`, `height`, `left`, `top`, `box-shadow`, or other layout/expensive paint properties.
- Avoid large `blur()`, `backdrop-filter`, complex SVG filters, full-screen mask combinations, and excessive blend modes.
- Do not use `setInterval` or `requestAnimationFrame` to mutate many DOM nodes every frame. Prefer the Web Animations API or CSS animations.
- Clean up temporary DOM, event listeners, timers, and root data attributes when the transition completes or the controller is destroyed.
- Check low-power mobile devices, lower-end Android hardware, and browser zoom/display scaling for frame drops, flicker, scrollbar jumps, and text blur.

Accessibility:

- Respect `prefers-reduced-motion`.
- Ensure theme controls are keyboard reachable and do not communicate state by color alone.
- Do not let temporary transition layers block interaction or screen-reader focus.
- Set `color-scheme` on the root or through CSS so form controls, scrollbars, and native UI follow the resolved theme.

Validation:

- Run the project's normal `lint`, `typecheck`, `build`, or equivalent checks.
- In a browser that supports View Transitions, toggle through `circle`, `diagonal`, `spotlight`, `page-flip`, and `curtain` when those presets are present.
- In DevTools, temporarily remove or override `document.startViewTransition` and confirm the fallback updates the theme without errors.
- Enable reduced motion at the OS or browser level and confirm all spatial animations stop.
- Toggle rapidly at least 20 times and confirm there are no leftover overlays, listener leaks, theme state mismatches, or obvious memory growth.
