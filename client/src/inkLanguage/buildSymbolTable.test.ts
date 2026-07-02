import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "./buildSymbolTable";
import { isDivertTarget } from "./inkSymbols";

// Helper: dedent a template literal so test fixtures read cleanly.
const ink = (s: string) => s.replace(/^\n/, "").trimEnd();

describe("buildSymbolTable — knot scanning", () => {
  it("indexes a basic knot", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== living_room ===
You look around.
-> END
`),
      "main.ink",
    );
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({
      name: "living_room",
      kind: "knot",
      path: "living_room",
      fileId: "main.ink",
    });
  });

  it("records the correct line number for knots", () => {
    const source = ink(`
VAR x = 0

=== start ===
-> END
`);
    const { symbols } = buildSymbolTable(source, "main.ink");
    expect(symbols[0].range.startLineNumber).toBe(3);
  });

  it("records whether knots and stitches have parameter lists", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== get_hit(x) ===
= calculate(amount)

=== main ===
= intro
`),
      "main.ink",
    );

    expect(symbols.map((symbol) => [symbol.path, symbol.hasParameters])).toEqual([
      ["get_hit", true],
      ["get_hit.calculate", true],
      ["main", false],
      ["main.intro", false],
    ]);
  });

  it("indexes multiple knots", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== intro ===
-> bedroom

=== bedroom ===
-> END
`),
      "main.ink",
    );
    const names = symbols.map((s) => s.name);
    expect(names).toEqual(["intro", "bedroom"]);
    expect(symbols.every((s) => s.kind === "knot")).toBe(true);
  });
});

describe("buildSymbolTable — stitch scanning", () => {
  it("indexes a stitch with parentPath and dotted path", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== living_room ===
= examine_sofa
You sink into the cushions.
-> END
`),
      "main.ink",
    );

    const stitch = symbols.find((s) => s.name === "examine_sofa");
    expect(stitch).toMatchObject({
      name: "examine_sofa",
      kind: "stitch",
      path: "living_room.examine_sofa",
      parentPath: "living_room",
    });
  });

  it("assigns the enclosing knot as parentPath when multiple knots exist", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== chapter_one ===
= scene_a
-> END

=== chapter_two ===
= scene_b
-> END
`),
      "main.ink",
    );

    const sceneA = symbols.find((s) => s.name === "scene_a");
    const sceneB = symbols.find((s) => s.name === "scene_b");
    expect(sceneA?.parentPath).toBe("chapter_one");
    expect(sceneA?.path).toBe("chapter_one.scene_a");
    expect(sceneB?.parentPath).toBe("chapter_two");
    expect(sceneB?.path).toBe("chapter_two.scene_b");
  });

  it("all divert targets include knots and stitches", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== hub ===
= spoke
-> END
`),
      "main.ink",
    );
    const targets = symbols.filter(isDivertTarget).map((s) => s.path);
    expect(targets).toContain("hub");
    expect(targets).toContain("hub.spoke");
  });
});

describe("buildSymbolTable — function knot exclusion", () => {
  it("classifies function knots as kind 'function'", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== function harm(x) ===
~ return x * 2
`),
      "main.ink",
    );
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({ name: "harm", kind: "function" });
  });

  it("excludes function knots from divert completion targets", () => {
    const { symbols } = buildSymbolTable(
      ink(`
=== function harm(x) ===
~ return x * 2

=== start ===
The story begins.
-> END
`),
      "main.ink",
    );

    const divertTargets = symbols.filter(isDivertTarget);
    const targetNames = divertTargets.map((s) => s.name);

    expect(targetNames).not.toContain("harm");
    expect(targetNames).toContain("start");
  });

  it("excludes function knots from missing-start first-knot suggestion", () => {
    // File opens with a function knot then a regular knot — no top-level content.
    const { symbols, hasTopLevelContent } = buildSymbolTable(
      ink(`
=== function harm(x) ===
~ return x * 2

=== start ===
The story begins.
-> END
`),
      "main.ink",
    );

    expect(hasTopLevelContent).toBe(false);

    // The first playable knot (for the missing-start quick fix) must be "start".
    const firstPlayable = symbols.find(isDivertTarget);
    expect(firstPlayable?.name).toBe("start");
    expect(firstPlayable?.name).not.toBe("harm");
  });

  it("function knot without params is still classified as 'function'", () => {
    const { symbols } = buildSymbolTable("=== function pure ===\n~ return 0", "main.ink");
    expect(symbols[0]).toMatchObject({ name: "pure", kind: "function" });
  });
});

describe("buildSymbolTable — top-level content detection", () => {
  it("detects top-level prose before the first knot", () => {
    const { hasTopLevelContent } = buildSymbolTable(
      ink(`
The story begins here.

=== later ===
-> END
`),
      "main.ink",
    );
    expect(hasTopLevelContent).toBe(true);
  });

  it("detects a top-level divert as content", () => {
    const { hasTopLevelContent } = buildSymbolTable(
      ink(`
-> start

=== start ===
-> END
`),
      "main.ink",
    );
    expect(hasTopLevelContent).toBe(true);
  });

  it("reports no top-level content when the file starts with only knots", () => {
    const { hasTopLevelContent } = buildSymbolTable(
      ink(`
=== start ===
Content.
-> END
`),
      "main.ink",
    );
    expect(hasTopLevelContent).toBe(false);
  });

  it("treats VAR and LIST declarations before a knot as non-content", () => {
    // Declarations don't produce story output; they must not mask the diagnostic.
    const { hasTopLevelContent } = buildSymbolTable(
      ink(`
VAR health = 100
LIST moods = happy, sad

=== start ===
-> END
`),
      "main.ink",
    );
    expect(hasTopLevelContent).toBe(false);
  });

  it("reports no top-level content for an empty file", () => {
    const { hasTopLevelContent, symbols } = buildSymbolTable("", "main.ink");
    expect(hasTopLevelContent).toBe(false);
    expect(symbols).toHaveLength(0);
  });
});

describe("buildSymbolTable — comment handling", () => {
  it("skips line comments and does not index them as symbols", () => {
    const { symbols } = buildSymbolTable(
      ink(`
// === fake_knot ===
=== real_knot ===
-> END
`),
      "main.ink",
    );
    expect(symbols.map((s) => s.name)).toEqual(["real_knot"]);
  });

  it("skips block comments spanning multiple lines", () => {
    const { symbols } = buildSymbolTable(
      ink(`
/*
=== inside_comment ===
*/
=== outside ===
-> END
`),
      "main.ink",
    );
    expect(symbols.map((s) => s.name)).toEqual(["outside"]);
  });

  it("does not count comment lines as top-level content", () => {
    const { hasTopLevelContent } = buildSymbolTable(
      ink(`
// Just a comment.

=== start ===
-> END
`),
      "main.ink",
    );
    expect(hasTopLevelContent).toBe(false);
  });
});

describe("buildSymbolTable — stitch regex does not false-positive on knots", () => {
  it("does not match a 2-equals knot line as a stitch", () => {
    const { symbols } = buildSymbolTable("== knot_name ==\n-> END", "main.ink");
    // Should be a knot, not a stitch.
    expect(symbols[0]?.kind).toBe("knot");
  });

  it("does not match a 3-equals knot line as a stitch", () => {
    const { symbols } = buildSymbolTable("=== knot_name ===\n-> END", "main.ink");
    expect(symbols[0]?.kind).toBe("knot");
  });
});
