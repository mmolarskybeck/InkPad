import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "./buildSymbolTable";
import { findClosestDivertTarget } from "./fuzzyMatch";

const ink = (source: string) => source.replace(/^\n/, "").trimEnd();

describe("findClosestDivertTarget", () => {
  it("returns the single closest divert target", () => {
    const symbols = buildSymbolTable(ink(`
=== start ===
-> END

=== kitchen ===
-> END
`), "main.ink").symbols;

    expect(findClosestDivertTarget("strat", symbols)?.path).toBe("start");
  });

  it("requires the same first character and a small length delta", () => {
    const symbols = buildSymbolTable(ink(`
=== kitchen ===
-> END
`), "main.ink").symbols;

    expect(findClosestDivertTarget("bitchen", symbols)).toBeNull();
    expect(findClosestDivertTarget("k", symbols)).toBeNull();
  });

  it("suppresses tied best candidates", () => {
    const symbols = buildSymbolTable(ink(`
=== cat ===
-> END

=== car ===
-> END
`), "main.ink").symbols;

    expect(findClosestDivertTarget("cap", symbols)).toBeNull();
  });

  it("excludes function knots", () => {
    const symbols = buildSymbolTable(ink(`
=== function helper ===
~ return 1
`), "main.ink").symbols;

    expect(findClosestDivertTarget("helpor", symbols)).toBeNull();
  });
});
