export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeTransitionOptions {
  storageKey?: string;
  attribute?: string;
  root?: HTMLElement;
  defaultMode?: ThemeMode;
  duration?: number;
  easing?: string;
  onChange?: (theme: ResolvedTheme, mode: ThemeMode) => void;
}

export interface ThemeController {
  init: () => ThemeController;
  destroy: () => void;
  getMode: () => ThemeMode;
  getResolvedTheme: () => ResolvedTheme;
  setMode: (mode: ThemeMode, event?: Pick<MouseEvent, "clientX" | "clientY">) => void;
  toggle: (event?: Pick<MouseEvent, "clientX" | "clientY">) => void;
}

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => ViewTransitionLike;
};

type PseudoElementAnimationOptions = KeyframeAnimationOptions & {
  pseudoElement?: string;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function canUseDOM(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function createThemeController(options: ThemeTransitionOptions = {}): ThemeController {
  if (!canUseDOM()) {
    throw new Error("createThemeController must run in a browser/client context.");
  }

  const root = options.root ?? document.documentElement;
  const attribute = options.attribute ?? "data-theme";
  const storageKey = options.storageKey ?? "app.theme";
  const defaultMode = options.defaultMode ?? "light";
  const duration = options.duration ?? 420;
  const easing = options.easing ?? "cubic-bezier(0.4, 0, 0.2, 1)";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let mode = readStoredMode(storageKey) ?? defaultMode;
  let initialized = false;

  function resolve(nextMode: ThemeMode = mode): ResolvedTheme {
    if (nextMode === "system") return media.matches ? "dark" : "light";
    return nextMode;
  }

  function apply(): void {
    const resolved = resolve();
    root.setAttribute(attribute, resolved);
    root.style.colorScheme = resolved;
    options.onChange?.(resolved, mode);
  }

  function persist(nextMode: ThemeMode): void {
    mode = nextMode;
    try {
      window.localStorage.setItem(storageKey, nextMode);
    } catch {
      // Ignore storage failures in private mode or restricted webviews.
    }
  }

  function handleSystemChange(): void {
    if (mode === "system") apply();
  }

  function setMode(nextMode: ThemeMode, event?: Pick<MouseEvent, "clientX" | "clientY">): void {
    const before = resolve();
    const after = resolve(nextMode);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as ViewTransitionDocument;

    if (
      before === after ||
      reduceMotion ||
      typeof transitionDocument.startViewTransition !== "function"
    ) {
      persist(nextMode);
      apply();
      return;
    }

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const shrink = after === "dark";

    root.setAttribute("data-theme-transition", shrink ? "shrink" : "expand");

    const transition = transitionDocument.startViewTransition(() => {
      persist(nextMode);
      apply();
    });

    void transition.ready.then(() => {
      const grow = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
      const keyframes: PropertyIndexedKeyframes = {
        clipPath: shrink ? [...grow].reverse() : grow,
      };
      const animationOptions: PseudoElementAnimationOptions = {
        duration,
        easing,
        fill: "forwards",
        pseudoElement: shrink ? "::view-transition-old(root)" : "::view-transition-new(root)",
      };

      root.animate(keyframes, animationOptions);
    });

    void transition.finished.finally(() => {
      root.removeAttribute("data-theme-transition");
    });
  }

  const controller: ThemeController = {
    init() {
      if (!initialized) {
        media.addEventListener("change", handleSystemChange);
        initialized = true;
      }
      apply();
      return controller;
    },
    destroy() {
      if (initialized) {
        media.removeEventListener("change", handleSystemChange);
        initialized = false;
      }
    },
    getMode() {
      return mode;
    },
    getResolvedTheme() {
      return resolve();
    },
    setMode,
    toggle(event) {
      setMode(resolve() === "dark" ? "light" : "dark", event);
    },
  };

  return controller;
}

function readStoredMode(storageKey: string): ThemeMode | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

