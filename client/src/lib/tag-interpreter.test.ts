import { describe, expect, it } from "vitest";
import {
  attachTagWarningLines,
  parseGlobalTags,
  resolveMetadata,
} from "./tag-interpreter";

describe("tag interpreter", () => {
  it("parses metadata case-insensitively and lets the last tag win", () => {
    const parsed = parseGlobalTags([
      "TITLE: First",
      "author: Ada",
      "title: Final: Cut",
      "theme: SEPIA",
    ]);

    expect(parsed.metadata).toEqual({
      title: "Final: Cut",
      author: "Ada",
      theme: "sepia",
    });
  });

  it("accepts high contrast as a story theme", () => {
    const parsed = parseGlobalTags(["theme: HIGH-CONTRAST"]);

    expect(parsed.metadata.theme).toBe("high-contrast");
    expect(parsed.warnings).toEqual([]);
  });

  it("warns about empty or unknown values while allowing an empty author", () => {
    const parsed = parseGlobalTags([
      "title:",
      "author:",
      "theme: neon",
    ]);

    expect(parsed.metadata).toEqual({ author: null });
    expect(parsed.warnings.map((warning) => warning.field)).toEqual(["title", "theme"]);
    expect(parsed.warnings[1]?.message).toContain("sepia");
  });

  it("applies source, stored, and filename precedence", () => {
    const resolved = resolveMetadata(
      parseGlobalTags(["title: Source title", "author:"]),
      { title: "Stored title", author: "Stored author", theme: "dark" },
      "fallback-name.ink",
    );

    expect(resolved).toMatchObject({
      title: "Source title",
      author: null,
      theme: "dark",
    });
    expect([...resolved.sourceFields]).toEqual(["title", "author"]);
  });

  it("uses a readable filename fallback", () => {
    const resolved = resolveMetadata(parseGlobalTags([]), {}, "moonlit_garden.ink");
    expect(resolved.title).toBe("moonlit garden");
  });

  it("attaches warnings to matching source lines", () => {
    const warnings = attachTagWarningLines(
      parseGlobalTags(["theme: neon"]).warnings,
      "# title: Test\n# theme: neon\nOpening",
    );

    expect(warnings[0]?.line).toBe(2);
  });

  it("does not attach a global warning to a later passage tag", () => {
    const warnings = attachTagWarningLines(
      parseGlobalTags(["theme: neon"]).warnings,
      "Opening\n# theme: neon",
    );

    expect(warnings[0]?.line).toBeUndefined();
  });
});
