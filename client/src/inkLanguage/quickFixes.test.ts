import { describe, expect, it } from "vitest";
import {
  canCreateMissingKnot,
  getAddEmptyChoicePlaceholderEdit,
  getCreateMissingKnotEdit,
  getMissingStartingDivertEdit,
} from "./quickFixes";

describe("getMissingStartingDivertEdit", () => {
  it("inserts a starting divert at the beginning of the document", () => {
    expect(getMissingStartingDivertEdit("find_help")).toEqual({
      from: 0,
      to: 0,
      insert: "-> find_help\n\n",
    });
  });

  it("preserves dotted stitch paths", () => {
    expect(getMissingStartingDivertEdit("hub.intro").insert).toBe("-> hub.intro\n\n");
  });
});

describe("getCreateMissingKnotEdit", () => {
  it("appends a new knot with a blank-line separator", () => {
    expect(getCreateMissingKnotEdit("Opening\n-> missing", "missing")).toEqual({
      from: 18,
      to: 18,
      insert: "\n\n=== missing ===\n",
    });
  });

  it("does not add extra whitespace when the document already ends with a blank line", () => {
    expect(getCreateMissingKnotEdit("Opening\n\n", "missing")?.insert).toBe("=== missing ===\n");
  });

  it("allows only bare knot names for knot creation", () => {
    expect(canCreateMissingKnot("missing_target")).toBe(true);
    expect(canCreateMissingKnot("chapter.missing_target")).toBe(false);
    expect(getCreateMissingKnotEdit("-> chapter.missing_target", "chapter.missing_target")).toBeNull();
  });
});

describe("getAddEmptyChoicePlaceholderEdit", () => {
  it("inserts placeholder text after an empty choice marker", () => {
    expect(getAddEmptyChoicePlaceholderEdit("=== start ===\n* \n-> END\n", 2)).toEqual({
      from: 16,
      to: 16,
      insert: "Choice text",
    });
  });

  it("adds a separating space when the empty choice marker has no trailing space", () => {
    expect(getAddEmptyChoicePlaceholderEdit("=== start ===\n*\n-> END\n", 2)).toEqual({
      from: 15,
      to: 15,
      insert: " Choice text",
    });
  });

  it("does not edit non-empty choice lines", () => {
    expect(getAddEmptyChoicePlaceholderEdit("=== start ===\n* Already visible\n-> END\n", 2)).toBeNull();
  });
});
