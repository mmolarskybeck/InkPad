import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "./buildSymbolTable";
import {
  getMissingStartDiagnostic,
  INKPAD_DIAGNOSTIC_SOURCE,
  MISSING_STARTING_DIVERT_CODE,
} from "./inkDiagnostics";

const ink = (s: string) => s.replace(/^\n/, "").trimEnd();

function getDiagnostic(source: string) {
  return getMissingStartDiagnostic(buildSymbolTable(source, "main.ink"));
}

describe("getMissingStartDiagnostic", () => {
  it("returns no diagnostic when top-level content exists", () => {
    const diagnostic = getDiagnostic(ink(`
Opening line.

=== start ===
-> END
`));

    expect(diagnostic).toBeNull();
  });

  it("returns a diagnostic when the first line is a knot declaration", () => {
    const diagnostic = getDiagnostic(ink(`
=== find_help ===
You search desperately.
`));

    expect(diagnostic).toMatchObject({
      code: MISSING_STARTING_DIVERT_CODE,
      message: "No opening content found. Start the story at `find_help`?",
      target: "find_help",
    });
  });

  it("ignores function knots when selecting a start target", () => {
    const diagnostic = getDiagnostic(ink(`
=== function helper(x) ===
~ return x
`));

    expect(diagnostic).toBeNull();
  });

  it("uses the first playable knot after one or more function knots", () => {
    const diagnostic = getDiagnostic(ink(`
=== function helper(x) ===
~ return x

=== function second_helper ===
~ return 2

=== start ===
The story begins.
`));

    expect(diagnostic?.target).toBe("start");
  });

  it("skips parameterized knots and uses the first bare entry target", () => {
    const diagnostic = getDiagnostic(ink(`
=== get_hit(x) ===
~ hp = hp - x

=== death(reason) ===
You're dead.

=== main ===
Should you cross the river?
`));

    expect(diagnostic).toMatchObject({
      message: "No opening content found. Start the story at `main`?",
      target: "main",
    });
  });

  it("returns no diagnostic when every playable knot requires arguments", () => {
    const diagnostic = getDiagnostic(ink(`
=== get_hit(x) ===
~ hp = hp - x

=== death(reason) ===
You're dead.
`));

    expect(diagnostic).toBeNull();
  });

  it("uses the full dotted path for stitches", () => {
    const diagnostic = getMissingStartDiagnostic({
      fileId: "main.ink",
      hasTopLevelContent: false,
      symbols: [{
        name: "intro",
        kind: "stitch",
        hasParameters: false,
        path: "hub.intro",
        parentPath: "hub",
        fileId: "main.ink",
        range: {
          startLineNumber: 2,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 8,
        },
      }],
    });

    expect(diagnostic?.target).toBe("hub.intro");
  });

  it("returns no diagnostic for an empty file", () => {
    expect(getDiagnostic("")).toBeNull();
  });

  it("returns a diagnostic when comments and blank lines precede a knot", () => {
    const diagnostic = getDiagnostic(ink(`
// Notes before the story.

=== start ===
-> END
`));

    expect(diagnostic?.target).toBe("start");
  });

  it("uses hint severity and the inkpad source", () => {
    const diagnostic = getDiagnostic("=== start ===\n-> END");

    expect(diagnostic).toMatchObject({
      severity: "hint",
      source: INKPAD_DIAGNOSTIC_SOURCE,
    });
  });

  it("ranges over the first playable knot declaration line instead of line 1", () => {
    const diagnostic = getDiagnostic(ink(`
// Notes.

=== start ===
-> END
`));

    expect(diagnostic?.range).toEqual({
      startLineNumber: 3,
      startColumn: 1,
      endLineNumber: 3,
      endColumn: Number.MAX_SAFE_INTEGER,
    });
  });
});
