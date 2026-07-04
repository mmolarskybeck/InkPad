import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  moveCompletionSelection,
  snippetCompletion,
  startCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { getSnippetCompletions } from "@/features/snippets/ink-completion-provider";
import { isDivertTarget, type InkSymbol } from "@/inkLanguage/inkSymbols";

type SymbolGetter = () => readonly InkSymbol[];

const DIVERT_VALID_FOR = /^[\w.]*$/;

const keywordCompletions: readonly Completion[] = [
  { label: "END", detail: "keyword", type: "keyword", boost: 10 },
  { label: "DONE", detail: "keyword", type: "keyword", boost: 10 },
];

function uniqueDivertTargets(symbols: readonly InkSymbol[]): Completion[] {
  const seen = new Set<string>();
  const completions: Completion[] = [];

  for (const symbol of symbols) {
    if (!isDivertTarget(symbol) || seen.has(symbol.path)) continue;
    seen.add(symbol.path);
    completions.push({
      label: symbol.path,
      detail: symbol.kind,
      type: symbol.kind === "stitch" ? "property" : "namespace",
    });
  }

  return completions;
}

export function createInkDivertCompletionSource(getSymbols: SymbolGetter): CompletionSource {
  return (context) => {
    const match = context.matchBefore(/->\s*[\w.]*$/);
    if (!match) return null;

    const partialWord = /[\w.]*$/.exec(match.text)?.[0] ?? "";
    const from = context.pos - partialWord.length;

    return {
      from,
      options: [
        ...uniqueDivertTargets(getSymbols()),
        ...keywordCompletions,
      ],
      validFor: DIVERT_VALID_FOR,
    };
  };
}

export const inkSnippetCompletionSource: CompletionSource = (context) => {
  if (!context.explicit) return null;

  const line = context.state.doc.lineAt(context.pos);
  const column = context.pos - line.from + 1;
  const completions = getSnippetCompletions(line.text, column);

  if (completions.length === 0) return null;

  const firstReplace = completions[0].replace;
  const from = line.from + firstReplace.startColumn - 1;
  const to = line.from + firstReplace.endColumn - 1;

  return {
    from,
    to,
    options: completions.map(({ snippet, matchedAlias }) =>
      snippetCompletion(snippet.desktopSnippet, {
        label: matchedAlias,
        detail: snippet.label,
        info: snippet.description,
        type: "keyword",
      }),
    ),
    validFor: /^\S*$/,
  };
};

// Replaces @codemirror/autocomplete's default completionKeymap, swapping the
// Enter -> acceptCompletion binding for Tab -> acceptCompletion (VS Code's
// `acceptSuggestionOnEnter: off` behavior). Enter must always fall through to
// insert a newline; Tab accepts the selected completion. All other bindings
// are mirrored from the package's default completionKeymap.
const inkCompletionKeymap = Prec.highest(keymap.of([
  { key: "Ctrl-Space", run: startCompletion },
  { mac: "Alt-`", run: startCompletion },
  { mac: "Alt-i", run: startCompletion },
  { key: "Escape", run: closeCompletion },
  { key: "ArrowDown", run: moveCompletionSelection(true) },
  { key: "ArrowUp", run: moveCompletionSelection(false) },
  { key: "PageDown", run: moveCompletionSelection(true, "page") },
  { key: "PageUp", run: moveCompletionSelection(false, "page") },
  { key: "Tab", run: acceptCompletion },
]));

export function inkCompletions(getSymbols: SymbolGetter): Extension {
  return [
    autocompletion({
      defaultKeymap: false,
      override: [
        createInkDivertCompletionSource(getSymbols),
        inkSnippetCompletionSource,
      ],
    }),
    inkCompletionKeymap,
  ];
}
