import { describe, expect, it } from "vitest";
import {
  isNormalizedInkProjectPath,
  normalizeInkProjectPath,
} from "./ink-project-paths";

describe("ink project paths", () => {
  it("normalizes project-relative paths to POSIX separators", () => {
    expect(normalizeInkProjectPath("chapters\\start.ink")).toBe("chapters/start.ink");
    expect(normalizeInkProjectPath("./chapters//start.ink")).toBe("chapters/start.ink");
  });

  it("rejects absolute paths and parent traversal", () => {
    expect(normalizeInkProjectPath("/story.ink")).toBeNull();
    expect(normalizeInkProjectPath("C:\\story.ink")).toBeNull();
    expect(normalizeInkProjectPath("../story.ink")).toBeNull();
    expect(normalizeInkProjectPath("chapters/../story.ink")).toBeNull();
  });

  it("checks that stored paths are already normalized", () => {
    expect(isNormalizedInkProjectPath("chapters/start.ink")).toBe(true);
    expect(isNormalizedInkProjectPath("chapters\\start.ink")).toBe(false);
    expect(isNormalizedInkProjectPath("./chapters/start.ink")).toBe(false);
  });
});
