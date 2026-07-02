import type * as MonacoNs from "monaco-editor";
import { buildSymbolTable } from "./buildSymbolTable";
import {
  getMissingStartDiagnostic,
  INKPAD_DIAGNOSTIC_SOURCE,
  MISSING_STARTING_DIVERT_CODE,
} from "./inkDiagnostics";

function markerCodeValue(marker: MonacoNs.editor.IMarkerData): string | undefined {
  return typeof marker.code === "string" ? marker.code : marker.code?.value;
}

function isMissingStartMarker(marker: MonacoNs.editor.IMarkerData): boolean {
  return (
    marker.source === INKPAD_DIAGNOSTIC_SOURCE &&
    markerCodeValue(marker) === MISSING_STARTING_DIVERT_CODE
  );
}

function markerIntersectsRange(
  monaco: typeof MonacoNs,
  marker: MonacoNs.editor.IMarkerData,
  range: MonacoNs.Range,
): boolean {
  return Boolean(new monaco.Range(
    marker.startLineNumber,
    marker.startColumn,
    marker.endLineNumber,
    marker.endColumn,
  ).intersectRanges(range));
}

export function registerInkMissingStartQuickFix(
  monaco: typeof MonacoNs,
  languageId: string,
): MonacoNs.IDisposable {
  return monaco.languages.registerCodeActionProvider(languageId, {
    provideCodeActions(model, range, context) {
      const matchingMarkers = context.markers.filter((marker) =>
        isMissingStartMarker(marker) && markerIntersectsRange(monaco, marker, range),
      );

      if (matchingMarkers.length === 0) {
        return { actions: [], dispose() {} };
      }

      const symbolTable = buildSymbolTable(model.getValue(), model.uri.toString());
      const diagnostic = getMissingStartDiagnostic(symbolTable);
      if (!diagnostic) {
        return { actions: [], dispose() {} };
      }

      return {
        actions: [{
          title: `Start story at ${diagnostic.target}`,
          kind: "quickfix",
          isPreferred: true,
          diagnostics: matchingMarkers,
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: new monaco.Range(1, 1, 1, 1),
                text: `-> ${diagnostic.target}\n\n`,
              },
            }],
          },
        }],
        dispose() {},
      };
    },
  }, {
    providedCodeActionKinds: ["quickfix"],
  });
}

