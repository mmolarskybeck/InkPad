// Editor-agnostic snippet-completion matching backed by the shared snippet
// library.
//
// See docs/completions-and-snippets-spec.md §3a. Ink is mostly prose, so
// triggering is deliberately conservative: a snippet is only offered when the
// current line is a single word (the thing being typed) and nothing else.
// This pure function is unit-tested without any editor model; a
// `@codemirror/autocomplete` source can be built on top of it when
// completion work starts (see docs/Editor Migration Plan.md Phase 3).

import { INK_SNIPPETS, type InkSnippet } from "./ink-snippets";

export interface SnippetCompletion {
  snippet: InkSnippet;
  /** The alias that matched the typed word — used as completion filterText. */
  matchedAlias: string;
  /** 1-based columns of the word to replace. */
  replace: { startColumn: number; endColumn: number };
}

/**
 * Decide which snippets to offer for a line and cursor column (1-based).
 *
 * v1 rule: only fire when the line, up to the cursor, is leading whitespace
 * followed by exactly one non-whitespace token, with nothing but whitespace
 * after the cursor. So `knot` alone on a line fires; `The knot of the city`
 * does not.
 */
export function getSnippetCompletions(
  lineContent: string,
  column: number,
): SnippetCompletion[] {
  const prefix = lineContent.slice(0, Math.max(0, column - 1));
  const suffix = lineContent.slice(Math.max(0, column - 1));

  // Anything other than whitespace after the cursor means we are inside a
  // line the user is composing — stay quiet.
  if (suffix.trim() !== "") return [];

  // Leading whitespace, then a single token, then the cursor.
  const match = /^(\s*)(\S+)$/.exec(prefix);
  if (!match) return [];

  const [, indent, word] = match;
  const lowerWord = word.toLowerCase();
  const startColumn = indent.length + 1;
  const endColumn = startColumn + word.length;

  const completions: SnippetCompletion[] = [];
  for (const snippet of INK_SNIPPETS) {
    const matchedAlias = snippet.aliases.find((alias) =>
      alias.toLowerCase().startsWith(lowerWord),
    );
    if (matchedAlias) {
      completions.push({ snippet, matchedAlias, replace: { startColumn, endColumn } });
    }
  }
  return completions;
}
