import { describe, expect, it } from "vitest";
import {
  hasCaseInsensitiveInkProjectPathCollision,
  isNormalizedInkProjectPath,
  normalizeInkProjectPath,
} from "./ink-project-paths";

describe("ink project paths", () => {
  it("normalizes project-relative paths to POSIX separators", () => {
    expect(normalizeInkProjectPath("chapters\\start.ink")).toBe("chapters/start.ink");
    expect(normalizeInkProjectPath("./chapters//start.ink")).toBe("chapters/start.ink");
  });

  it("normalizes paths to NFC", () => {
    expect(normalizeInkProjectPath("cafe\u0301.ink")).toBe("caf\u00e9.ink");
  });

  it("rejects absolute paths and parent traversal", () => {
    expect(normalizeInkProjectPath("/story.ink")).toBeNull();
    expect(normalizeInkProjectPath("C:\\story.ink")).toBeNull();
    expect(normalizeInkProjectPath("file:///story.ink")).toBeNull();
    expect(normalizeInkProjectPath("https://example.com/story.ink")).toBeNull();
    expect(normalizeInkProjectPath("../story.ink")).toBeNull();
    expect(normalizeInkProjectPath("chapters/../story.ink")).toBeNull();
  });

  it("checks that stored paths are already normalized", () => {
    expect(isNormalizedInkProjectPath("chapters/start.ink")).toBe(true);
    expect(isNormalizedInkProjectPath("chapters\\start.ink")).toBe(false);
    expect(isNormalizedInkProjectPath("./chapters/start.ink")).toBe(false);
    expect(isNormalizedInkProjectPath("cafe\u0301.ink")).toBe(false);
    expect(isNormalizedInkProjectPath("caf\u00e9.ink")).toBe(true);
  });

  it("detects paths that collide case-insensitively after normalization", () => {
    expect(hasCaseInsensitiveInkProjectPathCollision([
      "chapters/Start.ink",
      "chapters/start.ink",
    ])).toBe(true);

    expect(hasCaseInsensitiveInkProjectPathCollision([
      "caf\u00e9.ink",
      "cafe\u0301.ink",
    ])).toBe(true);

    expect(hasCaseInsensitiveInkProjectPathCollision([
      "chapters/start.ink",
      "chapters/end.ink",
    ])).toBe(false);
  });
});
