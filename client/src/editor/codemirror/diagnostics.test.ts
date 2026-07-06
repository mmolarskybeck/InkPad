import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { buildSymbolTable } from "@/inkLanguage/buildSymbolTable";
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

  it("uses explicit InkPad ranges, preserves hint severity, and attaches the missing-start action", () => {
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

    const [diagnostic] = toCodeMirrorDiagnostics(state, diagnostics, { activeFileId: "main.ink" });

    expect(diagnostic).toMatchObject({
      from: 0,
      to: 13,
      severity: "hint",
      message: "No opening content found.",
      source: "inkpad",
    });
    expect(diagnostic.actions?.map((action) => action.name)).toEqual(["Start at start"]);
  });

  it("applies the missing-start action as a CodeMirror transaction", () => {
    const state = EditorState.create({
      doc: "=== start ===\nHello\n",
    });
    const [diagnostic] = toCodeMirrorDiagnostics(state, [{
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
    }], { activeFileId: "main.ink" });
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state, parent });

    diagnostic.actions?.[0]?.apply(view, diagnostic.from, diagnostic.to);

    expect(view.state.doc.toString()).toBe("-> start\n\n=== start ===\nHello\n");
    expect(view.state.selection.main.from).toBe("-> start\n\n".length);
    view.destroy();
    parent.remove();
  });

  it("attaches and applies create-knot actions for bare unresolved divert targets", () => {
    const state = EditorState.create({
      doc: "Opening\n-> missing",
    });
    const [diagnostic] = toCodeMirrorDiagnostics(state, [{
      source: "inkjs",
      fileId: "main.ink",
      line: 2,
      message: "Divert target not found: '-> missing'",
      type: "error",
      code: "unresolved-divert",
      targetName: "missing",
    }], { activeFileId: "main.ink" });
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state, parent });

    expect(diagnostic.actions?.map((action) => action.name)).toEqual(["Create knot missing"]);
    diagnostic.actions?.[0]?.apply(view, diagnostic.from, diagnostic.to);

    expect(view.state.doc.toString()).toBe("Opening\n-> missing\n\n=== missing ===\n");
    expect(view.state.selection.main.from).toBe(view.state.doc.length);
    view.destroy();
    parent.remove();
  });

  it("attaches and applies closest-match actions for unresolved divert targets", () => {
    const state = EditorState.create({
      doc: "=== start ===\n-> END\n\n-> strat\n",
    });
    const symbols = buildSymbolTable(state.doc.toString(), "main.ink").symbols;
    const [diagnostic] = toCodeMirrorDiagnostics(state, [{
      source: "inkjs",
      fileId: "main.ink",
      line: 4,
      message: "Divert target not found: '-> strat'",
      type: "error",
      code: "unresolved-divert",
      targetName: "strat",
    }], { activeFileId: "main.ink", symbols });
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state, parent });

    expect(diagnostic.actions?.map((action) => action.name)).toEqual([
      "Change to start",
      "Create knot strat",
    ]);
    diagnostic.actions?.[0]?.apply(view, diagnostic.from, diagnostic.to);

    expect(view.state.doc.toString()).toBe("=== start ===\n-> END\n\n-> start\n");
    expect(view.state.selection.main.from).toBe("=== start ===\n-> END\n\n-> start".length);
    view.destroy();
    parent.remove();
  });

  it("does not attach create-knot actions for dotted unresolved divert targets", () => {
    const state = EditorState.create({
      doc: "-> chapter.missing",
    });
    const [diagnostic] = toCodeMirrorDiagnostics(state, [{
      source: "inkjs",
      fileId: "main.ink",
      line: 1,
      message: "Divert target not found: '-> chapter.missing'",
      type: "error",
      code: "unresolved-divert",
      targetName: "chapter.missing",
    }], { activeFileId: "main.ink" });

    expect(diagnostic.actions).toBeUndefined();
  });

  it("attaches and applies placeholder actions for empty choice diagnostics", () => {
    const state = EditorState.create({
      doc: "=== start ===\n* \n-> END\n",
    });
    const [diagnostic] = toCodeMirrorDiagnostics(state, [{
      source: "inkjs",
      fileId: "main.ink",
      line: 2,
      message: "Choice is completely empty. Interpretting as a default fallback choice. Add a divert arrow to remove this warning: * ->",
      type: "warning",
      code: "empty-choice",
    }], { activeFileId: "main.ink" });
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state, parent });

    expect(diagnostic.actions?.map((action) => action.name)).toEqual(["Add placeholder choice text"]);
    diagnostic.actions?.[0]?.apply(view, diagnostic.from, diagnostic.to);

    expect(view.state.doc.toString()).toBe("=== start ===\n* Choice text\n-> END\n");
    expect(view.state.selection.main.from).toBe("=== start ===\n* Choice text".length);
    view.destroy();
    parent.remove();
  });

  it("does not attach placeholder actions when an empty choice diagnostic no longer points at an empty choice", () => {
    const state = EditorState.create({
      doc: "=== start ===\n* Already visible\n-> END\n",
    });
    const [diagnostic] = toCodeMirrorDiagnostics(state, [{
      source: "inkjs",
      fileId: "main.ink",
      line: 2,
      message: "Choice is completely empty. Interpretting as a default fallback choice. Add a divert arrow to remove this warning: * ->",
      type: "warning",
      code: "empty-choice",
    }], { activeFileId: "main.ink" });

    expect(diagnostic.actions).toBeUndefined();
  });
});
