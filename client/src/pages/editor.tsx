import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Ref } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { TopMenu } from "@/components/editor/top-menu";
import type {
  CodeMirrorEditorHandle,
  CodeMirrorEditorControlState,
  CodeMirrorEditorProps,
} from "@/components/editor/codemirror-editor";
import { StoryPreview } from "@/components/editor/story-preview";
import { ErrorPanel } from "@/components/editor/error-panel";
import { VariableInspector } from "@/components/editor/variable-inspector";
import { FileActionDialog } from "@/components/editor/file-action-dialog";
import { LocalSavesDialog } from "@/components/editor/local-saves-dialog";
import { SettingsSheet } from "@/components/editor/settings-sheet";
import {
  EditorWorkspace,
  type FocusedPanel,
  type MobileDrawer,
  type MobileTab,
} from "@/components/editor/editor-workspace";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useInkStory } from "@/hooks/use-ink-story";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorSourceBuffer } from "@/hooks/use-editor-source-buffer";
import { useEditorDocumentActions } from "@/hooks/use-editor-document-actions";
import { useSaveErrorToast } from "@/hooks/use-save-error-toast";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePreferences } from "@/components/preferences-provider";
import { SAMPLE_STORY } from "@/data/sample-story";
import { FileOperations } from "@/lib/file-operations";
import { getDisplayTitleFromFilename } from "@/lib/filename-utils";
import { createInkDocumentId } from "@/lib/ink-document-id";
import { useStoryExport } from "@/features/export/useStoryExport";
import { AlertTriangle, X } from "lucide-react";
import type { InkDocument } from "@/types/ink-document";
import type { StoredInkDocument } from "@/lib/file-operations";
import type { PreviewMode } from "@/types/story-runtime";
import {
  resolveMetadata,
} from "@/lib/tag-interpreter";
import type { MetadataField, ThemeName } from "@/lib/tag-interpreter";
import {
  DEFAULT_HTML_EXPORT_APPEARANCE,
  type HtmlExportFont,
  type HtmlExportRequest,
  type HtmlExportTheme,
} from "@/features/export/html-export-options";
import { findTopLevelTagLine, setTopLevelTag, removeTopLevelTag } from "@/lib/ink-source-tags";
import {
  trackErrorPanelOpened,
  trackMobileTabChanged,
  trackNavigatorUsed,
  trackPanelLayoutChanged,
  trackStoryRun,
  type AnalyticsMobileTab,
  type PanelLayout,
} from "@/lib/analytics";
import { buildSymbolTable } from "@/inkLanguage/buildSymbolTable";
import { getMissingStartDiagnostic } from "@/inkLanguage/inkDiagnostics";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";

const LazyCodeMirrorEditor = lazy(() =>
  loadCodeMirrorEditor().then((module) => ({
    default: module.CodeMirrorEditor,
  })),
);

const PHONE_MEDIA_QUERY = "(max-width: 768px)";

function isPhoneViewport() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(PHONE_MEDIA_QUERY).matches;
}

function loadCodeMirrorEditor() {
  return import("@/components/editor/codemirror-editor");
}

function prefetchCodeMirrorEditor() {
  void loadCodeMirrorEditor().catch(() => {
    // A failed prefetch should not block opening the editor tab later.
  });
}

function getSingleTextChange(current: string, next: string) {
  let from = 0;
  const shortestLength = Math.min(current.length, next.length);
  while (from < shortestLength && current[from] === next[from]) {
    from += 1;
  }

  let currentEnd = current.length;
  let nextEnd = next.length;
  while (
    currentEnd > from
    && nextEnd > from
    && current[currentEnd - 1] === next[nextEnd - 1]
  ) {
    currentEnd -= 1;
    nextEnd -= 1;
  }

  return {
    from,
    to: currentEnd,
    insert: next.slice(from, nextEnd),
  };
}

if (typeof window !== "undefined" && !isPhoneViewport()) {
  prefetchCodeMirrorEditor();
}

interface StartupState {
  document: InkDocument;
  recoveredAt: number | null;
}

function EditorPaneSkeleton({
  fileName,
  showHeader,
  compact = false,
}: {
  fileName: string;
  showHeader: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-editor-bg">
      {showHeader && (
        <div className="flex h-11 shrink-0 items-center border-b border-border-color bg-panel-bg px-3 lg:px-4">
          <div className="h-3.5 w-28 max-w-[45vw] rounded-sm bg-border-color/70" aria-hidden="true" />
          <span className="sr-only">Loading editor for {fileName}</span>
        </div>
      )}
      <div className="grid min-h-0 flex-1 place-items-center p-4" aria-hidden="true">
        {compact ? (
          <div className="flex items-center gap-3 font-mono text-[0.8125rem] uppercase tracking-[0.14em] text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-color border-t-accent-blue" />
            Loading editor
          </div>
        ) : (
          <div className="w-full space-y-3 opacity-70">
            <div className="h-3 w-3/4 rounded-sm bg-border-color/60" />
            <div className="h-3 w-1/2 rounded-sm bg-border-color/45" />
            <div className="h-3 w-2/3 rounded-sm bg-border-color/45" />
            <div className="h-3 w-5/12 rounded-sm bg-border-color/35" />
          </div>
        )}
      </div>
    </div>
  );
}

function CodeEditorPane(props: CodeMirrorEditorProps & {
  editorRef: Ref<CodeMirrorEditorHandle>;
  isPhone: boolean;
  isVisible: boolean;
}) {
  const {
    editorRef,
    fileName,
    isPhone,
    isVisible,
    showHeader = true,
    ...editorProps
  } = props;
  const [shouldMountEditor, setShouldMountEditor] = useState(() => !isPhone || isVisible);

  useEffect(() => {
    if (!shouldMountEditor && (!isPhone || isVisible)) {
      setShouldMountEditor(true);
    }
  }, [isPhone, isVisible, shouldMountEditor]);

  if (!shouldMountEditor) {
    return null;
  }

  return (
    <Suspense
      fallback={(
        <EditorPaneSkeleton
          fileName={fileName}
          showHeader={showHeader}
          compact={isPhone}
        />
      )}
    >
      <LazyCodeMirrorEditor
        ref={editorRef}
        {...editorProps}
        fileName={fileName}
        showHeader={showHeader}
      />
    </Suspense>
  );
}

function getStartupState(): StartupState {
  try {
    const startupFile = FileOperations.loadStartupFile();
    if (startupFile) {
      const isRecoveryDraft = !('lastSavedAt' in startupFile);
      return {
        document: {
          id: createInkDocumentId(),
          filename: startupFile.name,
          title: startupFile.settings?.title ?? getDisplayTitleFromFilename(startupFile.name),
          source: startupFile.content,
          author: startupFile.settings?.author,
          htmlExport: startupFile.settings?.htmlExport,
          storyTypeface: startupFile.settings?.storyTypeface ?? startupFile.settings?.htmlExport?.font,
          previewMode: startupFile.settings?.previewMode ?? "transcript",
          updatedAt: startupFile.lastModified,
          lastSavedAt: isRecoveryDraft ? undefined : startupFile.lastSavedAt,
        },
        recoveredAt: isRecoveryDraft ? startupFile.lastModified : null,
      };
    }
  } catch {
    // localStorage unavailable (private browsing, security settings, etc.)
  }

  return {
    document: {
      id: createInkDocumentId(),
      filename: "story.ink",
      title: "Story",
      source: SAMPLE_STORY,
      author: "",
      previewMode: "transcript",
    },
    recoveredAt: null,
  };
}

export default function Editor() {
  const startupStateRef = useRef<StartupState | null>(null);
  if (!startupStateRef.current) {
    startupStateRef.current = getStartupState();
  }

  const [storageAvailable] = useState(() => FileOperations.checkAvailability().available);
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);

  const [currentDocument, setCurrentDocument] = useState<InkDocument>(startupStateRef.current.document);
  const title = currentDocument.title ?? getDisplayTitleFromFilename(currentDocument.filename);
  const [recentFiles, setRecentFiles] = useState<StoredInkDocument[]>(() => {
    try { return FileOperations.getAllFiles(); } catch { return []; }
  });
  const [recoveredAt, setRecoveredAt] = useState<number | null>(startupStateRef.current.recoveredAt);
  const [isRecoveryBannerDismissed, setIsRecoveryBannerDismissed] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => (
    isPhoneViewport() ? "preview" : "code"
  ));
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawer>(null);
  // Desktop "focus mode": a collapsed panel switches the workspace to the simplified
  // tab layout shared with mobile. Cleared when the window narrows into true mobile.
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastRunSource, setLastRunSource] = useState<string | null>(null);
  const [storySessionKey, setStorySessionKey] = useState(0);
  const [editorControlState, setEditorControlState] = useState<CodeMirrorEditorControlState>({
    canUndo: false,
    canRedo: false,
    isFindVisible: false,
  });

  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const desktopBottomPanelRef = useRef<ImperativePanelHandle>(null);
  const isMobile = useIsMobile();

  // True mobile owns the tab layout outright; clear any desktop focus state on entry.
  useEffect(() => {
    if (isMobile) setFocusedPanel(null);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || mobileTab === "code") {
      return;
    }

    let idleId: number | null = null;
    const timerId = window.setTimeout(() => {
      const requestIdleCallback = window.requestIdleCallback;
      if (requestIdleCallback) {
        idleId = requestIdleCallback(prefetchCodeMirrorEditor, { timeout: 1500 });
        return;
      }

      prefetchCodeMirrorEditor();
    }, 2500);

    return () => {
      window.clearTimeout(timerId);
      if (idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [isMobile, mobileTab]);
  const { toast } = useToast();
  const { preferences, effectiveTheme } = usePreferences();
  
  const {
    runtimeState,
    errors,
    variables,
    knots,
    isRunning,
    compileStatus,
    parsedGlobalTags,
    runStory,
    restartStory,
    makeChoice,
    stepBack,
    compileLive,
    compileNow,
    jumpToKnot
  } = useInkStory();

  const commitBufferedSource = useCallback((latestSource: string) => {
    setCurrentDocument((document) => {
      if (document.source === latestSource) {
        return document;
      }

      return {
        ...document,
        source: latestSource,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const {
    scheduleSourceState,
    resetBufferedSource,
    cancelPendingRecoveryDraft,
    scheduleRecoveryDraft,
    getCurrentSource,
  } = useEditorSourceBuffer({
    editorRef,
    fileName: currentDocument.filename,
    source: currentDocument.source,
    onSourceCommit: commitBufferedSource,
  });

  // Autosave system
  const autosave = useAutosave({
    fileName: currentDocument.filename,
    content: currentDocument.source,
    enabled: storageAvailable,
    onSave: async (filename, source) => {
      await FileOperations.saveFile(filename, source, {
        title: currentDocument.title,
        author: currentDocument.author,
        htmlExport: currentDocument.htmlExport,
        storyTypeface: currentDocument.storyTypeface,
        previewMode: currentDocument.previewMode,
      });
      cancelPendingRecoveryDraft();
      FileOperations.clearRecoveryDraft(filename);
      setRecoveredAt(null);
      setIsRecoveryBannerDismissed(false);
      setRecentFiles(FileOperations.getAllFiles());
    }
  });

  const {
    pendingAction,
    setPendingAction,
    isSavingBeforeAction,
    fileAction,
    setFileAction,
    isLocalSavesOpen,
    setIsLocalSavesOpen,
    deleteTarget,
    setDeleteTarget,
    saveCurrentDocument,
    handleNew,
    handleOpenFromDisk,
    handleOpenRecent,
    handleOpenManagedFile,
    handleSaveAndContinue,
    handleDiscardAndContinue,
    openFileActionDialog,
    handleSaveAs,
    getFileActionInitialName,
    handleConfirmFileAction,
    handleRenameCurrentDocument,
    handleDuplicateLocalFile,
    handleConfirmDeleteLocalFile,
  } = useEditorDocumentActions({
    currentDocument,
    setCurrentDocument,
    setRecentFiles,
    recoveredAt,
    setRecoveredAt,
    setIsRecoveryBannerDismissed,
    autosave,
    getCurrentSource,
    cancelPendingRecoveryDraft,
    resetBufferedSource,
    compileLive,
  });

  // Show error toasts for save failures
  useSaveErrorToast({
    saveState: autosave.saveState,
    fileName: currentDocument.filename
  });

  // Compile the Ink source on initial load
  useEffect(() => {
    if (!currentDocument.source) return;

    let timeoutId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        compileLive(currentDocument.source);
      }, 0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on initial load

  const handleSourceChange = useCallback((newSource: string) => {
    scheduleRecoveryDraft(currentDocument.filename, newSource, {
      title: currentDocument.title,
      author: currentDocument.author,
      htmlExport: currentDocument.htmlExport,
      storyTypeface: currentDocument.storyTypeface,
      previewMode: currentDocument.previewMode,
    });
    scheduleSourceState(newSource);
    compileLive(newSource);
  }, [
    compileLive,
    currentDocument.author,
    currentDocument.filename,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    currentDocument.title,
    scheduleRecoveryDraft,
    scheduleSourceState,
  ]);

  const formatRecoveredAt = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  };

  const handleExportError = useCallback((message: string, error: unknown) => {
    console.error(message, error);
    toast({
      title: message,
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
  }, [toast]);

  const handleRun = useCallback(async () => {
    // Use the editor's value as source of truth and do immediate compile
    const editorSource = editorRef.current?.getValue() || "";
    const sourceToCompile = editorSource || currentDocument.source;
    const compileStartedAt = performance.now();
    const result = await compileNow(sourceToCompile);
    const compileTimeMs = performance.now() - compileStartedAt;
    
    if (result?.runtimeStory) {
      trackStoryRun({
        result: "success",
        storyText: sourceToCompile,
        compileTimeMs,
      });
      setLastRunSource(sourceToCompile);
      runStory(result.runtimeStory); // Pass the freshly compiled runtime story directly
      setStorySessionKey(k => k + 1);
      setMobileTab("preview");
      if (!isMobile && focusedPanel !== null) {
        setFocusedPanel("preview");
      }
    } else {
      trackStoryRun({
        result: "compiler_error",
        storyText: sourceToCompile,
        compileTimeMs,
      });
      console.error("Compile failed; not running.", result?.errors);
      if (isMobile) {
        setMobileTab("code");
        setMobileDrawer("problems");
      } else {
        if (focusedPanel !== null) {
          setFocusedPanel("code");
          setMobileTab("code");
        }
        if ((desktopBottomPanelRef.current?.getSize() ?? 25) < 25) {
          desktopBottomPanelRef.current?.resize(25);
        }
      }
    }
  }, [compileNow, currentDocument.source, focusedPanel, isMobile, runStory]);

  const handleRestart = useCallback(() => {
    setStorySessionKey(k => k + 1);
    restartStory();
  }, [restartStory]);

  const handleSave = useCallback(async () => {
    await saveCurrentDocument(true);
  }, [saveCurrentDocument]);

  const handleNavigateToKnot = useCallback((knotName: string) => {
    trackNavigatorUsed("knot");
    // Jump to knot in editor - find the line with "=== knotName ==="
    const lines = currentDocument.source.split('\n');
    const knotLineIndex = lines.findIndex(line => 
      line.trim() === `=== ${knotName} ===`
    );
    
    if (knotLineIndex !== -1) {
      // Jump to line in the editor (line numbers are 1-based)
      const lineNumber = knotLineIndex + 1;
      editorRef.current?.jumpToLine(lineNumber);
    }
    
    // Also jump to knot in story preview if running
    if (isRunning) {
      jumpToKnot(knotName);
    }
  }, [currentDocument.source, isRunning, jumpToKnot]);

  const { exportInk, exportJson, exportHtml, isExporting } = useStoryExport({
    getSource: getCurrentSource,
    title,
    author: currentDocument.author ?? "",
    filename: currentDocument.filename,
    compileStory: compileNow,
    onError: handleExportError,
  });

  const handleErrorClick = useCallback((line: number) => {
    setMobileDrawer(null);
    setMobileTab("code");
    if (!isMobile && focusedPanel !== null) {
      setFocusedPanel("code");
    }
    window.setTimeout(() => {
      editorRef.current?.jumpToLine(line);
    }, 0);
  }, [focusedPanel, isMobile]);

  const handleToggleFind = useCallback(() => {
    setMobileDrawer(null);
    setMobileTab("code");
    window.setTimeout(() => {
      if (editorControlState.isFindVisible) {
        editorRef.current?.closeFind();
      } else {
        editorRef.current?.openFind();
      }
    }, 0);
  }, [editorControlState.isFindVisible]);

  const handleProjectSettingsChange = useCallback(async (updates: {
    title?: string;
    author?: string;
    htmlExport?: InkDocument["htmlExport"];
    storyTypeface?: InkDocument["storyTypeface"];
    previewMode?: PreviewMode;
  }) => {
    const nextDocument = { ...currentDocument, ...updates, updatedAt: Date.now() };
    setCurrentDocument(nextDocument);

    try {
      await FileOperations.saveFile(nextDocument.filename, getCurrentSource(), {
        title: nextDocument.title,
        author: nextDocument.author,
        htmlExport: nextDocument.htmlExport,
        storyTypeface: nextDocument.storyTypeface,
        previewMode: nextDocument.previewMode,
      });
      setRecentFiles(FileOperations.getAllFiles());
    } catch (error) {
      toast({
        title: "Could not save story settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [currentDocument, getCurrentSource, setRecentFiles, toast]);

  const effectiveStoryTypeface: HtmlExportFont =
    currentDocument.storyTypeface
    ?? currentDocument.htmlExport?.font
    ?? DEFAULT_HTML_EXPORT_APPEARANCE.font;

  const handleStoryTypefaceChange = useCallback((storyTypeface: HtmlExportFont) => {
    void handleProjectSettingsChange({
      storyTypeface,
      htmlExport: currentDocument.htmlExport
        ? { ...currentDocument.htmlExport, font: storyTypeface }
        : undefined,
    });
  }, [currentDocument.htmlExport, handleProjectSettingsChange]);

  const handleWriteTag = useCallback((field: MetadataField, value: string | null) => {
    const current = editorRef.current?.getValue() ?? currentDocument.source;
    const newSource = value === null
      ? removeTopLevelTag(current, field)
      : setTopLevelTag(current, field, value);
    if (newSource === current) return;
    const change = getSingleTextChange(current, newSource);

    if (editorRef.current) {
      editorRef.current.replaceRange(change.from, change.to, change.insert, "input.metadata");
      return;
    }

    handleSourceChange(newSource);
  }, [currentDocument.source, handleSourceChange]);

  const handleSetFileTheme = useCallback((theme: HtmlExportTheme) => {
    handleWriteTag("theme", theme);
  }, [handleWriteTag]);

  const resolvedExportTheme: ThemeName = preferences.previewTheme === "inkpad"
    ? effectiveTheme
    : preferences.previewTheme;
  const resolvedFromSystem = preferences.previewTheme === "inkpad" && preferences.theme === "system";

  const handleJumpToTagLine = useCallback((field: MetadataField) => {
    const source = editorRef.current?.getValue() ?? currentDocument.source;
    const line = findTopLevelTagLine(source, field);
    if (line !== null) {
      setIsSettingsOpen(false);
      requestAnimationFrame(() => {
        editorRef.current?.jumpToLine(line);
        editorRef.current?.focus();
      });
    }
  }, [currentDocument.source]);

  const previewMetadata = resolveMetadata(
    parsedGlobalTags,
    {
      title,
      author: currentDocument.author,
    },
    currentDocument.filename,
  );
  const exportMetadata = resolveMetadata(
    parsedGlobalTags,
    {
      title,
      author: currentDocument.author,
    },
    currentDocument.filename,
  );

  const handleHtmlExport = useCallback(async (request: HtmlExportRequest) => {
    const {
      rememberChoices,
      ...htmlExport
    } = request;
    await exportHtml(htmlExport);
    if (rememberChoices) {
      await handleProjectSettingsChange({
        htmlExport,
        storyTypeface: htmlExport.font,
      });
    }
  }, [exportHtml, handleProjectSettingsChange]);

  const inkpadDiagnostics = useMemo(() => {
    const missingStartDiagnostic = getMissingStartDiagnostic(
      buildSymbolTable(currentDocument.source, currentDocument.filename),
    );
    return missingStartDiagnostic ? [missingStartDiagnostic] : [];
  }, [currentDocument.filename, currentDocument.source]);
  const editorDiagnostics = useMemo<EditorDiagnostic[]>(() => ([
    ...errors.map((error) => ({
      ...error,
      source: "inkjs" as const,
      fileId: error.fileId && error.fileId !== "story.ink" ? error.fileId : currentDocument.filename,
    })),
    ...inkpadDiagnostics,
  ]), [currentDocument.filename, errors, inkpadDiagnostics]);
  const errorCount = errors.filter(e => e.type === "error").length;
  const warningCount = errors.filter(e => e.type === "warning").length;
  const isPreviewStale = Boolean(runtimeState && lastRunSource !== null && currentDocument.source !== lastRunSource);

  const handleErrorPanelOpened = useCallback(() => {
    trackErrorPanelOpened(errorCount + warningCount);
  }, [errorCount, warningCount]);

  const handlePanelLayoutChanged = useCallback((layout: PanelLayout) => {
    trackPanelLayoutChanged(layout);
  }, []);

  const handleMobileTabChanged = useCallback((tab: AnalyticsMobileTab) => {
    trackMobileTabChanged(tab);
  }, []);

  const editorPane = (
    <CodeEditorPane
      editorRef={editorRef}
      value={currentDocument.source}
      onChange={handleSourceChange}
      onControlStateChange={setEditorControlState}
      errors={editorDiagnostics}
      fileId={currentDocument.filename}
      documentId={currentDocument.id}
      fileName={currentDocument.filename}
      isMobileLayout={isMobile}
      showHeader={!isMobile && focusedPanel === null}
      fontSize={preferences.editorFontSize}
      wordWrap={preferences.wordWrap}
      saveState={autosave.saveState}
      isPhone={isMobile}
      isVisible={!isMobile || mobileTab === "code"}
    />
  );

  const previewPane = (
    <StoryPreview
      runtimeState={runtimeState}
      isRunning={isRunning}
      isStale={isPreviewStale}
      showHeader={!isMobile && focusedPanel === null}
      previewMode={currentDocument.previewMode ?? "transcript"}
      previewFontSize={preferences.previewFontSize}
      previewTheme={preferences.previewTheme}
      metadata={previewMetadata}
      sessionKey={storySessionKey}
      onMakeChoice={makeChoice}
      onStepBack={stepBack}
      onRun={handleRun}
      onRestart={handleRestart}
    />
  );

  const problemsPane = (
    <ErrorPanel
      errors={editorDiagnostics}
      compileStatus={compileStatus}
      onErrorClick={handleErrorClick}
    />
  );

  const compactProblemsPane = (
    <ErrorPanel
      errors={editorDiagnostics}
      compileStatus={compileStatus}
      onErrorClick={handleErrorClick}
      showHeader={false}
      showCompactStatus={false}
    />
  );

  const mobileProblemsPane = (
    <ErrorPanel
      errors={editorDiagnostics}
      compileStatus={compileStatus}
      onErrorClick={handleErrorClick}
      showHeader={false}
    />
  );

  const variablesPane = <VariableInspector variables={variables} />;
  const compactVariablesPane = <VariableInspector variables={variables} showHeader={false} />;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasCommandModifier = event.metaKey || event.ctrlKey;
      if (!hasCommandModifier || event.altKey || event.shiftKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        handleSave();
      } else if (key === "enter") {
        event.preventDefault();
        handleRun();
      } else if (key === "o") {
        event.preventDefault();
        handleOpenFromDisk();
      } else if (key === "n") {
        event.preventDefault();
        handleNew();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleNew, handleOpenFromDisk, handleRun, handleSave]);

  return (
    <main className="flex h-dvh flex-col bg-editor-bg text-text-primary">
      <TopMenu
        title={title}
        knots={knots}
        onNew={handleNew}
        onOpen={handleOpenFromDisk}
        recentFiles={recentFiles}
        currentFileName={currentDocument.filename}
        exportMetadata={exportMetadata}
        savedHtmlExport={currentDocument.htmlExport}
        storyTypeface={effectiveStoryTypeface}
        onOpenRecent={handleOpenRecent}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onManageSaves={() => setIsLocalSavesOpen(true)}
        onTitleChange={(nextTitle) => {
          void handleProjectSettingsChange({ title: nextTitle });
        }}
        onRun={handleRun}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportInk={exportInk}
        onExportJson={exportJson}
        resolvedTheme={resolvedExportTheme}
        resolvedFromSystem={resolvedFromSystem}
        onExportHtml={handleHtmlExport}
        onSetFileTheme={handleSetFileTheme}
        onStoryTypefaceChange={handleStoryTypefaceChange}
        isExporting={isExporting}
        onNavigateToKnot={handleNavigateToKnot}
        saveState={autosave.saveState}
      />

      <SettingsSheet
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        parsedGlobalTags={parsedGlobalTags}
        currentFileName={currentDocument.filename}
        storyTitle={title}
        author={currentDocument.author}
        previewMode={currentDocument.previewMode ?? "transcript"}
        storyTypeface={effectiveStoryTypeface}
        onWriteTag={handleWriteTag}
        onStoryDetailsChange={(updates) => {
          void handleProjectSettingsChange(updates);
        }}
        onStoryTypefaceChange={handleStoryTypefaceChange}
        onRenameFile={handleRenameCurrentDocument}
        onPreviewModeChange={(previewMode) => {
          void handleProjectSettingsChange({ previewMode });
        }}
        onJumpToTagLine={handleJumpToTagLine}
      />

      <FileActionDialog
        mode={fileAction?.mode ?? null}
        initialName={getFileActionInitialName()}
        onOpenChange={(open) => {
          if (!open) {
            setFileAction(null);
          }
        }}
        onConfirm={handleConfirmFileAction}
      />

      <LocalSavesDialog
        open={isLocalSavesOpen}
        files={recentFiles}
        currentFileName={currentDocument.filename}
        storageAvailable={storageAvailable}
        onOpenChange={setIsLocalSavesOpen}
        onOpenFile={handleOpenManagedFile}
        onRenameFile={(fileName) => openFileActionDialog("rename", fileName)}
        onDuplicateFile={handleDuplicateLocalFile}
        onDeleteFile={setDeleteTarget}
        onExport={exportInk}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null);
        }
      }}>
        <AlertDialogContent className="bg-panel-bg border-border-color text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete local save?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              {deleteTarget
                ? `${deleteTarget} will be removed from this browser. This cannot be undone.`
                : "This local save will be removed from this browser."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeleteLocalFile}
              className="bg-error text-editor-bg hover:brightness-110"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!storageAvailable && !storageWarningDismissed && (
        <div className="flex items-center justify-between gap-3 border-b border-border-color bg-error/10 px-4 py-2 text-[0.8125rem] text-text-emphasis">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            <span className="text-error font-medium">Browser storage unavailable.</span>
            <span className="text-text-secondary hidden sm:inline">Autosave is disabled. Your work is active in this session — export your .ink file before closing this tab.</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportInk()}
              className="h-7 px-2 text-[0.75rem] text-error hover:bg-error/10 hover:text-error"
            >
              Export now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStorageWarningDismissed(true)}
              className="h-7 px-2 text-[0.75rem] text-text-secondary hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      )}

      {recoveredAt !== null && !isRecoveryBannerDismissed && (
        <div className="flex items-center justify-between gap-3 border-b border-border-color bg-amber-500/10 px-4 py-2 text-[0.8125rem] text-text-emphasis">
          <div className="min-w-0">
            <span className="font-medium text-warning">Recovered unsaved changes</span>
            <span className="text-text-secondary"> from {formatRecoveredAt(recoveredAt)} in {currentDocument.filename}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveCurrentDocument(true)}
              className="h-7 px-2 text-[0.75rem] hover:bg-accent"
            >
              Save now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRecoveryBannerDismissed(true)}
              className="h-7 px-2 text-[0.75rem] text-text-secondary hover:bg-accent"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => {
        if (!open && !isSavingBeforeAction) {
          setPendingAction(null);
        }
      }}>
        <AlertDialogContent className="bg-panel-bg border-border-color text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes first?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              {pendingAction
                ? `You have unsaved changes in ${currentDocument.filename}. Save before you ${pendingAction.label}?`
                : `You have unsaved changes in ${currentDocument.filename}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingAction(null)}
              disabled={isSavingBeforeAction}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscardAndContinue}
              disabled={isSavingBeforeAction}
              className="border-border-color"
            >
              Discard
            </Button>
            <Button
              onClick={handleSaveAndContinue}
              disabled={isSavingBeforeAction}
              className="bg-success text-editor-bg hover:brightness-110"
            >
              {isSavingBeforeAction ? "Saving..." : "Save and continue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <EditorWorkspace
        isMobile={isMobile}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        mobileDrawer={mobileDrawer}
        setMobileDrawer={setMobileDrawer}
        focusedPanel={focusedPanel}
        setFocusedPanel={setFocusedPanel}
        editorPane={editorPane}
        previewPane={previewPane}
        problemsPane={problemsPane}
        variablesPane={variablesPane}
        compactProblemsPane={compactProblemsPane}
        compactVariablesPane={compactVariablesPane}
        mobileProblemsPane={mobileProblemsPane}
        mobileVariablesPane={compactVariablesPane}
        problemCount={errorCount + warningCount}
        variableCount={variables.length}
        editorRef={editorRef}
        editorControlState={editorControlState}
        onToggleFind={handleToggleFind}
        desktopBottomPanelRef={desktopBottomPanelRef}
        onErrorPanelOpened={handleErrorPanelOpened}
        onPanelLayoutChanged={handlePanelLayoutChanged}
        onMobileTabChanged={handleMobileTabChanged}
        onCodeTabIntent={prefetchCodeMirrorEditor}
        onStepBack={stepBack}
        onRestart={handleRestart}
        canStepBack={runtimeState?.canStepBack ?? false}
        hasRuntimeState={Boolean(runtimeState)}
      />
    </main>
  );
}
