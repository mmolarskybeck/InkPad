// Desktop Monaco completion provider backed by the shared snippet library.
//
// See docs/completions-and-snippets-spec.md §3a. Ink is mostly prose, so
// triggering is deliberately conservative: a snippet is only offered when the
// current line is a single word (the thing being typed) and nothing else. The
// decision lives in the pure `getSnippetCompletions` function so it can be
// unit-tested without a Monaco model.

import type * as MonacoNs from "monaco-editor";
import { INK_SNIPPETS, type InkSnippet } from "./ink-snippets";
import { trackSnippetInserted, type SnippetType } from "@/lib/analytics";

export interface SnippetCompletion {
  snippet: InkSnippet;
  /** The alias that matched the typed word — used as Monaco filterText. */
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

/** Symbol characters that should invoke the provider even with auto-suggest off. */
const TRIGGER_CHARACTERS = [">", "=", "*", "+", "/", "~"];
const TRACK_SNIPPET_INSERTED_COMMAND = "inkpad.trackSnippetInserted";

function getAnalyticsSnippetType(snippet: InkSnippet): SnippetType {
  if (snippet.id === "var") return "variable";
  if (snippet.id === "sticky-choice") return "choice";
  if (
    snippet.id === "knot" ||
    snippet.id === "stitch" ||
    snippet.id === "choice" ||
    snippet.id === "conditional" ||
    snippet.id === "list" ||
    snippet.id === "function" ||
    snippet.id === "divert"
  ) {
    return snippet.id;
  }

  return "unknown";
}

export function registerInkSnippetCompletions(
  monaco: typeof MonacoNs,
  languageId: string,
): MonacoNs.IDisposable {
  const commandDisposable = monaco.editor.registerCommand(
    TRACK_SNIPPET_INSERTED_COMMAND,
    (_accessor, snippetType: SnippetType) => {
      trackSnippetInserted(snippetType);
    },
  );

  const completionDisposable = monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: TRIGGER_CHARACTERS,
    provideCompletionItems(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);
      const completions = getSnippetCompletions(lineContent, position.column);

      const suggestions = completions.map(({ snippet, matchedAlias, replace }) => ({
        label: snippet.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: snippet.desktopSnippet,
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: new monaco.Range(
          position.lineNumber,
          replace.startColumn,
          position.lineNumber,
          replace.endColumn,
        ),
        detail: `Ink snippet · ${snippet.category}`,
        documentation: snippet.description,
        filterText: matchedAlias,
        sortText: snippet.id,
        command: {
          id: TRACK_SNIPPET_INSERTED_COMMAND,
          title: "Track InkPad snippet insertion",
          arguments: [getAnalyticsSnippetType(snippet)],
        },
      }));

      return { suggestions };
    },
  });

  return {
    dispose() {
      completionDisposable.dispose();
      commandDisposable.dispose();
    },
  };
}
