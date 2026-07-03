import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, Ref } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  EditorWorkspace,
  type FocusedPanel,
  type MobileDrawer,
  type MobileTab,
} from "@/components/editor/editor-workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useMobileKeyboardInset } from "@/hooks/use-mobile-keyboard-inset";
import { usePreferences } from "@/components/preferences-provider";
import { SAMPLE_STORY } from "@/data/sample-story";
import { FileOperations } from "@/lib/file-operations";
import { getDisplayTitleFromFilename, getFilename } from "@/lib/filename-utils";
import { createInkDocumentId } from "@/lib/ink-document-id";
import { cn } from "@/lib/utils";
import { useStoryExport } from "@/features/export/useStoryExport";
import { AlertTriangle, ChevronLeft, ChevronRight, File, FilePlus2, FileText, X } from "lucide-react";
import type { InkDocument } from "@/types/ink-document";
import type { InkProject } from "@/types/ink-project";
import type { StoredInkDocument } from "@/lib/file-operations";
import type { InkCompileInput } from "@/types/worker-messages";
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
import { adaptCompilerDiagnostic } from "@/inkLanguage/diagnosticAdapter";
import { getMissingStartDiagnostic } from "@/inkLanguage/inkDiagnostics";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import { getEditorDiagnosticLine } from "@/types/editor-diagnostic";
import {
  createSingleFileProject,
  parseInkProject,
  projectToCompileInput,
} from "@/lib/ink-project";
import {
  hasCaseInsensitiveInkProjectPathCollision,
  normalizeInkProjectPath,
} from "@/lib/ink-project-paths";

const LazyCodeMirrorEditor = lazy(() =>
  loadCodeMirrorEditor().then((module) => ({
    default: module.CodeMirrorEditor,
  })),
);

const PHONE_MEDIA_QUERY = "(max-width: 768px)";
const PROJECT_FILES_DRAG_THRESHOLD = 28;

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
  project: InkProject;
  activeFileId: string;
  recoveredAt: number | null;
}

function createProjectFromDocument(document: InkDocument): InkProject {
  return createSingleFileProject({
    id: document.id,
    name: document.title ?? getDisplayTitleFromFilename(document.filename),
    fileName: document.filename,
    content: document.source,
  });
}

function tryParseStoredProject(content: string): InkProject | null {
  try {
    return parseInkProject(content);
  } catch {
    return null;
  }
}

function getProjectFileSource(project: InkProject, fileId: string): string {
  return project.files[fileId]?.content ?? "";
}

function withProjectFileSource(project: InkProject, fileId: string, source: string): InkProject {
  return {
    ...project,
    files: {
      ...project.files,
      [fileId]: { content: source },
    },
  };
}

function getProjectCompileInput(project: InkProject): InkCompileInput {
  return projectToCompileInput(project);
}

function getProjectFingerprint(project: InkProject): string {
  return JSON.stringify({
    entryFile: project.entryFile,
    files: Object.keys(project.files)
      .sort()
      .map((fileId) => [fileId, project.files[fileId].content]),
  });
}

function getProjectExportName(project: InkProject): string {
  const baseName = (project.name || project.entryFile.replace(/\.ink$/i, "")).trim();
  return getFilename(baseName.replace(/\.inkpad$/i, ""), ".inkpad");
}

function getSortedProjectFileIds(project: InkProject): string[] {
  return Object.keys(project.files).sort((a, b) => {
    if (a === project.entryFile) return -1;
    if (b === project.entryFile) return 1;
    return a.localeCompare(b);
  });
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
      const storedProject = tryParseStoredProject(startupFile.content);
      if (storedProject) {
        const activeFileId = storedProject.entryFile;
        const activeSource = getProjectFileSource(storedProject, activeFileId);
        return {
          document: {
            id: storedProject.id,
            filename: activeFileId,
            title: startupFile.settings?.title ?? storedProject.name,
            source: activeSource,
            author: startupFile.settings?.author,
            htmlExport: startupFile.settings?.htmlExport,
            storyTypeface: startupFile.settings?.storyTypeface ?? startupFile.settings?.htmlExport?.font,
            previewMode: startupFile.settings?.previewMode ?? "transcript",
            updatedAt: startupFile.lastModified,
            lastSavedAt: isRecoveryDraft ? undefined : startupFile.lastSavedAt,
          },
          project: storedProject,
          activeFileId,
          recoveredAt: isRecoveryDraft ? startupFile.lastModified : null,
        };
      }

      const document = {
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
      } satisfies InkDocument;

      return {
        document,
        project: createProjectFromDocument(document),
        activeFileId: document.filename,
        recoveredAt: isRecoveryDraft ? startupFile.lastModified : null,
      };
    }
  } catch {
    // localStorage unavailable (private browsing, security settings, etc.)
  }

  const document: InkDocument = {
    id: createInkDocumentId(),
    filename: "story.ink",
    title: "Story",
    source: SAMPLE_STORY,
    author: "",
    previewMode: "transcript",
  };

  return {
    document,
    project: createProjectFromDocument(document),
    activeFileId: document.filename,
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
  const [currentProject, setCurrentProject] = useState<InkProject>(startupStateRef.current.project);
  const [activeFileId, setActiveFileId] = useState(startupStateRef.current.activeFileId);
  const [isProjectFilesCollapsed, setIsProjectFilesCollapsed] = useState(() => (
    Object.keys(startupStateRef.current?.project.files ?? {}).length <= 1
  ));
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
  const [isAddProjectFileOpen, setIsAddProjectFileOpen] = useState(false);
  const [lastRunSource, setLastRunSource] = useState<string | null>(null);
  const [storySessionKey, setStorySessionKey] = useState(0);
  const [editorControlState, setEditorControlState] = useState<CodeMirrorEditorControlState>({
    canUndo: false,
    canRedo: false,
    isFindVisible: false,
  });

  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const desktopBottomPanelRef = useRef<ImperativePanelHandle>(null);
  const previousProjectIdRef = useRef(currentProject.id);
  const projectFilesHandleDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startCollapsed: boolean;
    crossedThreshold: boolean;
  } | null>(null);
  const projectFilesHandleCleanupRef = useRef<(() => void) | null>(null);
  const suppressProjectFilesHandleClickRef = useRef(false);
  const isMobile = useIsMobile();
  const mobileKeyboardInset = useMobileKeyboardInset(isMobile);

  useEffect(() => () => {
    projectFilesHandleCleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (
      currentProject.id === currentDocument.id
      && Object.prototype.hasOwnProperty.call(currentProject.files, currentDocument.filename)
    ) {
      return;
    }

    const nextProject = createProjectFromDocument(currentDocument);
    setCurrentProject(nextProject);
    setActiveFileId(nextProject.entryFile);
  }, [currentDocument, currentProject]);

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
    setCurrentProject((project) => withProjectFileSource(project, activeFileId, latestSource));
    setCurrentDocument((document) => {
      if (document.source === latestSource) {
        return document;
      }

      return {
        ...document,
        filename: activeFileId,
        source: latestSource,
        updatedAt: Date.now(),
      };
    });
  }, [activeFileId]);

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

  const projectFileCount = Object.keys(currentProject.files).length;
  const hasMultipleProjectFiles = projectFileCount > 1;
  const currentProjectForSave = useMemo(
    () => withProjectFileSource(currentProject, activeFileId, currentDocument.source),
    [activeFileId, currentDocument.source, currentProject],
  );
  const localSaveFileName = hasMultipleProjectFiles
    ? getProjectExportName(currentProjectForSave)
    : currentDocument.filename;
  const localSaveContent = hasMultipleProjectFiles
    ? JSON.stringify(currentProjectForSave, null, 2)
    : currentDocument.source;
  const getCurrentSaveFileForAction = useCallback(() => {
    const activeSource = getCurrentSource();
    const projectForAction = withProjectFileSource(currentProject, activeFileId, activeSource);
    if (Object.keys(projectForAction.files).length > 1) {
      return {
        filename: getProjectExportName(projectForAction),
        content: JSON.stringify(projectForAction, null, 2),
      };
    }

    return {
      filename: currentDocument.filename,
      content: activeSource,
    };
  }, [activeFileId, currentDocument.filename, currentProject, getCurrentSource]);

  useEffect(() => {
    if (previousProjectIdRef.current === currentProject.id) {
      return;
    }

    previousProjectIdRef.current = currentProject.id;
    setIsProjectFilesCollapsed(projectFileCount <= 1);
  }, [currentProject.id, projectFileCount]);

  // Autosave system
  const autosave = useAutosave({
    fileName: localSaveFileName,
    content: localSaveContent,
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
      FileOperations.clearRecoveryDraft(currentDocument.filename);
      if (filename !== currentDocument.filename) {
        FileOperations.clearRecoveryDraft(filename);
      }
      setRecoveredAt(null);
      setIsRecoveryBannerDismissed(false);
      setRecentFiles(FileOperations.getAllFiles());
    }
  });

  const applyLoadedProjectFile = useCallback((file: StoredInkDocument) => {
    const loadedProject = tryParseStoredProject(file.content);
    if (!loadedProject) {
      return false;
    }

    const nextActiveFileId = loadedProject.entryFile;
    const nextActiveSource = getProjectFileSource(loadedProject, nextActiveFileId);

    cancelPendingRecoveryDraft();
    resetBufferedSource(nextActiveSource);
    FileOperations.setActiveFile(file.name);
    FileOperations.clearRecoveryDraft(file.name);
    FileOperations.clearRecoveryDraft(nextActiveFileId);
    setRecoveredAt(null);
    setIsRecoveryBannerDismissed(false);
    setCurrentProject(loadedProject);
    setActiveFileId(nextActiveFileId);
    setCurrentDocument({
      id: loadedProject.id,
      filename: nextActiveFileId,
      title: file.settings?.title ?? loadedProject.name,
      source: nextActiveSource,
      author: file.settings?.author ?? "",
      htmlExport: file.settings?.htmlExport,
      storyTypeface: file.settings?.storyTypeface ?? file.settings?.htmlExport?.font,
      previewMode: file.settings?.previewMode ?? "transcript",
      updatedAt: Date.now(),
      lastSavedAt: file.lastSavedAt ?? file.lastModified,
    });
    setIsProjectFilesCollapsed(Object.keys(loadedProject.files).length <= 1);
    setRecentFiles(FileOperations.getAllFiles());
    compileLive(getProjectCompileInput(loadedProject));
    return true;
  }, [
    cancelPendingRecoveryDraft,
    compileLive,
    resetBufferedSource,
    setIsRecoveryBannerDismissed,
    setRecoveredAt,
  ]);

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
    getFileActionExtension,
    handleConfirmFileAction,
    handleRenameCurrentDocument,
    handleDuplicateLocalFile,
    handleConfirmDeleteLocalFile,
  } = useEditorDocumentActions({
    currentDocument,
    setCurrentDocument,
    setRecentFiles,
    applyLoadedProjectFile,
    currentSaveFileName: localSaveFileName,
    getCurrentSaveFile: getCurrentSaveFileForAction,
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
    fileName: localSaveFileName
  });

  // Compile the Ink source on initial load
  useEffect(() => {
    if (!currentProject.entryFile) return;

    let timeoutId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        compileLive(getProjectCompileInput(currentProject));
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
    const nextProject = withProjectFileSource(currentProject, activeFileId, newSource);
    setCurrentProject(nextProject);
    scheduleRecoveryDraft(currentDocument.filename, newSource, {
      title: currentDocument.title,
      author: currentDocument.author,
      htmlExport: currentDocument.htmlExport,
      storyTypeface: currentDocument.storyTypeface,
      previewMode: currentDocument.previewMode,
    });
    scheduleSourceState(newSource);
    compileLive(getProjectCompileInput(nextProject));
  }, [
    activeFileId,
    compileLive,
    currentDocument.author,
    currentDocument.filename,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    currentDocument.title,
    currentProject,
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
    const projectToCompile = withProjectFileSource(currentProject, activeFileId, sourceToCompile);
    const compileInput = getProjectCompileInput(projectToCompile);
    const projectFingerprint = getProjectFingerprint(projectToCompile);
    const compileStartedAt = performance.now();
    const result = await compileNow(compileInput);
    const compileTimeMs = performance.now() - compileStartedAt;
    
    if (result?.runtimeStory) {
      trackStoryRun({
        result: "success",
        storyText: sourceToCompile,
        compileTimeMs,
      });
      setLastRunSource(projectFingerprint);
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
  }, [activeFileId, compileNow, currentDocument.source, currentProject, focusedPanel, isMobile, runStory]);

  const handleRestart = useCallback(() => {
    setStorySessionKey(k => k + 1);
    restartStory();
  }, [restartStory]);

  const getLiveProject = useCallback(() => {
    const activeSource = editorRef.current?.getValue() ?? currentDocument.source;
    return withProjectFileSource(currentProject, activeFileId, activeSource);
  }, [activeFileId, currentDocument.source, currentProject]);

  const handleSave = useCallback(async () => {
    if (!hasMultipleProjectFiles) {
      await saveCurrentDocument(true);
      return;
    }

    const nextProject = getLiveProject();
    const filename = getProjectExportName(nextProject);
    const content = JSON.stringify(nextProject, null, 2);
    try {
      await FileOperations.saveFile(filename, content, {
        title: currentDocument.title,
        author: currentDocument.author,
        htmlExport: currentDocument.htmlExport,
        storyTypeface: currentDocument.storyTypeface,
        previewMode: currentDocument.previewMode,
      });
      setCurrentProject(nextProject);
      autosave.markSaved(filename, content);
      cancelPendingRecoveryDraft();
      FileOperations.clearRecoveryDraft(currentDocument.filename);
      FileOperations.clearRecoveryDraft(filename);
      setRecoveredAt(null);
      setIsRecoveryBannerDismissed(false);
      setRecentFiles(FileOperations.getAllFiles());
      toast({ title: "Saved", description: `${filename} saved successfully.` });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [
    autosave,
    cancelPendingRecoveryDraft,
    currentDocument.author,
    currentDocument.filename,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    currentDocument.title,
    getLiveProject,
    hasMultipleProjectFiles,
    saveCurrentDocument,
    setRecentFiles,
    toast,
  ]);

  const handleExportProject = useCallback(() => {
    const project = getLiveProject();
    FileOperations.downloadFile(
      JSON.stringify(project, null, 2),
      getProjectExportName(project),
      "application/json",
    );
  }, [getLiveProject]);

  const switchToProjectFile = useCallback((fileId: string, options?: { line?: number }) => {
    if (!Object.prototype.hasOwnProperty.call(currentProject.files, fileId)) return;

    const activeSource = editorRef.current?.getValue() ?? currentDocument.source;
    const projectWithLatestActiveFile = withProjectFileSource(currentProject, activeFileId, activeSource);
    const nextSource = getProjectFileSource(projectWithLatestActiveFile, fileId);
    setCurrentProject(projectWithLatestActiveFile);
    setActiveFileId(fileId);
    resetBufferedSource(nextSource);
    setCurrentDocument((document) => ({
      ...document,
      filename: fileId,
      source: nextSource,
      updatedAt: Date.now(),
    }));
    setMobileDrawer(null);
    setMobileTab("code");
    if (!isMobile && focusedPanel !== null) {
      setFocusedPanel("code");
    }
    window.setTimeout(() => {
      editorRef.current?.layout();
      if (options?.line) {
        editorRef.current?.jumpToLine(options.line);
      }
    }, 0);
  }, [
    activeFileId,
    currentDocument.source,
    currentProject,
    focusedPanel,
    isMobile,
    resetBufferedSource,
  ]);

  const handleAddProjectFile = useCallback(() => {
    setIsAddProjectFileOpen(true);
  }, []);

  const handleConfirmAddProjectFile = useCallback((requestedPath: string) => {
    const normalizedPath = normalizeInkProjectPath(requestedPath.replace(/\.ink$/i, "") + ".ink");
    if (!normalizedPath) {
      toast({
        title: "Could not add file",
        description: "Use a project-relative Ink path like chapters/opening.ink.",
        variant: "destructive",
      });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(currentProject.files, normalizedPath)) {
      toast({
        title: "Could not add file",
        description: `${normalizedPath} already exists in this project.`,
        variant: "destructive",
      });
      return;
    }

    if (hasCaseInsensitiveInkProjectPathCollision([...Object.keys(currentProject.files), normalizedPath])) {
      toast({
        title: "Could not add file",
        description: `${normalizedPath} collides with an existing path on case-insensitive filesystems.`,
        variant: "destructive",
      });
      return;
    }

    const activeSource = editorRef.current?.getValue() ?? currentDocument.source;
    const projectWithLatestActiveFile = withProjectFileSource(currentProject, activeFileId, activeSource);
    const nextProject = {
      ...projectWithLatestActiveFile,
      files: {
        ...projectWithLatestActiveFile.files,
        [normalizedPath]: { content: "" },
      },
    };
    setCurrentProject(nextProject);
    setActiveFileId(normalizedPath);
    resetBufferedSource("");
    setCurrentDocument((document) => ({
      ...document,
      filename: normalizedPath,
      source: "",
      updatedAt: Date.now(),
    }));
    compileLive(getProjectCompileInput(nextProject));
    setIsAddProjectFileOpen(false);
    setIsProjectFilesCollapsed(false);
    setMobileTab("code");
    window.setTimeout(() => editorRef.current?.layout(), 0);
  }, [
    activeFileId,
    compileLive,
    currentDocument.source,
    currentProject,
    resetBufferedSource,
    toast,
  ]);

  const handleNavigateToKnot = useCallback((knotName: string) => {
    trackNavigatorUsed("knot");

    const liveProject = getLiveProject();
    for (const fileId of getSortedProjectFileIds(liveProject)) {
      const symbol = buildSymbolTable(getProjectFileSource(liveProject, fileId), fileId)
        .symbols
        .find((item) => item.path === knotName || item.name === knotName);
      if (symbol) {
        switchToProjectFile(fileId, { line: symbol.range.startLineNumber });
        break;
      }
    }
    
    // Also jump to knot in story preview if running
    if (isRunning) {
      jumpToKnot(knotName);
    }
  }, [getLiveProject, isRunning, jumpToKnot, switchToProjectFile]);

  const { exportInk, exportJson, exportHtml, isExporting } = useStoryExport({
    getSource: getCurrentSource,
    getCompileInput: () => getProjectCompileInput(getLiveProject()),
    title,
    author: currentDocument.author ?? "",
    filename: currentDocument.filename,
    compileStory: compileNow,
    onError: handleExportError,
  });

  const handleErrorClick = useCallback((error: EditorDiagnostic) => {
    const fileId = error.fileId ?? activeFileId;
    switchToProjectFile(fileId, { line: getEditorDiagnosticLine(error) });
  }, [activeFileId, switchToProjectFile]);

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
    if (updates.title) {
      setCurrentProject((project) => ({ ...project, name: updates.title ?? project.name }));
    }

    try {
      const projectForSettings = updates.title
        ? { ...currentProjectForSave, name: updates.title }
        : currentProjectForSave;
      const settingsFileName = hasMultipleProjectFiles
        ? getProjectExportName(projectForSettings)
        : nextDocument.filename;
      const settingsContent = hasMultipleProjectFiles
        ? JSON.stringify(projectForSettings, null, 2)
        : getCurrentSource();
      await FileOperations.saveFile(settingsFileName, settingsContent, {
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
  }, [
    currentDocument,
    currentProjectForSave,
    getCurrentSource,
    hasMultipleProjectFiles,
    setRecentFiles,
    toast,
  ]);

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
      buildSymbolTable(
        getProjectFileSource(currentProjectForSave, currentProjectForSave.entryFile),
        currentProjectForSave.entryFile,
      ),
    );
    return missingStartDiagnostic ? [missingStartDiagnostic] : [];
  }, [currentProjectForSave]);
  const projectSymbols = useMemo(() => (
    getSortedProjectFileIds(currentProjectForSave).flatMap((fileId) => (
      buildSymbolTable(getProjectFileSource(currentProjectForSave, fileId), fileId).symbols
    ))
  ), [currentProjectForSave]);
  const editorDiagnostics = useMemo<EditorDiagnostic[]>(() => ([
    ...errors.map((error) => adaptCompilerDiagnostic({
      ...error,
      source: "inkjs" as const,
      fileId: error.fileId ?? currentProject.entryFile,
    })),
    ...inkpadDiagnostics,
  ]), [currentProject.entryFile, errors, inkpadDiagnostics]);
  const errorCount = errors.filter(e => e.type === "error").length;
  const warningCount = errors.filter(e => e.type === "warning").length;
  const isPreviewStale = Boolean(
    runtimeState
    && lastRunSource !== null
    && getProjectFingerprint(currentProjectForSave) !== lastRunSource,
  );

  const handleErrorPanelOpened = useCallback(() => {
    trackErrorPanelOpened(errorCount + warningCount);
  }, [errorCount, warningCount]);

  const handlePanelLayoutChanged = useCallback((layout: PanelLayout) => {
    trackPanelLayoutChanged(layout);
  }, []);

  const handleMobileTabChanged = useCallback((tab: AnalyticsMobileTab) => {
    trackMobileTabChanged(tab);
  }, []);

  const projectFileIds = useMemo(() => getSortedProjectFileIds(currentProjectForSave), [currentProjectForSave]);
  const updateProjectFilesHandleDrag = useCallback((clientX: number) => {
    const drag = projectFilesHandleDragRef.current;
    if (!drag || drag.crossedThreshold) return;

    const deltaX = clientX - drag.startX;
    if (drag.startCollapsed && deltaX > PROJECT_FILES_DRAG_THRESHOLD) {
      drag.crossedThreshold = true;
      suppressProjectFilesHandleClickRef.current = true;
      setIsProjectFilesCollapsed(false);
    } else if (!drag.startCollapsed && deltaX < -PROJECT_FILES_DRAG_THRESHOLD) {
      drag.crossedThreshold = true;
      suppressProjectFilesHandleClickRef.current = true;
      setIsProjectFilesCollapsed(true);
    }
  }, []);

  const finishProjectFilesHandleDrag = useCallback(() => {
    const drag = projectFilesHandleDragRef.current;
    projectFilesHandleDragRef.current = null;
    projectFilesHandleCleanupRef.current?.();
    projectFilesHandleCleanupRef.current = null;

    if (drag?.crossedThreshold) {
      window.setTimeout(() => {
        suppressProjectFilesHandleClickRef.current = false;
      }, 0);
    }
  }, []);

  const beginProjectFilesHandleDrag = useCallback((startX: number, pointerId: number | null) => {
    projectFilesHandleCleanupRef.current?.();
    projectFilesHandleDragRef.current = {
      pointerId,
      startX,
      startCollapsed: isProjectFilesCollapsed,
      crossedThreshold: false,
    };
  }, [isProjectFilesCollapsed]);

  const handleProjectFilesHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    beginProjectFilesHandleDrag(event.clientX, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      const drag = projectFilesHandleDragRef.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;
      updateProjectFilesHandleDrag(moveEvent.clientX);
    };
    const handleWindowPointerEnd = (endEvent: PointerEvent) => {
      const drag = projectFilesHandleDragRef.current;
      if (!drag || drag.pointerId !== endEvent.pointerId) return;
      finishProjectFilesHandleDrag();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
    projectFilesHandleCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  }, [beginProjectFilesHandleDrag, finishProjectFilesHandleDrag, updateProjectFilesHandleDrag]);

  const handleProjectFilesHandlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = projectFilesHandleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateProjectFilesHandleDrag(event.clientX);
  }, [updateProjectFilesHandleDrag]);

  const handleProjectFilesHandlePointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = projectFilesHandleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishProjectFilesHandleDrag();
  }, [finishProjectFilesHandleDrag]);

  const handleProjectFilesHandleMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || projectFilesHandleDragRef.current) return;

    beginProjectFilesHandleDrag(event.clientX, null);
    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      updateProjectFilesHandleDrag(moveEvent.clientX);
    };
    const handleWindowMouseEnd = () => {
      finishProjectFilesHandleDrag();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseEnd);
    projectFilesHandleCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseEnd);
    };
  }, [beginProjectFilesHandleDrag, finishProjectFilesHandleDrag, updateProjectFilesHandleDrag]);

  const handleProjectFilesHandleClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressProjectFilesHandleClickRef.current) {
      event.preventDefault();
      suppressProjectFilesHandleClickRef.current = false;
      return;
    }

    setIsProjectFilesCollapsed((collapsed) => !collapsed);
  }, []);

  const projectNewMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${isMobile ? "h-8 w-8 rounded-md border border-border-color/70 bg-editor-bg/70" : isProjectFilesCollapsed ? "h-8 w-8" : "h-7 w-7"} p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis`}
          aria-label="New file or project"
        >
          <FilePlus2 className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 border-border-color bg-panel-bg">
        <DropdownMenuItem onClick={handleAddProjectFile} className="cursor-pointer">
          <FilePlus2 className="h-4 w-4" />
          New ink file
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNew} className="cursor-pointer">
          <File className="h-4 w-4" />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const mobileCodeTabLabel = projectFileIds.length > 1 ? (
    <span className="font-mono text-[0.75rem]">{activeFileId}</span>
  ) : (
    "Code"
  );
  const mobileCodeTabMenu = (
    <DropdownMenuContent align="end" className="w-64 border-border-color bg-panel-bg">
      {projectFileIds.length > 1 && projectFileIds.map((fileId) => {
        const isActive = fileId === activeFileId;
        const isEntry = fileId === currentProject.entryFile;
        return (
          <DropdownMenuItem
            key={fileId}
            onClick={() => switchToProjectFile(fileId)}
            className="cursor-pointer"
            aria-current={isActive ? "page" : undefined}
          >
            <FileText className={isEntry ? "text-accent-blue" : "text-text-secondary"} />
            <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{fileId}</span>
            {isActive && (
              <span className="text-[0.75rem] text-text-secondary">Current</span>
            )}
          </DropdownMenuItem>
        );
      })}
      {projectFileIds.length > 1 && (
        <DropdownMenuSeparator className="bg-border-color" />
      )}
      <DropdownMenuItem onClick={handleAddProjectFile} className="cursor-pointer">
        <FilePlus2 className="h-4 w-4" />
        New ink file
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleNew} className="cursor-pointer">
        <File className="h-4 w-4" />
        New project
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
  const projectFilesPane = (
    <aside className={`${isProjectFilesCollapsed ? "flex w-11 flex-col items-center" : "flex w-56 flex-col"} relative shrink-0 border-border-color bg-panel-bg`}>
      <button
        type="button"
        onPointerDown={handleProjectFilesHandlePointerDown}
        onPointerMove={handleProjectFilesHandlePointerMove}
        onPointerUp={handleProjectFilesHandlePointerEnd}
        onPointerCancel={handleProjectFilesHandlePointerEnd}
        onMouseDown={handleProjectFilesHandleMouseDown}
        onClick={handleProjectFilesHandleClick}
        aria-label={isProjectFilesCollapsed ? "Project files divider: drag or click to show files" : "Project files divider: drag or click to hide files"}
        aria-expanded={!isProjectFilesCollapsed}
        className="group absolute inset-y-0 -right-1 z-20 flex w-2 touch-none cursor-col-resize items-stretch justify-center bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
      >
        <span className="h-full w-px bg-border-color transition-colors group-hover:bg-accent-blue group-focus-visible:bg-accent-blue" aria-hidden="true" />
      </button>
      {!isMobile && isProjectFilesCollapsed && (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 px-1.5 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsProjectFilesCollapsed(false)}
                className="h-8 w-8 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis"
                aria-label="Show project files"
                aria-expanded={false}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Show project files</TooltipContent>
          </Tooltip>
          {projectNewMenu}
        </div>
      )}
      {!isMobile && (
        <div className={`${isProjectFilesCollapsed ? "hidden" : "flex"} h-11 shrink-0 items-center justify-between gap-2 border-b border-border-color px-3 pr-4`}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Files
            </span>
            <span className="rounded-sm bg-editor-bg px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums leading-none text-text-secondary">
              {projectFileCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {projectNewMenu}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsProjectFilesCollapsed(true)}
                  className="h-7 w-7 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis"
                  aria-label="Hide project files"
                  aria-expanded={true}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Hide project files</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      <div className={`${isProjectFilesCollapsed ? "hidden" : "min-h-0 flex-1 overflow-auto p-1.5 pr-2.5"}`}>
        {projectFileIds.map((fileId) => {
          const isActive = fileId === activeFileId;
          const isEntry = fileId === currentProject.entryFile;
          return (
            <button
              key={fileId}
              type="button"
              onClick={() => switchToProjectFile(fileId)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "mb-0.5 flex min-w-0 w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-[0.8125rem] text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg",
                "hover:border-border-color hover:bg-accent hover:text-text-emphasis",
                isActive && "border-accent-blue bg-accent text-text-emphasis hover:border-accent-blue",
              )}
            >
              <FileText className={cn(
                "h-3.5 w-3.5 shrink-0",
                isActive || isEntry ? "text-accent-blue" : "text-text-secondary",
              )} />
              <span className={cn("truncate font-mono", isActive && "font-medium")}>{fileId}</span>
              {isActive && <span className="sr-only">Current file</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );

  const editorPane = (
    <div className={`${isMobile ? "flex-col" : "flex-row"} flex h-full min-h-0 bg-editor-bg`}>
      {!isMobile && projectFilesPane}
      <div className="min-h-0 min-w-0 flex-1">
        <CodeEditorPane
          editorRef={editorRef}
          value={currentDocument.source}
          onChange={handleSourceChange}
          onControlStateChange={setEditorControlState}
          errors={editorDiagnostics}
          symbols={projectSymbols}
          fileId={activeFileId}
          documentId={`${currentProject.id}:${activeFileId}`}
          fileName={activeFileId}
          isMobileLayout={isMobile}
          showHeader={!isMobile && focusedPanel === null}
          fontSize={preferences.editorFontSize}
          wordWrap={preferences.wordWrap}
          saveState={autosave.saveState}
          isPhone={isMobile}
          isVisible={!isMobile || mobileTab === "code"}
        />
      </div>
    </div>
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
    <main
      className="flex h-dvh flex-col bg-editor-bg text-text-primary"
      style={mobileKeyboardInset > 0 ? { height: `calc(100dvh - ${mobileKeyboardInset}px)` } : undefined}
    >
      <TopMenu
        title={title}
        knots={knots}
        onNew={handleNew}
        onNewFile={handleAddProjectFile}
        onOpen={handleOpenFromDisk}
        recentFiles={recentFiles}
        currentFileName={currentDocument.filename}
        currentSaveFileName={localSaveFileName}
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
        onExportProject={handleExportProject}
        onExportJson={exportJson}
        resolvedTheme={resolvedExportTheme}
        resolvedFromSystem={resolvedFromSystem}
        onExportHtml={handleHtmlExport}
        onSetFileTheme={handleSetFileTheme}
        onStoryTypefaceChange={handleStoryTypefaceChange}
        isExporting={isExporting}
        hasMultipleFiles={hasMultipleProjectFiles}
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
        extension={getFileActionExtension()}
        onOpenChange={(open) => {
          if (!open) {
            setFileAction(null);
          }
        }}
        onConfirm={handleConfirmFileAction}
      />

      <FileActionDialog
        mode={isAddProjectFileOpen ? "add-file" : null}
        initialName="chapter"
        extension=".ink"
        onOpenChange={setIsAddProjectFileOpen}
        onConfirm={handleConfirmAddProjectFile}
      />

      <LocalSavesDialog
        open={isLocalSavesOpen}
        files={recentFiles}
        currentFileName={localSaveFileName}
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
        mobileCodeTabLabel={mobileCodeTabLabel}
        mobileCodeTabMenu={mobileCodeTabMenu}
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
