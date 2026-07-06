import type { EditorState } from "@codemirror/state";
import { isolateHistory } from "@codemirror/commands";
import type { Action, Diagnostic } from "@codemirror/lint";
import { lineNumberToOffset } from "@/editor/codemirror/coordinates";
import { EMPTY_CHOICE_CODE, UNRESOLVED_DIVERT_CODE } from "@/inkLanguage/diagnosticAdapter";
import { findClosestDivertTarget } from "@/inkLanguage/fuzzyMatch";
import { MISSING_STARTING_DIVERT_CODE } from "@/inkLanguage/inkDiagnostics";
import type { InkSymbol } from "@/inkLanguage/inkSymbols";
import {
  canCreateMissingKnot,
  getAddEmptyChoicePlaceholderEdit,
  getCreateMissingKnotEdit,
  getMissingStartingDivertEdit,
} from "@/inkLanguage/quickFixes";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import { getEditorDiagnosticSeverity } from "@/types/editor-diagnostic";

export interface CodeMirrorDiagnosticOptions {
  activeFileId?: string;
  symbols?: InkSymbol[];
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

function getMissingStartingDivertActions(diagnostic: EditorDiagnostic): readonly Action[] | undefined {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTargetReplacementRange(
  state: EditorState,
  lineNumber: number,
  targetName: string,
): { from: number; to: number } | null {
  const line = state.doc.line(Math.min(Math.max(lineNumber, 1), state.doc.lines));
  const match = new RegExp(`->\\s*${escapeRegExp(targetName)}`).exec(line.text);
  if (!match) return null;

  const targetStart = match.index + match[0].length - targetName.length;
  const from = line.from + targetStart;
  return {
    from,
    to: from + targetName.length,
  };
}

function getUnresolvedDivertActions(
  diagnostic: EditorDiagnostic,
  symbols: InkSymbol[],
): readonly Action[] | undefined {
  if (!("code" in diagnostic) || diagnostic.code !== UNRESOLVED_DIVERT_CODE || !diagnostic.targetName) {
    return undefined;
  }

  const actions: Action[] = [];
  const closestTarget = findClosestDivertTarget(diagnostic.targetName, symbols);
  if (closestTarget) {
    actions.push({
      name: `Change to ${closestTarget.path}`,
      apply(view) {
        if (!diagnostic.targetName) return;

        const range = getTargetReplacementRange(
          view.state,
          getDiagnosticLine(diagnostic),
          diagnostic.targetName,
        );
        if (!range) return;

        view.dispatch({
          changes: { ...range, insert: closestTarget.path },
          selection: { anchor: range.from + closestTarget.path.length },
          scrollIntoView: true,
          annotations: isolateHistory.of("full"),
          userEvent: "input.quickfix",
        });
        view.focus();
      },
    });
  }

  if (canCreateMissingKnot(diagnostic.targetName)) {
    actions.push({
      name: `Create knot ${diagnostic.targetName}`,
      apply(view) {
        const edit = getCreateMissingKnotEdit(view.state.doc.toString(), diagnostic.targetName ?? "");
        if (!edit) return;

        view.dispatch({
          changes: edit,
          selection: { anchor: edit.from + edit.insert.length },
          scrollIntoView: true,
          annotations: isolateHistory.of("full"),
          userEvent: "input.quickfix",
        });
        view.focus();
      },
    });
  }

  return actions.length > 0 ? actions : undefined;
}

function getEmptyChoiceActions(
  state: EditorState,
  diagnostic: EditorDiagnostic,
): readonly Action[] | undefined {
  if (!("code" in diagnostic) || diagnostic.code !== EMPTY_CHOICE_CODE) {
    return undefined;
  }

  const existingEdit = getAddEmptyChoicePlaceholderEdit(
    state.doc.toString(),
    getDiagnosticLine(diagnostic),
  );
  if (!existingEdit) return undefined;

  return [{
    name: "Add placeholder choice text",
    apply(view) {
      const edit = getAddEmptyChoicePlaceholderEdit(
        view.state.doc.toString(),
        getDiagnosticLine(diagnostic),
      );
      if (!edit) return;

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

function getDiagnosticActions(
  state: EditorState,
  diagnostic: EditorDiagnostic,
  options: CodeMirrorDiagnosticOptions,
): readonly Action[] | undefined {
  return getMissingStartingDivertActions(diagnostic)
    ?? getEmptyChoiceActions(state, diagnostic)
    ?? getUnresolvedDivertActions(diagnostic, options.symbols ?? []);
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
      const actions = getDiagnosticActions(state, diagnostic, options);

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
