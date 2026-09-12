import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "./buildSymbolTable";
import {
  canCreateMissingKnot,
  getAddEmptyChoicePlaceholderEdit,
  getAddLooseEndDivertEdit,
  getCreateMissingFunctionEdit,
  getCreateMissingKnotEdit,
  getCreateMissingStitchEdit,
  getDeclareGlobalVariableEdit,
  getDeclareTempVariableEdit,
  getFunctionCallArity,
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

describe("getDeclareGlobalVariableEdit", () => {
  it("inserts at the top of the file, with a trailing blank line, when there are no header declarations", () => {
    expect(getDeclareGlobalVariableEdit("=== start ===\n-> END\n", "foo")).toEqual({
      from: 0,
      to: 0,
      insert: "VAR foo = 0\n\n",
    });
  });

  it("does not add a trailing blank line for an empty document", () => {
    expect(getDeclareGlobalVariableEdit("", "foo")).toEqual({
      from: 0,
      to: 0,
      insert: "VAR foo = 0\n",
    });
  });

  it("inserts after the last declaration line when the header has INCLUDE and VAR", () => {
    const source = "INCLUDE shared.ink\nVAR x = 1\n=== start ===\n-> END\n";
    expect(getDeclareGlobalVariableEdit(source, "foo", "1")).toEqual({
      from: 29,
      to: 29,
      insert: "VAR foo = 1\n",
    });
  });

  it("rejects invalid variable names", () => {
    expect(getDeclareGlobalVariableEdit("=== start ===\n", "1foo")).toBeNull();
    expect(getDeclareGlobalVariableEdit("=== start ===\n", "a.b")).toBeNull();
  });
});

describe("getDeclareTempVariableEdit", () => {
  it("inserts a temp declaration above the diagnostic line, preserving indentation", () => {
    expect(getDeclareTempVariableEdit("=== start ===\n    -> END\n", 2, "hp")).toEqual({
      from: 14,
      to: 14,
      insert: "    ~ temp hp = 0\n",
    });
  });

  it("returns null for an invalid name or a missing line", () => {
    expect(getDeclareTempVariableEdit("=== start ===\n", 5, "hp")).toBeNull();
    expect(getDeclareTempVariableEdit("=== start ===\n", 1, "1hp")).toBeNull();
  });
});

describe("getAddLooseEndDivertEdit", () => {
  it("appends a -> END divert at the end of the diagnostic line, preserving indentation", () => {
    expect(getAddLooseEndDivertEdit("=== start ===\n    Hello\n", 2, "END")).toEqual({
      from: 23,
      to: 23,
      insert: "\n    -> END",
    });
  });

  it("appends a -> DONE divert when requested", () => {
    expect(getAddLooseEndDivertEdit("=== start ===\n    Hello\n", 2, "DONE")).toEqual({
      from: 23,
      to: 23,
      insert: "\n    -> DONE",
    });
  });

  it("returns null when the line does not exist", () => {
    expect(getAddLooseEndDivertEdit("=== start ===\n", 5, "END")).toBeNull();
  });
});

describe("getCreateMissingStitchEdit", () => {
  it("inserts before the next knot without an extra blank line when one already separates them", () => {
    const source = "=== chapter_one ===\nSome text.\n-> END\n\n=== chapter_two ===\nMore text.\n";
    const { symbols } = buildSymbolTable(source, "main.ink");

    expect(getCreateMissingStitchEdit(source, "chapter_one", "intro", symbols, "main.ink")).toEqual({
      from: 39,
      to: 39,
      insert: "= intro\n\n",
    });
  });

  it("prefixes a blank line when the next knot immediately follows", () => {
    const source = "=== chapter_one ===\nSome text.\n=== chapter_two ===\n";
    const { symbols } = buildSymbolTable(source, "main.ink");

    expect(getCreateMissingStitchEdit(source, "chapter_one", "intro", symbols, "main.ink")).toEqual({
      from: 31,
      to: 31,
      insert: "\n= intro\n\n",
    });
  });

  it("appends at the end of the file when the knot has no following knot or function", () => {
    const source = "=== chapter_one ===\n-> END\n";
    const { symbols } = buildSymbolTable(source, "main.ink");

    expect(getCreateMissingStitchEdit(source, "chapter_one", "intro", symbols, "main.ink")).toEqual({
      from: source.length,
      to: source.length,
      insert: "\n= intro\n",
    });
  });

  it("returns null when the knot cannot be found or names are invalid", () => {
    const source = "=== chapter_one ===\n-> END\n";
    const { symbols } = buildSymbolTable(source, "main.ink");

    expect(getCreateMissingStitchEdit(source, "missing_knot", "intro", symbols, "main.ink")).toBeNull();
    expect(getCreateMissingStitchEdit(source, "chapter_one", "1intro", symbols, "main.ink")).toBeNull();
  });
});

describe("getCreateMissingFunctionEdit", () => {
  it("appends a zero-parameter function", () => {
    expect(getCreateMissingFunctionEdit("", "foo", 0)).toEqual({
      from: 0,
      to: 0,
      insert: "=== function foo() ===\n    ~ return 0\n",
    });
  });

  it("appends a one-parameter function", () => {
    expect(getCreateMissingFunctionEdit("", "double", 1)).toEqual({
      from: 0,
      to: 0,
      insert: "=== function double(p1) ===\n    ~ return 0\n",
    });
  });

  it("appends a three-parameter function", () => {
    expect(getCreateMissingFunctionEdit("", "combine", 3)).toEqual({
      from: 0,
      to: 0,
      insert: "=== function combine(p1, p2, p3) ===\n    ~ return 0\n",
    });
  });

  it("returns null for an invalid name or a non-integer/negative paramCount", () => {
    expect(getCreateMissingFunctionEdit("", "1foo", 0)).toBeNull();
    expect(getCreateMissingFunctionEdit("", "foo", -1)).toBeNull();
    expect(getCreateMissingFunctionEdit("", "foo", 1.5)).toBeNull();
  });
});

describe("getFunctionCallArity", () => {
  it("returns 0 for a call with no arguments", () => {
    expect(getFunctionCallArity("~ x = double()", "double")).toBe(0);
  });

  it("returns 0 when the function name does not appear in the line", () => {
    expect(getFunctionCallArity("Hello world", "double")).toBe(0);
  });

  it("returns 1 for a single-argument call", () => {
    expect(getFunctionCallArity("~ x = double(5)", "double")).toBe(1);
  });

  it("returns 3 for a three-argument call", () => {
    expect(getFunctionCallArity("~ x = combine(a, b, c)", "combine")).toBe(3);
  });
});
