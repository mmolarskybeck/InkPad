/**
 * Platform-aware keyboard shortcut descriptors shared by tooltips, menus,
 * and the command palette. Shortcuts are written once with a `mod` key and
 * rendered as ⌘ on Apple platforms and Ctrl everywhere else.
 */

export type ShortcutKey =
  | "mod"
  | "shift"
  | "alt"
  | "ctrl"
  | "enter"
  | "escape"
  | "tab"
  | "backspace"
  | "up"
  | "down"
  | "left"
  | "right"
  | (string & {});

let cachedIsApple: boolean | null = null;

/** True on macOS, iOS, and iPadOS, where the command key is the primary modifier. */
export function isApplePlatform(): boolean {
  if (cachedIsApple !== null) return cachedIsApple;
  if (typeof navigator === "undefined") return false;

  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? "";
  const source = platform || navigator.userAgent || "";
  cachedIsApple = /mac|iphone|ipad|ipod/i.test(source);
  return cachedIsApple;
}

/** Test hook: override platform detection. Pass `null` to re-detect. */
export function setApplePlatformForTests(value: boolean | null): void {
  cachedIsApple = value;
}

/**
 * Human-readable form of one key. Apple platforms use glyphs; others use
 * words, matching how each OS labels its own menus.
 */
export function formatShortcutKey(key: ShortcutKey, apple: boolean = isApplePlatform()): string {
  switch (key) {
    case "mod":
      return apple ? "⌘" : "Ctrl";
    case "shift":
      return apple ? "⇧" : "Shift";
    case "alt":
      return apple ? "⌥" : "Alt";
    case "ctrl":
      return apple ? "⌃" : "Ctrl";
    case "enter":
      return apple ? "↩" : "Enter";
    case "escape":
      return "Esc";
    case "tab":
      return apple ? "⇥" : "Tab";
    case "backspace":
      return apple ? "⌫" : "Backspace";
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "left":
      return "←";
    case "right":
      return "→";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/** Plain-text rendering, e.g. for aria-keyshortcuts or native titles: "⌘⇧Z" / "Ctrl+Shift+Z". */
export function formatShortcut(keys: readonly ShortcutKey[], apple: boolean = isApplePlatform()): string {
  const parts = keys.map((key) => formatShortcutKey(key, apple));
  return apple ? parts.join("") : parts.join("+");
}

/** Value for the `aria-keyshortcuts` attribute, which uses the W3C key-name vocabulary. */
export function toAriaKeyShortcuts(keys: readonly ShortcutKey[], apple: boolean = isApplePlatform()): string {
  return keys
    .map((key) => {
      switch (key) {
        case "mod":
          return apple ? "Meta" : "Control";
        case "ctrl":
          return "Control";
        case "shift":
          return "Shift";
        case "alt":
          return "Alt";
        case "enter":
          return "Enter";
        case "escape":
          return "Escape";
        case "tab":
          return "Tab";
        case "backspace":
          return "Backspace";
        case "up":
          return "ArrowUp";
        case "down":
          return "ArrowDown";
        case "left":
          return "ArrowLeft";
        case "right":
          return "ArrowRight";
        default:
          return key.length === 1 ? key.toUpperCase() : key;
      }
    })
    .join("+");
}
