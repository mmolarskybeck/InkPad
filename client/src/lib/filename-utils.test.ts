import { describe, expect, it } from "vitest";
import {
  getDisplayTitleFromFilename,
  getFilename,
  replaceFilenameExtension,
  sanitizeFilenameBase,
} from "./filename-utils";

describe("filename utilities", () => {
  it("preserves case, spaces, punctuation, and unicode when valid", () => {
    expect(getFilename("The Moonlit Garden", ".ink")).toBe("The Moonlit Garden.ink");
    expect(getFilename("Été, 1987", ".zip")).toBe("Été, 1987.zip");
  });

  it("replaces only filesystem-invalid characters", () => {
    expect(sanitizeFilenameBase('Act 1: "Arrival" / Draft?')).toBe("Act 1- -Arrival- - Draft-");
  });

  it("falls back when no usable filename remains", () => {
    expect(getFilename("///", ".ink")).toBe("story.ink");
    expect(getFilename("", ".ink")).toBe("story.ink");
  });

  it("changes an extension without changing filename casing", () => {
    expect(replaceFilenameExtension("Moonlit Garden.ink", ".json"))
      .toBe("Moonlit Garden.json");
  });

  it("migrates old lowercase slug filenames into readable fallback titles", () => {
    expect(getDisplayTitleFromFilename("the-moonlit-garden.ink"))
      .toBe("The Moonlit Garden");
    expect(getDisplayTitleFromFilename("eBay Notes.ink")).toBe("eBay Notes");
  });
});
