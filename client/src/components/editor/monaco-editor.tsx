// src/components/editor/MonacoEditor.tsx
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { getMonaco } from "@/monaco-setup";
import { Code, Redo2, Search, Undo2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { SaveState } from "@/hooks/use-autosave";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import { getEditorDiagnosticSeverity } from "@/types/editor-diagnostic";

const MOBILE_TAP_MOVE_THRESHOLD = 12;
const MOBILE_FOCUS_RECOVERY_MAX_TAP_MS = 450;
// TEMP: on-screen telemetry for diagnosing the iOS drag-to-select gesture.
// Remove once the gesture is confirmed working on device.
const TOUCH_DEBUG = false;
// A stationary touch held this long enters drag-to-select mode, mirroring the
// iOS long-press-to-select gesture. Kept above the tap-recovery window so a
// normal tap never crosses into selection.
const MOBILE_LONG_PRESS_MS = 500;
const CHANGE_ALL_OCCURRENCES_ACTION_ID = "editor.action.changeAll";
const MONACO_WORD_SEPARATORS_OPTION = 132;

export interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onControlStateChange?: (state: MonacoEditorControlState) => void;
  errors: EditorDiagnostic[];
  fileName: string;
  isMobileLayout?: boolean;
  showHeader?: boolean;
  fontSize?: number;
  wordWrap?: boolean;
  saveState?: SaveState;
}

export interface MonacoEditorControlState {
  canUndo: boolean;
  canRedo: boolean;
  isFindVisible: boolean;
}

export interface MonacoEditorInsertOptions {
  text: string;
  /** Offset within inserted text where the caret should land. Defaults to end. */
  cursorOffset?: number;
  /** Offset range within inserted text to select after insertion. Wins over cursorOffset. */
  selectRange?: { startOffset: number; endOffset: number };
}

export interface MonacoEditorHandle {
  getEditor: () => import("monaco-editor").editor.IStandaloneCodeEditor | undefined;
  getValue: () => string;
  flushChanges: () => void;
  focus: () => void;
  layout: () => void;
  insertTextAtCursor: (insert: string | MonacoEditorInsertOptions) => void;
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

export const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(({
  value,
  onChange,
  onControlStateChange,
  errors,
  fileName,
  isMobileLayout = false,
  showHeader = true,
  fontSize = isMobileLayout ? 13 : 14,
  wordWrap = true,
  saveState = "saved",
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor>();
  const syncingRef = useRef(false);
  const initializingRef = useRef(false); // Prevent double creation
  const lastEmittedValueRef = useRef(value);
  const lastSyncedFileNameRef = useRef(fileName);
  const onChangeRef = useRef(onChange);
  const onControlStateChangeRef = useRef(onControlStateChange);
  const changeEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fontLoadingDoneHandlerRef = useRef<(() => void) | null>(null);
  const mobileFindObserverRef = useRef<MutationObserver | null>(null);
  const changeAllActionDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const touchGestureRef = useRef<{
    identifier: number;
    startX: number;
    startY: number;
    startedAt: number;
    moved: boolean;
    selecting: boolean;
    anchorStart: { lineNumber: number; column: number } | null;
    anchorEnd: { lineNumber: number; column: number } | null;
    longPressTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const touchDebugRef = useRef<HTMLDivElement>(null);
  const isMobileLayoutRef = useRef(isMobileLayout);
  const [handlePositions, setHandlePositions] = useState<{
    start: { x: number; y: number; height: number } | null;
    end: { x: number; y: number; height: number } | null;
  } | null>(null);
  const handleDragRef = useRef<{
    which: "start" | "end";
    fixed: { lineNumber: number; column: number };
  } | null>(null);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const historyStateRef = useRef(historyState);
  const findVisibleRef = useRef(false);
  const { effectiveTheme } = useTheme();

  const saveStatusLabel = (() => {
    switch (saveState) {
      case "dirty":
        return "Modified";
      case "saving":
        return "Saving...";
      case "error":
        return "Save failed";
      case "disabled":
        return "Autosave disabled";
      default:
        return "Saved";
    }
  })();

  const saveStatusClass = (() => {
    switch (saveState) {
      case "dirty":
      case "disabled":
        return "text-warning";
      case "saving":
        return "text-accent-blue";
      case "error":
        return "text-error";
      default:
        return "text-text-secondary";
    }
  })();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onControlStateChangeRef.current = onControlStateChange;
  }, [onControlStateChange]);

  useEffect(() => {
    isMobileLayoutRef.current = isMobileLayout;
    if (!isMobileLayout) setHandlePositions(null);
  }, [isMobileLayout]);

  const emitControlState = (nextHistoryState = historyStateRef.current) => {
    onControlStateChangeRef.current?.({
      ...nextHistoryState,
      isFindVisible: findVisibleRef.current,
    });
  };

  const clearChangeEmitTimer = () => {
    if (changeEmitTimerRef.current) {
      clearTimeout(changeEmitTimerRef.current);
      changeEmitTimerRef.current = null;
    }
  };

  const emitChangeNow = () => {
    clearChangeEmitTimer();

    const ed = editorRef.current;
    if (!ed || syncingRef.current) return;

    const nextValue = ed.getValue();
    if (nextValue === lastEmittedValueRef.current) return;

    lastEmittedValueRef.current = nextValue;
    onChangeRef.current(nextValue);
  };

  const scheduleChangeEmit = () => {
    clearChangeEmitTimer();

    changeEmitTimerRef.current = setTimeout(() => {
      changeEmitTimerRef.current = null;

      const ed = editorRef.current;
      if (!ed || syncingRef.current) return;

      const nextValue = ed.getValue();
      if (nextValue === lastEmittedValueRef.current) return;

      lastEmittedValueRef.current = nextValue;
      onChangeRef.current(nextValue);
    }, 120);
  };

  const updateHandlePositions = () => {
    const ed = editorRef.current;
    if (!ed || !isMobileLayoutRef.current) {
      setHandlePositions(null);
      return;
    }
    const sel = ed.getSelection();
    if (!sel || sel.isEmpty()) {
      setHandlePositions(null);
      return;
    }
    const startPx = ed.getScrolledVisiblePosition({
      lineNumber: sel.startLineNumber,
      column: sel.startColumn,
    });
    const endPx = ed.getScrolledVisiblePosition({
      lineNumber: sel.endLineNumber,
      column: sel.endColumn,
    });
    setHandlePositions({
      start: startPx ? { x: startPx.left, y: startPx.top, height: startPx.height } : null,
      end: endPx ? { x: endPx.left, y: endPx.top, height: endPx.height } : null,
    });
  };

  const onHandlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    which: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const ed = editorRef.current;
    const sel = ed?.getSelection();
    if (!ed || !sel || sel.isEmpty()) return;
    const fixed =
      which === "start"
        ? { lineNumber: sel.endLineNumber, column: sel.endColumn }
        : { lineNumber: sel.startLineNumber, column: sel.startColumn };
    handleDragRef.current = { which, fixed };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = handleDragRef.current;
    const ed = editorRef.current;
    if (!drag || !ed) return;
    e.preventDefault();
    const focus = ed.getTargetAtClientPoint(e.clientX, e.clientY)?.position;
    if (!focus) return;
    const { fixed } = drag;
    const cmp =
      focus.lineNumber !== fixed.lineNumber
        ? focus.lineNumber - fixed.lineNumber
        : focus.column - fixed.column;
    if (cmp <= 0) {
      ed.setSelection({
        startLineNumber: focus.lineNumber,
        startColumn: focus.column,
        endLineNumber: fixed.lineNumber,
        endColumn: fixed.column,
      });
    } else {
      ed.setSelection({
        startLineNumber: fixed.lineNumber,
        startColumn: fixed.column,
        endLineNumber: focus.lineNumber,
        endColumn: focus.column,
      });
    }
    updateHandlePositions();
  };

  const onHandlePointerUp = () => {
    handleDragRef.current = null;
  };

  const focusEditor = () => {
    const ed = editorRef.current;
    if (!ed) return;

    ed.layout();
    ed.focus();
  };

  const shouldRecoverFocusFromMobileTap = (target: EventTarget | null) => {
    const ed = editorRef.current;
    const container = containerRef.current;
    if (!ed || !container || !(target instanceof Element)) return false;
    if (ed.hasTextFocus()) return false;

    return !target.closest(
      ".find-widget, .context-view, .monaco-menu, .suggest-widget, .scrollbar, .slider",
    );
  };

  // Long-press drag-to-select for touch devices. Monaco renders text as
  // non-selectable spans and funnels input through a hidden textarea, so iOS has
  // no native selection handles to grab — a touch-drag is consumed as a scroll.
  // We reconstruct the gesture against Monaco's own model: hold to anchor a word,
  // then drag to extend, mapping touch coordinates via getTargetAtClientPoint.
  // Listeners are native and capture-phase so we can preventDefault the scroll
  // (React's touchmove is passive) and stop Monaco's gesture from also scrolling.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobileLayout) return;

    let debugMoveCount = 0;
    const dbg = (msg: string) => {
      if (TOUCH_DEBUG && touchDebugRef.current) touchDebugRef.current.textContent = msg;
    };

    const comparePosition = (
      a: { lineNumber: number; column: number },
      b: { lineNumber: number; column: number },
    ) => (a.lineNumber !== b.lineNumber ? a.lineNumber - b.lineNumber : a.column - b.column);

    const clearLongPress = () => {
      const gesture = touchGestureRef.current;
      if (gesture?.longPressTimer != null) {
        clearTimeout(gesture.longPressTimer);
        gesture.longPressTimer = null;
      }
    };

    const beginSelection = () => {
      const gesture = touchGestureRef.current;
      const ed = editorRef.current;
      if (!gesture || !ed) return;

      const position = ed.getTargetAtClientPoint(gesture.startX, gesture.startY)?.position;
      if (!position) {
        dbg("LP fired but getTargetAtClientPoint=null");
        return;
      }

      // If a selection already exists, the long-press-drag extends it (iOS
      // handle-drag) rather than replacing it. Otherwise anchor the word under
      // the finger so a fresh drag has something to grow from.
      const existing = ed.getSelection();
      let anchorStart: { lineNumber: number; column: number };
      let anchorEnd: { lineNumber: number; column: number };
      let mode: string;
      if (existing && !existing.isEmpty()) {
        anchorStart = { lineNumber: existing.startLineNumber, column: existing.startColumn };
        anchorEnd = { lineNumber: existing.endLineNumber, column: existing.endColumn };
        mode = "extend";
      } else {
        const word = ed.getModel()?.getWordAtPosition(position);
        anchorStart = {
          lineNumber: position.lineNumber,
          column: word ? word.startColumn : position.column,
        };
        anchorEnd = {
          lineNumber: position.lineNumber,
          column: word ? word.endColumn : position.column,
        };
        mode = "word";
      }

      gesture.selecting = true;
      gesture.anchorStart = anchorStart;
      gesture.anchorEnd = anchorEnd;
      ed.setSelection({
        startLineNumber: anchorStart.lineNumber,
        startColumn: anchorStart.column,
        endLineNumber: anchorEnd.lineNumber,
        endColumn: anchorEnd.column,
      });
      // Light haptic confirms selection mode engaged, matching iOS long-press.
      navigator.vibrate?.(10);
      debugMoveCount = 0;
      dbg(`LP ok ${mode} L${anchorStart.lineNumber} c${anchorStart.column}-${anchorEnd.column}`);
    };

    const updateSelection = (clientX: number, clientY: number) => {
      const gesture = touchGestureRef.current;
      const ed = editorRef.current;
      if (!gesture?.selecting || !gesture.anchorStart || !gesture.anchorEnd || !ed) return;

      const focus = ed.getTargetAtClientPoint(clientX, clientY)?.position;
      if (!focus) {
        dbg(`mv#${debugMoveCount} xy=${Math.round(clientX)},${Math.round(clientY)} focus=null`);
        return;
      }

      const { anchorStart, anchorEnd } = gesture;
      const branch = comparePosition(focus, anchorStart) < 0
        ? "L"
        : comparePosition(focus, anchorEnd) > 0
          ? "R"
          : "in";
      dbg(`mv#${debugMoveCount} xy=${Math.round(clientX)},${Math.round(clientY)} f=L${focus.lineNumber}c${focus.column} ${branch}`);
      if (comparePosition(focus, anchorStart) < 0) {
        ed.setSelection({
          startLineNumber: focus.lineNumber,
          startColumn: focus.column,
          endLineNumber: anchorEnd.lineNumber,
          endColumn: anchorEnd.column,
        });
      } else if (comparePosition(focus, anchorEnd) > 0) {
        ed.setSelection({
          startLineNumber: anchorStart.lineNumber,
          startColumn: anchorStart.column,
          endLineNumber: focus.lineNumber,
          endColumn: focus.column,
        });
      } else {
        ed.setSelection({
          startLineNumber: anchorStart.lineNumber,
          startColumn: anchorStart.column,
          endLineNumber: anchorEnd.lineNumber,
          endColumn: anchorEnd.column,
        });
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      clearLongPress();

      if (
        (event.target instanceof Element
          && event.target.closest(".find-widget, .scrollbar, .slider, [data-selection-handle]"))
        || event.touches.length !== 1
      ) {
        touchGestureRef.current = null;
        return;
      }

      const touch = event.touches[0];
      const gesture = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: Date.now(),
        moved: false,
        selecting: false,
        anchorStart: null,
        anchorEnd: null,
        longPressTimer: null as ReturnType<typeof setTimeout> | null,
      };
      touchGestureRef.current = gesture;
      dbg(`down @${Math.round(touch.clientX)},${Math.round(touch.clientY)} — hold…`);
      gesture.longPressTimer = setTimeout(() => {
        const current = touchGestureRef.current;
        if (!current || current.identifier !== touch.identifier || current.moved) return;
        current.longPressTimer = null;
        beginSelection();
      }, MOBILE_LONG_PRESS_MS);
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = touchGestureRef.current;
      if (!gesture) return;

      const touch = Array.from(event.touches).find(
        (candidate) => candidate.identifier === gesture.identifier,
      );
      if (!touch) return;

      if (gesture.selecting) {
        // Own the gesture: block the browser scroll and Monaco's touch handling.
        event.preventDefault();
        event.stopPropagation();
        debugMoveCount += 1;
        updateSelection(touch.clientX, touch.clientY);
        return;
      }

      if (
        !gesture.moved
        && (Math.abs(touch.clientX - gesture.startX) > MOBILE_TAP_MOVE_THRESHOLD
          || Math.abs(touch.clientY - gesture.startY) > MOBILE_TAP_MOVE_THRESHOLD)
      ) {
        // Movement before the long-press fires means scroll, not selection.
        gesture.moved = true;
        clearLongPress();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      const gesture = touchGestureRef.current;
      if (!gesture) return;
      clearLongPress();
      touchGestureRef.current = null;

      if (gesture.selecting) {
        // Block Monaco's tap-to-place-cursor and the emulated mouse events iOS
        // fires after touchend; either would collapse the selection we just made.
        // Keep focus as-is so we don't pop the keyboard over the selection.
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (gesture.moved) return;
      if (Date.now() - gesture.startedAt > MOBILE_FOCUS_RECOVERY_MAX_TAP_MS) return;

      const touchEnded = Array.from(event.changedTouches).some(
        (touch) => touch.identifier === gesture.identifier,
      );
      if (touchEnded && shouldRecoverFocusFromMobileTap(event.target)) {
        focusEditor();
      }
    };

    const onTouchCancel = () => {
      clearLongPress();
      touchGestureRef.current = null;
    };

    container.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    container.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    container.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    container.addEventListener("touchcancel", onTouchCancel, { capture: true, passive: true });

    return () => {
      clearLongPress();
      container.removeEventListener("touchstart", onTouchStart, { capture: true });
      container.removeEventListener("touchmove", onTouchMove, { capture: true });
      container.removeEventListener("touchend", onTouchEnd, { capture: true });
      container.removeEventListener("touchcancel", onTouchCancel, { capture: true });
    };
  }, [isMobileLayout]);

  const runFindAction = (actionId: "actions.find" | "editor.action.startFindReplaceAction") => {
    const ed = editorRef.current;
    if (!ed) return;

    ed.layout();
    ed.focus();
    void ed.getAction(actionId)?.run();
  };

  const updateHistoryState = () => {
    const model = editorRef.current?.getModel() as (import("monaco-editor").editor.ITextModel & {
      canUndo?: () => boolean;
      canRedo?: () => boolean;
    }) | null | undefined;
    const nextState = {
      canUndo: model?.canUndo?.() ?? false,
      canRedo: model?.canRedo?.() ?? false,
    };

    historyStateRef.current = nextState;
    setHistoryState((currentState) => (
      currentState.canUndo === nextState.canUndo && currentState.canRedo === nextState.canRedo
        ? currentState
        : nextState
    ));
    emitControlState(nextState);
  };

  const runHistoryCommand = (command: "undo" | "redo") => {
    const ed = editorRef.current;
    if (!ed) return;

    ed.trigger("inkpad-toolbar", command, null);
    ed.focus();
  };

  const triggerEditorCommand = (command: string) => {
    const ed = editorRef.current;
    if (!ed) return;

    ed.focus();
    ed.trigger("inkpad-mobile-toolbar", command, null);
  };

  const runEditorAction = (actionId: string) => {
    const ed = editorRef.current;
    if (!ed) return;

    ed.focus();
    void ed.getAction(actionId)?.run();
  };

  const changeAllOccurrences = (ed: import("monaco-editor").editor.ICodeEditor) => {
    const model = ed.getModel();
    const selection = ed.getSelection();
    if (!model || !selection) return;

    const selectedText = selection.isEmpty() ? "" : model.getValueInRange(selection);
    const word = selection.isEmpty()
      ? model.getWordAtPosition(selection.getStartPosition())
      : null;
    const searchText = selectedText || word?.word || "";
    if (!searchText) return;

    const matches = model.findMatches(
      searchText,
      true,
      false,
      true,
      selection.isEmpty() ? ed.getOption(MONACO_WORD_SEPARATORS_OPTION) : null,
      false,
    );
    if (matches.length === 0) return;

    const selections = matches.map((match) => ({
      selectionStartLineNumber: match.range.startLineNumber,
      selectionStartColumn: match.range.startColumn,
      positionLineNumber: match.range.endLineNumber,
      positionColumn: match.range.endColumn,
    }));
    const currentMatchIndex = matches.findIndex((match) => match.range.intersectRanges(selection));

    ed.setSelections(
      currentMatchIndex > 0
        ? [selections[currentMatchIndex], ...selections.slice(0, currentMatchIndex), ...selections.slice(currentMatchIndex + 1)]
        : selections,
    );
    ed.focus();
  };

  const writeTextToClipboard = async (text: string) => {
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
  };

  const readTextFromClipboard = async () => {
    try {
      return await navigator.clipboard?.readText() ?? "";
    } catch {
      return "";
    }
  };

  const getSelectedEditorText = (ed: import("monaco-editor").editor.ICodeEditor) => {
    const model = ed.getModel();
    const selection = ed.getSelection();
    if (!model || !selection || selection.isEmpty()) return "";

    return model.getValueInRange(selection);
  };

  const insertTextAtCursor = (insert: string | MonacoEditorInsertOptions) => {
    const ed = editorRef.current;
    if (!ed) return;

    const model = ed.getModel();
    if (!model) return;

    const options = typeof insert === "string" ? { text: insert } : insert;
    const { text } = options;
    const selection = ed.getSelection();
    const position = ed.getPosition();
    const modelEnd = model.getFullModelRange().getEndPosition();
    const range = selection && !selection.isEmpty()
      ? selection
      : position
        ? {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          }
        : {
            startLineNumber: modelEnd.lineNumber,
            startColumn: modelEnd.column,
            endLineNumber: modelEnd.lineNumber,
            endColumn: modelEnd.column,
          };
    const insertionStartOffset = model.getOffsetAt({
      lineNumber: range.startLineNumber,
      column: range.startColumn,
    });
    const selectionOffsets = options.selectRange ?? {
      startOffset: options.cursorOffset ?? text.length,
      endOffset: options.cursorOffset ?? text.length,
    };
    const startOffset = Math.max(0, Math.min(text.length, selectionOffsets.startOffset));
    const endOffset = Math.max(startOffset, Math.min(text.length, selectionOffsets.endOffset));

    // Focus synchronously before the edit. On mobile Safari/Chrome this must
    // happen inside the user's pointer/key event if we want the keyboard back.
    ed.focus();
    ed.pushUndoStop();
    ed.executeEdits("inkpad-insert", [{ range, text, forceMoveMarkers: true }]);
    const targetStart = model.getPositionAt(insertionStartOffset + startOffset);
    const targetEnd = model.getPositionAt(insertionStartOffset + endOffset);
    ed.setSelection({
      startLineNumber: targetStart.lineNumber,
      startColumn: targetStart.column,
      endLineNumber: targetEnd.lineNumber,
      endColumn: targetEnd.column,
    });
    ed.revealPositionInCenterIfOutsideViewport(targetEnd);
    ed.pushUndoStop();
    ed.focus();
    emitChangeNow();
  };

  const copySelection = () => {
    const ed = editorRef.current;
    if (!ed) return;

    void writeTextToClipboard(getSelectedEditorText(ed));
    ed.focus();
  };

  const cutSelection = () => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const selection = ed?.getSelection();
    if (!ed || !model || !selection || selection.isEmpty()) {
      ed?.focus();
      return;
    }

    void (async () => {
      const copied = await writeTextToClipboard(model.getValueInRange(selection));
      if (!copied) {
        ed.focus();
        return;
      }

      ed.pushUndoStop();
      ed.executeEdits("inkpad-toolbar-cut", [{ range: selection, text: "", forceMoveMarkers: true }]);
      ed.pushUndoStop();
      ed.focus();
      emitChangeNow();
    })();
  };

  const pasteFromClipboard = () => {
    const ed = editorRef.current;
    if (!ed) return;

    void (async () => {
      const text = await readTextFromClipboard();
      if (text) {
        insertTextAtCursor({ text });
      } else {
        ed.focus();
      }
    })();
  };

  const replaceEditorValue = (nextValue: string, source = "inkpad-replace") => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;

    ed.executeEdits(source, [{ range: model.getFullModelRange(), text: nextValue }]);
    ed.pushUndoStop();
    emitChangeNow();
  };

  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
    getValue: () => editorRef.current?.getValue() || "",
    flushChanges: emitChangeNow,
    focus: focusEditor,
    layout: () => {
      editorRef.current?.layout();
    },
    insertTextAtCursor,
    openFind: () => runFindAction("actions.find"),
    openReplace: () => runFindAction("editor.action.startFindReplaceAction"),
    closeFind: () => editorRef.current?.trigger("inkpad-toolbar", "closeFindWidget", null),
    replaceValue: replaceEditorValue,
    selectPreviousWord: () => triggerEditorCommand("cursorWordStartLeftSelect"),
    selectNextWord: () => triggerEditorCommand("cursorWordEndRightSelect"),
    expandSelection: () => runEditorAction("editor.action.smartSelect.expand"),
    shrinkSelection: () => runEditorAction("editor.action.smartSelect.shrink"),
    selectLine: () => triggerEditorCommand("expandLineSelection"),
    copySelection,
    cutSelection,
    pasteFromClipboard,
    undo: () => runHistoryCommand("undo"),
    redo: () => runHistoryCommand("redo"),
    jumpToLine: (line: number) => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
      ed.focus();
      // Transient flash highlight — cleared after 1.2 s
      const ids = ed.deltaDecorations([], [{
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: { isWholeLine: true, className: 'error-line-flash' },
      }]);
      setTimeout(() => ed.deltaDecorations(ids, []), 1200);
    },
  }));

  // 1️⃣  Create / dispose editor
  useEffect(() => {
    (async () => {
      // Prevent double creation
      if (!containerRef.current || editorRef.current || initializingRef.current) {
        return;
      }
      
      initializingRef.current = true;

      const monaco = await getMonaco(); // workers + Ink already set up
      editorRef.current = monaco.editor.create(containerRef.current, {
        value,
        language: "ink",
        theme: effectiveTheme === "light"
          ? "ink-paper-light"
          : effectiveTheme === "high-contrast"
            ? "ink-high-contrast"
            : "ink-tokyo-night",
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontLigatures: false,
        disableMonospaceOptimizations: true,
        fontSize,
        letterSpacing: 0,
        lineNumbers: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: wordWrap ? "on" : "off",
        renderWhitespace: "selection",
        renderControlCharacters: true,
        folding: true,
        lineDecorationsWidth: isMobileLayout ? 12 : 20,
        lineNumbersMinChars: isMobileLayout ? 2 : 3,
        scrollbar: {
          verticalScrollbarSize: isMobileLayout ? 8 : 10,
          horizontalScrollbarSize: isMobileLayout ? 8 : 10,
        },
        fixedOverflowWidgets: true,
        // Additional settings to ensure proper keyboard handling
        tabSize: 2,
        insertSpaces: true,
        // Inline snippet completions. The Ink provider's word-alone gate keeps
        // this quiet during prose, so auto-suggest is safe to leave on here.
        quickSuggestions: { other: true, comments: false, strings: false },
        suggestOnTriggerCharacters: true,
        contextmenu: !isMobileLayout,
        find: {
          addExtraSpaceOnTop: isMobileLayout,
          autoFindInSelection: "multiline",
          cursorMoveOnType: true,
          loop: true,
          seedSearchStringFromSelection: "selection",
        },
      });
      if (isMobileLayout) {
        let wasFindVisible = false;
        mobileFindObserverRef.current = new MutationObserver(() => {
          const container = containerRef.current;
          if (!container) return;

          const findWidget = container.querySelector(".find-widget");
          const isFindVisible = findWidget?.classList.contains("visible") ?? false;

          if (isFindVisible !== findVisibleRef.current) {
            findVisibleRef.current = isFindVisible;
            emitControlState();
          }

          if (wasFindVisible && !isFindVisible) {
            window.requestAnimationFrame(() => {
              const currentContainer = containerRef.current;
              if (!currentContainer) return;

              currentContainer
                .querySelectorAll<HTMLElement>(".find-widget textarea, .monaco-editor textarea")
                .forEach((element) => element.blur());

              if (
                document.activeElement instanceof HTMLElement
                && currentContainer.contains(document.activeElement)
              ) {
                document.activeElement.blur();
              }
            });
          }

          wasFindVisible = isFindVisible;
        });
        mobileFindObserverRef.current.observe(containerRef.current, {
          attributes: true,
          attributeFilter: ["class"],
          childList: true,
          subtree: true,
        });
      }

      const remeasureEditorFonts = () => {
        if (!editorRef.current) return;
        monaco.editor.remeasureFonts();
        editorRef.current.layout();
      };

      fontLoadingDoneHandlerRef.current = remeasureEditorFonts;
      document.fonts.addEventListener("loadingdone", remeasureEditorFonts);
      document.fonts.ready.then(remeasureEditorFonts);

      // IMPORTANT: Don't override Monaco's built-in keyboard handling!
      // Monaco already handles Ctrl+A, Delete, Backspace perfectly.
      // Adding custom commands can break the default behavior.
      
      // However, if you need to ensure select-all works, you can ADD (not override) a command:
      // This uses a different key combination to avoid conflicts
      editorRef.current.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, 
        () => {
          // This is a backup select-all command (Ctrl+Shift+A)
          const model = editorRef.current?.getModel();
          if (model) {
            const fullRange = model.getFullModelRange();
            editorRef.current?.setSelection(fullRange);
          }
        }
      );

      changeAllActionDisposableRef.current = editorRef.current.addAction({
        id: CHANGE_ALL_OCCURRENCES_ACTION_ID,
        label: "Change All Occurrences",
        run: (ed) => {
          changeAllOccurrences(ed);
        },
      });

      editorRef.current.addAction({
        id: "inkpad.clipboard.copySelection",
        label: "Copy",
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 1,
        run: async (ed) => {
          await writeTextToClipboard(getSelectedEditorText(ed));
          ed.focus();
        },
      });

      editorRef.current.addAction({
        id: "inkpad.clipboard.cutSelection",
        label: "Cut",
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 2,
        run: async (ed) => {
          const model = ed.getModel();
          const selection = ed.getSelection();
          if (!model || !selection || selection.isEmpty()) {
            ed.focus();
            return;
          }

          const copied = await writeTextToClipboard(model.getValueInRange(selection));
          if (!copied) {
            ed.focus();
            return;
          }

          ed.pushUndoStop();
          ed.executeEdits("inkpad-context-cut", [{ range: selection, text: "", forceMoveMarkers: true }]);
          ed.pushUndoStop();
          ed.focus();
          emitChangeNow();
        },
      });

      editorRef.current.addAction({
        id: "inkpad.clipboard.paste",
        label: "Paste",
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 3,
        run: async (ed) => {
          const text = await readTextFromClipboard();
          if (text) {
            insertTextAtCursor({ text });
          } else {
            ed.focus();
          }
        },
      });

      // propagate changes
      editorRef.current.onDidChangeModelContent(() => {
        updateHistoryState();
        if (syncingRef.current) return;
        scheduleChangeEmit();
      });
      updateHistoryState();
      emitControlState();

      // iOS selection handle positions — update whenever selection or scroll changes.
      editorRef.current.onDidChangeCursorSelection(() => updateHandlePositions());
      editorRef.current.onDidScrollChange(() => updateHandlePositions());

      // iOS will accept programmatic focus here without opening the keyboard.
      // That leaves Monaco's textarea focused-but-keyboardless until another
      // panel blurs it, so mobile must wait for an actual user tap.
      if (!isMobileLayout) {
        editorRef.current.focus();
      }
      
      initializingRef.current = false;
    })();

    return () => {
      clearChangeEmitTimer();
      if (fontLoadingDoneHandlerRef.current) {
        document.fonts.removeEventListener("loadingdone", fontLoadingDoneHandlerRef.current);
        fontLoadingDoneHandlerRef.current = null;
      }
      mobileFindObserverRef.current?.disconnect();
      mobileFindObserverRef.current = null;
      changeAllActionDisposableRef.current?.dispose();
      changeAllActionDisposableRef.current = null;
      findVisibleRef.current = false;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = undefined;
      }
      // StrictMode-safe cleanup
      if (containerRef.current) {
        // Clear all Monaco DOM artifacts
        containerRef.current.innerHTML = '';
        // Also remove the context attribute that Monaco adds
        containerRef.current.removeAttribute('data-monaco-context');
      }
      // Block creation briefly to ensure DOM cleanup completes
      initializingRef.current = true;
      setTimeout(() => {
        initializingRef.current = false;
      }, 10);
    };
  }, []);

  // Update Monaco theme dynamically
  useEffect(() => {
    if (!editorRef.current) return;
    getMonaco().then((monaco) => {
      monaco.editor.setTheme(
        effectiveTheme === "light"
          ? "ink-paper-light"
          : effectiveTheme === "high-contrast"
            ? "ink-high-contrast"
            : "ink-tokyo-night",
      );
    });
  }, [effectiveTheme]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize,
      wordWrap: wordWrap ? "on" : "off",
    });
  }, [fontSize, wordWrap]);

  // 2️⃣  Keep value in sync for external document loads, without fighting local typing.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    const currentValue = ed.getValue();
    const didSwitchDocument = fileName !== lastSyncedFileNameRef.current;
    const isEchoFromLocalEdit = value === lastEmittedValueRef.current;

    if (currentValue === value) {
      lastSyncedFileNameRef.current = fileName;
      return;
    }

    if (!didSwitchDocument && isEchoFromLocalEdit) {
      return;
    }

    if (!didSwitchDocument && ed.hasTextFocus()) {
      return;
    }

    syncingRef.current = true;
    const position = ed.getPosition();
    ed.setValue(value);
    lastEmittedValueRef.current = value;
    lastSyncedFileNameRef.current = fileName;

    if (position && !didSwitchDocument) {
      setTimeout(() => {
        ed.setPosition(position);
      }, 0);
    }

    setTimeout(() => (syncingRef.current = false), 0);
  }, [fileName, value]);

  // 3️⃣  Show error markers
  useEffect(() => {
    let cancelled = false;
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;

    void getMonaco().then((monaco) => {
      if (cancelled || model.isDisposed()) return;
      const markers = errors.map((err) => ({
        startLineNumber: "range" in err ? err.range.startLineNumber : err.line,
        endLineNumber: "range" in err ? err.range.endLineNumber : err.line,
        startColumn: "range" in err ? err.range.startColumn : err.column || 1,
        endColumn: "range" in err
          ? err.range.endColumn
          : err.column
            ? err.column + 10
            : model.getLineMaxColumn(err.line),
        message: err.message,
        severity: (() => {
          const severity = getEditorDiagnosticSeverity(err);
          if (severity === "error") return monaco.MarkerSeverity.Error;
          if (severity === "warning") return monaco.MarkerSeverity.Warning;
          if (severity === "hint") return monaco.MarkerSeverity.Hint;
          return monaco.MarkerSeverity.Info;
        })(),
        source: err.source,
        code: "code" in err ? err.code : undefined,
      }));
      monaco.editor.setModelMarkers(model, "ink", markers);
    });

    return () => {
      cancelled = true;
    };
  }, [errors]);

  /* ---------------- Render ---------------- */
  return (
    <div className={`flex flex-col h-full ${TOUCH_DEBUG ? "relative" : ""}`}>
      {showHeader && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-color bg-panel-bg px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Code className="shrink-0 text-sm text-accent-blue" />
            <span className="truncate text-[0.875rem] font-medium text-text-emphasis">
              {fileName}
            </span>
            <span className={`shrink-0 text-[0.8125rem] ${saveStatusClass}`} aria-live="polite">
              &bull; {saveStatusLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 text-[0.8125rem] text-text-secondary">
            <button
              type="button"
              onClick={() => runHistoryCommand("undo")}
              disabled={!historyState.canUndo}
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              aria-label="Undo"
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runHistoryCommand("redo")}
              disabled={!historyState.canRedo}
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              aria-label="Redo"
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runFindAction("actions.find")}
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis"
              aria-label="Find and replace"
              title="Find (Ctrl/Cmd+F)"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0" style={{ minHeight: 0 }}>
        <div
          ref={containerRef}
          className={`h-full w-full ${isMobileLayout ? "inkpad-mobile-editor" : ""}`}
          style={{ minHeight: 0 }}
          // Touch handling (tap focus-recovery + long-press drag-to-select) is wired
          // through native non-passive listeners in a dedicated effect, because React's
          // synthetic touchmove is passive and cannot preventDefault the scroll.
          // IMPORTANT: No keyboard event handlers here!
          // Let Monaco handle ALL keyboard events internally.
          // Adding onKeyDown/onKeyDownCapture here will interfere with Monaco.
        />
        {isMobileLayout && handlePositions && (() => {
          // Context menu: floating Cut/Copy/Paste pill above the selection.
          const menuWidth = 152;
          const menuHeight = 36;
          const arrowHalf = 5; // half of the 10px rotated-square arrow
          const gap = 8; // space between arrow tip and top of start handle circle
          // Start handle circle sits 14px above pos.y; menu is above that.
          const menuTop = Math.max(
            8,
            (handlePositions.start?.y ?? 0) - 14 - gap - arrowHalf * 2 - menuHeight,
          );
          const midX =
            ((handlePositions.start?.x ?? 0) + (handlePositions.end?.x ?? handlePositions.start?.x ?? 0)) / 2;
          const containerWidth = containerRef.current?.offsetWidth ?? 375;
          const menuLeft = Math.max(8, Math.min(midX - menuWidth / 2, containerWidth - menuWidth - 8));
          // Arrow centered on the selection midpoint, clamped within pill edges.
          const arrowLeft = Math.max(
            8,
            Math.min(midX - menuLeft - arrowHalf, menuWidth - arrowHalf * 2 - 8),
          );
          const menuBtnStyle: React.CSSProperties = {
            flex: 1,
            height: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-emphasis)",
            padding: "0 12px",
            whiteSpace: "nowrap",
          };
          const onContextPointerDown = (e: React.PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
          };
          return (
            <>
              <div
                style={{
                  position: "absolute",
                  left: menuLeft,
                  top: menuTop,
                  zIndex: 20,
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    height: menuHeight,
                    borderRadius: 8,
                    background: "var(--panel-bg)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.45)",
                  }}
                >
                  <button
                    type="button"
                    style={menuBtnStyle}
                    onPointerDown={onContextPointerDown}
                    onClick={cutSelection}
                    aria-label="Cut"
                  >
                    Cut
                  </button>
                  <div style={{ width: 1, alignSelf: "stretch", background: "var(--border-color)" }} />
                  <button
                    type="button"
                    style={menuBtnStyle}
                    onPointerDown={onContextPointerDown}
                    onClick={copySelection}
                    aria-label="Copy"
                  >
                    Copy
                  </button>
                  <div style={{ width: 1, alignSelf: "stretch", background: "var(--border-color)" }} />
                  <button
                    type="button"
                    style={menuBtnStyle}
                    onPointerDown={onContextPointerDown}
                    onClick={pasteFromClipboard}
                    aria-label="Paste"
                  >
                    Paste
                  </button>
                  {/* Downward-pointing arrow connecting menu to selection */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -arrowHalf - 1,
                      left: arrowLeft,
                      width: arrowHalf * 2,
                      height: arrowHalf * 2,
                      background: "var(--panel-bg)",
                      borderRight: "1px solid var(--border-color)",
                      borderBottom: "1px solid var(--border-color)",
                      transform: "rotate(45deg)",
                    }}
                  />
                </div>
              </div>
              {handlePositions.start && (
              <div
                data-selection-handle="start"
                style={{
                  position: "absolute",
                  left: handlePositions.start.x - 11,
                  // Shift up so the bar aligns with the text line; circle sits above it.
                  top: handlePositions.start.y - 14,
                  width: 22,
                  pointerEvents: "auto",
                  touchAction: "none",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "grab",
                }}
                onPointerDown={(e) => onHandlePointerDown(e, "start")}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerUp}
              >
                <div style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--accent-blue)", marginBottom: 1 }} />
                <div style={{ width: 2, height: handlePositions.start.height, background: "var(--accent-blue)" }} />
              </div>
            )}
              {handlePositions.end && (
                <div
                  data-selection-handle="end"
                  style={{
                    position: "absolute",
                    left: handlePositions.end.x - 11,
                    top: handlePositions.end.y,
                    width: 22,
                    pointerEvents: "auto",
                    touchAction: "none",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "grab",
                  }}
                  onPointerDown={(e) => onHandlePointerDown(e, "end")}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                >
                  <div style={{ width: 2, height: handlePositions.end.height, background: "var(--accent-blue)" }} />
                  <div style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--accent-blue)", marginTop: 1 }} />
                </div>
              )}
            </>
          );
        })()}
      </div>
      {TOUCH_DEBUG && isMobileLayout && (
        <div
          ref={touchDebugRef}
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            right: 4,
            zIndex: 50,
            pointerEvents: "none",
            font: "11px/1.3 ui-monospace, monospace",
            color: "#0f0",
            background: "rgba(0,0,0,0.7)",
            padding: "2px 6px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          touch debug: idle
        </div>
      )}
    </div>
  );
});

MonacoEditor.displayName = "MonacoEditor";
