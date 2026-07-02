import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import { toCodeMirrorDiagnostics } from "./diagnostics";

describe("toCodeMirrorDiagnostics", () => {
  it("filters lint diagnostics to the active file", () => {
    const state = EditorState.create({
      doc: "Line one\nLine two\n",
    });
    const diagnostics: EditorDiagnostic[] = [
      {
        source: "inkjs",
        fileId: "main.ink",
        line: 1,
        column: 1,
        message: "Visible",
        type: "error",
      },
      {
        source: "inkjs",
        fileId: "other.ink",
        line: 2,
        column: 1,
        message: "Hidden",
        type: "warning",
      },
    ];

    expect(toCodeMirrorDiagnostics(state, diagnostics, { activeFileId: "main.ink" })).toEqual([
      {
        from: 0,
        to: 8,
        severity: "error",
        message: "Visible",
        source: "inkjs",
      },
    ]);
  });

  it("converts line and column numbers with CodeMirror UTF-16 offsets", () => {
    const state = EditorState.create({
      doc: "첫 줄\nab😊cd\nlast",
    });
    const diagnostics: EditorDiagnostic[] = [
      {
        source: "inkjs",
        fileId: "main.ink",
        line: 2,
        column: 5,
        message: "Starts after the emoji surrogate pair",
        type: "warning",
      },
    ];

    expect(toCodeMirrorDiagnostics(state, diagnostics, { activeFileId: "main.ink" })).toEqual([
      {
        from: 8,
        to: 10,
        severity: "warning",
        message: "Starts after the emoji surrogate pair",
        source: "inkjs",
      },
    ]);
  });

  it("uses explicit InkPad ranges and preserves hint severity", () => {
    const state = EditorState.create({
      doc: "=== start ===\nHello\n",
    });
    const diagnostics: EditorDiagnostic[] = [
      {
        code: "missing-starting-divert",
        source: "inkpad",
        fileId: "main.ink",
        severity: "hint",
        message: "No opening content found.",
        target: "start",
        range: {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: Number.MAX_SAFE_INTEGER,
        },
      },
    ];

    expect(toCodeMirrorDiagnostics(state, diagnostics, { activeFileId: "main.ink" })).toEqual([
      {
        from: 0,
        to: 13,
        severity: "hint",
        message: "No opening content found.",
        source: "inkpad",
      },
    ]);
  });
});
