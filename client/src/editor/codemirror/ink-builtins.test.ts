import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  findInkBuiltinFunctionRanges,
  INK_BUILTIN_FUNCTIONS,
} from "@/editor/codemirror/ink-builtins";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";

const doc = `LIST fruit = apple, pear

=== start ===
~ temp roll = RANDOM(1, 6)
~ temp turns = TURNS_SINCE(-> start)
~ temp seen = CHOICE_COUNT()
~ temp rounded = FLOOR(1.8)
~ temp maximum = MAX(roll, rounded)
~ temp item = LIST_RANDOM(fruit)
RANDOM, LIST_COUNT, and TURNS_SINCE are prose here.
~ custom = not_a_builtin(roll)
-> END
`;

function createState() {
  const state = EditorState.create({
    doc,
    extensions: InkLanguageSupport(),
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

describe("ink built-in function highlighting", () => {
  it("keeps the built-in set aligned with inkjs-recognized public function names", () => {
    expect([...INK_BUILTIN_FUNCTIONS].sort()).toEqual([
      "CEILING",
      "CHOICE_COUNT",
      "FLOAT",
      "FLOOR",
      "INT",
      "LIST_ALL",
      "LIST_COUNT",
      "LIST_INVERT",
      "LIST_MAX",
      "LIST_MIN",
      "LIST_RANDOM",
      "LIST_RANGE",
      "LIST_VALUE",
      "MAX",
      "MIN",
      "POW",
      "RANDOM",
      "READ_COUNT",
      "SEED_RANDOM",
      "TURNS",
      "TURNS_SINCE",
    ]);
  });

  it("marks built-ins only when they are parsed as function calls", () => {
    const state = createState();
    const ranges = findInkBuiltinFunctionRanges(state);

    expect(ranges.map((range) => range.name)).toEqual([
      "RANDOM",
      "TURNS_SINCE",
      "CHOICE_COUNT",
      "FLOOR",
      "MAX",
      "LIST_RANDOM",
    ]);
    expect(ranges.map((range) => state.doc.lineAt(range.from).number)).toEqual([4, 5, 6, 7, 8, 9]);
  });
});
