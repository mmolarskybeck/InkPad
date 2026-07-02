import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree, foldable } from "@codemirror/language";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import { InkLanguageSupport } from "@mavnn/codemirror-lang-ink";
import { compileInkProject } from "@/workers/compile-ink-project";

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

type FixtureCompileStatus = "valid" | "invalid";

const expectedFixtureCompileStatus: Record<string, FixtureCompileStatus> = {
  "basic-knot.ink": "valid",
  "built-in-functions.ink": "valid",
  "cjk-hangul-identifiers.ink": "valid",
  "divert-function-call.ink": "valid",
  "divert-parameterized.ink": "valid",
  "divert-three-part-path.ink": "valid",
  "divert-tunnel.ink": "valid",
  "emoji-offsets.ink": "valid",
  "escape-sequences.ink": "valid",
  "external-declaration.ink": "valid",
  "function-knot.ink": "valid",
  "global-dictionary-tag.ink": "valid",
  "glue.ink": "valid",
  "include-quoted-path.ink": "invalid",
  "include-subfolder-path.ink": "valid",
  "nested-conditional.ink": "valid",
  "sequence.ink": "valid",
  "stitch.ink": "valid",
  "todo-author-warning.ink": "valid",
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

function countErrorNodes(treeString: string) {
  return treeString.match(/⚠/g)?.length ?? 0;
}

function getErrorNodeContexts(treeString: string) {
  const contexts: string[] = [];
  let index = treeString.indexOf("⚠");

  while (index !== -1) {
    contexts.push(treeString.slice(Math.max(0, index - 35), index + 36));
    index = treeString.indexOf("⚠", index + 1);
  }

  return contexts;
}

function createCompileFiles(name: string, source: string) {
  const files: Record<string, string> = {
    [name]: source,
  };

  if (name === "include-quoted-path.ink" || name === "include-subfolder-path.ink") {
    files["chapters/start.ink"] = "=== start ===\nIncluded chapter.\n-> END";
  }

  if (name === "include-subfolder-path.ink") {
    files["shared/common.ink"] = "VAR shared_count = 0";
  }

  return files;
}

function getFixtureCompileStatus(name: string, source: string): FixtureCompileStatus {
  const response = compileInkProject({
    type: "compile",
    requestId: `fixture-${name}`,
    entryFile: name,
    files: createCompileFiles(name, source),
  });

  return response.type === "compile-success" ? "valid" : "invalid";
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
      const source = readFixture(name);
      const state = createInkState(source);
      const treeString = getTreeString(state);

      return {
        name,
        inkjsStatus: getFixtureCompileStatus(name, source),
        errorNodeCount: countErrorNodes(treeString),
        errorNodeContexts: getErrorNodeContexts(treeString),
        foldableLines: getFoldableLines(state),
      };
    });

    expect(Object.keys(expectedFixtureCompileStatus).sort()).toEqual(fixtureNames);
    expect(Object.fromEntries(report.map((item) => [item.name, item.inkjsStatus]))).toEqual(
      expectedFixtureCompileStatus,
    );
    expect(report).toEqual([
      { name: "basic-knot.ink", inkjsStatus: "valid", errorNodeCount: 1, errorNodeContexts: ["t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [1] },
      { name: "built-in-functions.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["Comparison(ExpressionSubtract(Bool(⚠),⚠),Name))),VariableAssignment(Tem", "parison(ExpressionSubtract(Bool(⚠),⚠),Name))),VariableAssignment(Temp,N", "t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [4] },
      { name: "cjk-hangul-identifiers.ink", inkjsStatus: "valid", errorNodeCount: 4, errorNodeContexts: ["eDeclaration(Name,Int),ContentLine(⚠),Knot(⚠),⚠,ContentLine(⚠),ContentL", "tion(Name,Int),ContentLine(⚠),Knot(⚠),⚠,ContentLine(⚠),ContentLine,Cont", "n(Name,Int),ContentLine(⚠),Knot(⚠),⚠,ContentLine(⚠),ContentLine,Content", "ntentLine(⚠),Knot(⚠),⚠,ContentLine(⚠),ContentLine,ContentLine(Divert(Di"], foldableLines: [] },
      { name: "divert-function-call.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["t(DivertArrow,DivertTarget(Path))),⚠,ContentLine,⚠,RepeatingChoice(Prew", "DivertTarget(Path))),⚠,ContentLine,⚠,RepeatingChoice(PreweaveChoiceCont", "t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [6] },
      { name: "divert-parameterized.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["t(DivertArrow,DivertTarget(Path))),⚠,ContentLine),⚠,Knot(KnotName,KnotA", "ivertTarget(Path))),⚠,ContentLine),⚠,Knot(KnotName,KnotArguments(Name,N", "t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [1, 4] },
      { name: "divert-three-part-path.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["t(DivertArrow,DivertTarget(Path))),⚠,ContentLine,ContentLine(Divert(Div", "t(DivertArrow,DivertTarget(END)))),⚠),⚠)", "ivertArrow,DivertTarget(END)))),⚠),⚠)"], foldableLines: [4, 5] },
      { name: "divert-tunnel.ink", inkjsStatus: "valid", errorNodeCount: 2, errorNodeContexts: ["t(DivertArrow,DivertTarget(END)))),⚠,Knot(KnotName,ContentLine,ContentL", "ContentLine(Divert(TunnelReturn))),⚠)"], foldableLines: [1, 6] },
      { name: "emoji-offsets.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "escape-sequences.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "external-declaration.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["t(KnotName,VariableAssignment(Name,⚠),⚠,ContentLine,ContentLine(Divert(", "notName,VariableAssignment(Name,⚠),⚠,ContentLine,ContentLine(Divert(Div", "t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [4] },
      { name: "function-knot.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["e)),VariableAssignment(Return,Name,⚠)),⚠,Knot(KnotName,VariableAssignme", "VariableAssignment(Return,Name,⚠)),⚠,Knot(KnotName,VariableAssignment(N", "t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [3, 7] },
      { name: "global-dictionary-tag.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "glue.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "include-quoted-path.ink", inkjsStatus: "invalid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "include-subfolder-path.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "nested-conditional.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
      { name: "sequence.ink", inkjsStatus: "valid", errorNodeCount: 3, errorNodeContexts: ["eContent)),ContentLine(Conditional(⚠),⚠(Pipe),InlineSequence(⚠,Sequence", "ntent)),ContentLine(Conditional(⚠),⚠(Pipe),InlineSequence(⚠,SequenceCon", "ditional(⚠),⚠(Pipe),InlineSequence(⚠,SequenceContent,Pipe,SequenceConte"], foldableLines: [] },
      { name: "stitch.ink", inkjsStatus: "valid", errorNodeCount: 2, errorNodeContexts: [",DivertTarget(Path)))),LineComment(⚠),ContentLine,ContentLine(Divert(Di", "t(DivertArrow,DivertTarget(END)))),⚠)"], foldableLines: [1, 2] },
      { name: "todo-author-warning.ink", inkjsStatus: "valid", errorNodeCount: 0, errorNodeContexts: [], foldableLines: [] },
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
