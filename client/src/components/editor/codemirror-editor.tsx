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
  undo,
  undoDepth,
} from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
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
import { EditableTitle } from "@/components/ui/editable-title";
import { inkAutoClose } from "@/editor/codemirror/auto-close";
import { lineNumberToOffset } from "@/editor/codemirror/coordinates";
import { inkCompletions } from "@/editor/codemirror/completion";
import { toCodeMirrorDiagnostics } from "@/editor/codemirror/diagnostics";
import { inkGoToDefinition } from "@/editor/codemirror/go-to-definition";
import { inkInfoHover } from "@/editor/codemirror/hover";
import { inkBuiltinFunctions } from "@/editor/codemirror/ink-builtins";
import { inkIdentifierOccurrences } from "@/editor/codemirror/identifier-occurrences";
import { inkSearch } from "@/components/editor/codemirror-search-panel";
import { inkHighlightStyle } from "@/editor/codemirror/ink-highlight-style";
import { InkLanguageSupport } from "@/editor/codemirror/ink-lang";
import type { SaveState } from "@/hooks/use-autosave";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import type { InkSymbol } from "@/inkLanguage/inkSymbols";

export interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onControlStateChange?: (state: CodeMirrorEditorControlState) => void;
  errors: EditorDiagnostic[];
  symbols?: InkSymbol[];
  fileId: string;
  documentId: string;
  fileName: string;
  isMobileLayout?: boolean;
  showHeader?: boolean;
  fontSize?: number;
  wordWrap?: boolean;
  saveState?: SaveState;
  onRenameFile?: (requestedName: string) => void | Promise<void>;
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
  getValue: () => string;
  flushChanges: () => void;
  focus: () => void;
  blur: () => void;
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

const DEFAULT_VIEWPORT_CONTENT = "width=device-width, initial-scale=1.0";
const ZOOM_LOCKED_VIEWPORT_CONTENT = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

// A smaller-than-16px mobile font (see effectiveFontSize) would otherwise
// trigger iOS Safari's auto-zoom on focus. Instead of flooring the font
// size, disable pinch-zoom for the duration of the focus so any font size
// is safe; zoom is restored the instant the editor blurs.
function setMobileZoomLocked(locked: boolean) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute("content", locked ? ZOOM_LOCKED_VIEWPORT_CONTENT : DEFAULT_VIEWPORT_CONTENT);
}

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

function createThemeExtension(fontSize: number, isDark: boolean, isMobileLayout: boolean) {
  return EditorView.theme({
    "&": {
      height: "100%",
      minHeight: "0",
      backgroundColor: "var(--editor-bg)",
      color: "var(--text-primary)",
      fontSize: `${fontSize}px`,
    },
    ".cm-scroller": {
      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace",
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
      padding: isMobileLayout ? "0 10px 0 2px" : "0 14px 0 4px",
    },
    ".cm-gutters": {
      backgroundColor: "var(--editor-bg)",
      color: "var(--text-secondary)",
      border: "none",
      paddingRight: isMobileLayout ? "6px" : "10px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: isMobileLayout ? "1.6em" : "2.5em",
      padding: isMobileLayout ? "0 3px 0 1px" : "0 4px 0 8px",
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
      borderLeftWidth: "2px",
    },
    // Matches of an explicit selection: a whisper next to the real selection (34%).
    ".cm-selectionMatch": {
      backgroundColor: "color-mix(in srgb, var(--accent-blue) 14%, transparent)",
    },
    // Occurrences of the identifier under the cursor (knots, variables, diverts).
    ".cm-inkIdentifierMatch": {
      backgroundColor: "color-mix(in srgb, var(--accent-blue) 14%, transparent)",
      outline: "1px solid color-mix(in srgb, var(--accent-blue) 32%, transparent)",
      borderRadius: "2px",
    },
    ".cm-inkBuiltin": {
      color: "var(--secondary-blue)",
      fontWeight: "600",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--panel-bg)",
      borderColor: "var(--border-color)",
      color: "var(--text-secondary)",
    },
    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--warning) 28%, transparent)",
      borderRadius: "2px",
    },
    ".cm-searchMatch-selected": {
      backgroundColor: "color-mix(in srgb, var(--warning) 48%, transparent)",
      outline: "1px solid var(--warning)",
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
    ".cm-tooltip .cm-inkInfoTooltip": {
      minWidth: "168px",
      maxWidth: "260px",
      padding: "8px 9px",
      fontFamily: "var(--font-sans, Inter), sans-serif",
      fontSize: "12px",
      lineHeight: "1.4",
    },
    ".cm-tooltip .cm-inkInfoTooltip-label": {
      color: "var(--text-primary)",
      fontSize: "12px",
      fontWeight: "600",
      marginBottom: "4px",
    },
    ".cm-tooltip .cm-inkInfoTooltip-path": {
      minWidth: "0",
      color: "var(--text-emphasis)",
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
      fontSize: "12px",
      fontWeight: "600",
      marginBottom: "7px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    ".cm-tooltip .cm-inkInfoTooltip-footer": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    },
    ".cm-tooltip .cm-inkInfoTooltip-location": {
      minWidth: "0",
      color: "var(--text-secondary)",
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
      fontSize: "11px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    ".cm-tooltip .cm-inkInfoTooltip-action": {
      display: "inline-flex",
      alignItems: "center",
      flexShrink: "0",
      minHeight: "24px",
      border: "1px solid var(--border-color)",
      borderRadius: "4px",
      backgroundColor: "transparent",
      color: "var(--accent-blue)",
      cursor: "pointer",
      font: "inherit",
      fontSize: "12px",
      fontWeight: "500",
      padding: "2px 7px",
      transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
    },
    ".cm-tooltip .cm-inkInfoTooltip-action:hover": {
      backgroundColor: "color-mix(in srgb, var(--accent-blue) 14%, transparent)",
      borderColor: "color-mix(in srgb, var(--accent-blue) 50%, var(--border-color))",
      color: "var(--text-emphasis)",
    },
    ".cm-tooltip .cm-inkInfoTooltip-action:focus-visible": {
      outline: "2px solid var(--ring)",
      outlineOffset: "2px",
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

function hasSearchPanelDom(view: EditorView) {
  return Boolean(view.dom.querySelector(".cm-ink-search"));
}

function isSearchPanelActuallyOpen(view: EditorView) {
  return searchPanelOpen(view.state) && hasSearchPanelDom(view);
}

function openSearchPanelSafely(view: EditorView) {
  if (searchPanelOpen(view.state) && !hasSearchPanelDom(view)) {
    closeSearchPanel(view);
  }

  return openSearchPanel(view);
}

function reconcileSearchPanelDom(view: EditorView) {
  if (!searchPanelOpen(view.state) || hasSearchPanelDom(view)) return;

  closeSearchPanel(view);
  openSearchPanel(view);
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(({
  value,
  onChange,
  onControlStateChange,
  errors,
  symbols = [],
  fileId,
  documentId,
  fileName,
  isMobileLayout = false,
  showHeader = true,
  fontSize = 14,
  wordWrap = true,
  saveState = "saved",
  onRenameFile,
}, ref) => {
  // Mobile renders a touch slightly smaller than the desktop preference
  // (dense monospace reads fine at arm's length on a phone). iOS Safari's
  // auto-zoom-on-focus, which this would otherwise trigger below 16px, is
  // handled separately by locking pinch-zoom while the editor is focused
  // (see the focus/blur domEventHandlers below) rather than by flooring the
  // font size, so the mobile size can go below 16px.
  const effectiveFontSize = isMobileLayout ? Math.max(fontSize - 1, 11) : fontSize;
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
  const symbolsRef = useRef(symbols);
  const lastControlStateRef = useRef<CodeMirrorEditorControlState | null>(null);
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

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  const emitControlState = useCallback((nextHistoryState = historyStateRef.current) => {
    const nextControlState = {
      ...nextHistoryState,
      isFindVisible: findVisibleRef.current,
    };
    const lastControlState = lastControlStateRef.current;

    if (
      lastControlState
      && (
        lastControlState.canUndo === nextControlState.canUndo
        && lastControlState.canRedo === nextControlState.canRedo
        && lastControlState.isFindVisible === nextControlState.isFindVisible
      )
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
    const nextFindVisible = isSearchPanelActuallyOpen(view);

    historyStateRef.current = nextState;
    findVisibleRef.current = nextFindVisible;
    setHistoryState((currentState) => (
      currentState.canUndo === nextState.canUndo && currentState.canRedo === nextState.canRedo
        ? currentState
        : nextState
    ));
    emitControlState(nextState);
  }, [emitControlState]);

  const jumpToLineNumber = useCallback((line: number) => {
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

  const getActiveFileSymbols = useCallback(
    () => symbolsRef.current.filter((symbol) => symbol.fileId === fileId),
    [fileId],
  );

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
    closeBrackets(),
    inkSearch({ top: true }),
    inkAutoClose(),
    inkCompletions(() => symbolsRef.current),
    inkGoToDefinition(
      getActiveFileSymbols,
      (symbol) => jumpToLineNumber(symbol.range.startLineNumber),
    ),
    inkInfoHover(
      getActiveFileSymbols,
      (symbol) => jumpToLineNumber(symbol.range.startLineNumber),
    ),
    highlightSelectionMatches({ minSelectionLength: 3 }),
    inkBuiltinFunctions,
    inkIdentifierOccurrences,
    flashLineField,
    EditorState.tabSize.of(2),
    indentUnit.of("  "),
    languageCompartmentRef.current.of(InkLanguageSupport()),
    syntaxHighlighting(inkHighlightStyle),
    themeCompartmentRef.current.of(createThemeExtension(effectiveFontSize, effectiveTheme !== "light", isMobileLayout)),
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
      ...closeBracketsKeymap,
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
    isMobileLayout
      ? EditorView.domEventHandlers({
          focus: () => setMobileZoomLocked(true),
          blur: () => setMobileZoomLocked(false),
        })
      : [],
  ], [
    effectiveFontSize,
    effectiveTheme,
    fileName,
    getActiveFileSymbols,
    isMobileLayout,
    jumpToLineNumber,
    scheduleChangeEmit,
    updateControlState,
    wordWrap,
  ]);

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
          : toCodeMirrorDiagnostics(view.state, errorsRef.current, {
              activeFileId: fileId,
              symbols: symbolsRef.current,
            }),
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
    jumpToLineNumber(line);
  }, [jumpToLineNumber]);

  const runCommand = useCallback((command: (view: EditorView) => boolean) => {
    const view = viewRef.current;
    if (!view) return;

    command(view);
    view.focus();
    updateControlState(view);
  }, [updateControlState]);

  useImperativeHandle(ref, () => ({
    getValue: () => viewRef.current?.state.doc.toString() || "",
    flushChanges: emitChangeNow,
    focus: focusEditor,
    blur: () => viewRef.current?.contentDOM.blur(),
    layout: () => {
      const view = viewRef.current;
      if (!view) return;

      reconcileSearchPanelDom(view);
      view.requestMeasure();
      updateControlState(view);
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
    openFind: () => runCommand(openSearchPanelSafely),
    openReplace: () => runCommand(openSearchPanelSafely),
    closeFind: () => runCommand(closeSearchPanel),
    replaceValue: (nextValue: string) => replaceDocument(nextValue, { history: "preserve" }),
    undo: () => runCommand(undo),
    redo: () => runCommand(redo),
  }), [
    emitChangeNow,
    focusEditor,
    insertTextAtCursor,
    jumpToLine,
    jumpToOffset,
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
      if (isMobileLayout) setMobileZoomLocked(false);
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
        createThemeExtension(effectiveFontSize, effectiveTheme !== "light", isMobileLayout),
      ),
    });
    view.requestMeasure();
  }, [effectiveFontSize, effectiveTheme, isMobileLayout]);

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

    view.dispatch(setDiagnostics(view.state, toCodeMirrorDiagnostics(view.state, errors, {
      activeFileId: fileId,
      symbols,
    })));
  }, [errors, fileId, symbols]);

  return (
    <div className="flex h-full flex-col">
      {showHeader && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-color bg-panel-bg px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Code className="shrink-0 text-sm text-accent-blue" />
            {onRenameFile ? (
              <EditableTitle
                title={fileName}
                onTitleChange={onRenameFile}
                editTrigger="double-click"
                ariaLabel={`Rename ${fileName}`}
                placeholder="File path..."
                fallbackTitle={fileName}
                normalizeValue={(value) => value.trim() || fileName}
                showEditIcon={false}
                className="h-8 min-w-0 px-1 md:px-1.5"
                inputClassName="font-mono text-[0.8125rem]"
                textClassName="font-mono text-[0.8125rem]"
              />
            ) : (
              <span className="truncate text-[0.875rem] font-medium text-text-emphasis">
                {fileName}
              </span>
            )}
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
