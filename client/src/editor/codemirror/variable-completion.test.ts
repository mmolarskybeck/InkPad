import {
  CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "@/inkLanguage/buildSymbolTable";
import type { InkVariableSymbol } from "@/inkLanguage/inkSymbols";
import { createInkVariableCompletionSource } from "./variable-completion";

const ink = (s: string) => s.replace(/^\n/, "").trimEnd();

const FIXTURE = ink(`
VAR health = 100
CONST MAX_HEALTH = 100
EXTERNAL roll_dice(sides)
LIST moods = happy, sad

=== function score(x) ===
~ return x

=== start ===
-> END
`);

const fixtureTable = buildSymbolTable(FIXTURE, "main.ink");

function completionContext(docWithCursor: string, explicit = false) {
  const pos = docWithCursor.indexOf("|");
  if (pos === -1) throw new Error("Test document must include a | cursor marker.");

  const doc = docWithCursor.slice(0, pos) + docWithCursor.slice(pos + 1);
  const state = EditorState.create({ doc });
  return { context: new CompletionContext(state, pos, explicit), pos, doc };
}

function run(source: CompletionSource, docWithCursor: string, explicit = false) {
  const { context } = completionContext(docWithCursor, explicit);
  const result = source(context);
  if (result instanceof Promise) {
    throw new Error("Ink completion sources are expected to be synchronous.");
  }
  return result;
}

/** For documents that contain a literal `|` (Ink alternatives), place the cursor explicitly. */
function runAt(source: CompletionSource, doc: string, pos: number, explicit = false) {
  const state = EditorState.create({ doc });
  const result = source(new CompletionContext(state, pos, explicit));
  if (result instanceof Promise) {
    throw new Error("Ink completion sources are expected to be synchronous.");
  }
  return result;
}

function labels(result: CompletionResult | null) {
  return result?.options.map((option) => option.label) ?? [];
}

function createSource(variables = fixtureTable.variables) {
  return createInkVariableCompletionSource(() => variables, () => fixtureTable.symbols);
}

describe("Ink variable completion", () => {
  it("fires in logic, interpolation, condition and declaration contexts", () => {
    const source = createSource();

    expect(labels(run(source, "~ |", true))).toContain("health");
    expect(labels(run(source, "{|", true))).toContain("health");
    expect(labels(run(source, "{x == |", true))).toContain("health");
    expect(labels(run(source, "* {|", true))).toContain("health");
    expect(labels(run(source, "VAR a = |", true))).toContain("health");
  });

  it("fires implicitly once a word is being typed", () => {
    const result = run(createSource(), "{ he|");

    expect(labels(result)).toContain("health");
    expect(result?.from).toBe("{ ".length);
    expect(result?.validFor).toEqual(/^\w*$/);
  });

  it("stays silent in prose, temp declarations, shuffle labels and alternatives", () => {
    const source = createSource();

    expect(run(source, "The story bends|", true)).toBeNull();
    expect(run(source, "~ temp |", true)).toBeNull();
    expect(run(source, "{stopping: Fi|")).toBeNull();
    expect(runAt(source, "{First|Sec", "{First|Sec".length)).toBeNull();
  });

  it("offers variables, list items, function knots and built-ins with details", () => {
    const options = run(createSource(), "~ |", true)?.options ?? [];
    const detailOf = (label: string) => options.find((o) => o.label === label)?.detail;
    const typeOf = (label: string) => options.find((o) => o.label === label)?.type;

    expect(detailOf("health")).toBe("VAR");
    expect(typeOf("health")).toBe("variable");
    expect(detailOf("MAX_HEALTH")).toBe("CONST");
    expect(typeOf("MAX_HEALTH")).toBe("constant");
    expect(detailOf("roll_dice")).toBe("EXTERNAL");
    expect(detailOf("moods")).toBe("LIST");
    expect(detailOf("happy")).toBe("item of moods");
    expect(typeOf("happy")).toBe("enum");
    expect(detailOf("score")).toBe("function");
    expect(detailOf("LIST_COUNT")).toBe("built-in");
    expect(labels(run(createSource(), "~ |", true))).not.toContain("start");
  });

  it("dedupes repeated names across files", () => {
    const duplicated: InkVariableSymbol[] = [
      ...fixtureTable.variables,
      {
        name: "health",
        kind: "var",
        fileId: "other.ink",
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 },
      },
    ];

    const found = labels(run(createSource(duplicated), "~ |", true))
      .filter((label) => label === "health");

    expect(found).toHaveLength(1);
  });
});
