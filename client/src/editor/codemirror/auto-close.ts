import type { Extension, Text } from "@codemirror/state";
import { EditorSelection, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export interface InkAutoCloseEdit {
  from: number;
  to: number;
  insert: string;
  selection: number;
}

const KNOT_DECLARATION_INSERT = "===  ===";
const KNOT_NAME_CURSOR_OFFSET = "=== ".length;

function lineHasOnlyWhitespaceBefore(doc: Text, pos: number) {
  const line = doc.lineAt(pos);
  return line.text.slice(0, pos - line.from).trim() === "";
}

function lineHasOnlyWhitespaceAfter(doc: Text, pos: number) {
  const line = doc.lineAt(pos);
  return line.text.slice(pos - line.from).trim() === "";
}

export function getInkAutoCloseEdit(
  doc: Text,
  from: number,
  to: number,
  text: string,
): InkAutoCloseEdit | null {
  if (from !== to) return null;

  if (text === "=") {
    if (from < 2 || doc.sliceString(from - 2, from) !== "==") return null;
    if (!lineHasOnlyWhitespaceBefore(doc, from - 2)) return null;
    if (!lineHasOnlyWhitespaceAfter(doc, from)) return null;

    return {
      from: from - 2,
      to,
      insert: KNOT_DECLARATION_INSERT,
      selection: from - 2 + KNOT_NAME_CURSOR_OFFSET,
    };
  }

  if (text === "===") {
    if (!lineHasOnlyWhitespaceBefore(doc, from)) return null;
    if (!lineHasOnlyWhitespaceAfter(doc, from)) return null;

    return {
      from,
      to,
      insert: KNOT_DECLARATION_INSERT,
      selection: from + KNOT_NAME_CURSOR_OFFSET,
    };
  }

  return null;
}

export function getInkKnotDeclarationEnterEdit(doc: Text, pos: number): InkAutoCloseEdit | null {
  const line = doc.lineAt(pos);
  const beforeCursor = line.text.slice(0, pos - line.from);
  const afterCursor = line.text.slice(pos - line.from);
  const closingMatch = /^(\s*===)\s*$/.exec(afterCursor);
  if (!closingMatch) return null;

  if (!/^\s*===\s+\S/.test(beforeCursor)) return null;

  const closingEnd = pos + closingMatch[1].length;
  return {
    from: closingEnd,
    to: line.to,
    insert: "\n",
    selection: closingEnd + 1,
  };
}

export const inkAutoClose = (): Extension => [
  EditorView.inputHandler.of((view, from, to, text) => {
    const edit = getInkAutoCloseEdit(view.state.doc, from, to, text);
    if (!edit) return false;

    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: EditorSelection.cursor(edit.selection),
      scrollIntoView: true,
      userEvent: "input.type",
    });
    return true;
  }),
  Prec.highest(keymap.of([{
    key: "Enter",
    run(view) {
      const range = view.state.selection.main;
      if (!range.empty) return false;

      const edit = getInkKnotDeclarationEnterEdit(view.state.doc, range.head);
      if (!edit) return false;

      view.dispatch({
        changes: { from: edit.from, to: edit.to, insert: edit.insert },
        selection: EditorSelection.cursor(edit.selection),
        scrollIntoView: true,
        userEvent: "input.type",
      });
      return true;
    },
  }])),
];
