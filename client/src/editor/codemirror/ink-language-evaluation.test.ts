import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree, foldable } from "@codemirror/language";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";
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
  { tag: tags.special(tags.comment), class: "authorWarning" },
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

// InkPad-authored fixtures target specific taxonomy/coordinate cases (see
// docs/Editor Migration Plan.md). "tmlang-*" fixtures are pulled from
// inkle/ink-tmlanguage's tests/cases/ corpus (MIT) and are not required to be
// valid inkjs programs -- that corpus exists to exercise a TextMate
// tokenizer against edge-case/partial syntax, not to be a runnable-story
// suite. Each fixture's real compile status is recorded here and asserted
// below so a future contributor can trust the "invalid" ones are
// deliberate, not drift.
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
  "tmlang-arithmetic.ink": "valid",
  "tmlang-basic-string-literals.ink": "valid",
  "tmlang-basic-tunnel.ink": "valid",
  "tmlang-conditional-choices.ink": "valid",
  "tmlang-conditionals.ink": "valid",
  "tmlang-default-choices.ink": "valid",
  "tmlang-divert-in-conditional.ink": "valid",
  "tmlang-divert-targets-with-parameters.ink": "valid",
  "tmlang-external-binding.ink": "valid",
  "tmlang-floor-ceiling-casts.ink": "valid",
  "tmlang-knot-stitch-function-declaration.ink": "invalid",
  "tmlang-path-to-self.ink": "valid",
  "tmlang-same-line-divert.ink": "valid",
  "tmlang-simple-glue.ink": "valid",
  "tmlang-tags.ink": "invalid",
  "tmlang-todo.ink": "invalid",
  "tmlang-turns-since.ink": "valid",
  "tmlang-variable-declarations.ink": "invalid",
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
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
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
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
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

describe("vendored Ink language (client/src/editor/codemirror/ink-lang)", () => {
  it("matches the recorded inkjs compile status for every fixture", async () => {
    const fixtureNames = (await readdir(fixturesDir))
      .filter((name) => name.endsWith(".ink"))
      .sort();

    const actualStatus = Object.fromEntries(
      fixtureNames.map((name) => [name, getFixtureCompileStatus(name, readFixture(name))]),
    );

    expect(Object.keys(expectedFixtureCompileStatus).sort()).toEqual(fixtureNames);
    expect(actualStatus).toEqual(expectedFixtureCompileStatus);
  });

  it("records parser error-node counts and fold coverage for the fixture corpus", async () => {
    const fixtureNames = (await readdir(fixturesDir))
      .filter((name) => name.endsWith(".ink"))
      .sort();

    const report = fixtureNames.map((name) => {
      const state = createInkState(readFixture(name));
      const treeString = getTreeString(state);

      return {
        name,
        errorNodeCount: countErrorNodes(treeString),
        foldableLines: getFoldableLines(state),
      };
    });

    expect(report).toMatchSnapshot();
  });

  it("snapshots the full syntax tree shape per fixture", async () => {
    const fixtureNames = (await readdir(fixturesDir))
      .filter((name) => name.endsWith(".ink"))
      .sort();

    for (const name of fixtureNames) {
      const state = createInkState(readFixture(name));
      await expect(getTreeString(state)).toMatchFileSnapshot(
        `__snapshots__/tree/${name}.tree.txt`,
      );
    }
  });

  it("snapshots highlight spans per fixture", async () => {
    const fixtureNames = (await readdir(fixturesDir))
      .filter((name) => name.endsWith(".ink"))
      .sort();

    for (const name of fixtureNames) {
      const spans = collectHighlightSpans(readFixture(name));
      const rendered = spans.map((span) => `${JSON.stringify(span.text)} -> ${span.classes}`).join("\n");
      await expect(rendered).toMatchFileSnapshot(
        `__snapshots__/highlights/${name}.highlights.txt`,
      );
    }
  });

  it("surfaces useful highlight tags where the grammar parses cleanly", () => {
    const spans = collectHighlightSpans(readFixture("basic-knot.ink"));

    expect(classesForText(spans, "=== ")).toContain("heading1");
    expect(classesForText(spans, "chapter")).toContain("name");
    expect(classesForText(spans, "Wave to the conductor")).toContain("content");
    expect(classesForText(spans, "# warm")).toContain("labelName");
    expect(classesForText(spans, "END")).toContain("keyword");
  });

  it("tags AuthorWarning distinctly from LineComment when the node is produced", () => {
    // The `todo` token uses @dynamicPrecedence in the vendored grammar, and
    // its resolution is sensitive to what follows on later lines -- see the
    // next test and client/src/editor/codemirror/ink-lang/README.md. A
    // single TODO line immediately followed by a `//` comment is a case
    // that reliably produces a real AuthorWarning node, which is what this
    // test needs to isolate the highlight-tag patch (t.special(t.comment))
    // from that separate, unresolved node-recognition gap.
    const spans = collectHighlightSpans("TODO: Tighten this scene.\n// This is a normal comment.\n");

    expect(classesForText(spans, "TODO: Tighten this scene.")).toBe("authorWarning");
    expect(classesForText(spans, "// This is a normal comment.")).toBe("comment");
  });

  it("still shows the known unpatched gap: AuthorWarning recognition is context-sensitive", () => {
    // In the full todo-author-warning.ink fixture (TODO line, then a FIXME
    // line, then comments), neither TODO nor FIXME is recognized as
    // AuthorWarning -- both parse as plain ContentLine. This was already
    // documented in Checkpoint 2 as "parsed as plain content, not
    // author-warning tokens". What's newly understood: the `todo`
    // @dynamicPrecedence token's resolution isn't simply "unsupported", it
    // is inconsistent based on lookahead -- the same "TODO: ..." text
    // parses as AuthorWarning in the isolated case above but as ContentLine
    // here. Retagging alone (this session's patch) cannot fix that; it
    // needs the `todo`/AuthorWarning grammar rule itself reworked.
    const spans = collectHighlightSpans(readFixture("todo-author-warning.ink"));

    expect(classesForText(spans, "TODO: Tighten this scene.")).toBe("content");
  });

  it("parses CJK/Hangul identifiers and parameterized divert targets without error nodes", () => {
    const cjkState = createInkState(readFixture("cjk-hangul-identifiers.ink"));
    const paramState = createInkState(readFixture("divert-parameterized.ink"));

    // One systemic zero-width error node remains at the trailing knot/EOF
    // boundary (see client/src/editor/codemirror/ink-lang/README.md) --
    // that is not related to CJK identifiers or divert-call arguments, and
    // is not fixable by patching either of those constructs. The
    // parameterized fixture has two knots, so it hits the systemic
    // knot-boundary artifact twice (once between knots, once at EOF).
    expect(countErrorNodes(getTreeString(cjkState))).toBe(1);
    expect(countErrorNodes(getTreeString(paramState))).toBe(2);
  });

  it("still shows the known unpatched gap: compound sequence keywords swallow real content", () => {
    const state = createInkState(readFixture("sequence.ink"));

    expect(getTreeString(state)).toContain("⚠");
  });
});
