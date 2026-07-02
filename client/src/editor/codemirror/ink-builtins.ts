import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

// Built-ins verified against inkjs:
// - compiler/Parser/ParsedHierarchy/FunctionCall.js for special calls
// - engine/NativeFunctionCall.js for native runtime functions
export const INK_BUILTIN_FUNCTIONS = new Set([
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

export interface InkBuiltinFunctionRange {
  from: number;
  to: number;
  name: string;
}

function firstNameChild(node: SyntaxNode): SyntaxNode | null {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "Name") return child;
  }

  return null;
}

export function findInkBuiltinFunctionRanges(state: EditorState): InkBuiltinFunctionRange[] {
  const ranges: InkBuiltinFunctionRange[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "ExpressionFunctionCall") return;

      const nameNode = firstNameChild(node.node);
      if (!nameNode) return;

      const name = state.doc.sliceString(nameNode.from, nameNode.to);
      if (!INK_BUILTIN_FUNCTIONS.has(name)) return;

      ranges.push({ from: nameNode.from, to: nameNode.to, name });
    },
  });

  return ranges;
}

const builtinMark = Decoration.mark({ class: "cm-inkBuiltin" });

function computeDecorations(view: EditorView): DecorationSet {
  return Decoration.set(
    findInkBuiltinFunctionRanges(view.state).map((range) => (
      builtinMark.range(range.from, range.to)
    )),
  );
}

export const inkBuiltinFunctions = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = computeDecorations(view);
  }

  update(update: ViewUpdate) {
    if (
      update.docChanged
      || update.viewportChanged
      || syntaxTree(update.state) !== syntaxTree(update.startState)
    ) {
      this.decorations = computeDecorations(update.view);
    }
  }
}, { decorations: (plugin) => plugin.decorations });
