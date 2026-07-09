---
name: animated-theme-toggle
description: Add or retrofit animated light/dark theme switching in frontend projects. Use when a user asks for black/white theme switching, dark mode, light mode, system theme mode, theme persistence, or a circular reveal theme transition powered by the View Transition API, with graceful no-animation fallback for unsupported browsers.
---

# Animated Theme Toggle

## Overview

Add a framework-agnostic light/dark theme system with selectable transition presets. The pattern uses semantic CSS variables on `document.documentElement`, stores `"light" | "dark" | "system"` mode, resolves system preference with `prefers-color-scheme`, respects `prefers-reduced-motion`, and falls back to an immediate theme switch when View Transitions are unavailable.

This skill is best for app shells, dashboards, SaaS tools, editors, and any frontend project that wants a polished black/white theme toggle without supporting legacy browsers.

## Browser Floor

Animated switching requires same-document View Transition support through `document.startViewTransition` and `::view-transition-old/new(root)`.

Minimum browser versions for the animated path, verified 2026-07-09:

- Chrome 111+
- Edge 111+
- Firefox 144+
- Safari 18+
- iOS Safari 18+
- Opera 97+
- Samsung Internet 22+

If the target browser is below these versions, do not polyfill or recreate the animation. Keep the normal theme update so the UI still changes instantly. See `references/browser-support.md` when the user asks for compatibility details or a source-backed browser list.

## Workflow

1. Inspect the target project and locate:
   - app bootstrap or client-only entry point
   - global CSS or design token file
   - theme/settings store, if one already exists
   - existing theme toggle UI
2. Prefer the project's existing state/persistence pattern. Use `assets/theme-transition.ts` only when the project lacks a suitable helper.
3. Put semantic color tokens on `:root` and `:root[data-theme="dark"]`. Avoid hard-coded component colors.
4. Apply the resolved theme by setting `data-theme="light"` or `data-theme="dark"` on `document.documentElement`.
5. Wrap theme changes in `document.startViewTransition(() => updateTheme())` only when supported and motion is allowed.
6. Pass the click or pointer event coordinates into the toggle so coordinate-based animations start from the control that was clicked.
7. Verify both paths:
   - supported browser: the selected preset plays
   - unsupported API or reduced motion: theme switches immediately

## Implementation Rules

- Keep theme mode separate from resolved theme:
  - mode: `"light" | "dark" | "system"`
  - resolved: `"light" | "dark"`
- For `system` mode, listen to `(prefers-color-scheme: dark)` changes and reapply only while mode is `"system"`.
- Support these preset names when the project wants selectable animation styles:
  - `circle`: click-origin circular reveal
  - `blinds`: vertical segmented blinds
  - `diagonal`: diagonal wipe
  - `spotlight`: soft click-origin light sweep
  - `page-flip`: horizontal page turn
  - `pixel`: stepped pixel dissolve
  - `curtain`: center-out curtain
  - `shatter`: fractured glass shard reveal
- Compute the reveal radius for coordinate-based presets with:

```ts
Math.hypot(
  Math.max(x, window.innerWidth - x),
  Math.max(y, window.innerHeight - y),
)
```

- Use root attributes such as `data-theme-transition="expand|shrink"` and `data-theme-animation="<preset>"` to control pseudo-element stacking and preset-specific behavior.
- Match the original Drama app direction:
  - switching to light: animate `::view-transition-new(root)` so the new light theme expands from the click point
  - switching to dark: animate `::view-transition-old(root)` so the old light theme shrinks back into the click point and reveals dark
- Set `animation: none` and `mix-blend-mode: normal` on `::view-transition-old(root)` and `::view-transition-new(root)` so the browser's default crossfade does not fight the custom clip-path animation.
- Use `fill: "forwards"` on the clip-path animation to avoid a one-frame flicker before the transition tree is removed.
- Do not add fallback animation for unsupported browsers unless the user explicitly asks. The intended fallback is a direct state update.
- In SSR frameworks, guard all `window` and `document` access behind client-only hooks, components, or dynamic imports.

## Assets

- `assets/theme-transition.ts`: dependency-free TypeScript controller with `THEME_ANIMATIONS`, `getAnimation()`, `setAnimation()`, `setMode(mode, event, animationOverride)`, and `toggle(event, animationOverride)`. Copy it into a frontend project or port the functions into an existing store.
- `assets/theme-transition.css`: starter semantic tokens plus View Transition pseudo-element stacking rules for multi-preset animations. Merge with the project's design tokens instead of replacing unrelated styling.

## Framework Notes

React:

- Call `controller.init()` before `createRoot().render(...)` in Vite/CRA style apps, or inside a client-only provider for SSR frameworks.
- Store the controller in module scope or React context.
- Use `onClick={(event) => controller.toggle(event)}` or `controller.toggle(event, selectedAnimation)`.
- Re-render icons by subscribing through local state, context, Zustand, Redux, or `useSyncExternalStore`.

Vue:

- Initialize in `main.ts` before `app.mount(...)`.
- Use `@click="controller.toggle($event)"` or `controller.toggle($event, selectedAnimation)`.
- Mirror `controller.getResolvedTheme()` into a `ref` when icons need to react.

Svelte/SvelteKit:

- Initialize in `onMount`.
- Use `on:click={(event) => controller.toggle(event)}` or `controller.toggle(event, selectedAnimation)`.
- Keep current mode/resolved theme in a writable store.

Plain JavaScript:

- Import or paste the controller.
- Call `const theme = createThemeController(); theme.init();`.
- Wire buttons with `button.addEventListener("click", (event) => theme.toggle(event));`.
- Wire animation controls with `theme.setAnimation(animationName)`.

## Validation

Run the project's normal checks after integration, usually `lint`, `typecheck`, and `build`.

Manual checks:

- Toggle from a sidebar/header button and confirm coordinate-based presets start at the click point.
- Switch through all animation presets and confirm the fallback state still updates immediately.
- Select explicit light/dark modes and system mode if the project exposes all three.
- Enable reduced motion at OS/browser level and confirm no animation runs.
- Temporarily force the fallback branch by checking `delete document.startViewTransition` in DevTools or by testing an unsupported browser.
- Confirm form controls, scrollbars, and native UI pick up the correct `color-scheme`.
