export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_ANIMATIONS = [
  "circle",
  "blinds",
  "diagonal",
  "spotlight",
  "page-flip",
  "ink",
  "pixel",
  "flash",
  "curtain",
  "card-flip",
  "stars",
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
        { clipPath: reveal(["inset(0 100% 0 0)", "inset(0 0 0 0)"]) },
        { ...baseOptions, duration: duration + 80 },
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
          filter: reveal(["brightness(1.25) blur(8px)", "brightness(1) blur(0px)"]),
        },
        { ...baseOptions, duration: duration + 120 },
      );
      break;
    case "page-flip":
      root.animate(
        {
          opacity: reveal([0.2, 1]),
          transform: reveal(["perspective(1200px) rotateY(-88deg)", "perspective(1200px) rotateY(0deg)"]),
          transformOrigin: ["left center", "left center"],
        },
        { ...baseOptions, duration: duration + 120 },
      );
      break;
    case "ink":
      root.animate(
        {
          clipPath: reveal(circle),
          filter: reveal(["blur(14px) contrast(1.35)", "blur(0px) contrast(1)"]),
        },
        { ...baseOptions, duration: duration + 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
      break;
    case "pixel":
      root.animate(
        {
          opacity: reveal([0, 1]),
          filter: reveal(["contrast(1.8)", "contrast(1)"]),
        },
        { ...baseOptions, easing: "steps(8, end)", duration: duration + 120 },
      );
      break;
    case "flash":
      root.animate(
        {
          clipPath: reveal(circle),
          opacity: reveal([0.35, 1]),
          filter: reveal(["brightness(1.9) saturate(1.35)", "brightness(1) saturate(1)"]),
        },
        { ...baseOptions, duration: Math.max(280, duration - 120) },
      );
      break;
    case "curtain":
      root.animate(
        { clipPath: reveal(["inset(0 50% 0 50%)", "inset(0 0 0 0)"]) },
        { ...baseOptions, duration: duration + 80 },
      );
      break;
    case "card-flip":
      root.animate(
        {
          opacity: reveal([0, 1]),
          transform: reveal(["perspective(1000px) translateY(10px) scale(0.96) rotateX(10deg)", "perspective(1000px) translateY(0) scale(1) rotateX(0deg)"]),
          filter: reveal(["blur(8px)", "blur(0px)"]),
        },
        baseOptions,
      );
      break;
    case "stars":
      root.animate(
        {
          clipPath: reveal(circle),
          opacity: reveal([0.15, 1]),
          filter: reveal(["brightness(1.45)", "brightness(1)"]),
        },
        { ...baseOptions, duration: duration + 180 },
      );
      break;
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
    return isThemeAnimation(value) ? value : null;
  } catch {
    return null;
  }
}
