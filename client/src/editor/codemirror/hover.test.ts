import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";
import { buildSymbolTable } from "@/inkLanguage/buildSymbolTable";
import type { InkSymbol } from "@/inkLanguage/inkSymbols";
import { createInkInfoTooltipSource } from "./hover";

const ink = (s: string) => s.replace(/^\n/, "").trimEnd();

function createFixture(doc: string) {
  const source = ink(doc);
  const state = EditorState.create({
    doc: source,
    extensions: InkLanguageSupport(),
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const symbols = buildSymbolTable(source, "main.ink").symbols;
  const parent = document.createElement("div");
  document.body.append(parent);
  const view = new EditorView({ state, parent });

  return {
    source,
    view,
    symbols,
    destroy() {
      view.destroy();
      parent.remove();
    },
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

describe("Ink Info hover", () => {
  it("shows concise Ink-aware text for a resolved divert target", () => {
    const fixture = createFixture(`
-> start.intro

=== start ===
= intro
-> END
`);

    try {
      const source = createInkInfoTooltipSource(() => fixture.symbols, () => {});
      const tooltip = source(fixture.view, fixture.posOf("intro"), 1);
      if (!tooltip || Array.isArray(tooltip) || tooltip instanceof Promise) {
        throw new Error("Expected a synchronous tooltip.");
      }

      const tooltipView = tooltip.create(fixture.view);
      expect(tooltip.pos).toBe(fixture.posOf("start.intro"));
      expect(tooltip.end).toBe(fixture.posOf("start.intro") + "start.intro".length);
      expect(tooltipView.dom.textContent).toContain("Divert to stitch");
      expect(tooltipView.dom.textContent).toContain("start.intro");
      expect(tooltipView.dom.textContent).toContain("main.ink:4");
      expect(tooltipView.dom.textContent).toContain("Go to definition");
    } finally {
      fixture.destroy();
    }
  });

  it("describes knot and stitch declarations differently from diverts", () => {
    const fixture = createFixture(`
=== start ===
= intro
-> END
`);

    try {
      const source = createInkInfoTooltipSource(() => fixture.symbols, () => {});
      const knotTooltip = source(fixture.view, fixture.posOf("=== start") + 5, 1);
      const stitchTooltip = source(fixture.view, fixture.posOf("= intro") + 3, 1);

      if (
        !knotTooltip
        || Array.isArray(knotTooltip)
        || knotTooltip instanceof Promise
        || !stitchTooltip
        || Array.isArray(stitchTooltip)
        || stitchTooltip instanceof Promise
      ) {
        throw new Error("Expected synchronous declaration tooltips.");
      }

      expect(knotTooltip.create(fixture.view).dom.textContent).toContain("Knot declaration");
      expect(stitchTooltip.create(fixture.view).dom.textContent).toContain("Stitch in start");
    } finally {
      fixture.destroy();
    }
  });

  it("calls the jump callback from the Go to definition action", () => {
    const fixture = createFixture(`
-> start

=== start ===
-> END
`);
    const jumped: InkSymbol[] = [];

    try {
      const source = createInkInfoTooltipSource(
        () => fixture.symbols,
        (symbol) => jumped.push(symbol),
      );
      const tooltip = source(fixture.view, fixture.posOf("start"), 1);
      if (!tooltip || Array.isArray(tooltip) || tooltip instanceof Promise) {
        throw new Error("Expected a synchronous tooltip.");
      }

      const dom = tooltip.create(fixture.view).dom;
      const action = dom.querySelector("button");
      expect(action).toBeTruthy();
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      expect(jumped.map((symbol) => symbol.path)).toEqual(["start"]);
    } finally {
      fixture.destroy();
    }
  });

  it("stays silent for prose, unknown targets, END, DONE, and functions", () => {
    const fixture = createFixture(`
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

    try {
      const source = createInkInfoTooltipSource(() => fixture.symbols, () => {});

      expect(source(fixture.view, fixture.posOf("intro"), 1)).toBeNull();
      expect(source(fixture.view, fixture.posOf("helper"), 1)).toBeNull();
      expect(source(fixture.view, fixture.posOf("missing"), 1)).toBeNull();
      expect(source(fixture.view, fixture.posOf("END"), 1)).toBeNull();
      expect(source(fixture.view, fixture.posOf("DONE"), 1)).toBeNull();
    } finally {
      fixture.destroy();
    }
  });
});
