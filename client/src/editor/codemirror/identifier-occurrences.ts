import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * Occurrence highlighting scoped to Ink identifiers. Resting the cursor inside
 * a knot, stitch, variable, or divert-target name highlights the other places
 * that identifier is used. Prose never triggers highlighting — mentions of the
 * same word in story content are ignored both as a trigger and as a match — so
 * moving the caret through story text stays visually quiet.
 */

const IDENTIFIER_NODE_NAMES = new Set([
  "KnotName",
  "StitchName",
  "Name",
  "Path",
  "SelectedName",
]);

const IDENTIFIER_CHAR = /[A-Za-z0-9_]/;

interface WordRange {
  from: number;
  to: number;
  text: string;
}

function wordRangeAt(state: EditorState, pos: number): WordRange | null {
  const line = state.doc.lineAt(pos);
  let from = pos;
  let to = pos;
  while (from > line.from && IDENTIFIER_CHAR.test(line.text[from - line.from - 1])) from -= 1;
  while (to < line.to && IDENTIFIER_CHAR.test(line.text[to - line.from])) to += 1;
  if (from === to) return null;

  return { from, to, text: state.doc.sliceString(from, to) };
}

function isIdentifierRange(state: EditorState, from: number, to: number) {
  const node = syntaxTree(state).resolveInner(from, 1);
  return IDENTIFIER_NODE_NAMES.has(node.name) && node.from <= from && node.to >= to;
}

/** The identifier word under the cursor, or null when the cursor is in prose. */
export function identifierWordAt(state: EditorState, pos: number): WordRange | null {
  const word = wordRangeAt(state, pos);
  if (!word || !isIdentifierRange(state, word.from, word.to)) return null;

  return word;
}

/** Whole-word occurrences of `word` in [from, to] that are identifiers themselves. */
export function findIdentifierMatches(
  state: EditorState,
  word: string,
  from: number,
  to: number,
): { from: number; to: number }[] {
  const matches: { from: number; to: number }[] = [];
  const text = state.doc.sliceString(from, to);
  let index = text.indexOf(word);

  while (index !== -1) {
    const before = index > 0 ? text[index - 1] : "";
    const after = index + word.length < text.length ? text[index + word.length] : "";
    const isWholeWord = !IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after);
    const matchFrom = from + index;
    const matchTo = matchFrom + word.length;

    if (isWholeWord && isIdentifierRange(state, matchFrom, matchTo)) {
      matches.push({ from: matchFrom, to: matchTo });
    }

    index = text.indexOf(word, index + word.length);
  }

  return matches;
}

const matchMark = Decoration.mark({ class: "cm-inkIdentifierMatch" });

function computeDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty) return Decoration.none;

  const word = identifierWordAt(state, selection.head);
  if (!word) return Decoration.none;

  const decorations = view.visibleRanges.flatMap((range) => (
    findIdentifierMatches(state, word.text, range.from, range.to)
      .map((match) => matchMark.range(match.from, match.to))
  ));

  return Decoration.set(decorations);
}

export const inkIdentifierOccurrences = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = computeDecorations(view);
  }

  update(update: ViewUpdate) {
    if (
      update.selectionSet
      || update.docChanged
      || update.viewportChanged
      || syntaxTree(update.state) !== syntaxTree(update.startState)
    ) {
      this.decorations = computeDecorations(update.view);
    }
  }
}, { decorations: (plugin) => plugin.decorations });
