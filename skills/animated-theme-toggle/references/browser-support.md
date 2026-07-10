# Browser Support

Verified on 2026-07-09.

This skill uses same-document View Transitions for animation:

- `document.startViewTransition(...)`
- `::view-transition-old(root)`
- `::view-transition-new(root)`
- Web Animations API with the `pseudoElement` option

Minimum browser versions for animated theme switching:

| Browser | Minimum version |
| --- | ---: |
| Chrome | 111 |
| Edge | 111 |
| Firefox | 144 |
| Safari | 18 |
| iOS Safari | 18 |
| Opera | 97 |
| Samsung Internet | 22 |

Unsupported browsers should still receive the final theme state immediately. Do not add a polyfill unless the user asks for a non-native fallback animation.

Sources:

- MDN says `Document.startViewTransition()` starts a same-document view transition and recommends direct fallback when unsupported: https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
- Can I Use lists `Document API: startViewTransition` support by browser version: https://caniuse.com/mdn-api_document_startviewtransition
- Chrome Developers documents same-document View Transitions and lists browser support as Chrome 111, Edge 111, Firefox 144, Safari 18: https://developer.chrome.com/docs/web-platform/view-transitions

