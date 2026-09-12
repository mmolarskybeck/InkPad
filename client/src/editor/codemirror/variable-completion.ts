import type { Completion, CompletionSource } from "@codemirror/autocomplete";
import { INK_BUILTIN_FUNCTIONS } from "@/editor/codemirror/ink-builtins";
import type { InkSymbol, InkVariableKind, InkVariableSymbol } from "@/inkLanguage/inkSymbols";

type VariableGetter = () => readonly InkVariableSymbol[];
type SymbolGetter = () => readonly InkSymbol[];

const WORD_RE = /[A-Za-z_]\w*$/;

/** `~ temp name` — the user is naming a new temporary, not referencing one. */
const TEMP_DECLARATION_RE = /^\s*~\s*temp\s+\w*$/;

/** Any logic line: `~ ...`. */
const LOGIC_LINE_RE = /^\s*~\s/;

/** The right-hand side of a `VAR`/`CONST` declaration. */
const DECLARATION_VALUE_RE = /^\s*(VAR|CONST)\s+\w+\s*=\s*[^=]*$/;

/**
 * Operators an expression can continue after. `==`, `!=`, `<=` and `>=` all end
 * with `=`, so only the multi-character tokens whose final character is not
 * itself an operator (`&&`, `||`) need listing separately — a lone `|` is Ink's
 * alternative separator, not an operator.
 */
const OPERATOR_TOKENS = [
  "&&",
  "||",
  "{",
  "(",
  ",",
  "=",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
  "?",
  "^",
];

const OPERATOR_KEYWORD_RE = /(?:^|\W)(not|and|or|mod|has|hasnt|return)$/;

const VARIABLE_TYPES: Record<Exclude<InkVariableKind, "list-item">, string> = {
  var: "variable",
  const: "constant",
  list: "enum",
  external: "function",
};

const VARIABLE_DETAILS: Record<Exclude<InkVariableKind, "list-item">, string> = {
  var: "VAR",
  const: "CONST",
  list: "LIST",
  external: "EXTERNAL",
};

function countChar(text: string, char: string) {
  let count = 0;
  for (const current of text) {
    if (current === char) count += 1;
  }
  return count;
}

function endsWithOperator(prefix: string) {
  const trimmed = prefix.replace(/\s+$/, "");
  if (OPERATOR_TOKENS.some((token) => trimmed.endsWith(token))) return true;
  return OPERATOR_KEYWORD_RE.test(trimmed);
}

function isVariableContext(before: string, word: string) {
  if (LOGIC_LINE_RE.test(before)) return true;
  if (DECLARATION_VALUE_RE.test(before)) return true;

  const openBraces = countChar(before, "{") - countChar(before, "}");
  if (openBraces <= 0) return false;

  return endsWithOperator(before.slice(0, before.length - word.length));
}

function buildOptions(
  variables: readonly InkVariableSymbol[],
  symbols: readonly InkSymbol[],
): Completion[] {
  const seen = new Set<string>();
  const options: Completion[] = [];

  for (const variable of variables) {
    if (variable.kind === "list-item" || seen.has(variable.name)) continue;
    seen.add(variable.name);
    options.push({
      label: variable.name,
      type: VARIABLE_TYPES[variable.kind],
      detail: VARIABLE_DETAILS[variable.kind],
    });
  }

  for (const variable of variables) {
    if (variable.kind !== "list-item" || seen.has(variable.name)) continue;
    seen.add(variable.name);
    options.push({
      label: variable.name,
      type: "enum",
      detail: `item of ${variable.listName}`,
    });
  }

  for (const symbol of symbols) {
    if (symbol.kind !== "function" || seen.has(symbol.name)) continue;
    seen.add(symbol.name);
    options.push({ label: symbol.name, type: "function", detail: "function" });
  }

  for (const name of Array.from(INK_BUILTIN_FUNCTIONS)) {
    if (seen.has(name)) continue;
    seen.add(name);
    options.push({ label: name, type: "function", detail: "built-in", boost: -1 });
  }

  return options;
}

export function createInkVariableCompletionSource(
  getVariables: VariableGetter,
  getSymbols: SymbolGetter,
): CompletionSource {
  return (context) => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);

    if (TEMP_DECLARATION_RE.test(before)) return null;

    const word = WORD_RE.exec(before)?.[0] ?? "";
    if (!isVariableContext(before, word)) return null;
    if (word.length === 0 && !context.explicit) return null;

    return {
      from: context.pos - word.length,
      options: buildOptions(getVariables(), getSymbols()),
      validFor: /^\w*$/,
    };
  };
}
