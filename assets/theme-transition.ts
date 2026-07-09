export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_ANIMATIONS = [
  "circle",
  "blinds",
  "diagonal",
  "spotlight",
  "page-flip",
  "pixel",
  "curtain",
  "shatter",
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

    void transition.ready.then(() => {
      animateThemeTransition(root, {
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

    void transition.finished.finally(() => {
      root.removeAttribute("data-theme-transition");
      root.removeAttribute("data-theme-animation");
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

function animateThemeTransition(root: HTMLElement, context: ThemeAnimationContext): void {
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
    case "blinds":
      root.animate(
        { clipPath: reveal(["inset(0 0 100% 0)", "inset(0 0 0 0)"]) },
        { ...baseOptions, easing: "steps(9, end)", duration: duration + 80 },
      );
      break;
    case "diagonal":
      root.animate(
        {
          clipPath: reveal([
            "polygon(-35% 0, -15% 0, -35% 100%, -55% 100%)",
            "polygon(-20% 0, 140% 0, 120% 100%, -40% 100%)",
          ]),
        },
        baseOptions,
      );
      break;
    case "spotlight":
      root.animate(
        {
          clipPath: reveal(circle),
          opacity: reveal([0.72, 1]),
          filter: reveal(["brightness(1.18)", "brightness(1)"]),
        },
        { ...baseOptions, duration: duration + 40 },
      );
      break;
    case "page-flip":
      root.animate(
        {
          clipPath: reveal(["inset(0 100% 0 0)", "inset(0 0 0 0)"]),
          opacity: reveal([0.65, 1]),
          transform: reveal(["translateX(-28px) skewX(-4deg)", "translateX(0) skewX(0deg)"]),
          transformOrigin: ["left center", "left center"],
        },
        { ...baseOptions, duration: duration + 40 },
      );
      break;
    case "pixel":
      root.animate(
        {
          clipPath: reveal(circle),
          opacity: reveal([0.45, 1]),
        },
        { ...baseOptions, easing: "steps(10, end)", duration: duration + 20 },
      );
      break;
    case "curtain":
      root.animate(
        { clipPath: reveal(["inset(0 50% 0 50%)", "inset(0 0 0 0)"]) },
        { ...baseOptions, duration: duration + 80 },
      );
      break;
    case "shatter": {
      const shatter = [
        `polygon(${x - 6}px 0, ${x + 8}px 0, ${x + 18}px ${y - 42}px, ${x + 5}px ${y - 12}px, ${x + 42}px ${y}px, ${x + 8}px ${y + 10}px, ${x + 18}px 100%, ${x - 8}px 100%, ${x - 16}px ${y + 44}px, ${x - 2}px ${y + 12}px, ${x - 46}px ${y + 8}px, ${x - 8}px ${y - 4}px, ${x - 30}px ${y - 54}px, ${x - 5}px ${y - 14}px, ${x - 6}px 0, ${x - 6}px 0)`,
        "polygon(-8% 0, 22% 0, 34% 18%, 55% 0, 84% 0, 100% 17%, 85% 38%, 108% 58%, 100% 100%, 72% 100%, 59% 82%, 37% 100%, 0 100%, 15% 69%, -8% 51%, 18% 30%)",
        "polygon(0 0, 28% 0, 54% 0, 78% 0, 100% 0, 100% 26%, 100% 54%, 100% 76%, 100% 100%, 72% 100%, 48% 100%, 24% 100%, 0 100%, 0 70%, 0 36%, 0 0)",
      ];

      root.animate(
        {
          clipPath: reveal(shatter),
          opacity: reveal([0.38, 0.9, 1]),
          filter: reveal([
            "brightness(1.2) contrast(1.08)",
            "brightness(1.08) contrast(1.04)",
            "brightness(1) contrast(1)",
          ]),
          transform: reveal(["scale(1.018)", "scale(1.006)", "scale(1)"]),
        },
        { ...baseOptions, duration: duration + 100, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
      break;
    }
    case "circle":
    default:
      root.animate({ clipPath: reveal(circle) }, baseOptions);
      break;
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
    if (value === "stars") return "shatter";
    return isThemeAnimation(value) ? value : null;
  } catch {
    return null;
  }
}
