import type { InkPadDiagnostic, InkPadDiagnosticSeverity } from "@/inkLanguage/inkDiagnostics";
import type { InkCompilerError } from "@/lib/ink-compiler";

export type CompilerEditorDiagnostic = InkCompilerError & {
  source: "inkjs";
};

export type EditorDiagnostic = CompilerEditorDiagnostic | InkPadDiagnostic;

export type EditorDiagnosticSeverity = InkPadDiagnosticSeverity;

export function getEditorDiagnosticSeverity(
  diagnostic: EditorDiagnostic,
): EditorDiagnosticSeverity {
  return "severity" in diagnostic ? diagnostic.severity : diagnostic.type;
}

export function getEditorDiagnosticLine(diagnostic: EditorDiagnostic): number {
  return "range" in diagnostic ? diagnostic.range.startLineNumber : diagnostic.line;
}

export function getEditorDiagnosticColumn(diagnostic: EditorDiagnostic): number | undefined {
  return "range" in diagnostic ? diagnostic.range.startColumn : diagnostic.column;
}

