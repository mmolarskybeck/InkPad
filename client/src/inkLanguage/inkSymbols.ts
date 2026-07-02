// Types for the error-tolerant Ink symbol table.
// See docs/structural-assistance-spec.md §Foundation.

/** Line/column range — same shape as Monaco's range, no Monaco import needed. */
export interface SymbolRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * - `"knot"`     — regular story section; valid divert target.
 * - `"stitch"`   — sub-section inside a knot; valid divert target.
 * - `"function"` — function knot (`=== function name(...) ===`);
 *                  NOT a valid divert target or missing-start candidate.
 */
export type SymbolKind = "knot" | "stitch" | "function";

export interface InkSymbol {
  name: string;
  kind: SymbolKind;
  /**
   * True when the declaration includes a parameter list, e.g. `=== hit(x) ===`.
   * Parameterized sections are symbols, but they are not safe bare story entry
   * targets for the missing-starting-divert quick fix.
   */
  hasParameters: boolean;
  /**
   * Full divert address: `"living_room"` for a knot,
   * `"living_room.intro"` for a stitch inside it.
   */
  path: string;
  /**
   * The enclosing knot's path. Undefined for top-level knots and functions.
   * For a stitch inside `living_room`, this is `"living_room"`.
   */
  parentPath?: string;
  fileId: string;
  range: SymbolRange;
}

/** True for symbols that may appear as divert targets in completion and quick fixes. */
export function isDivertTarget(symbol: InkSymbol): boolean {
  return symbol.kind === "knot" || symbol.kind === "stitch";
}

/** True for playable symbols that can be reached with a bare `-> target` divert. */
export function isMissingStartTarget(symbol: InkSymbol): boolean {
  return isDivertTarget(symbol) && !symbol.hasParameters;
}

export interface SymbolTableResult {
  symbols: InkSymbol[];
  /**
   * True when there is at least one non-empty, non-comment, non-declaration
   * line before the first knot/function declaration. When false and at least
   * one playable knot exists, InkPad emits the missing-starting-divert
   * diagnostic.
   */
  hasTopLevelContent: boolean;
  fileId: string;
}
