import { isMissingStartTarget, type SymbolRange, type SymbolTableResult } from "./inkSymbols";

export const MISSING_STARTING_DIVERT_CODE = "missing-starting-divert";
export const INKPAD_DIAGNOSTIC_SOURCE = "inkpad";

export type InkPadDiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface InkPadDiagnostic {
  code: typeof MISSING_STARTING_DIVERT_CODE;
  severity: InkPadDiagnosticSeverity;
  source: typeof INKPAD_DIAGNOSTIC_SOURCE;
  message: string;
  target: string;
  range: SymbolRange;
}

export function getMissingStartDiagnostic(
  symbolTable: SymbolTableResult,
): InkPadDiagnostic | null {
  if (symbolTable.hasTopLevelContent) return null;

  const firstPlayableSymbol = symbolTable.symbols.find(isMissingStartTarget);
  if (!firstPlayableSymbol) return null;

  return {
    code: MISSING_STARTING_DIVERT_CODE,
    severity: "hint",
    source: INKPAD_DIAGNOSTIC_SOURCE,
    message: `No opening content found. Start the story at \`${firstPlayableSymbol.path}\`?`,
    target: firstPlayableSymbol.path,
    range: {
      startLineNumber: firstPlayableSymbol.range.startLineNumber,
      startColumn: 1,
      endLineNumber: firstPlayableSymbol.range.startLineNumber,
      endColumn: Number.MAX_SAFE_INTEGER,
    },
  };
}
