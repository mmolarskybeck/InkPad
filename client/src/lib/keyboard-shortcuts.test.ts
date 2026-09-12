import { afterEach, describe, expect, it } from "vitest";
import {
  formatShortcut,
  formatShortcutKey,
  setApplePlatformForTests,
  toAriaKeyShortcuts,
} from "./keyboard-shortcuts";

afterEach(() => setApplePlatformForTests(null));

describe("keyboard-shortcuts", () => {
  it("renders Apple glyphs joined without separators", () => {
    setApplePlatformForTests(true);
    expect(formatShortcut(["mod", "shift", "z"])).toBe("⌘⇧Z");
    expect(formatShortcutKey("enter")).toBe("↩");
  });

  it("renders words joined with plus on other platforms", () => {
    setApplePlatformForTests(false);
    expect(formatShortcut(["mod", "shift", "z"])).toBe("Ctrl+Shift+Z");
    expect(formatShortcut(["shift", "enter"])).toBe("Shift+Enter");
  });

  it("emits W3C key names for aria-keyshortcuts", () => {
    setApplePlatformForTests(true);
    expect(toAriaKeyShortcuts(["mod", "f"])).toBe("Meta+F");
    setApplePlatformForTests(false);
    expect(toAriaKeyShortcuts(["mod", "f"])).toBe("Control+F");
    expect(toAriaKeyShortcuts(["escape"])).toBe("Escape");
  });
});
