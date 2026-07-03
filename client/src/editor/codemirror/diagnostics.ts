import type { EditorState } from "@codemirror/state";
import { isolateHistory } from "@codemirror/commands";
import type { Action, Diagnostic } from "@codemirror/lint";
import { lineNumberToOffset } from "@/editor/codemirror/coordinates";
import { MISSING_STARTING_DIVERT_CODE } from "@/inkLanguage/inkDiagnostics";
import { getMissingStartingDivertEdit } from "@/inkLanguage/quickFixes";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import { getEditorDiagnosticSeverity } from "@/types/editor-diagnostic";

export interface CodeMirrorDiagnosticOptions {
  activeFileId?: string;
}

function getDiagnosticLine(diagnostic: EditorDiagnostic) {
  return "range" in diagnostic ? diagnostic.range.startLineNumber : diagnostic.line;
}

function getDiagnosticStartColumn(diagnostic: EditorDiagnostic) {
  return "range" in diagnostic ? diagnostic.range.startColumn : diagnostic.column ?? 1;
}

function getDiagnosticEndColumn(diagnostic: EditorDiagnostic) {
  if ("range" in diagnostic) return diagnostic.range.endColumn;
  if (diagnostic.column) return diagnostic.column + 10;
  return Number.MAX_SAFE_INTEGER;
}

function isActiveFileDiagnostic(diagnostic: EditorDiagnostic, activeFileId?: string) {
  return !activeFileId || !diagnostic.fileId || diagnostic.fileId === activeFileId;
}

function getDiagnosticActions(diagnostic: EditorDiagnostic): readonly Action[] | undefined {
  if (!("code" in diagnostic) || diagnostic.code !== MISSING_STARTING_DIVERT_CODE) {
    return undefined;
  }

  return [{
    name: `Start at ${diagnostic.target}`,
    apply(view) {
      const edit = getMissingStartingDivertEdit(diagnostic.target);
      view.dispatch({
        changes: edit,
        selection: { anchor: edit.from + edit.insert.length },
        scrollIntoView: true,
        annotations: isolateHistory.of("full"),
        userEvent: "input.quickfix",
      });
      view.focus();
    },
  }];
}

export function toCodeMirrorDiagnostics(
  state: EditorState,
  diagnostics: EditorDiagnostic[],
  options: CodeMirrorDiagnosticOptions = {},
): Diagnostic[] {
  return diagnostics
    .filter((diagnostic) => isActiveFileDiagnostic(diagnostic, options.activeFileId))
    .map((diagnostic) => {
      const lineNumber = getDiagnosticLine(diagnostic);
      const startColumn = getDiagnosticStartColumn(diagnostic);
      const endColumn = getDiagnosticEndColumn(diagnostic);
      const from = lineNumberToOffset(state.doc, lineNumber, startColumn);
      const line = state.doc.line(Math.min(Math.max(lineNumber, 1), state.doc.lines));
      const to = Math.max(from, Math.min(lineNumberToOffset(state.doc, lineNumber, endColumn), line.to));
      const severity = getEditorDiagnosticSeverity(diagnostic);
      const actions = getDiagnosticActions(diagnostic);

      return {
        from,
        to: to === from ? Math.min(from + 1, state.doc.length) : to,
        severity: severity === "hint" ? "hint" : severity,
        message: diagnostic.message,
        source: diagnostic.source,
        ...(actions ? { actions } : {}),
      };
    });
}
