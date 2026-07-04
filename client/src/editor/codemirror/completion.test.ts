import {
  acceptCompletion,
  CompletionContext,
  hasNextSnippetField,
  selectedCompletion,
  startCompletion,
  nextSnippetField,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "@/inkLanguage/buildSymbolTable";
import type { InkSymbol } from "@/inkLanguage/inkSymbols";
import {
  createInkDivertCompletionSource,
  inkCompletions,
  inkSnippetCompletionSource,
} from "./completion";

const ink = (s: string) => s.replace(/^\n/, "").trimEnd();

function completionContext(docWithCursor: string, explicit = false) {
  const pos = docWithCursor.indexOf("|");
  if (pos === -1) throw new Error("Test document must include a | cursor marker.");

  const doc = docWithCursor.slice(0, pos) + docWithCursor.slice(pos + 1);
  const state = EditorState.create({ doc });
  return {
    context: new CompletionContext(state, pos, explicit),
    pos,
    doc,
  };
}

function runCompletionSource(source: CompletionSource, docWithCursor: string) {
  const { context } = completionContext(docWithCursor);
  const result = source(context);
  if (result instanceof Promise) {
    throw new Error("Ink completion sources are expected to be synchronous.");
  }
  return result;
}

function runExplicitCompletionSource(source: CompletionSource, docWithCursor: string) {
  const { context } = completionContext(docWithCursor, true);
  const result = source(context);
  if (result instanceof Promise) {
    throw new Error("Ink completion sources are expected to be synchronous.");
  }
  return result;
}

function labels(result: CompletionResult | null) {
  return result?.options.map((option) => option.label) ?? [];
}

describe("Ink CodeMirror completions", () => {
  it("offers divert targets from broken or incomplete Ink", () => {
    const source = ink(`
=== start ===
= intro
{ flag:
  -> missing_target

=== unfinished
`);
    const symbols = buildSymbolTable(source, "main.ink").symbols;
    const result = runCompletionSource(
      createInkDivertCompletionSource(() => symbols),
      "-> |",
    );

    expect(labels(result)).toEqual([
      "start",
      "start.intro",
      "unfinished",
      "END",
      "DONE",
    ]);
  });

  it("filters divert completions to valid targets plus END and DONE", () => {
    const symbols: InkSymbol[] = [
      {
        name: "hub",
        kind: "knot",
        hasParameters: false,
        path: "hub",
        fileId: "main.ink",
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 14 },
      },
      {
        name: "phone",
        kind: "stitch",
        hasParameters: false,
        path: "hub.phone",
        parentPath: "hub",
        fileId: "main.ink",
        range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 8 },
      },
      {
        name: "score",
        kind: "function",
        hasParameters: true,
        path: "score",
        fileId: "main.ink",
        range: { startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 26 },
      },
    ];

    const result = runCompletionSource(
      createInkDivertCompletionSource(() => symbols),
      "-> h|",
    );

    expect(labels(result)).toEqual(["hub", "hub.phone", "END", "DONE"]);
    expect(result?.from).toBe("-> ".length);
    expect(result?.validFor).toEqual(/^[\w.]*$/);
  });

  it("excludes function knots from divert completion", () => {
    const symbols = buildSymbolTable(
      ink(`
=== function helper(x) ===
~ return x

=== start ===
-> END
`),
      "main.ink",
    ).symbols;

    const result = runCompletionSource(
      createInkDivertCompletionSource(() => symbols),
      "-> |",
    );

    expect(labels(result)).not.toContain("helper");
    expect(labels(result)).toContain("start");
  });

  it("stays silent outside divert and lone-snippet contexts", () => {
    expect(runCompletionSource(
      createInkDivertCompletionSource(() => []),
      "The story bends|",
    )).toBeNull();
    expect(runCompletionSource(inkSnippetCompletionSource, "The knot tightens|")).toBeNull();
  });

  it("only offers snippets for explicit completion", () => {
    expect(runCompletionSource(inkSnippetCompletionSource, "kn|")).toBeNull();
    expect(labels(runExplicitCompletionSource(inkSnippetCompletionSource, "kn|"))).toContain("knot");
  });

  it("inserts CodeMirror snippet completions with tab stops", () => {
    const { context, pos, doc } = completionContext("kn|", true);
    const result = inkSnippetCompletionSource(context);
    if (result instanceof Promise) {
      throw new Error("Ink snippet completion source should be synchronous.");
    }
    const completion = result?.options.find((option) => option.label === "knot");

    expect(result).toBeTruthy();
    expect(completion?.apply).toBeTypeOf("function");
    if (!result || !completion || typeof completion.apply !== "function") {
      throw new Error("Expected the knot snippet completion to have an apply function.");
    }

    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: pos },
      }),
      parent,
    });

    completion.apply(view, completion, result.from, result.to ?? pos);

    const inserted = "=== knot_name ===\nStory text.\n-> END\n";
    const firstFieldFrom = inserted.indexOf("knot_name");
    const firstFieldTo = firstFieldFrom + "knot_name".length;
    expect(view.state.doc.toString()).toBe(inserted);
    expect(view.state.selection.main.from).toBe(firstFieldFrom);
    expect(view.state.selection.main.to).toBe(firstFieldTo);
    expect(hasNextSnippetField(view.state)).toBe(true);

    expect(nextSnippetField(view)).toBe(true);
    const secondFieldFrom = inserted.indexOf("Story text.");
    const secondFieldTo = secondFieldFrom + "Story text.".length;
    expect(view.state.selection.main.from).toBe(secondFieldFrom);
    expect(view.state.selection.main.to).toBe(secondFieldTo);

    view.destroy();
    parent.remove();
  });

  it("preselects the first completion so Tab can accept it", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc: "-> s",
        selection: { anchor: "-> s".length },
        extensions: [
          inkCompletions(() => [{
            name: "start",
            kind: "knot",
            hasParameters: false,
            path: "start",
            fileId: "main.ink",
            range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 14 },
          }]),
        ],
      }),
      parent,
    });

    expect(startCompletion(view)).toBe(true);
    // Completion sources are queried asynchronously (debounced via setTimeout
    // even for synchronous sources), so wait for the popup to actually open
    // before asserting on the selected completion.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(selectedCompletion(view.state)).not.toBeNull();
    expect(acceptCompletion(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("-> start");

    view.destroy();
    parent.remove();
  });
});
