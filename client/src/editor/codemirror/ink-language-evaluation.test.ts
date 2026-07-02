import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree, foldable } from "@codemirror/language";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import { InkLanguageSupport } from "@mavnn/codemirror-lang-ink";

const fixturesDir = path.resolve(process.cwd(), "client/src/editor/codemirror/__fixtures__");

const inkEvaluationHighlighter = tagHighlighter([
  { tag: tags.heading1, class: "heading1" },
  { tag: tags.heading2, class: "heading2" },
  { tag: tags.keyword, class: "keyword" },
  { tag: tags.operatorKeyword, class: "operatorKeyword" },
  { tag: tags.controlOperator, class: "controlOperator" },
  { tag: tags.name, class: "name" },
  { tag: tags.labelName, class: "labelName" },
  { tag: tags.content, class: "content" },
  { tag: tags.string, class: "string" },
  { tag: tags.number, class: "number" },
  { tag: tags.operator, class: "operator" },
  { tag: tags.bracket, class: "bracket" },
  { tag: tags.squareBracket, class: "squareBracket" },
  { tag: tags.paren, class: "paren" },
  { tag: tags.comment, class: "comment" },
  { tag: tags.blockComment, class: "blockComment" },
  { tag: tags.bool, class: "bool" },
  { tag: tags.separator, class: "separator" },
  { tag: tags.arithmeticOperator, class: "arithmeticOperator" },
]);

type HighlightSpan = {
  text: string;
  classes: string;
};

function readFixture(name: string) {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

function createInkState(source: string) {
  return EditorState.create({
    doc: source,
    extensions: [InkLanguageSupport()],
  });
}

function getTreeString(state: EditorState) {
  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  expect(tree, "Expected CodeMirror to produce an Ink syntax tree").toBeTruthy();

  return tree?.toString() ?? "";
}

function getFoldableLines(state: EditorState) {
  const lines: number[] = [];

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (foldable(state, line.from, line.to)) lines.push(lineNumber);
  }

  return lines;
}

function collectHighlightSpans(source: string): HighlightSpan[] {
  const state = createInkState(source);
  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  expect(tree, "Expected CodeMirror to produce an Ink syntax tree").toBeTruthy();
  const spans: HighlightSpan[] = [];

  highlightTree(tree!, inkEvaluationHighlighter, (from, to, classes) => {
    const text = source.slice(from, to);
    if (!text.trim()) return;
    spans.push({ text, classes });
  });

  return spans;
}

function classesForText(spans: HighlightSpan[], text: string) {
  const match = spans.find((span) => span.text.includes(text));
  expect(match, `Expected a highlighted span containing "${text}"`).toBeDefined();

  return match?.classes ?? "";
}

describe("@mavnn/codemirror-lang-ink evaluation", () => {
  it("records parser error-node and fold coverage for the InkPad fixture corpus", async () => {
    const fixtureNames = (await readdir(fixturesDir))
      .filter((name) => name.endsWith(".ink"))
      .sort();

    const report = fixtureNames.map((name) => {
      const state = createInkState(readFixture(name));
      const treeString = getTreeString(state);

      return {
        name,
        hasErrorNodes: treeString.includes("⚠"),
        foldableLines: getFoldableLines(state),
      };
    });

    expect(report).toEqual([
      { name: "basic-knot.ink", hasErrorNodes: true, foldableLines: [1] },
      { name: "built-in-functions.ink", hasErrorNodes: true, foldableLines: [] },
      { name: "cjk-hangul-identifiers.ink", hasErrorNodes: true, foldableLines: [] },
      { name: "divert-function-call.ink", hasErrorNodes: true, foldableLines: [] },
      { name: "divert-parameterized.ink", hasErrorNodes: true, foldableLines: [1, 4] },
      { name: "divert-three-part-path.ink", hasErrorNodes: true, foldableLines: [] },
      { name: "divert-tunnel.ink", hasErrorNodes: true, foldableLines: [1, 6] },
      { name: "emoji-offsets.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "escape-sequences.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "external-declaration.ink", hasErrorNodes: true, foldableLines: [4] },
      { name: "function-knot.ink", hasErrorNodes: true, foldableLines: [1, 5] },
      { name: "global-dictionary-tag.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "glue.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "include-quoted-path.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "include-subfolder-path.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "nested-conditional.ink", hasErrorNodes: false, foldableLines: [] },
      { name: "sequence.ink", hasErrorNodes: true, foldableLines: [] },
      { name: "stitch.ink", hasErrorNodes: true, foldableLines: [1, 2] },
      { name: "todo-author-warning.ink", hasErrorNodes: false, foldableLines: [] },
    ]);
  });

  it("surfaces useful highlight tags where the candidate grammar parses cleanly", () => {
    const spans = collectHighlightSpans(readFixture("basic-knot.ink"));

    expect(classesForText(spans, "=== ")).toContain("heading1");
    expect(classesForText(spans, "chapter")).toContain("name");
    expect(classesForText(spans, "Wave to the conductor")).toContain("content");
    expect(classesForText(spans, "# warm")).toContain("labelName");
    expect(classesForText(spans, "END")).toContain("keyword");
  });

  it("documents candidate gaps that need patching or a fallback StreamLanguage path", () => {
    const todoSpans = collectHighlightSpans(readFixture("todo-author-warning.ink"));
    const cjkState = createInkState(readFixture("cjk-hangul-identifiers.ink"));
    const functionState = createInkState(readFixture("function-knot.ink"));

    expect(classesForText(todoSpans, "TODO: Tighten this scene.")).toBe("content");
    expect(getTreeString(cjkState)).toContain("⚠");
    expect(getTreeString(functionState)).toContain("⚠");
  });
});
