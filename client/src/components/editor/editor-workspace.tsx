import { useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { flushSync } from "react-dom";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { AlertTriangle, ArrowLeft, ChevronDown, Columns2, List, Plus, Redo2, RotateCcw, ScrollText, Search, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INK_SNIPPETS, type SnippetCategory } from "@/features/snippets/ink-snippets";
import type {
  CodeMirrorEditorControlState,
  CodeMirrorEditorHandle,
  CodeMirrorEditorInsertOptions,
} from "@/components/editor/codemirror-editor";
import type { AnalyticsMobileTab, PanelLayout } from "@/lib/analytics";
import { useMobileKeyboardInset } from "@/hooks/use-mobile-keyboard-inset";

export type MobileTab = "code" | "preview";
export type MobileDrawer = "problems" | "variables" | "snippets" | null;
export type FocusedPanel = "code" | "preview" | null;
export type DesktopBottomPanelHandle = ImperativePanelHandle;

const MOBILE_SYNTAX_INSERTS = [
  { label: "->", insert: { text: "-> " } },
  { label: "*", insert: { text: "* " } },
  { label: "+", insert: { text: "+ " } },
  { label: "~", insert: { text: "~ " } },
  { label: "=", insert: { text: "= " } },
  { label: "===", insert: { text: "===  ===", cursorOffset: 4 } },
  { label: "{ }", insert: { text: "{ }", cursorOffset: 2 } },
];

const MOBILE_SNIPPET_TAP_MOVE_THRESHOLD = 12;
const DESKTOP_BOTTOM_PANEL_COLLAPSED_HEIGHT = 44;
const DESKTOP_BOTTOM_PANEL_DEFAULT_SIZE = 25;
const DESKTOP_BOTTOM_PANEL_MIN_HEIGHT = 140;
const DESKTOP_BOTTOM_PANEL_MAX_HEIGHT = 520;
const DESKTOP_BOTTOM_PANEL_COLLAPSE_SNAP_HEIGHT = 92;
const DESKTOP_BOTTOM_PANEL_DRAG_THRESHOLD = 28;
const DESKTOP_BOTTOM_PANEL_CLICK_DRAG_TOLERANCE = 4;
const DESKTOP_MAIN_PANEL_MIN_HEIGHT = 220;

const SNIPPET_CATEGORY_ORDER: SnippetCategory[] = [
  "Structure",
  "Choices",
  "Variables",
  "Logic",
  "Comments",
];

const SNIPPETS_BY_CATEGORY = SNIPPET_CATEGORY_ORDER.map((category) => ({
  category,
  snippets: INK_SNIPPETS.filter((snippet) => snippet.category === category),
})).filter((group) => group.snippets.length > 0);

function getFirstPlaceholderRange(text: string): CodeMirrorEditorInsertOptions["selectRange"] {
  const match = /\[[^\]\n]+\]/.exec(text);
  if (!match) return undefined;
  return {
    startOffset: match.index,
    endOffset: match.index + match[0].length,
  };
}

function getSnippetInsert(text: string): CodeMirrorEditorInsertOptions {
  return {
    text,
    selectRange: getFirstPlaceholderRange(text),
  };
}

function clampDesktopBottomPanelHeight(height: number, containerHeight: number) {
  const availableMaxHeight = Math.max(
    DESKTOP_BOTTOM_PANEL_MIN_HEIGHT,
    Math.min(DESKTOP_BOTTOM_PANEL_MAX_HEIGHT, containerHeight - DESKTOP_MAIN_PANEL_MIN_HEIGHT),
  );
  return Math.min(availableMaxHeight, Math.max(DESKTOP_BOTTOM_PANEL_MIN_HEIGHT, height));
}

interface EditorWorkspaceProps {
  isMobile: boolean;
  mobileTab: MobileTab;
  setMobileTab: Dispatch<SetStateAction<MobileTab>>;
  mobileDrawer: MobileDrawer;
  setMobileDrawer: Dispatch<SetStateAction<MobileDrawer>>;
  focusedPanel: FocusedPanel;
  setFocusedPanel: Dispatch<SetStateAction<FocusedPanel>>;
  editorPane: ReactNode;
  previewPane: ReactNode;
  mobileCodeTabLabel?: ReactNode;
  mobileCodeTabMenu?: ReactNode;
  problemsPane: ReactNode;
  variablesPane: ReactNode;
  compactProblemsPane: ReactNode;
  compactVariablesPane: ReactNode;
  mobileProblemsPane: ReactNode;
  mobileVariablesPane: ReactNode;
  problemCount: number;
  variableCount: number;
  editorRef: RefObject<CodeMirrorEditorHandle>;
  editorControlState: CodeMirrorEditorControlState;
  onToggleFind: () => void;
  desktopBottomPanelRef: RefObject<DesktopBottomPanelHandle>;
  onErrorPanelOpened: () => void;
  onPanelLayoutChanged: (layout: PanelLayout) => void;
  onMobileTabChanged: (tab: AnalyticsMobileTab) => void;
  onCodeTabIntent?: () => void;
  onStepBack: () => void;
  onRestart: () => void;
  canStepBack: boolean;
  hasRuntimeState: boolean;
}

export function EditorWorkspace({
  isMobile,
  mobileTab,
  setMobileTab,
  mobileDrawer,
  setMobileDrawer,
  focusedPanel,
  setFocusedPanel,
  editorPane,
  previewPane,
  mobileCodeTabLabel,
  mobileCodeTabMenu,
  problemsPane,
  variablesPane,
  compactProblemsPane,
  compactVariablesPane,
  mobileProblemsPane,
  mobileVariablesPane,
  problemCount,
  variableCount,
  editorRef,
  editorControlState,
  onToggleFind,
  desktopBottomPanelRef,
  onErrorPanelOpened,
  onPanelLayoutChanged,
  onMobileTabChanged,
  onCodeTabIntent,
  onStepBack,
  onRestart,
  canStepBack,
  hasRuntimeState,
}: EditorWorkspaceProps) {
  const editorPanelRef = useRef<ImperativePanelHandle>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);
  const desktopWorkspaceRef = useRef<HTMLDivElement>(null);
  const bottomPanelDragRef = useRef<{
    pointerId: number | null;
    startY: number;
    startHeight: number;
    startCollapsed: boolean;
    hasDragged: boolean;
  } | null>(null);
  const bottomPanelCleanupRef = useRef<(() => void) | null>(null);
  const suppressBottomPanelHandleClickRef = useRef(false);
  const hasInitializedDesktopBottomPanelHeightRef = useRef(false);
  const pointerActivationHandledRef = useRef(false);
  const restoreFindAfterFocusRef = useRef(false);
  const tapGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  // Incremented each time split view is restored, forcing a clean PanelGroup mount.
  const [splitKey, setSplitKey] = useState(0);
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [desktopBottomPanelHeight, setDesktopBottomPanelHeight] = useState(280);
  const [isDesktopBottomPanelCollapsed, setIsDesktopBottomPanelCollapsed] = useState(false);

  const handleResetSplit = useCallback(() => {
    editorPanelRef.current?.resize(50);
    previewPanelRef.current?.resize(50);
  }, []);

  const handleRestoreSplit = useCallback(() => {
    setSplitKey(k => k + 1);
    setFocusedPanel(null);
    onPanelLayoutChanged("split");
  }, [onPanelLayoutChanged, setFocusedPanel]);

  const getDesktopWorkspaceHeight = useCallback(() => {
    return desktopWorkspaceRef.current?.clientHeight ?? 900;
  }, []);

  const resizeDesktopBottomPanel = useCallback((size: number) => {
    const workspaceHeight = getDesktopWorkspaceHeight();
    const requestedHeight = size <= 100 ? workspaceHeight * (size / 100) : size;

    if (requestedHeight <= DESKTOP_BOTTOM_PANEL_COLLAPSE_SNAP_HEIGHT) {
      setIsDesktopBottomPanelCollapsed(true);
      return;
    }

    setIsDesktopBottomPanelCollapsed(false);
    setDesktopBottomPanelHeight(clampDesktopBottomPanelHeight(requestedHeight, workspaceHeight));
  }, [getDesktopWorkspaceHeight]);

  const expandDesktopBottomPanel = useCallback((minSize?: number) => {
    setIsDesktopBottomPanelCollapsed(false);
    if (typeof minSize === "number") {
      resizeDesktopBottomPanel(minSize);
    }
  }, [resizeDesktopBottomPanel]);

  useImperativeHandle(desktopBottomPanelRef, () => ({
    collapse: () => setIsDesktopBottomPanelCollapsed(true),
    expand: expandDesktopBottomPanel,
    getId: () => "desktop-bottom-inspector-dock",
    getSize: () => {
      const workspaceHeight = getDesktopWorkspaceHeight();
      const currentHeight = isDesktopBottomPanelCollapsed
        ? DESKTOP_BOTTOM_PANEL_COLLAPSED_HEIGHT
        : desktopBottomPanelHeight;
      return (currentHeight / workspaceHeight) * 100;
    },
    isCollapsed: () => isDesktopBottomPanelCollapsed,
    isExpanded: () => !isDesktopBottomPanelCollapsed,
    resize: resizeDesktopBottomPanel,
  }), [
    desktopBottomPanelHeight,
    desktopBottomPanelRef,
    expandDesktopBottomPanel,
    getDesktopWorkspaceHeight,
    isDesktopBottomPanelCollapsed,
    resizeDesktopBottomPanel,
  ]);

  const updateBottomPanelDrag = useCallback((clientY: number) => {
    const drag = bottomPanelDragRef.current;
    if (!drag) return;

    const deltaUp = drag.startY - clientY;
    if (Math.abs(deltaUp) > DESKTOP_BOTTOM_PANEL_CLICK_DRAG_TOLERANCE) {
      drag.hasDragged = true;
      suppressBottomPanelHandleClickRef.current = true;
    }

    if (drag.startCollapsed) {
      if (deltaUp <= DESKTOP_BOTTOM_PANEL_DRAG_THRESHOLD) return;

      setIsDesktopBottomPanelCollapsed(false);
      setDesktopBottomPanelHeight(clampDesktopBottomPanelHeight(
        DESKTOP_BOTTOM_PANEL_MIN_HEIGHT + deltaUp - DESKTOP_BOTTOM_PANEL_DRAG_THRESHOLD,
        getDesktopWorkspaceHeight(),
      ));
      return;
    }

    const nextHeight = drag.startHeight + deltaUp;
    if (nextHeight <= DESKTOP_BOTTOM_PANEL_COLLAPSE_SNAP_HEIGHT) {
      setIsDesktopBottomPanelCollapsed(true);
      return;
    }

    setIsDesktopBottomPanelCollapsed(false);
    setDesktopBottomPanelHeight(clampDesktopBottomPanelHeight(nextHeight, getDesktopWorkspaceHeight()));
  }, [getDesktopWorkspaceHeight]);

  const finishBottomPanelDrag = useCallback(() => {
    const drag = bottomPanelDragRef.current;
    bottomPanelDragRef.current = null;
    bottomPanelCleanupRef.current?.();
    bottomPanelCleanupRef.current = null;

    if (drag?.hasDragged) {
      window.setTimeout(() => {
        suppressBottomPanelHandleClickRef.current = false;
      }, 0);
    }
  }, []);

  const beginBottomPanelDrag = useCallback((startY: number, pointerId: number | null) => {
    bottomPanelCleanupRef.current?.();
    bottomPanelDragRef.current = {
      pointerId,
      startY,
      startHeight: isDesktopBottomPanelCollapsed
        ? DESKTOP_BOTTOM_PANEL_COLLAPSED_HEIGHT
        : desktopBottomPanelHeight,
      startCollapsed: isDesktopBottomPanelCollapsed,
      hasDragged: false,
    };
  }, [desktopBottomPanelHeight, isDesktopBottomPanelCollapsed]);

  const handleBottomPanelPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    beginBottomPanelDrag(event.clientY, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      const drag = bottomPanelDragRef.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;
      updateBottomPanelDrag(moveEvent.clientY);
    };
    const handleWindowPointerEnd = (endEvent: PointerEvent) => {
      const drag = bottomPanelDragRef.current;
      if (!drag || drag.pointerId !== endEvent.pointerId) return;
      finishBottomPanelDrag();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
    bottomPanelCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  }, [beginBottomPanelDrag, finishBottomPanelDrag, updateBottomPanelDrag]);

  const handleBottomPanelPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = bottomPanelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateBottomPanelDrag(event.clientY);
  }, [updateBottomPanelDrag]);

  const handleBottomPanelPointerEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = bottomPanelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishBottomPanelDrag();
  }, [finishBottomPanelDrag]);

  const handleBottomPanelMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || bottomPanelDragRef.current) return;

    beginBottomPanelDrag(event.clientY, null);
    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      updateBottomPanelDrag(moveEvent.clientY);
    };
    const handleWindowMouseEnd = () => {
      finishBottomPanelDrag();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseEnd);
    bottomPanelCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseEnd);
    };
  }, [beginBottomPanelDrag, finishBottomPanelDrag, updateBottomPanelDrag]);

  const handleBottomPanelHandleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressBottomPanelHandleClickRef.current) {
      event.preventDefault();
      suppressBottomPanelHandleClickRef.current = false;
      return;
    }

    setIsDesktopBottomPanelCollapsed(collapsed => !collapsed);
  }, []);

  const handleFocusPanelChange = useCallback((panel: Exclude<FocusedPanel, null>) => {
    restoreFindAfterFocusRef.current = panel === "code" && editorControlState.isFindVisible;
    setFocusedPanel(panel);
    setMobileTab(panel);
    onPanelLayoutChanged(panel === "code" ? "editor_focus" : "preview_focus");
  }, [editorControlState.isFindVisible, onPanelLayoutChanged, setFocusedPanel, setMobileTab]);

  const handleMobilePrimaryTabChange = useCallback((value: string) => {
    const nextTab = value as MobileTab;
    setMobileTab(nextTab);
    onMobileTabChanged(nextTab === "code" ? "editor" : "preview");
  }, [onMobileTabChanged, setMobileTab]);

  const handleMobileDrawerToggle = useCallback((nextDrawer: Exclude<MobileDrawer, null>) => {
    setMobileDrawer((drawer) => {
      const shouldOpen = drawer !== nextDrawer;
      if (shouldOpen) {
        onMobileTabChanged(nextDrawer === "problems" ? "errors" : "variables");
        if (nextDrawer === "problems") {
          onErrorPanelOpened();
        }
        return nextDrawer;
      }

      return null;
    });
  }, [onErrorPanelOpened, onMobileTabChanged, setMobileDrawer]);

  const markPointerActivationHandled = useCallback(() => {
    pointerActivationHandledRef.current = true;
    window.setTimeout(() => {
      pointerActivationHandledRef.current = false;
    }, 500);
  }, []);

  const insertAtCursor = useCallback((
    insert: CodeMirrorEditorInsertOptions,
    closeDrawer = false,
  ) => {
    editorRef.current?.insertTextAtCursor(insert);
    if (closeDrawer) {
      flushSync(() => {
        setMobileTab("code");
        setMobileDrawer(null);
      });
      editorRef.current?.focus();
      return;
    }
    setMobileTab("code");
  }, [editorRef, setMobileDrawer, setMobileTab]);

  const handleInsertClick = useCallback((
    event: React.MouseEvent<HTMLElement>,
    insert: CodeMirrorEditorInsertOptions,
    closeDrawer = false,
  ) => {
    if (pointerActivationHandledRef.current) {
      event.preventDefault();
      return;
    }
    insertAtCursor(insert, closeDrawer);
  }, [insertAtCursor]);

  const handleInsertKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLElement>,
    insert: CodeMirrorEditorInsertOptions,
    closeDrawer = false,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    markPointerActivationHandled();
    insertAtCursor(insert, closeDrawer);
  }, [insertAtCursor, markPointerActivationHandled]);

  // Accessory-bar commands (undo/redo/find while the keyboard is open) run on
  // pointerdown with preventDefault so focus never leaves the editor and the
  // iOS keyboard stays up.
  const handleAccessoryCommandPointerDown = useCallback((
    event: React.PointerEvent<HTMLElement>,
    command: () => void,
  ) => {
    event.preventDefault();
    markPointerActivationHandled();
    command();
  }, [markPointerActivationHandled]);

  const handleAccessoryCommandClick = useCallback((
    event: React.MouseEvent<HTMLElement>,
    command: () => void,
  ) => {
    if (pointerActivationHandledRef.current) {
      event.preventDefault();
      return;
    }
    command();
  }, []);

  const handleAccessoryCommandKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLElement>,
    command: () => void,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    markPointerActivationHandled();
    command();
  }, [markPointerActivationHandled]);

  // Deliberately dismisses the keyboard: reviewing problems is a read task,
  // and the drawer needs the vertical space the keyboard is occupying.
  const handleProblemsChipClick = useCallback(() => {
    editorRef.current?.blur();
    handleMobileDrawerToggle("problems");
  }, [editorRef, handleMobileDrawerToggle]);

  // Shared tap-vs-drag gesture guard. Buttons that live inside a
  // horizontally- or vertically-scrollable region can't fire their action on
  // pointerdown, or the very touch that starts a scroll drag triggers them.
  // Instead we track movement and only commit the action on pointerup if the
  // finger never travelled past the threshold; a real drag is left alone so
  // native scrolling still works.
  const handleTapPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;

    event.stopPropagation();
    tapGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }, []);

  const handleTapPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const gesture = tapGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved) return;

    if (
      Math.abs(event.clientX - gesture.startX) > MOBILE_SNIPPET_TAP_MOVE_THRESHOLD
      || Math.abs(event.clientY - gesture.startY) > MOBILE_SNIPPET_TAP_MOVE_THRESHOLD
    ) {
      gesture.moved = true;
    }
  }, []);

  const handleTapPointerUp = useCallback((
    event: React.PointerEvent<HTMLElement>,
    onTap: () => void,
  ) => {
    if (event.pointerType === "mouse") return;

    const gesture = tapGestureRef.current;
    tapGestureRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      markPointerActivationHandled();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    markPointerActivationHandled();
    onTap();
  }, [markPointerActivationHandled]);

  const handleTapPointerCancel = useCallback(() => {
    tapGestureRef.current = null;
  }, []);

  // Opening the drawer dismisses the keyboard: browsing snippets is a read
  // task, and the drawer needs the vertical space the keyboard is occupying.
  // The keyboard comes back on its own when a snippet is actually inserted
  // (insertAtCursor refocuses the editor).
  const toggleSnippetsDrawer = useCallback(() => {
    setMobileDrawer((drawer) => {
      if (drawer === "snippets") return null;
      editorRef.current?.blur();
      return "snippets";
    });
  }, [editorRef, setMobileDrawer]);

  const handleSnippetsTogglePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    markPointerActivationHandled();
    toggleSnippetsDrawer();
  }, [markPointerActivationHandled, toggleSnippetsDrawer]);

  const handleSnippetsToggleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (pointerActivationHandledRef.current) {
      event.preventDefault();
      return;
    }
    toggleSnippetsDrawer();
  }, [toggleSnippetsDrawer]);

  const handleSnippetsToggleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    markPointerActivationHandled();
    toggleSnippetsDrawer();
  }, [markPointerActivationHandled, toggleSnippetsDrawer]);

  const drawerTitle = mobileDrawer === "variables"
    ? "Variables"
    : mobileDrawer === "snippets"
      ? "Snippets"
      : "Problems";

  const drawerDescription = mobileDrawer === "variables"
    ? "Inspect variables in the current story."
    : mobileDrawer === "snippets"
      ? "Insert reusable Ink structures at the editor cursor."
      : "Review compiler errors and warnings.";
  const isMobileSearchMode = isMobile && mobileTab === "code" && editorControlState.isFindVisible;

  // The phone `<main>` shrinks to the visible viewport above the keyboard (see
  // editor.tsx), which already lifts this workspace's toolbar rows into view.
  // The drawer is portalled outside `<main>` though, so it still needs an
  // explicit offset to sit above the keyboard.
  const mobileKeyboardInset = useMobileKeyboardInset(isMobile, () => editorRef.current?.layout());
  // While typing, chrome collapses to a single accessory row: tabs and the
  // Problems/Variables bar hide, and undo/redo/find fold into the insert bar.
  const isMobileKeyboardOpen = isMobile && mobileKeyboardInset > 0;

  const mobileDrawerStyle: CSSProperties | undefined = mobileKeyboardInset > 0
    ? {
        bottom: mobileKeyboardInset,
        height: `min(72vh, calc(100dvh - ${mobileKeyboardInset}px - 1rem))`,
        maxHeight: `min(72vh, calc(100dvh - ${mobileKeyboardInset}px - 1rem))`,
      }
    : undefined;

  // Trigger editor layout whenever the code tab becomes visible (mobile or desktop focus mode).
  useEffect(() => {
    if (mobileTab !== "code") return;
    const timer = window.setTimeout(() => {
      editorRef.current?.layout();
      if (restoreFindAfterFocusRef.current) {
        restoreFindAfterFocusRef.current = false;
        editorRef.current?.openFind();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editorRef, mobileDrawer, mobileTab, focusedPanel]);

  useEffect(() => {
    if (!isMobileSearchMode) return;

    setMobileDrawer(null);
    const timer = window.setTimeout(() => editorRef.current?.layout(), 0);
    return () => window.clearTimeout(timer);
  }, [editorRef, isMobileSearchMode, setMobileDrawer]);

  // Always reopen the snippet list collapsed.
  useEffect(() => {
    if (mobileDrawer !== "snippets") setExpandedSnippetId(null);
  }, [mobileDrawer]);

  useEffect(() => () => {
    bottomPanelCleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const clampBottomPanelForViewport = () => {
      const workspaceHeight = getDesktopWorkspaceHeight();
      setDesktopBottomPanelHeight((height) => {
        if (!hasInitializedDesktopBottomPanelHeightRef.current) {
          hasInitializedDesktopBottomPanelHeightRef.current = true;
          return clampDesktopBottomPanelHeight(workspaceHeight * (DESKTOP_BOTTOM_PANEL_DEFAULT_SIZE / 100), workspaceHeight);
        }

        return clampDesktopBottomPanelHeight(height, workspaceHeight);
      });
    };

    clampBottomPanelForViewport();
    window.addEventListener("resize", clampBottomPanelForViewport);
    return () => window.removeEventListener("resize", clampBottomPanelForViewport);
  }, [getDesktopWorkspaceHeight, isMobile]);

  // Re-measure after the chrome rows mount/unmount around the keyboard.
  useEffect(() => {
    const timer = window.setTimeout(() => editorRef.current?.layout(), 0);
    return () => window.clearTimeout(timer);
  }, [editorRef, isMobileKeyboardOpen]);

  // Desktop and tablet keep the inspector dock independent from primary-pane focus.
  if (!isMobile) {
    return (
      <div ref={desktopWorkspaceRef} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {focusedPanel === null ? (
            <ResizablePanelGroup key={splitKey} direction="horizontal" className="h-full">
              <ResizablePanel
                ref={editorPanelRef}
                collapsible
                defaultSize={50}
                minSize={20}
                onCollapse={() => handleFocusPanelChange("preview")}
              >
                <div className="h-full">{editorPane}</div>
              </ResizablePanel>
              <ResizableHandle className="w-1 bg-border-color transition-colors hover:bg-accent-blue" onDoubleClick={handleResetSplit} />
              <ResizablePanel
                ref={previewPanelRef}
                collapsible
                defaultSize={50}
                minSize={20}
                onCollapse={() => handleFocusPanelChange("code")}
              >
                {previewPane}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-color bg-panel-bg px-2 sm:px-3">
                <div className="flex h-full min-w-0 items-stretch" aria-label="Focused workspace panel">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleFocusPanelChange("code")}
                    aria-pressed={focusedPanel === "code"}
                    className="relative h-full min-w-0 max-w-[18rem] rounded-none px-3 text-[0.8125rem] font-medium text-text-secondary hover:bg-accent hover:text-text-emphasis aria-pressed:text-text-emphasis after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent aria-pressed:after:bg-accent-blue"
                  >
                    <span className="min-w-0 truncate">
                      {mobileCodeTabLabel ?? "Code"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleFocusPanelChange("preview")}
                    aria-pressed={focusedPanel === "preview"}
                    className="relative h-full rounded-none px-3 text-[0.8125rem] font-medium text-text-secondary hover:bg-accent hover:text-text-emphasis aria-pressed:text-text-emphasis after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent aria-pressed:after:bg-accent-blue"
                  >
                    Preview
                  </Button>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {focusedPanel === "code" ? (
                    <>
                      <Button type="button" variant="ghost" onClick={() => editorRef.current?.undo()} disabled={!editorControlState.canUndo} aria-label="Undo" className="h-9 w-9 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => editorRef.current?.redo()} disabled={!editorControlState.canRedo} aria-label="Redo" className="h-9 w-9 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                        <Redo2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" onClick={onToggleFind} aria-label={editorControlState.isFindVisible ? "Close find and replace" : "Find and replace"} aria-pressed={editorControlState.isFindVisible} className="h-9 w-9 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis aria-pressed:bg-accent aria-pressed:text-accent-blue">
                        <Search className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="ghost" onClick={onStepBack} disabled={!canStepBack || !hasRuntimeState} aria-label="Back to previous choice" className="h-9 w-9 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" onClick={onRestart} disabled={!hasRuntimeState} aria-label="Restart story from beginning" className="h-9 w-9 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <div className="mx-1 h-4 w-px bg-border-color" aria-hidden="true" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRestoreSplit}
                        className="h-9 w-9 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis"
                        aria-label="Restore split view"
                      >
                        <Columns2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Restore split view</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                {focusedPanel === "code" ? editorPane : previewPane}
              </div>
            </div>
          )}
        </div>
        <section
          aria-label="Problems and variables dock"
          className="relative shrink-0 overflow-hidden border-t border-border-color bg-panel-bg"
          data-collapsed={isDesktopBottomPanelCollapsed}
          style={{
            height: isDesktopBottomPanelCollapsed
              ? DESKTOP_BOTTOM_PANEL_COLLAPSED_HEIGHT
              : desktopBottomPanelHeight,
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={handleBottomPanelPointerDown}
                onPointerMove={handleBottomPanelPointerMove}
                onPointerUp={handleBottomPanelPointerEnd}
                onPointerCancel={handleBottomPanelPointerEnd}
                onMouseDown={handleBottomPanelMouseDown}
                onClick={handleBottomPanelHandleClick}
                aria-label={isDesktopBottomPanelCollapsed ? "Inspector divider: drag or click to show details" : "Inspector divider: drag to resize or click to hide details"}
                aria-expanded={!isDesktopBottomPanelCollapsed}
                className="group absolute inset-x-0 -top-1.5 z-20 flex h-3 touch-none cursor-row-resize items-center justify-center bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
              >
                <span className="h-px w-full bg-border-color transition-all group-hover:h-0.5 group-hover:bg-accent-blue group-focus-visible:h-0.5 group-focus-visible:bg-accent-blue" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isDesktopBottomPanelCollapsed ? "Drag or click to show details" : "Drag to resize; click to hide details"}
            </TooltipContent>
          </Tooltip>
          <div className="hidden h-full min-[1100px]:block">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={70} minSize={40}>
                {problemsPane}
              </ResizablePanel>
              <ResizableHandle className="w-1 bg-border-color transition-colors hover:bg-accent-blue" />
              <ResizablePanel defaultSize={30} minSize={20} className="flex h-full flex-col">
                {variablesPane}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          <Tabs defaultValue="problems" className="flex h-full min-h-0 flex-col min-[1100px]:hidden">
            <TabsList className="flex h-10 w-full shrink-0 justify-start rounded-none border-b border-border-color bg-panel-bg p-0 text-text-secondary">
              <TabsTrigger value="problems" className="relative h-full rounded-none px-4 text-[0.8125rem] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-text-emphasis data-[state=active]:after:bg-accent-blue">
                <AlertTriangle className="mr-2 h-3.5 w-3.5 text-error" />
                Problems
                <span className="ml-2 tabular-nums text-text-secondary">{problemCount}</span>
              </TabsTrigger>
              <TabsTrigger value="variables" className="relative h-full rounded-none px-4 text-[0.8125rem] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-text-emphasis data-[state=active]:after:bg-accent-blue">
                <List className="mr-2 h-3.5 w-3.5 text-accent-blue" />
                Variables
                <span className="ml-2 tabular-nums text-text-secondary">{variableCount}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="problems" className="m-0 min-h-0 flex-1">
              {compactProblemsPane}
            </TabsContent>
            <TabsContent value="variables" className="m-0 min-h-0 flex-1">
              {compactVariablesPane}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    );
  }

  // Phone layout keeps the compact tabs, bottom actions, and modal inspectors.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={mobileTab}
        onValueChange={handleMobilePrimaryTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        {!isMobileSearchMode && !isMobileKeyboardOpen && (
          <div className="relative flex h-10 w-full shrink-0 items-stretch border-b border-border-color bg-panel-bg text-text-secondary">
            <TabsList className="grid h-full min-w-0 flex-1 grid-cols-2 rounded-none bg-transparent p-0">
              {mobileCodeTabMenu ? (
                <TabsTrigger
                  value="code"
                  onPointerEnter={onCodeTabIntent}
                  onFocus={onCodeTabIntent}
                  className="relative h-full w-full min-w-0 justify-start rounded-none pl-3 pr-11 text-left text-[0.8125rem] font-medium after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-text-emphasis data-[state=active]:after:bg-accent-blue"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {mobileCodeTabLabel ?? "Code"}
                  </span>
                </TabsTrigger>
              ) : (
                <TabsTrigger
                  value="code"
                  onPointerEnter={onCodeTabIntent}
                  onFocus={onCodeTabIntent}
                  className="relative h-full min-w-0 rounded-none text-[0.8125rem] font-medium after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-text-emphasis data-[state=active]:after:bg-accent-blue"
                >
                  Code
                </TabsTrigger>
              )}
              <TabsTrigger value="preview" className="relative h-full min-w-0 rounded-none text-[0.8125rem] font-medium after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-text-emphasis data-[state=active]:after:bg-accent-blue">
                Preview
              </TabsTrigger>
            </TabsList>
            {mobileCodeTabMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open file menu"
                    className="absolute inset-y-1 right-1/2 z-10 flex w-12 translate-x-1/2 items-center justify-center rounded-md text-text-secondary/50 transition-colors hover:bg-accent/45 hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-blue"
                  >
                    <ChevronDown aria-hidden="true" className="h-3 w-3 stroke-[1.75]" />
                  </button>
                </DropdownMenuTrigger>
                {mobileCodeTabMenu}
              </DropdownMenu>
            )}
          </div>
        )}
        <TabsContent value="code" forceMount className="m-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          <div className="h-full min-h-0">{editorPane}</div>
        </TabsContent>
        <TabsContent value="preview" className="m-0 min-h-0 flex-1">
          <div className="h-full min-h-0">{previewPane}</div>
        </TabsContent>
      </Tabs>

      {mobileTab === "code" && !isMobileSearchMode && (
        <div className="relative z-40 flex h-11 shrink-0 items-stretch gap-1 border-t border-border-color bg-editor-bg px-1 py-1">
          {isMobileKeyboardOpen && (
            <div className="flex shrink-0 items-stretch gap-1 border-r border-border-color pr-1">
              <button
                type="button"
                onPointerDown={(event) => handleAccessoryCommandPointerDown(event, () => editorRef.current?.undo())}
                onClick={(event) => handleAccessoryCommandClick(event, () => editorRef.current?.undo())}
                onKeyDown={(event) => handleAccessoryCommandKeyDown(event, () => editorRef.current?.undo())}
                disabled={!editorControlState.canUndo}
                className="flex h-full w-10 shrink-0 items-center justify-center rounded border border-border-color bg-panel-bg text-text-emphasis transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:opacity-30"
                aria-label="Undo"
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onPointerDown={(event) => handleAccessoryCommandPointerDown(event, () => editorRef.current?.redo())}
                onClick={(event) => handleAccessoryCommandClick(event, () => editorRef.current?.redo())}
                onKeyDown={(event) => handleAccessoryCommandKeyDown(event, () => editorRef.current?.redo())}
                disabled={!editorControlState.canRedo}
                className="flex h-full w-10 shrink-0 items-center justify-center rounded border border-border-color bg-panel-bg text-text-emphasis transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:opacity-30"
                aria-label="Redo"
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto">
            {MOBILE_SYNTAX_INSERTS.map((item) => (
              <button
                key={item.label}
                type="button"
                onPointerDown={handleTapPointerDown}
                onPointerMove={handleTapPointerMove}
                onPointerUp={(event) => handleTapPointerUp(event, () => insertAtCursor(item.insert))}
                onPointerCancel={handleTapPointerCancel}
                onLostPointerCapture={handleTapPointerCancel}
                onClick={(event) => handleInsertClick(event, item.insert)}
                onKeyDown={(event) => handleInsertKeyDown(event, item.insert)}
                className="flex h-full min-w-10 shrink-0 items-center justify-center rounded border border-border-color bg-panel-bg px-2 font-mono text-[0.8125rem] font-medium text-text-emphasis transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                aria-label={`Insert ${item.label}`}
                title={`Insert ${item.label}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-stretch gap-1 border-l border-border-color pl-1">
            {isMobileKeyboardOpen && problemCount > 0 && (
              <button
                type="button"
                onClick={handleProblemsChipClick}
                className="flex h-full min-w-10 shrink-0 items-center justify-center gap-1 rounded border border-error/40 bg-panel-bg px-2 text-[0.8125rem] font-medium tabular-nums text-error transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                aria-label={`Open problems, ${problemCount} found`}
                title={`${problemCount} problems`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {problemCount}
              </button>
            )}
            <button
              type="button"
              onPointerDown={handleSnippetsTogglePointerDown}
              onClick={handleSnippetsToggleClick}
              onKeyDown={handleSnippetsToggleKeyDown}
              aria-pressed={mobileDrawer === "snippets"}
              aria-label="Snippets"
              title="Snippets"
              className={`flex h-full shrink-0 items-center justify-center gap-1.5 rounded border border-border-color bg-panel-bg text-[0.8125rem] font-medium text-text-emphasis transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue aria-pressed:border-accent-blue aria-pressed:text-accent-blue ${isMobileKeyboardOpen ? "w-10" : "min-w-[6.5rem] px-3"}`}
            >
              <ScrollText className="h-4 w-4" />
              {!isMobileKeyboardOpen && "Snippets"}
            </button>
          </div>
        </div>
      )}

      {!isMobileSearchMode && !isMobileKeyboardOpen && (
        <div
          className="relative z-40 flex h-12 shrink-0 border-t border-border-color bg-panel-bg"
        >
          {mobileTab === "code" ? (
            <>
              <div className="flex shrink-0 items-stretch px-1">
                <Button type="button" variant="ghost" onClick={() => editorRef.current?.undo()} disabled={!editorControlState.canUndo} aria-label="Undo" className="h-full w-10 rounded-none p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => editorRef.current?.redo()} disabled={!editorControlState.canRedo} aria-label="Redo" className="h-full w-10 rounded-none p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={onToggleFind} aria-label={editorControlState.isFindVisible ? "Close find and replace" : "Find and replace"} aria-pressed={editorControlState.isFindVisible} className="h-full w-10 rounded-none p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis aria-pressed:bg-accent aria-pressed:text-accent-blue">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <div className="my-2 w-px shrink-0 bg-border-color" aria-hidden="true" />
            </>
          ) : (
            <>
              <div className="flex shrink-0 items-stretch px-1">
                <Button type="button" variant="ghost" onClick={onStepBack} disabled={!canStepBack || !hasRuntimeState} aria-label="Back to previous choice" className="h-full w-11 rounded-none p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={onRestart} disabled={!hasRuntimeState} aria-label="Restart story from beginning" className="h-full w-11 rounded-none p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis disabled:opacity-30">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="my-2 w-px shrink-0 bg-border-color" aria-hidden="true" />
            </>
          )}
          <Button variant="ghost" onClick={() => handleMobileDrawerToggle("problems")} aria-label={`Problems ${problemCount}`} aria-pressed={mobileDrawer === "problems"} className="h-full min-w-0 flex-1 rounded-none justify-center gap-1.5 px-1 text-[0.75rem] text-text-primary hover:bg-accent hover:text-text-emphasis aria-pressed:bg-accent aria-pressed:text-text-emphasis min-[360px]:gap-2 min-[360px]:text-[0.8125rem]">
            <AlertTriangle className="h-4 w-4 text-error" />
            <span className="hidden min-[340px]:inline">Problems</span>
            <span className="tabular-nums text-text-secondary">{problemCount}</span>
          </Button>
          <Button variant="ghost" onClick={() => handleMobileDrawerToggle("variables")} aria-label={`Variables ${variableCount}`} aria-pressed={mobileDrawer === "variables"} className="h-full min-w-0 flex-1 rounded-none justify-center gap-1.5 px-1 text-[0.75rem] text-text-primary hover:bg-accent hover:text-text-emphasis aria-pressed:bg-accent aria-pressed:text-text-emphasis min-[360px]:gap-2 min-[360px]:text-[0.8125rem]">
            <List className="h-4 w-4 text-accent-blue" />
            <span className="hidden min-[340px]:inline">Variables</span>
            <span className="tabular-nums text-text-secondary">{variableCount}</span>
          </Button>
        </div>
      )}

      <Drawer open={mobileDrawer !== null} onOpenChange={(open) => !open && setMobileDrawer(null)}>
        <DrawerContent
          className="h-[72vh] max-h-[72vh] min-h-[42vh] overflow-hidden border-border-color bg-panel-bg text-text-primary"
          style={mobileDrawerStyle}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-color px-4">
            <DrawerTitle className="text-[0.9375rem] font-semibold text-text-emphasis">
              {drawerTitle}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {drawerDescription}
            </DrawerDescription>
            <Button variant="ghost" size="sm" onClick={() => setMobileDrawer(null)} className="h-8 w-8 p-0 hover:bg-accent" aria-label="Close drawer">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileDrawer === "variables" ? mobileVariablesPane : null}
            {mobileDrawer === "problems" ? mobileProblemsPane : null}
            {mobileDrawer === "snippets" ? (
              <div className="h-full touch-pan-y overflow-y-auto px-3 py-3" data-vaul-no-drag>
                {SNIPPETS_BY_CATEGORY.map((group) => (
                  <section key={group.category} className="mb-4 last:mb-0">
                    <h3 className="mb-2 px-1 text-[0.75rem] font-semibold text-text-secondary">
                      {group.category}
                    </h3>
                    <div className="space-y-2">
                      {group.snippets.map((snippet) => {
                        const isExpanded = expandedSnippetId === snippet.id;
                        return (
                          <div
                            key={snippet.id}
                            className="overflow-hidden rounded border border-border-color bg-editor-bg transition-colors data-[expanded=true]:border-accent-blue/60"
                            data-expanded={isExpanded}
                          >
                            <button
                              type="button"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => setExpandedSnippetId((id) => id === snippet.id ? null : snippet.id)}
                              aria-expanded={isExpanded}
                              className="flex w-full items-center gap-3 p-3 text-left text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="text-[0.875rem] font-medium text-text-emphasis">
                                    {snippet.label}
                                  </span>
                                  <span className="shrink-0 font-mono text-[0.6875rem] text-text-secondary">
                                    {snippet.aliases[0]}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[0.75rem] leading-snug text-text-secondary">
                                  {snippet.description}
                                </span>
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                aria-hidden="true"
                              />
                            </button>
                            {isExpanded && (
                              <div className="border-t border-border-color px-3 pb-3 pt-2">
                                <code className="block whitespace-pre-wrap rounded bg-panel-bg px-2 py-1.5 font-mono text-[0.75rem] leading-relaxed text-text-primary">
                                  {snippet.mobileInsert}
                                </code>
                                <button
                                  type="button"
                                  onPointerDown={handleTapPointerDown}
                                  onPointerMove={handleTapPointerMove}
                                  onPointerUp={(event) => handleTapPointerUp(event, () => insertAtCursor(getSnippetInsert(snippet.mobileInsert), true))}
                                  onPointerCancel={handleTapPointerCancel}
                                  onLostPointerCapture={handleTapPointerCancel}
                                  onClick={(event) => handleInsertClick(event, getSnippetInsert(snippet.mobileInsert), true)}
                                  onKeyDown={(event) => handleInsertKeyDown(event, getSnippetInsert(snippet.mobileInsert), true)}
                                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-accent-blue px-3 py-2 text-[0.8125rem] font-medium text-editor-bg transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Insert
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
