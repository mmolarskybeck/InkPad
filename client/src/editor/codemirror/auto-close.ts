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

export function getInkKnotTypeOverPos(
  doc: Text,
  from: number,
  to: number,
  text: string,
): number | null {
  if (from !== to) return null;
  if (text !== "=" && text !== " ") return null;
  if (doc.sliceString(from, from + 1) !== text) return null;

  const line = doc.lineAt(from);
  const beforeCursor = line.text.slice(0, from - line.from);
  const afterCursor = line.text.slice(from - line.from);

  if (!/^\s*===\s+\S/.test(beforeCursor)) return null;
  if (!/^ ?=+\s*$/.test(afterCursor)) return null;

  return from + 1;
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

const CHOICE_CONTINUATION_LINE_RE = /^(\s*)([*+-](?:\s*[*+-])*)(\s+)(\S)/;
const CHOICE_MARKER_ONLY_LINE_RE = /^(\s*)([*+-](?:\s*[*+-])*)(\s*)$/;

export function getInkChoiceContinuationEdit(doc: Text, pos: number): InkAutoCloseEdit | null {
  if (!lineHasOnlyWhitespaceAfter(doc, pos)) return null;

  const line = doc.lineAt(pos);

  const contentMatch = CHOICE_CONTINUATION_LINE_RE.exec(line.text);
  if (contentMatch) {
    const [, indentation, markerRun] = contentMatch;
    const insert = `\n${indentation}${markerRun} `;
    return {
      from: line.to,
      to: line.to,
      insert,
      selection: line.to + insert.length,
    };
  }

  if (CHOICE_MARKER_ONLY_LINE_RE.test(line.text)) {
    return {
      from: line.from,
      to: line.to,
      insert: "",
      selection: line.from,
    };
  }

  return null;
}

export function getInkBlockCommentAutoCloseEdit(
  doc: Text,
  from: number,
  to: number,
  text: string,
): InkAutoCloseEdit | null {
  if (from !== to) return null;
  if (text !== "*") return null;
  if (from < 1 || doc.sliceString(from - 1, from) !== "/") return null;
  if (from >= 2 && doc.sliceString(from - 2, from - 1) === "/") return null;
  if (!lineHasOnlyWhitespaceAfter(doc, from)) return null;

  return {
    from,
    to,
    insert: "*  */",
    selection: from + 2,
  };
}

export function getInkBlockCommentTypeOverPos(
  doc: Text,
  from: number,
  to: number,
  text: string,
): number | null {
  if (from !== to) return null;
  if (text !== " " && text !== "*" && text !== "/") return null;
  if (doc.sliceString(from, from + 1) !== text) return null;

  const line = doc.lineAt(from);
  const beforeCursor = line.text.slice(0, from - line.from);
  const afterCursor = line.text.slice(from - line.from);

  if (!beforeCursor.includes("/*")) return null;
  if (!/^ ?\*\/\s*$/.test(afterCursor) && !/^\/\s*$/.test(afterCursor)) return null;

  return from + 1;
}

export const inkAutoClose = (): Extension => [
  EditorView.inputHandler.of((view, from, to, text) => {
    const typeOverPos =
      getInkKnotTypeOverPos(view.state.doc, from, to, text) ??
      getInkBlockCommentTypeOverPos(view.state.doc, from, to, text);
    if (typeOverPos !== null) {
      view.dispatch({
        selection: EditorSelection.cursor(typeOverPos),
        scrollIntoView: true,
        userEvent: "input.type",
      });
      return true;
    }

    const edit =
      getInkAutoCloseEdit(view.state.doc, from, to, text) ??
      getInkBlockCommentAutoCloseEdit(view.state.doc, from, to, text);
    if (!edit) return false;

    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: EditorSelection.cursor(edit.selection),
      scrollIntoView: true,
      userEvent: "input.type",
    });
    return true;
  }),
  Prec.highest(keymap.of([
    {
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
    },
    {
      key: "Enter",
      run(view) {
        const range = view.state.selection.main;
        if (!range.empty) return false;

        const edit = getInkChoiceContinuationEdit(view.state.doc, range.head);
        if (!edit) return false;

        view.dispatch({
          changes: { from: edit.from, to: edit.to, insert: edit.insert },
          selection: EditorSelection.cursor(edit.selection),
          scrollIntoView: true,
          userEvent: "input.type",
        });
        return true;
      },
    },
  ])),
];
