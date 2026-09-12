// Error-tolerant Ink symbol scanner.
// See docs/structural-assistance-spec.md §Foundation.
//
// Runs on the main thread, debounced. Intentionally a line/pattern scan —
// not a full parser. The goal is "find declared sections in a broken file,"
// not perfect semantic analysis.

import type {
  InkSymbol,
  InkVariableSymbol,
  SymbolRange,
  SymbolTableResult,
} from "./inkSymbols";

// --- Scan patterns ---
// Check FUNCTION_KNOT_RE before KNOT_RE: both start with ={2,}, but function
// knots carry the `function` keyword and must be excluded from divert targets.

/** `=== function name(...)` — function knot declaration. */
const FUNCTION_KNOT_RE = /^\s*={2,}\s+function\s+([a-zA-Z_]\w*)\s*(\([^=]*?\))?/;

/** `=== name` — regular knot, `function` keyword excluded via negative lookahead. */
const KNOT_RE = /^\s*={2,}\s+(?!function\b)([a-zA-Z_]\w*)\s*(\([^=]*?\))?/;

/**
 * `= name` — stitch. The `(?!=)` prevents matching `==` or `===` (which start
 * with `=` but are immediately followed by another `=`).
 */
const STITCH_RE = /^\s*=(?!=)\s+([a-zA-Z_]\w*)\s*(\([^=]*?\))?/;

/** Lines that open a block comment (simplified: assumes `/*` is near line start). */
const BLOCK_COMMENT_OPEN_RE = /^\s*\/\*/;
const BLOCK_COMMENT_CLOSE = "*/";
const LINE_COMMENT_RE = /^\s*\/\//;

/**
 * Pure declarations that do not produce story output and do not count as
 * "top-level content" for the missing-starting-divert diagnostic.
 */
const DECLARATION_RE = /^\s*(VAR|LIST|CONST|EXTERNAL|INCLUDE)\b/i;

/** `VAR name = ...` — mutable story variable. */
const VAR_RE = /^\s*VAR\s+([A-Za-z_]\w*)/;

/** `CONST name = ...` — compile-time constant. */
const CONST_RE = /^\s*CONST\s+([A-Za-z_]\w*)/;

/** `EXTERNAL name(...)` — externally bound function. */
const EXTERNAL_RE = /^\s*EXTERNAL\s+([A-Za-z_]\w*)\s*\(/;

/** `LIST name = a, (b), c = 3` — list declaration plus its items. */
const LIST_RE = /^\s*LIST\s+([A-Za-z_]\w*)\s*=\s*(.*)$/;

const LIST_ITEM_NAME_RE = /^[A-Za-z_]\w*$/;

/** Strip surrounding whitespace/parentheses and an optional `= <number>` value. */
function normalizeListItem(entry: string): string {
  return entry
    .trim()
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .trim()
    .replace(/\s*=\s*-?\d+$/, "")
    .trim();
}

function makeRange(lineNumber: number, line: string): SymbolRange {
  return {
    startLineNumber: lineNumber,
    startColumn: 1,
    endLineNumber: lineNumber,
    endColumn: line.length + 1,
  };
}

/**
 * Scan `source` for Ink structural declarations and return an `InkSymbol[]`
 * plus metadata needed for custom diagnostics.
 *
 * The scanner is tolerant: it continues past syntax errors and produces a
 * best-effort index so that editor features keep working on broken files.
 */
export function buildSymbolTable(source: string, fileId: string): SymbolTableResult {
  const lines = source.split("\n");
  const symbols: InkSymbol[] = [];
  const variables: InkVariableSymbol[] = [];

  let inBlockComment = false;
  // Path of the most recently opened knot or function knot (for stitch parentage).
  let currentKnotPath: string | null = null;
  // Set to true once we see any knot/function declaration.
  let seenFirstDeclaration = false;
  let hasTopLevelContent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // --- Block comment tracking ---
    if (inBlockComment) {
      if (line.includes(BLOCK_COMMENT_CLOSE)) inBlockComment = false;
      continue;
    }
    if (BLOCK_COMMENT_OPEN_RE.test(line)) {
      if (!line.includes(BLOCK_COMMENT_CLOSE)) inBlockComment = true;
      continue;
    }

    // --- Line comments ---
    if (LINE_COMMENT_RE.test(line)) continue;

    // --- Variable, constant, external and list declarations ---
    const varMatch = line.match(VAR_RE);
    if (varMatch) {
      variables.push({
        name: varMatch[1],
        kind: "var",
        fileId,
        range: makeRange(lineNumber, line),
      });
      continue;
    }

    const constMatch = line.match(CONST_RE);
    if (constMatch) {
      variables.push({
        name: constMatch[1],
        kind: "const",
        fileId,
        range: makeRange(lineNumber, line),
      });
      continue;
    }

    const externalMatch = line.match(EXTERNAL_RE);
    if (externalMatch) {
      variables.push({
        name: externalMatch[1],
        kind: "external",
        fileId,
        range: makeRange(lineNumber, line),
      });
      continue;
    }

    const listMatch = line.match(LIST_RE);
    if (listMatch) {
      const listName = listMatch[1];
      const range = makeRange(lineNumber, line);
      variables.push({ name: listName, kind: "list", fileId, range });

      for (const entry of listMatch[2].split(",")) {
        const itemName = normalizeListItem(entry);
        if (!LIST_ITEM_NAME_RE.test(itemName)) continue;
        variables.push({
          name: itemName,
          kind: "list-item",
          listName,
          fileId,
          range,
        });
      }
      continue;
    }

    // --- Function knot (must precede KNOT_RE check) ---
    const fnMatch = line.match(FUNCTION_KNOT_RE);
    if (fnMatch) {
      const name = fnMatch[1];
      symbols.push({
        name,
        kind: "function",
        hasParameters: Boolean(fnMatch[2]),
        path: name,
        fileId,
        range: makeRange(lineNumber, line),
      });
      currentKnotPath = name;
      seenFirstDeclaration = true;
      continue;
    }

    // --- Regular knot ---
    const knotMatch = line.match(KNOT_RE);
    if (knotMatch) {
      const name = knotMatch[1];
      symbols.push({
        name,
        kind: "knot",
        hasParameters: Boolean(knotMatch[2]),
        path: name,
        fileId,
        range: makeRange(lineNumber, line),
      });
      currentKnotPath = name;
      seenFirstDeclaration = true;
      continue;
    }

    // --- Stitch ---
    const stitchMatch = line.match(STITCH_RE);
    if (stitchMatch) {
      const name = stitchMatch[1];
      const parentPath = currentKnotPath ?? undefined;
      const path = parentPath ? `${parentPath}.${name}` : name;
      symbols.push({
        name,
        kind: "stitch",
        hasParameters: Boolean(stitchMatch[2]),
        path,
        parentPath,
        fileId,
        range: makeRange(lineNumber, line),
      });
      continue;
    }

    // --- Top-level content detection ---
    // Any non-empty, non-comment, non-declaration line before the first
    // knot/function declaration counts as top-level content. This means
    // the story has something to show when it starts.
    if (!seenFirstDeclaration) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !DECLARATION_RE.test(trimmed)) {
        hasTopLevelContent = true;
      }
    }
  }

  return { symbols, variables, hasTopLevelContent, fileId };
}
