import { ensureSyntaxTree, foldable } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";

const doc = `=== outer ===
Intro line.

= inner
Inside stitch.


=== next ===
Next line.
-> END

=== function helper(x) ===
~ return x

=== empty ===
`;

function createState() {
  const state = EditorState.create({
    doc,
    extensions: InkLanguageSupport(),
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

function foldLineRange(state: EditorState, lineNumber: number) {
  const line = state.doc.line(lineNumber);
  const range = foldable(state, line.from, line.to);
  if (!range) return null;

  return {
    fromLine: state.doc.lineAt(range.from).number,
    toLine: state.doc.lineAt(range.to).number,
    from: range.from,
    to: range.to,
  };
}

describe("Ink CodeMirror folding", () => {
  it("folds knots, stitches, and functions while trimming spacer blank lines", () => {
    const state = createState();

    expect(foldLineRange(state, 1)).toMatchObject({ fromLine: 1, toLine: 5 });
    expect(foldLineRange(state, 4)).toMatchObject({ fromLine: 4, toLine: 5 });
    expect(foldLineRange(state, 8)).toMatchObject({ fromLine: 8, toLine: 10 });
    expect(foldLineRange(state, 12)).toMatchObject({ fromLine: 12, toLine: 13 });
  });

  it("does not offer a fold for an empty section header", () => {
    const state = createState();

    expect(foldLineRange(state, 15)).toBeNull();
  });
});
