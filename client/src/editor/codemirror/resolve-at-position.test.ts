import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";
import { buildSymbolTable } from "@/inkLanguage/buildSymbolTable";
import { resolveSymbolAtPosition } from "./resolve-at-position";

const ink = (s: string) => s.replace(/^\n/, "").trimEnd();

function createFixture(doc: string) {
  const source = ink(doc);
  const state = EditorState.create({
    doc: source,
    extensions: InkLanguageSupport(),
  });
  ensureSyntaxTree(state, state.doc.length, 5000);

  return {
    state,
    symbols: buildSymbolTable(source, "main.ink").symbols,
    posOf(text: string, occurrence = 0) {
      let index = -1;
      for (let i = 0; i <= occurrence; i += 1) {
        index = source.indexOf(text, index + 1);
      }
      if (index === -1) {
        throw new Error(`"${text}" occurrence ${occurrence} not found in fixture`);
      }
      return index;
    },
  };
}

describe("resolveSymbolAtPosition", () => {
  it("resolves a bare knot divert target", () => {
    const { state, symbols, posOf } = createFixture(`
-> start

=== start ===
-> END
`);

    const resolved = resolveSymbolAtPosition(state, posOf("start"), symbols);

    expect(resolved?.symbol).toMatchObject({ kind: "knot", path: "start" });
    expect(resolved?.text).toBe("start");
  });

  it("resolves a dotted stitch divert target from either path component", () => {
    const { state, symbols, posOf } = createFixture(`
-> start.intro

=== start ===
= intro
-> END
`);

    expect(resolveSymbolAtPosition(state, posOf("start.intro"), symbols)?.symbol.path)
      .toBe("start.intro");
    expect(resolveSymbolAtPosition(state, posOf("intro"), symbols)?.symbol.path)
      .toBe("start.intro");
  });

  it("resolves a local bare stitch target inside its enclosing knot", () => {
    const { state, symbols, posOf } = createFixture(`
=== start ===
-> intro

= intro
-> END

=== other ===
= intro
-> END
`);

    const resolved = resolveSymbolAtPosition(state, posOf("intro"), symbols);

    expect(resolved?.symbol.path).toBe("start.intro");
  });

  it("resolves a unique bare stitch target when there is no local knot context", () => {
    const { state, symbols, posOf } = createFixture(`
-> intro

=== start ===
= intro
-> END
`);

    const resolved = resolveSymbolAtPosition(state, posOf("intro"), symbols);

    expect(resolved?.symbol.path).toBe("start.intro");
  });

  it("does not guess an ambiguous bare stitch target outside a local knot", () => {
    const { state, symbols, posOf } = createFixture(`
-> intro

=== start ===
= intro
-> END

=== other ===
= intro
-> END
`);

    expect(resolveSymbolAtPosition(state, posOf("intro"), symbols)).toBeNull();
  });

  it("rejects END, DONE, function knots, unknown targets, and prose", () => {
    const { state, symbols, posOf } = createFixture(`
The intro word in prose.
-> helper
-> missing
-> END
-> DONE

=== function helper(x) ===
~ return x

=== start ===
-> END
`);

    expect(resolveSymbolAtPosition(state, posOf("intro"), symbols)).toBeNull();
    expect(resolveSymbolAtPosition(state, posOf("helper"), symbols)).toBeNull();
    expect(resolveSymbolAtPosition(state, posOf("missing"), symbols)).toBeNull();
    expect(resolveSymbolAtPosition(state, posOf("END"), symbols)).toBeNull();
    expect(resolveSymbolAtPosition(state, posOf("DONE"), symbols)).toBeNull();
  });

  it("resolves unique knot and stitch declarations themselves", () => {
    const { state, symbols, posOf } = createFixture(`
=== start ===
= intro
-> END
`);

    expect(resolveSymbolAtPosition(state, posOf("=== start") + 5, symbols)?.symbol.path)
      .toBe("start");
    expect(resolveSymbolAtPosition(state, posOf("= intro") + 3, symbols)?.symbol.path)
      .toBe("start.intro");
  });

  it("resolves duplicate stitch declarations by their exact declaration line", () => {
    const { state, symbols, posOf } = createFixture(`
=== start ===
= intro
-> END

=== other ===
= intro
-> END
`);

    expect(resolveSymbolAtPosition(state, posOf("= intro") + 3, symbols)?.symbol.path)
      .toBe("start.intro");
    expect(resolveSymbolAtPosition(state, posOf("= intro", 1) + 3, symbols)?.symbol.path)
      .toBe("other.intro");
  });
});
