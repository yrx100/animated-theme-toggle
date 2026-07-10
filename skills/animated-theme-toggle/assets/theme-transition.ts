export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_ANIMATIONS = [
  "circle",
  "diagonal",
  "spotlight",
  "page-flip",
  "curtain",
] as const;

export type ThemeAnimation = (typeof THEME_ANIMATIONS)[number];

export interface ThemeTransitionOptions {
  storageKey?: string;
  animationStorageKey?: string;
  attribute?: string;
  root?: HTMLElement;
  defaultMode?: ThemeMode;
  defaultAnimation?: ThemeAnimation;
  duration?: number;
  easing?: string;
  onChange?: (theme: ResolvedTheme, mode: ThemeMode, animation: ThemeAnimation) => void;
}

export interface ThemeController {
  init: () => ThemeController;
  destroy: () => void;
  getMode: () => ThemeMode;
  getResolvedTheme: () => ResolvedTheme;
  getAnimation: () => ThemeAnimation;
  setAnimation: (animation: ThemeAnimation) => void;
  setMode: (
    mode: ThemeMode,
    event?: Pick<MouseEvent, "clientX" | "clientY">,
    animationOverride?: ThemeAnimation,
  ) => void;
  toggle: (
    event?: Pick<MouseEvent, "clientX" | "clientY">,
    animationOverride?: ThemeAnimation,
  ) => void;
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

type ThemeAnimationContext = {
  animation: ThemeAnimation;
  entering: boolean;
  x: number;
  y: number;
  radius: number;
  duration: number;
  easing: string;
  pseudoElement: "::view-transition-old(root)" | "::view-transition-new(root)";
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isThemeAnimation(value: unknown): value is ThemeAnimation {
  return typeof value === "string" && THEME_ANIMATIONS.includes(value as ThemeAnimation);
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
  const animationStorageKey = options.animationStorageKey ?? `${storageKey}.animation`;
  const defaultMode = options.defaultMode ?? "light";
  const defaultAnimation = options.defaultAnimation ?? "circle";
  const duration = options.duration ?? 520;
  const easing = options.easing ?? "cubic-bezier(0.4, 0, 0.2, 1)";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let mode = readStoredMode(storageKey) ?? defaultMode;
  let animation = readStoredAnimation(animationStorageKey) ?? defaultAnimation;
  let initialized = false;

  function resolve(nextMode: ThemeMode = mode): ResolvedTheme {
    if (nextMode === "system") return media.matches ? "dark" : "light";
    return nextMode;
  }

  function apply(): void {
    const resolved = resolve();
    root.setAttribute(attribute, resolved);
    root.style.colorScheme = resolved;
    options.onChange?.(resolved, mode, animation);
  }

  function persistMode(nextMode: ThemeMode): void {
    mode = nextMode;
    try {
      window.localStorage.setItem(storageKey, nextMode);
    } catch {
      // Ignore storage failures in private mode or restricted webviews.
    }
  }

  function persistAnimation(nextAnimation: ThemeAnimation): void {
    animation = nextAnimation;
    try {
      window.localStorage.setItem(animationStorageKey, nextAnimation);
    } catch {
      // Ignore storage failures in private mode or restricted webviews.
    }
  }

  function handleSystemChange(): void {
    if (mode === "system") apply();
  }

  function setMode(
    nextMode: ThemeMode,
    event?: Pick<MouseEvent, "clientX" | "clientY">,
    animationOverride?: ThemeAnimation,
  ): void {
    const before = resolve();
    const after = resolve(nextMode);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as ViewTransitionDocument;
    const nextAnimation = animationOverride ?? animation;

    if (
      before === after ||
      reduceMotion ||
      typeof transitionDocument.startViewTransition !== "function"
    ) {
      persistMode(nextMode);
      apply();
      return;
    }

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const entering = after === "light";

    root.setAttribute("data-theme-transition", entering ? "expand" : "shrink");
    root.setAttribute("data-theme-animation", nextAnimation);

    const transition = transitionDocument.startViewTransition(() => {
      persistMode(nextMode);
      apply();
    });

    let transitionAnimation: Animation | undefined;

    void transition.ready.then(() => {
      transitionAnimation = animateThemeTransition(root, {
        animation: nextAnimation,
        entering,
        x,
        y,
        radius,
        duration,
        easing,
        pseudoElement: entering ? "::view-transition-new(root)" : "::view-transition-old(root)",
      });
    });

    const cleanup = (): void => {
      // `fill: "forwards"` keeps the final frame stable until the View
      // Transition tree disappears. Cancel it afterwards so its clip-path
      // cannot affect the same pseudo-element in the next transition.
      transitionAnimation?.cancel();
      root.removeAttribute("data-theme-transition");
      root.removeAttribute("data-theme-animation");
    };

    void transition.finished.then(cleanup, cleanup);
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
    getAnimation() {
      return animation;
    },
    setAnimation(nextAnimation) {
      persistAnimation(nextAnimation);
      apply();
    },
    setMode,
    toggle(event, animationOverride) {
      setMode(resolve() === "dark" ? "light" : "dark", event, animationOverride);
    },
  };

  return controller;
}

function animateThemeTransition(root: HTMLElement, context: ThemeAnimationContext): Animation {
  const { animation, entering, x, y, radius, duration, easing, pseudoElement } = context;
  const baseOptions: PseudoElementAnimationOptions = {
    duration,
    easing,
    fill: "forwards",
    pseudoElement,
  };

  const circle = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
  const reveal = <T>(frames: T[]): T[] => (entering ? frames : [...frames].reverse());

  switch (animation) {
    case "diagonal":
      return root.animate(
        {
          clipPath: reveal([
            "polygon(-35% 0, -15% 0, -35% 100%, -55% 100%)",
            "polygon(-20% 0, 140% 0, 120% 100%, -40% 100%)",
          ]),
        },
        baseOptions,
      );
    case "spotlight":
      return root.animate(
        {
          clipPath: reveal(circle),
          opacity: reveal([0.72, 1]),
          filter: reveal(["brightness(1.18)", "brightness(1)"]),
        },
        { ...baseOptions, duration: duration + 40 },
      );
    case "page-flip":
      return root.animate(
        {
          clipPath: reveal(["inset(0 100% 0 0)", "inset(0 0 0 0)"]),
          opacity: reveal([0.65, 1]),
          transform: reveal(["translateX(-28px) skewX(-4deg)", "translateX(0) skewX(0deg)"]),
          transformOrigin: ["left center", "left center"],
        },
        { ...baseOptions, duration: duration + 40 },
      );
    case "curtain":
      return root.animate(
        { clipPath: reveal(["inset(0 50% 0 50%)", "inset(0 0 0 0)"]) },
        { ...baseOptions, duration: duration + 80 },
      );
    case "circle":
    default:
      return root.animate({ clipPath: reveal(circle) }, baseOptions);
  }
}

function readStoredMode(storageKey: string): ThemeMode | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

function readStoredAnimation(storageKey: string): ThemeAnimation | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return isThemeAnimation(value) ? value : null;
  } catch {
    return null;
  }
}
