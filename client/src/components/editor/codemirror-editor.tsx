import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import { Compartment, EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
  redo,
  redoDepth,
  selectGroupBackward,
  selectGroupForward,
  selectLine,
  selectParentSyntax,
  simplifySelection,
  undo,
  undoDepth,
} from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  closeSearchPanel,
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
  searchPanelOpen,
} from "@codemirror/search";
import { lintKeymap, setDiagnostics } from "@codemirror/lint";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { Code, Redo2, Search, Undo2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { lineNumberToOffset } from "@/editor/codemirror/coordinates";
import { toCodeMirrorDiagnostics } from "@/editor/codemirror/diagnostics";
import { inkHighlightStyle } from "@/editor/codemirror/ink-highlight-style";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";
import type { SaveState } from "@/hooks/use-autosave";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";

export interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onControlStateChange?: (state: CodeMirrorEditorControlState) => void;
  errors: EditorDiagnostic[];
  fileId: string;
  documentId: string;
  fileName: string;
  isMobileLayout?: boolean;
  showHeader?: boolean;
  fontSize?: number;
  wordWrap?: boolean;
  saveState?: SaveState;
}

export interface CodeMirrorEditorControlState {
  canUndo: boolean;
  canRedo: boolean;
  isFindVisible: boolean;
}

export interface CodeMirrorEditorInsertOptions {
  text: string;
  cursorOffset?: number;
  selectRange?: { startOffset: number; endOffset: number };
  userEvent?: string;
}

export type ReplaceDocumentOptions = {
  history: "reset" | "preserve";
  selection?: { from: number; to?: number };
  diagnostics?: "reapply" | "clear";
};

export interface CodeMirrorEditorHandle {
  getEditor: () => EditorView | undefined;
  getValue: () => string;
  flushChanges: () => void;
  focus: () => void;
  layout: () => void;
  replaceDocument: (value: string, options: ReplaceDocumentOptions) => void;
  replaceRange: (from: number, to: number, insert: string, userEvent?: string) => void;
  insertText: (text: string) => void;
  replaceSelection: (text: string) => void;
  getSelection: () => { from: number; to: number };
  setSelection: (from: number, to?: number) => void;
  revealLine: (line: number) => void;
  jumpToOffset: (offset: number) => void;
  insertTextAtCursor: (insert: string | CodeMirrorEditorInsertOptions) => void;
  jumpToLine: (line: number) => void;
  openFind: () => void;
  openReplace: () => void;
  closeFind: () => void;
  replaceValue: (nextValue: string, source?: string) => void;
  selectPreviousWord: () => void;
  selectNextWord: () => void;
  expandSelection: () => void;
  shrinkSelection: () => void;
  selectLine: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteFromClipboard: () => void;
  undo: () => void;
  redo: () => void;
}

const flashLineEffect = StateEffect.define<number | null>();

const flashLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(flashLineEffect)) {
        if (effect.value === null) return Decoration.none;

        const lineNumber = Math.min(Math.max(effect.value, 1), transaction.state.doc.lines);
        const line = transaction.state.doc.line(lineNumber);

        return Decoration.set([
          Decoration.line({ class: "error-line-flash" }).range(line.from),
        ]);
      }
    }

    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function getSaveStatus(saveState: SaveState) {
  switch (saveState) {
    case "dirty":
      return { label: "Modified", className: "text-warning" };
    case "saving":
      return { label: "Saving...", className: "text-accent-blue" };
    case "error":
      return { label: "Save failed", className: "text-error" };
    case "disabled":
      return { label: "Autosave disabled", className: "text-warning" };
    default:
      return { label: "Saved", className: "text-text-secondary" };
  }
}

function createThemeExtension(fontSize: number, isDark: boolean) {
  return EditorView.theme({
    "&": {
      height: "100%",
      minHeight: "0",
      backgroundColor: "var(--editor-bg)",
      color: "var(--text-primary)",
      fontSize: `${fontSize}px`,
    },
    ".cm-scroller": {
      fontFamily: "\"JetBrains Mono\", \"Fira Code\", ui-monospace, SFMono-Regular, monospace",
      // Keep -> and === as literal characters instead of ligature glyphs,
      // matching the previous Monaco setup (fontLigatures: false).
      fontVariantLigatures: "none",
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: "var(--accent-blue)",
      padding: "12px 0 48px",
    },
    ".cm-line": {
      padding: "0 14px 0 4px",
    },
    ".cm-gutters": {
      backgroundColor: "var(--editor-bg)",
      color: "var(--text-secondary)",
      border: "none",
      paddingRight: "10px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.5em",
      padding: "0 4px 0 8px",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--accent-blue) 9%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--text-emphasis)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent-blue) 34%, transparent)",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--accent-blue)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--panel-bg)",
      borderColor: "var(--border-color)",
      color: "var(--text-secondary)",
    },
    ".cm-search": {
      backgroundColor: "var(--panel-bg)",
      borderTop: "1px solid var(--border-color)",
      borderBottom: "1px solid var(--border-color)",
      color: "var(--text-primary)",
      padding: "6px",
    },
    ".cm-search input": {
      backgroundColor: "var(--editor-bg)",
      border: "1px solid var(--border-color)",
      borderRadius: "4px",
      color: "var(--text-emphasis)",
      fontSize: "16px",
      padding: "3px 6px",
    },
    ".cm-search button": {
      backgroundColor: "var(--accent)",
      border: "1px solid var(--border-color)",
      borderRadius: "4px",
      color: "var(--text-emphasis)",
      fontSize: "12px",
      marginLeft: "4px",
      padding: "2px 7px",
    },
    ".cm-panels": {
      backgroundColor: "var(--panel-bg)",
      color: "var(--text-primary)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--panel-bg)",
      border: "1px solid var(--border-color)",
      color: "var(--text-primary)",
    },
    ".cm-diagnostic-error": {
      borderLeftColor: "var(--error)",
    },
    ".cm-diagnostic-warning": {
      borderLeftColor: "var(--warning)",
    },
    ".cm-diagnostic-info": {
      borderLeftColor: "var(--accent-blue)",
    },
    // Monaco-style wavy underlines instead of the default gradient strips.
    ".cm-lintRange": {
      backgroundImage: "none",
      textDecorationLine: "underline",
      textDecorationStyle: "wavy",
      textDecorationThickness: "1px",
      textDecorationSkipInk: "none",
      textUnderlineOffset: "3px",
      paddingBottom: "0",
    },
    ".cm-lintRange-error": {
      textDecorationColor: "var(--error)",
    },
    ".cm-lintRange-warning": {
      textDecorationColor: "var(--warning)",
    },
    ".cm-lintRange-info": {
      textDecorationColor: "var(--accent-blue)",
    },
    ".cm-lintRange-hint": {
      textDecorationColor: "var(--text-secondary)",
    },
  }, { dark: isDark });
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(({
  value,
  onChange,
  onControlStateChange,
  errors,
  fileId,
  documentId,
  fileName,
  isMobileLayout = false,
  showHeader = true,
  fontSize = isMobileLayout ? 13 : 14,
  wordWrap = true,
  saveState = "saved",
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const changeEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);
  const lastEmittedValueRef = useRef(value);
  const lastSyncedDocumentIdRef = useRef(documentId);
  const onChangeRef = useRef(onChange);
  const onControlStateChangeRef = useRef(onControlStateChange);
  const errorsRef = useRef(errors);
  const lastControlStateRef = useRef<CodeMirrorEditorControlState>({
    canUndo: false,
    canRedo: false,
    isFindVisible: false,
  });
  const themeCompartmentRef = useRef(new Compartment());
  const wrappingCompartmentRef = useRef(new Compartment());
  const editableCompartmentRef = useRef(new Compartment());
  const contentAttributesCompartmentRef = useRef(new Compartment());
  const languageCompartmentRef = useRef(new Compartment());
  const { effectiveTheme } = useTheme();
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const historyStateRef = useRef(historyState);
  const findVisibleRef = useRef(false);
  const saveStatus = getSaveStatus(saveState);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onControlStateChangeRef.current = onControlStateChange;
  }, [onControlStateChange]);

  useEffect(() => {
    errorsRef.current = errors;
  }, [errors]);

  const emitControlState = useCallback((nextHistoryState = historyStateRef.current) => {
    const nextControlState = {
      ...nextHistoryState,
      isFindVisible: findVisibleRef.current,
    };
    const lastControlState = lastControlStateRef.current;

    if (
      lastControlState.canUndo === nextControlState.canUndo
      && lastControlState.canRedo === nextControlState.canRedo
      && lastControlState.isFindVisible === nextControlState.isFindVisible
    ) {
      return;
    }

    lastControlStateRef.current = nextControlState;
    onControlStateChangeRef.current?.(nextControlState);
  }, []);

  const clearChangeEmitTimer = useCallback(() => {
    if (changeEmitTimerRef.current) {
      clearTimeout(changeEmitTimerRef.current);
      changeEmitTimerRef.current = null;
    }
  }, []);

  const emitChangeNow = useCallback(() => {
    clearChangeEmitTimer();

    const view = viewRef.current;
    if (!view || syncingRef.current) return;

    const nextValue = view.state.doc.toString();
    if (nextValue === lastEmittedValueRef.current) return;

    lastEmittedValueRef.current = nextValue;
    onChangeRef.current(nextValue);
  }, [clearChangeEmitTimer]);

  const scheduleChangeEmit = useCallback(() => {
    clearChangeEmitTimer();

    changeEmitTimerRef.current = setTimeout(() => {
      changeEmitTimerRef.current = null;
      emitChangeNow();
    }, 120);
  }, [clearChangeEmitTimer, emitChangeNow]);

  const updateControlState = useCallback((view: EditorView) => {
    const nextState = {
      canUndo: undoDepth(view.state) > 0,
      canRedo: redoDepth(view.state) > 0,
    };
    const nextFindVisible = searchPanelOpen(view.state);

    historyStateRef.current = nextState;
    findVisibleRef.current = nextFindVisible;
    setHistoryState((currentState) => (
      currentState.canUndo === nextState.canUndo && currentState.canRedo === nextState.canRedo
        ? currentState
        : nextState
    ));
    emitControlState(nextState);
  }, [emitControlState]);

  const buildExtensions = useCallback(() => [
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    highlightSpecialChars(),
    highlightActiveLine(),
    rectangularSelection(),
    indentOnInput(),
    bracketMatching(),
    search({ top: isMobileLayout }),
    highlightSelectionMatches({ highlightWordAroundCursor: true }),
    flashLineField,
    EditorState.tabSize.of(2),
    indentUnit.of("  "),
    languageCompartmentRef.current.of(InkLanguageSupport()),
    syntaxHighlighting(inkHighlightStyle),
    themeCompartmentRef.current.of(createThemeExtension(fontSize, effectiveTheme !== "light")),
    wrappingCompartmentRef.current.of(wordWrap ? EditorView.lineWrapping : []),
    editableCompartmentRef.current.of([
      EditorView.editable.of(true),
      EditorState.readOnly.of(false),
    ]),
    contentAttributesCompartmentRef.current.of(EditorView.contentAttributes.of({
      "aria-label": `Ink editor for ${fileName}`,
    })),
    keymap.of([
      indentWithTab,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...lintKeymap,
      ...defaultKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet && !update.transactions.length) return;
      updateControlState(update.view);
      if (update.docChanged && !syncingRef.current) {
        scheduleChangeEmit();
      }
    }),
  ], [effectiveTheme, fileName, fontSize, isMobileLayout, scheduleChangeEmit, updateControlState, wordWrap]);

  const createState = useCallback((doc: string, selection?: { from: number; to?: number }) => (
    EditorState.create({
      doc,
      selection: selection
        ? EditorSelection.range(
            Math.min(selection.from, doc.length),
            Math.min(selection.to ?? selection.from, doc.length),
          )
        : undefined,
      extensions: buildExtensions(),
    })
  ), [buildExtensions]);

  const focusEditor = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;

    view.requestMeasure();
    view.focus();
  }, []);

  const replaceDocument = useCallback((nextValue: string, options: ReplaceDocumentOptions) => {
    const view = viewRef.current;
    if (!view) return;

    syncingRef.current = true;
    if (options.history === "reset") {
      view.setState(createState(nextValue, options.selection));
      view.dispatch(setDiagnostics(
        view.state,
        options.diagnostics === "clear"
          ? []
          : toCodeMirrorDiagnostics(view.state, errorsRef.current, { activeFileId: fileId }),
      ));
    } else {
      const selection = options.selection
        ? EditorSelection.range(
            Math.min(options.selection.from, nextValue.length),
            Math.min(options.selection.to ?? options.selection.from, nextValue.length),
          )
        : undefined;

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue },
        selection,
        annotations: isolateHistory.of("full"),
        userEvent: "input.replace",
      });
    }

    lastEmittedValueRef.current = nextValue;
    updateControlState(view);
    setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, [createState, fileId, updateControlState]);

  const insertTextAtCursor = useCallback((insert: string | CodeMirrorEditorInsertOptions) => {
    const view = viewRef.current;
    if (!view) return;

    const options = typeof insert === "string" ? { text: insert } : insert;
    const { text } = options;
    const range = view.state.selection.main;
    const insertionStart = range.from;
    const selectionOffsets = options.selectRange ?? {
      startOffset: options.cursorOffset ?? text.length,
      endOffset: options.cursorOffset ?? text.length,
    };
    const startOffset = Math.max(0, Math.min(text.length, selectionOffsets.startOffset));
    const endOffset = Math.max(startOffset, Math.min(text.length, selectionOffsets.endOffset));
    const selection = EditorSelection.range(
      insertionStart + startOffset,
      insertionStart + endOffset,
    );

    view.focus();
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      selection,
      scrollIntoView: true,
      annotations: isolateHistory.of("full"),
      userEvent: options.userEvent ?? "input.insert",
    });
    view.focus();
    emitChangeNow();
  }, [emitChangeNow]);

  const replaceRange = useCallback((
    from: number,
    to: number,
    insert: string,
    userEvent = "input.replace",
  ) => {
    const view = viewRef.current;
    if (!view) return;

    const safeFrom = Math.min(Math.max(from, 0), view.state.doc.length);
    const safeTo = Math.min(Math.max(to, safeFrom), view.state.doc.length);

    view.dispatch({
      changes: { from: safeFrom, to: safeTo, insert },
      annotations: isolateHistory.of("full"),
      userEvent,
    });
    emitChangeNow();
  }, [emitChangeNow]);

  const getSelectedEditorText = useCallback((view: EditorView) => {
    const selection = view.state.selection.main;
    if (selection.empty) return "";

    return view.state.doc.sliceString(selection.from, selection.to);
  }, []);

  const writeTextToClipboard = useCallback(async (text: string) => {
    if (!text) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the legacy copy path below.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        return document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    } catch {
      return false;
    }
  }, []);

  const readTextFromClipboard = useCallback(async () => {
    try {
      return await navigator.clipboard?.readText() ?? "";
    } catch {
      return "";
    }
  }, []);

  const copySelection = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;

    void writeTextToClipboard(getSelectedEditorText(view));
    view.focus();
  }, [getSelectedEditorText, writeTextToClipboard]);

  const cutSelection = useCallback(() => {
    const view = viewRef.current;
    const selection = view?.state.selection.main;
    if (!view || !selection || selection.empty) {
      view?.focus();
      return;
    }

    void (async () => {
      const copied = await writeTextToClipboard(view.state.doc.sliceString(selection.from, selection.to));
      if (!copied) {
        view.focus();
        return;
      }

      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: "" },
        annotations: isolateHistory.of("full"),
        userEvent: "delete.cut",
      });
      view.focus();
      emitChangeNow();
    })();
  }, [emitChangeNow, writeTextToClipboard]);

  const pasteFromClipboard = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;

    void (async () => {
      const text = await readTextFromClipboard();
      if (text) {
        insertTextAtCursor({ text, userEvent: "input.paste" });
      } else {
        view.focus();
      }
    })();
  }, [insertTextAtCursor, readTextFromClipboard]);

  const jumpToOffset = useCallback((offset: number) => {
    const view = viewRef.current;
    if (!view) return;

    const safeOffset = Math.min(Math.max(offset, 0), view.state.doc.length);
    view.dispatch({
      selection: EditorSelection.cursor(safeOffset),
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  const jumpToLine = useCallback((line: number) => {
    const view = viewRef.current;
    if (!view) return;

    const offset = lineNumberToOffset(view.state.doc, line);
    view.dispatch({
      selection: EditorSelection.cursor(offset),
      effects: flashLineEffect.of(line),
      scrollIntoView: true,
    });
    view.focus();

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      viewRef.current?.dispatch({ effects: flashLineEffect.of(null) });
      flashTimerRef.current = null;
    }, 1200);
  }, []);

  const runCommand = useCallback((command: (view: EditorView) => boolean) => {
    const view = viewRef.current;
    if (!view) return;

    command(view);
    view.focus();
    updateControlState(view);
  }, [updateControlState]);

  useImperativeHandle(ref, () => ({
    getEditor: () => viewRef.current,
    getValue: () => viewRef.current?.state.doc.toString() || "",
    flushChanges: emitChangeNow,
    focus: focusEditor,
    layout: () => {
      viewRef.current?.requestMeasure();
    },
    replaceDocument,
    replaceRange,
    insertText: (text: string) => insertTextAtCursor({ text }),
    replaceSelection: (text: string) => insertTextAtCursor({ text }),
    getSelection: () => {
      const selection = viewRef.current?.state.selection.main;
      return {
        from: selection?.from ?? 0,
        to: selection?.to ?? 0,
      };
    },
    setSelection: (from: number, to = from) => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        selection: EditorSelection.range(
          Math.min(Math.max(from, 0), view.state.doc.length),
          Math.min(Math.max(to, 0), view.state.doc.length),
        ),
        scrollIntoView: true,
      });
      view.focus();
    },
    revealLine: jumpToLine,
    jumpToOffset,
    insertTextAtCursor,
    jumpToLine,
    openFind: () => runCommand(openSearchPanel),
    openReplace: () => runCommand(openSearchPanel),
    closeFind: () => runCommand(closeSearchPanel),
    replaceValue: (nextValue: string) => replaceDocument(nextValue, { history: "preserve" }),
    selectPreviousWord: () => runCommand(selectGroupBackward),
    selectNextWord: () => runCommand(selectGroupForward),
    expandSelection: () => runCommand((view) => selectParentSyntax(view) || selectLine(view)),
    shrinkSelection: () => runCommand(simplifySelection),
    selectLine: () => runCommand(selectLine),
    copySelection,
    cutSelection,
    pasteFromClipboard,
    undo: () => runCommand(undo),
    redo: () => runCommand(redo),
  }), [
    copySelection,
    cutSelection,
    emitChangeNow,
    focusEditor,
    insertTextAtCursor,
    jumpToLine,
    jumpToOffset,
    pasteFromClipboard,
    replaceRange,
    replaceDocument,
    runCommand,
  ]);

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const view = new EditorView({
      state: createState(value),
      parent: containerRef.current,
    });
    viewRef.current = view;
    updateControlState(view);
    if (!isMobileLayout) view.focus();

    return () => {
      emitChangeNow();
      clearChangeEmitTimer();
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      view.destroy();
      viewRef.current = undefined;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // Create exactly one EditorView per mount. Runtime settings update through
    // compartments below rather than by recreating the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        createThemeExtension(fontSize, effectiveTheme !== "light"),
      ),
    });
    view.requestMeasure();
  }, [effectiveTheme, fontSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: wrappingCompartmentRef.current.reconfigure(
        wordWrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [wordWrap]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: contentAttributesCompartmentRef.current.reconfigure(
        EditorView.contentAttributes.of({
          "aria-label": `Ink editor for ${fileName}`,
        }),
      ),
    });

    const currentValue = view.state.doc.toString();
    const didSwitchDocument = documentId !== lastSyncedDocumentIdRef.current;
    const isEchoFromLocalEdit = value === lastEmittedValueRef.current;

    if (!didSwitchDocument && currentValue === value) {
      lastSyncedDocumentIdRef.current = documentId;
      return;
    }

    if (!didSwitchDocument && isEchoFromLocalEdit) return;
    if (!didSwitchDocument && view.hasFocus) return;

    const selection = view.state.selection.main;
    replaceDocument(value, {
      history: didSwitchDocument ? "reset" : "preserve",
      diagnostics: didSwitchDocument ? "clear" : "reapply",
      selection: didSwitchDocument
        ? undefined
        : {
            from: selection.from,
            to: selection.to,
          },
    });
    lastSyncedDocumentIdRef.current = documentId;
  }, [documentId, fileName, replaceDocument, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch(setDiagnostics(view.state, toCodeMirrorDiagnostics(view.state, errors, { activeFileId: fileId })));
  }, [errors, fileId]);

  return (
    <div className="flex h-full flex-col">
      {showHeader && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-color bg-panel-bg px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Code className="shrink-0 text-sm text-accent-blue" />
            <span className="truncate text-[0.875rem] font-medium text-text-emphasis">
              {fileName}
            </span>
            <span className={`shrink-0 text-[0.8125rem] ${saveStatus.className}`} aria-live="polite">
              &bull; {saveStatus.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 text-[0.8125rem] text-text-secondary">
            <button
              type="button"
              onClick={() => runCommand(undo)}
              disabled={!historyState.canUndo}
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              aria-label="Undo"
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runCommand(redo)}
              disabled={!historyState.canRedo}
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              aria-label="Redo"
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runCommand(openSearchPanel)}
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis"
              aria-label="Find and replace"
              title="Find (Ctrl/Cmd+F)"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          className={`h-full w-full ${isMobileLayout ? "inkpad-mobile-editor" : ""}`}
          style={{ minHeight: 0 }}
          aria-label={`Ink editor for ${fileName}`}
        />
      </div>
    </div>
  );
});

CodeMirrorEditor.displayName = "CodeMirrorEditor";
