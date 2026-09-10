import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Ref } from "react";
import { TopMenu } from "@/components/editor/top-menu";
import type {
  CodeMirrorEditorHandle,
  CodeMirrorEditorControlState,
  CodeMirrorEditorProps,
} from "@/components/editor/codemirror-editor";
import { StoryPreview } from "@/components/editor/story-preview";
import { ErrorPanel } from "@/components/editor/error-panel";
import { VariableInspector } from "@/components/editor/variable-inspector";
import {
  ProjectFilesPane,
  PROJECT_FILES_DEFAULT_WIDTH,
} from "@/components/editor/project-files-pane";
import {
  EditorWorkspace,
  type DesktopBottomPanelHandle,
  type FocusedPanel,
  type MobileDrawer,
  type MobileTab,
} from "@/components/editor/editor-workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileKeyboardInset } from "@/hooks/use-mobile-keyboard-inset";
import { usePreferences } from "@/components/preferences-provider";
import { SAMPLE_STORY } from "@/data/sample-story";
import { FileOperations } from "@/lib/file-operations";
import { getDisplayTitleFromFilename, getFilename, replaceFilenameExtension } from "@/lib/filename-utils";
import { createInkDocumentId } from "@/lib/ink-document-id";
import { cn } from "@/lib/utils";
import { useStoryExport } from "@/features/export/useStoryExport";
import { AlertTriangle, Copy, File, FilePlus2, FileText, Lock, Trash2, X } from "lucide-react";
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
import { findTopLevelTagLine, parseTagsFromSource, setTopLevelTag, removeTopLevelTag } from "@/lib/ink-source-tags";
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
import { getEditorDiagnosticLine, getEditorDiagnosticSeverity } from "@/types/editor-diagnostic";
import {
  createSingleFileProject,
  deleteProjectFile,
  duplicateProjectFile,
  getProjectStorageName,
  parseInkProject,
  pinProjectName,
  projectToCompileInput,
  reconcileProjectNaming,
  renameProjectFile,
} from "@/lib/ink-project";
import { normalizeInkProjectFilePath } from "@/lib/ink-project-paths";

const LazyCodeMirrorEditor = lazy(() =>
  loadCodeMirrorEditor().then((module) => ({
    default: module.CodeMirrorEditor,
  })),
);

const LazySettingsSheet = lazy(() =>
  import("@/components/editor/settings-sheet").then((module) => ({
    default: module.SettingsSheet,
  })),
);

const LazyFileActionDialog = lazy(() =>
  import("@/components/editor/file-action-dialog").then((module) => ({
    default: module.FileActionDialog,
  })),
);

const LazyLocalSavesDialog = lazy(() =>
  import("@/components/editor/local-saves-dialog").then((module) => ({
    default: module.LocalSavesDialog,
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
  project: InkProject;
  activeFileId: string;
  /** The localStorage key the loaded save lives under (used to clean up on renames). */
  storageKey: string;
  recoveredAt: number | null;
}

function createProjectFromDocument(document: InkDocument): InkProject {
  return createSingleFileProject({
    id: document.id,
    name: document.title ?? getDisplayTitleFromFilename(document.filename),
    fileName: document.filename,
    content: document.source,
    explicit: document.namingExplicit ?? true,
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
  const baseName = (project.exportNameBase || project.name || project.entryFile.replace(/\.ink$/i, "")).trim();
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
          storageKey: startupFile.name,
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
        storageKey: startupFile.name,
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
    namingExplicit: false,
    author: "",
    previewMode: "transcript",
  };

  return {
    document,
    project: createProjectFromDocument(document),
    activeFileId: document.filename,
    storageKey: document.filename,
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
  // Identity of the open editor buffer. Bumped when the user switches files or
  // loads another save (resets undo history/diagnostics), but NOT when the open
  // file is merely renamed — a rename keeps the same buffer.
  const [editorBufferKey, setEditorBufferKey] = useState(0);
  // Set false for one editor remount so an inline file rename keeps focus instead of the editor.
  const editorAutoFocusRef = useRef(true);
  // The localStorage key the current project was last saved under. When naming
  // changes move the storage name, the save path renames instead of leaving a
  // ghost entry behind.
  const lastStorageKeyRef = useRef(startupStateRef.current.storageKey);
  const [isProjectFilesCollapsed, setIsProjectFilesCollapsed] = useState(() => (
    Object.keys(startupStateRef.current?.project.files ?? {}).length <= 1
  ));
  const [projectFilesPaneWidth, setProjectFilesPaneWidth] = useState(PROJECT_FILES_DEFAULT_WIDTH);
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
  const [inlineRenameRequest, setInlineRenameRequest] = useState<{ fileId: string; key: number } | null>(null);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<string | null>(null);
  const [lastRunSource, setLastRunSource] = useState<string | null>(null);
  const [storySessionKey, setStorySessionKey] = useState(0);
  const [editorControlState, setEditorControlState] = useState<CodeMirrorEditorControlState>({
    canUndo: false,
    canRedo: false,
    isFindVisible: false,
  });

  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const desktopBottomPanelRef = useRef<DesktopBottomPanelHandle>(null);
  const previousProjectIdRef = useRef(currentProject.id);
  const isMobile = useIsMobile();
  const mobileKeyboardInset = useMobileKeyboardInset(isMobile);

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
    setEditorBufferKey((key) => key + 1);
    // A rebuilt project means another save was opened (or created); its
    // storage key is the document's own filename until the next save.
    lastStorageKeyRef.current = currentDocument.filename;
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
  // Every local save stores the full InkProject model as JSON — a one-file
  // story is just a one-file project. The storage key is the entry file for
  // one-file projects and the project export name for multi-file ones.
  const localSaveFileName = getProjectStorageName(currentProjectForSave);
  const localSaveContent = useMemo(
    () => JSON.stringify(currentProjectForSave, null, 2),
    [currentProjectForSave],
  );
  const getCurrentSaveFileForAction = useCallback(() => {
    const activeSource = getCurrentSource();
    const projectForAction = withProjectFileSource(currentProject, activeFileId, activeSource);
    return {
      filename: getProjectStorageName(projectForAction),
      content: JSON.stringify(projectForAction, null, 2),
    };
  }, [activeFileId, currentProject, getCurrentSource]);

  useEffect(() => {
    if (previousProjectIdRef.current === currentProject.id) {
      return;
    }

    previousProjectIdRef.current = currentProject.id;
    setIsProjectFilesCollapsed(projectFileCount <= 1);
  }, [currentProject.id, projectFileCount]);

  // Rename-aware save core: when the computed storage key has moved (a title
  // tag auto-followed into a new file name, or the project was renamed), the
  // save is a storage-key rename — write the new key, retire the old one —
  // so Local Saves never accumulates ghost entries.
  const persistSaveContent = useCallback(async (
    filename: string,
    content: string,
    settings: {
      title?: string;
      author?: string;
      htmlExport?: InkDocument["htmlExport"];
      storyTypeface?: InkDocument["storyTypeface"];
      previewMode?: PreviewMode;
    },
  ) => {
    const previousKey = lastStorageKeyRef.current;
    await FileOperations.saveFile(filename, content, settings);
    if (previousKey && previousKey !== filename && FileOperations.fileExists(previousKey)) {
      FileOperations.deleteFile(previousKey);
      FileOperations.clearRecoveryDraft(previousKey);
    }
    lastStorageKeyRef.current = filename;
    cancelPendingRecoveryDraft();
    FileOperations.clearRecoveryDraft(currentDocument.filename);
    if (filename !== currentDocument.filename) {
      FileOperations.clearRecoveryDraft(filename);
    }
    setRecoveredAt(null);
    setIsRecoveryBannerDismissed(false);
    setRecentFiles(FileOperations.getAllFiles());
  }, [cancelPendingRecoveryDraft, currentDocument.filename, setRecentFiles]);

  // Autosave system
  const autosave = useAutosave({
    fileName: localSaveFileName,
    content: localSaveContent,
    enabled: storageAvailable,
    onSave: async (filename, source) => {
      await persistSaveContent(filename, source, {
        title: currentDocument.title,
        author: currentDocument.author,
        htmlExport: currentDocument.htmlExport,
        storyTypeface: currentDocument.storyTypeface,
        previewMode: currentDocument.previewMode,
      });
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
    setEditorBufferKey((key) => key + 1);
    lastStorageKeyRef.current = file.name;
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

  const getLiveProject = useCallback(() => {
    const activeSource = editorRef.current?.getValue() ?? currentDocument.source;
    return withProjectFileSource(currentProject, activeFileId, activeSource);
  }, [activeFileId, currentDocument.source, currentProject]);

  // One save path for every project size: serialize the given project and save
  // it under its computed storage key (rename-aware via persistSaveContent).
  const persistProject = useCallback(async (project: InkProject, showToast: boolean): Promise<boolean> => {
    const filename = getProjectStorageName(project);
    const content = JSON.stringify(project, null, 2);
    try {
      await persistSaveContent(filename, content, {
        title: currentDocument.title,
        author: currentDocument.author,
        htmlExport: currentDocument.htmlExport,
        storyTypeface: currentDocument.storyTypeface,
        previewMode: currentDocument.previewMode,
      });
      setCurrentProject(project);
      setCurrentDocument((document) => ({
        ...document,
        updatedAt: Date.now(),
        lastSavedAt: Date.now(),
      }));
      autosave.markSaved(filename, content);
      if (showToast) {
        toast.success(`Saved ${filename}`);
      }
      return true;
    } catch (error) {
      toast.error("Save failed", {
        id: "save-error",
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }, [
    autosave,
    currentDocument.author,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    currentDocument.title,
    persistSaveContent,
  ]);

  const persistProjectNow = useCallback(
    (showToast = false) => persistProject(getLiveProject(), showToast),
    [getLiveProject, persistProject],
  );

  // Renames a file inside the project: rekeys the files map, rewrites INCLUDE
  // references, updates the open buffer/active file if affected, and persists.
  // Renaming the entry file pins it against further name auto-follow.
  const handleRenameProjectFileById = useCallback(async (fileId: string, requestedName: string) => {
    const live = getLiveProject();
    if (!Object.prototype.hasOwnProperty.call(live.files, fileId)) {
      throw new Error(`${fileId} is not part of this project.`);
    }

    const requested = normalizeInkProjectFilePath(requestedName);
    if (!requested) {
      throw new Error(`${requestedName} is not a valid project file path.`);
    }
    const isSingleFile = Object.keys(live.files).length === 1;
    // For a one-file project the file name is also the local-save key, so it
    // must not collide with another save.
    const target = isSingleFile
      ? FileOperations.getAvailableFileName(requested, fileId)
      : requested;
    if (target === fileId) {
      return { nextFilename: fileId, sourceName: fileId };
    }

    const next = renameProjectFile(live, fileId, target);
    if (next === live) {
      throw new Error(`${requestedName} is not a valid project file name.`);
    }
    const nextFilename = Object.keys(next.files)
      .find((name) => !Object.prototype.hasOwnProperty.call(live.files, name)) ?? target;

    setCurrentProject(next);
    const activeAfter = fileId === activeFileId ? nextFilename : activeFileId;
    if (fileId === activeFileId) {
      setActiveFileId(nextFilename);
      setCurrentDocument((document) => ({ ...document, filename: nextFilename, updatedAt: Date.now() }));
    }

    // INCLUDE rewrites may have touched the open buffer.
    const activeSourceBefore = live.files[activeFileId].content;
    const activeSourceAfter = next.files[activeAfter].content;
    if (activeSourceAfter !== activeSourceBefore) {
      if (editorRef.current) {
        const change = getSingleTextChange(activeSourceBefore, activeSourceAfter);
        editorRef.current.replaceRange(change.from, change.to, change.insert, "input.rename");
      } else {
        resetBufferedSource(activeSourceAfter);
        setCurrentDocument((document) => ({ ...document, source: activeSourceAfter, updatedAt: Date.now() }));
      }
    }

    FileOperations.clearRecoveryDraft(fileId);
    await persistProject(next, false);
    return { nextFilename, sourceName: fileId };
  }, [activeFileId, getLiveProject, persistProject, resetBufferedSource]);

  const renameActiveDocumentInProject = useCallback(
    (requestedName: string) => handleRenameProjectFileById(activeFileId, requestedName),
    [activeFileId, handleRenameProjectFileById],
  );

  const handleInlineProjectFileRename = useCallback(async (fileId: string, requestedName: string) => {
    try {
      await handleRenameProjectFileById(fileId, requestedName);
    } catch (error) {
      toast.error("Rename failed", { description: error instanceof Error ? error.message : "Unknown error" });
      throw error;
    }
  }, [handleRenameProjectFileById]);


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
    handleDeleteLocalFiles,
    handleConfirmDeleteLocalFile,
  } = useEditorDocumentActions({
    currentDocument,
    setCurrentDocument,
    setRecentFiles,
    applyLoadedProjectFile,
    currentSaveFileName: localSaveFileName,
    getCurrentSaveFile: getCurrentSaveFileForAction,
    persistCurrentSave: persistProjectNow,
    renameActiveDocument: renameActiveDocumentInProject,
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
    toast.error(message, { description: error instanceof Error ? error.message : "Unknown error" });
  }, []);

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

  const handleSave = useCallback(async () => {
    await persistProjectNow(true);
  }, [persistProjectNow]);

  const exportProjectArchive = useCallback(async (extension: ".inkpad" | ".zip") => {
    const project = getLiveProject();
    const [{ createInkPadBundleBlob }, { downloadBlob }] = await Promise.all([
      import("@/lib/inkpad-bundle"),
      import("@/features/files/fileDownload"),
    ]);
    const blob = await createInkPadBundleBlob(project, {
      title: currentDocument.title,
      author: currentDocument.author,
      htmlExport: currentDocument.htmlExport,
      storyTypeface: currentDocument.storyTypeface,
      previewMode: currentDocument.previewMode,
    });
    const inkpadName = getProjectExportName(project);
    downloadBlob(
      blob,
      extension === ".zip" ? replaceFilenameExtension(inkpadName, ".zip") : inkpadName,
    );
  }, [
    currentDocument.author,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    currentDocument.title,
    getLiveProject,
  ]);

  const handleExportProject = useCallback(async () => {
    try {
      await exportProjectArchive(".inkpad");
    } catch (error) {
      handleExportError("Failed to export InkPad project", error);
    }
  }, [exportProjectArchive, handleExportError]);

  const handleExportProjectZip = useCallback(async () => {
    try {
      await exportProjectArchive(".zip");
    } catch (error) {
      handleExportError("Failed to export project ZIP", error);
    }
  }, [exportProjectArchive, handleExportError]);

  const switchToProjectFile = useCallback((fileId: string, options?: { line?: number }) => {
    if (!Object.prototype.hasOwnProperty.call(currentProject.files, fileId)) return;

    const activeSource = editorRef.current?.getValue() ?? currentDocument.source;
    const projectWithLatestActiveFile = withProjectFileSource(currentProject, activeFileId, activeSource);
    const nextSource = getProjectFileSource(projectWithLatestActiveFile, fileId);
    setCurrentProject(projectWithLatestActiveFile);
    setActiveFileId(fileId);
    setEditorBufferKey((key) => key + 1);
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

  // ── Naming fan-out: # title: tag → project name → {entry file, export name} ──
  // Story Title resolves from the entry file's own source (not compiled
  // globalTags, which can splice in tags from INCLUDEd files).
  const entryFileSource = activeFileId === currentProject.entryFile
    ? currentDocument.source
    : getProjectFileSource(currentProject, currentProject.entryFile);
  const sourceTagTitle = useMemo(
    () => parseTagsFromSource(entryFileSource).metadata.title,
    [entryFileSource],
  );
  const resolvedStoryTitle = useMemo(() => resolveMetadata(
    parseTagsFromSource(entryFileSource),
    { title: currentDocument.title, author: currentDocument.author ?? null },
    currentProject.entryFile,
  ).title, [currentDocument.author, currentDocument.title, currentProject.entryFile, entryFileSource]);

  // Name and export name follow the title tag immediately (no editor impact).
  useEffect(() => {
    if (!sourceTagTitle) return;
    setCurrentProject((project) => reconcileProjectNaming(project, sourceTagTitle, { renameEntryFile: false }));
  }, [sourceTagTitle]);

  // The entry-file rename leg is debounced: renaming mid-keystroke would churn
  // the storage key while the user is still typing the title tag.
  const applyEntryFileFollow = useCallback(() => {
    const live = getLiveProject();
    const next = reconcileProjectNaming(live, sourceTagTitle ?? "");
    if (next === live || next.entryFile === live.entryFile) return;
    try {
      // The entry file name doubles as the local-save key for one-file
      // projects; if another save already owns the derived name, leave the
      // file alone rather than inventing a variant the user never chose.
      if (FileOperations.getAvailableFileName(next.entryFile, live.entryFile) !== next.entryFile) return;
    } catch {
      // Storage unavailable — rename in memory only.
    }
    const previousEntryFile = live.entryFile;
    setCurrentProject(next);
    setActiveFileId(next.entryFile);
    setCurrentDocument((document) => ({ ...document, filename: next.entryFile, updatedAt: Date.now() }));
    FileOperations.clearRecoveryDraft(previousEntryFile);
  }, [getLiveProject, sourceTagTitle]);

  useEffect(() => {
    const wouldRename = reconcileProjectNaming(currentProject, sourceTagTitle ?? "");
    if (wouldRename === currentProject || wouldRename.entryFile === currentProject.entryFile) return;
    const timer = window.setTimeout(applyEntryFileFollow, 1200);
    return () => window.clearTimeout(timer);
  }, [applyEntryFileFollow, currentProject, sourceTagTitle]);

  // Explicit project rename from the topbar: pins the name, fans out to the
  // file/export names immediately (a deliberate action, nothing to debounce).
  const handleProjectNameChange = useCallback((requestedName: string) => {
    const trimmed = requestedName.trim();
    if (!trimmed) return;
    const live = getLiveProject();
    const pinned = pinProjectName(live, trimmed);
    let next = reconcileProjectNaming(pinned, "");
    if (next.entryFile !== live.entryFile) {
      try {
        if (FileOperations.getAvailableFileName(next.entryFile, live.entryFile) !== next.entryFile) {
          next = reconcileProjectNaming(pinned, "", { renameEntryFile: false });
        }
      } catch {
        // Storage unavailable — keep the in-memory rename.
      }
    }
    const previousEntryFile = live.entryFile;
    setCurrentProject(next);
    if (next.entryFile !== previousEntryFile) {
      setActiveFileId(next.entryFile);
      setCurrentDocument((document) => ({ ...document, filename: next.entryFile, updatedAt: Date.now() }));
      FileOperations.clearRecoveryDraft(previousEntryFile);
    }
    void persistProject(next, false);
  }, [getLiveProject, persistProject]);

  const handleRenameManagedProject = useCallback(async (fileName: string, requestedName: string) => {
    const trimmed = requestedName.trim();
    if (!trimmed) {
      throw new Error("Project name cannot be empty.");
    }

    if (fileName === localSaveFileName) {
      const live = getLiveProject();
      const pinned = pinProjectName(live, trimmed);
      let next = reconcileProjectNaming(pinned, "");
      const nextStorageName = getProjectStorageName(next);
      if (FileOperations.getAvailableFileName(nextStorageName, fileName) !== nextStorageName) {
        throw new Error(`${nextStorageName} already exists.`);
      }

      const previousEntryFile = live.entryFile;
      const content = JSON.stringify(next, null, 2);
      await persistSaveContent(nextStorageName, content, {
        title: trimmed,
        author: currentDocument.author,
        htmlExport: currentDocument.htmlExport,
        storyTypeface: currentDocument.storyTypeface,
        previewMode: currentDocument.previewMode,
      });
      setCurrentProject(next);
      if (next.entryFile !== previousEntryFile) {
        setActiveFileId(next.entryFile);
        setCurrentDocument((document) => ({
          ...document,
          filename: next.entryFile,
          title: trimmed,
          updatedAt: Date.now(),
          lastSavedAt: Date.now(),
        }));
        FileOperations.clearRecoveryDraft(previousEntryFile);
      } else {
        setCurrentDocument((document) => ({
          ...document,
          title: trimmed,
          updatedAt: Date.now(),
          lastSavedAt: Date.now(),
        }));
      }
      autosave.markSaved(nextStorageName, content);
      return;
    }

    const stored = FileOperations.loadFile(fileName);
    if (!stored) {
      throw new Error(`${fileName} is no longer available.`);
    }

    const storedProject = tryParseStoredProject(stored.content);
    if (storedProject) {
      const nextProject = reconcileProjectNaming(pinProjectName(storedProject, trimmed), "");
      const nextStorageName = getProjectStorageName(nextProject);
      if (FileOperations.getAvailableFileName(nextStorageName, fileName) !== nextStorageName) {
        throw new Error(`${nextStorageName} already exists.`);
      }
      await FileOperations.saveFile(nextStorageName, JSON.stringify(nextProject, null, 2), {
        ...stored.settings,
        title: trimmed,
      });
      if (nextStorageName !== fileName) {
        FileOperations.deleteFile(fileName);
      }
      setRecentFiles(FileOperations.getAllFiles());
      return;
    }

    const extension = fileName.toLowerCase().endsWith(".inkpad") ? ".inkpad" : ".ink";
    const nextFileName = getFilename(trimmed, extension);
    if (FileOperations.getAvailableFileName(nextFileName, fileName) !== nextFileName) {
      throw new Error(`${nextFileName} already exists.`);
    }
    const renamed = await FileOperations.renameFile(fileName, nextFileName, true);
    if (!renamed) {
      throw new Error(`${fileName} could not be renamed.`);
    }
    const renamedFile = FileOperations.loadFile(nextFileName);
    if (renamedFile) {
      await FileOperations.saveFile(nextFileName, renamedFile.content, {
        ...renamedFile.settings,
        title: trimmed,
      });
    }
    setRecentFiles(FileOperations.getAllFiles());
  }, [
    autosave,
    currentDocument.author,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    getLiveProject,
    localSaveFileName,
    persistSaveContent,
    setRecentFiles,
  ]);

  const requestInlineProjectFileRename = useCallback((fileId: string) => {
    setInlineRenameRequest((request) => ({
      fileId,
      key: (request?.key ?? 0) + 1,
    }));
  }, []);

  const handleAddProjectFile = useCallback(() => {
    const existingPaths = Object.keys(currentProject.files);
    const existingLower = new Set(existingPaths.map((path) => path.toLowerCase()));
    let normalizedPath = "untitled.ink";
    for (let index = 2; existingLower.has(normalizedPath.toLowerCase()); index += 1) {
      normalizedPath = `untitled-${index}.ink`;
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
    editorAutoFocusRef.current = false;
    setEditorBufferKey((key) => key + 1);
    resetBufferedSource("");
    setCurrentDocument((document) => ({
      ...document,
      filename: normalizedPath,
      source: "",
      updatedAt: Date.now(),
    }));
    compileLive(getProjectCompileInput(nextProject));
    setIsProjectFilesCollapsed(false);
    setMobileTab("code");
    window.setTimeout(() => {
      editorRef.current?.layout();
      editorAutoFocusRef.current = true;
      requestInlineProjectFileRename(normalizedPath);
    }, 0);
  }, [
    activeFileId,
    compileLive,
    currentDocument.source,
    currentProject,
    requestInlineProjectFileRename,
    resetBufferedSource,
  ]);

  const handleDuplicateProjectFile = useCallback(async (fileId: string) => {
    const live = getLiveProject();
    if (!Object.prototype.hasOwnProperty.call(live.files, fileId)) {
      toast.error("Duplicate failed", { description: `${fileId} is not part of this project.` });
      return;
    }

    const nextProject = duplicateProjectFile(live, fileId);
    const newFileId = Object.keys(nextProject.files)
      .find((name) => !Object.prototype.hasOwnProperty.call(live.files, name));
    if (!newFileId) {
      toast.error("Duplicate failed", { description: `${fileId} could not be duplicated.` });
      return;
    }

    const nextSource = getProjectFileSource(nextProject, newFileId);
    setCurrentProject(nextProject);
    setActiveFileId(newFileId);
    setEditorBufferKey((key) => key + 1);
    resetBufferedSource(nextSource);
    setCurrentDocument((document) => ({
      ...document,
      filename: newFileId,
      source: nextSource,
      updatedAt: Date.now(),
    }));
    compileLive(getProjectCompileInput(nextProject));
    setIsProjectFilesCollapsed(false);
    setMobileTab("code");
    window.setTimeout(() => editorRef.current?.layout(), 0);
    await persistProject(nextProject, false);
  }, [
    compileLive,
    getLiveProject,
    persistProject,
    resetBufferedSource,
  ]);

  const handleRequestDeleteProjectFile = useCallback((fileId: string) => {
    const live = getLiveProject();
    if (fileId === live.entryFile) {
      toast.error("Entry file cannot be deleted", { description: "Rename or edit the entry file instead, or delete another project file." });
      return;
    }
    if (Object.keys(live.files).length <= 1) {
      toast.error("File cannot be deleted", { description: "A project needs at least one Ink file." });
      return;
    }
    setProjectDeleteTarget(fileId);
  }, [getLiveProject]);

  const handleConfirmDeleteProjectFile = useCallback(async () => {
    if (!projectDeleteTarget) return;

    const fileId = projectDeleteTarget;
    const live = getLiveProject();
    const nextProject = deleteProjectFile(live, fileId);
    if (nextProject === live) {
      setProjectDeleteTarget(null);
      toast.error("Delete failed", {
        description: fileId === live.entryFile
          ? "The project entry file cannot be deleted."
          : `${fileId} could not be deleted.`,
      });
      return;
    }

    const nextActiveFileId = fileId === activeFileId
      ? nextProject.entryFile
      : activeFileId;
    const nextSource = getProjectFileSource(nextProject, nextActiveFileId);

    setProjectDeleteTarget(null);
    setCurrentProject(nextProject);
    setActiveFileId(nextActiveFileId);
    if (nextActiveFileId !== activeFileId) {
      setEditorBufferKey((key) => key + 1);
    }
    resetBufferedSource(nextSource);
    setCurrentDocument((document) => ({
      ...document,
      filename: nextActiveFileId,
      source: nextSource,
      updatedAt: Date.now(),
    }));
    FileOperations.clearRecoveryDraft(fileId);
    compileLive(getProjectCompileInput(nextProject));
    await persistProject(nextProject, false);
  }, [
    activeFileId,
    compileLive,
    getLiveProject,
    persistProject,
    projectDeleteTarget,
    resetBufferedSource,
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

  // Story settings (stored title fallback, author, export options). Never
  // touches the project name — that's the topbar's job, and the two are
  // independent now.
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
      const project = getLiveProject();
      const settingsFileName = getProjectStorageName(project);
      const settingsContent = JSON.stringify(project, null, 2);
      await persistSaveContent(settingsFileName, settingsContent, {
        title: nextDocument.title,
        author: nextDocument.author,
        htmlExport: nextDocument.htmlExport,
        storyTypeface: nextDocument.storyTypeface,
        previewMode: nextDocument.previewMode,
      });
      autosave.markSaved(settingsFileName, settingsContent);
    } catch (error) {
      toast.error("Could not save story settings", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  }, [
    autosave,
    currentDocument,
    getLiveProject,
    persistSaveContent,
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

  const storyMetadata = resolveMetadata(
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

  const handleViewProblems = useCallback(() => {
    if (isMobile) {
      setMobileTab("code");
      setMobileDrawer("problems");
    } else {
      if (focusedPanel !== null) {
        setFocusedPanel("code");
      }
      if ((desktopBottomPanelRef.current?.getSize() ?? 25) < 25) {
        desktopBottomPanelRef.current?.resize(25);
      }
    }
    const firstError = editorDiagnostics.find((d) => getEditorDiagnosticSeverity(d) === "error");
    if (firstError) {
      handleErrorClick(firstError);
    }
  }, [editorDiagnostics, focusedPanel, handleErrorClick, isMobile]);

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
  const mobileCodeTabLabel = projectFileIds.length > 1 ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 leading-none">Code</span>
      <span className="shrink-0 text-[0.75rem] leading-none text-text-secondary">·</span>
      <span className="min-w-0 truncate text-[0.75rem] leading-none text-text-secondary">
        {activeFileId}
      </span>
    </span>
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
            <FileText className={isActive ? "text-accent-blue" : "text-text-secondary"} />
            <span className={cn(
              "min-w-0 flex-1 truncate font-sans text-[0.8125rem] leading-5 text-text-primary",
              isActive && "font-medium text-text-emphasis",
            )}>
              {fileId}
            </span>
            {isActive && (
              <span className="text-[0.6875rem] font-medium leading-none text-text-secondary">Current</span>
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
      {projectFileIds.length > 0 && (
        <>
          <DropdownMenuSeparator className="bg-border-color" />
          <DropdownMenuItem onClick={() => handleDuplicateProjectFile(activeFileId)} className="cursor-pointer">
            <Copy className="h-4 w-4" />
            Duplicate current file
          </DropdownMenuItem>
          {activeFileId === currentProject.entryFile ? (
            <DropdownMenuItem
              disabled
              className="text-text-secondary opacity-100 data-[disabled]:opacity-100"
            >
              <Lock className="h-4 w-4" />
              Entry file cannot be deleted
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => handleRequestDeleteProjectFile(activeFileId)}
              className="cursor-pointer text-error focus:text-error"
            >
              <Trash2 className="h-4 w-4" />
              Delete current file
            </DropdownMenuItem>
          )}
        </>
      )}
      <DropdownMenuItem onClick={handleNew} className="cursor-pointer">
        <File className="h-4 w-4" />
        New project
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
  const editorPane = (
    <div className={`${isMobile ? "flex-col" : "flex-row"} flex h-full min-h-0 bg-editor-bg`}>
      {!isMobile && (
        <ProjectFilesPane
          fileIds={projectFileIds}
          activeFileId={activeFileId}
          entryFileId={currentProject.entryFile}
          isCollapsed={isProjectFilesCollapsed}
          paneWidth={projectFilesPaneWidth}
          inlineRenameRequest={inlineRenameRequest}
          onCollapsedChange={setIsProjectFilesCollapsed}
          onPaneWidthChange={setProjectFilesPaneWidth}
          onAddProjectFile={handleAddProjectFile}
          onNewProject={handleNew}
          onOpenProjectFile={switchToProjectFile}
          onRenameProjectFile={handleInlineProjectFileRename}
          onRequestRenameProjectFile={requestInlineProjectFileRename}
          onDuplicateProjectFile={handleDuplicateProjectFile}
          onRequestDeleteProjectFile={handleRequestDeleteProjectFile}
        />
      )}
      <div className="min-h-0 min-w-0 flex-1">
        <CodeEditorPane
          editorRef={editorRef}
          value={currentDocument.source}
          onChange={handleSourceChange}
          onControlStateChange={setEditorControlState}
          errors={editorDiagnostics}
          symbols={projectSymbols}
          fileId={activeFileId}
          documentId={`${currentProject.id}:${editorBufferKey}`}
          fileName={activeFileId}
          isMobileLayout={isMobile}
          autoFocus={editorAutoFocusRef.current}
          showHeader={!isMobile && focusedPanel === null}
          fontSize={preferences.editorFontSize}
          wordWrap={preferences.wordWrap}
          saveState={autosave.saveState}
          onRenameFile={(nextName) => handleInlineProjectFileRename(activeFileId, nextName)}
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
      storyTypeface={effectiveStoryTypeface}
      metadata={storyMetadata}
      sessionKey={storySessionKey}
      hasErrors={compileStatus === "error"}
      errorCount={errorCount}
      onViewProblems={handleViewProblems}
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

  const variablesPane = <VariableInspector variables={variables} compileFailed={compileStatus === "error"} />;
  const compactVariablesPane = <VariableInspector variables={variables} showHeader={false} compileFailed={compileStatus === "error"} />;

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
        title={currentProject.name}
        knots={knots}
        onNew={handleNew}
        onNewFile={handleAddProjectFile}
        onOpen={handleOpenFromDisk}
        recentFiles={recentFiles}
        currentFileName={currentDocument.filename}
        currentSaveFileName={localSaveFileName}
        exportMetadata={storyMetadata}
        savedHtmlExport={currentDocument.htmlExport}
        storyTypeface={effectiveStoryTypeface}
        onOpenRecent={handleOpenRecent}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onManageSaves={() => setIsLocalSavesOpen(true)}
        onTitleChange={handleProjectNameChange}
        onRun={handleRun}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportInk={exportInk}
        onExportProject={handleExportProject}
        onExportProjectZip={handleExportProjectZip}
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

      <Suspense fallback={null}>
        {isSettingsOpen && (
          <LazySettingsSheet
            open={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            parsedGlobalTags={parsedGlobalTags}
            currentFileName={currentDocument.filename}
            storyTitle={resolvedStoryTitle}
            author={currentDocument.author}
            previewMode={currentDocument.previewMode ?? "transcript"}
            storyTypeface={effectiveStoryTypeface}
            onWriteTag={handleWriteTag}
            onStoryDetailsChange={(updates) => {
              void handleProjectSettingsChange(updates);
            }}
            onStoryTypefaceChange={handleStoryTypefaceChange}
            onRenameFile={handleRenameCurrentDocument}
            hasMultipleFiles={hasMultipleProjectFiles}
            onPreviewModeChange={(previewMode) => {
              void handleProjectSettingsChange({ previewMode });
            }}
            onJumpToTagLine={handleJumpToTagLine}
          />
        )}

        {fileAction !== null && (
          <LazyFileActionDialog
            mode={fileAction.mode}
            initialName={getFileActionInitialName()}
            extension={getFileActionExtension()}
            onOpenChange={(open) => {
              if (!open) {
                setFileAction(null);
              }
            }}
            onConfirm={handleConfirmFileAction}
          />
        )}

        {isLocalSavesOpen && (
          <LazyLocalSavesDialog
            open={isLocalSavesOpen}
            files={recentFiles}
            currentFileName={localSaveFileName}
            storageAvailable={storageAvailable}
            onOpenChange={setIsLocalSavesOpen}
            onOpenFile={handleOpenManagedFile}
            onRenameProject={handleRenameManagedProject}
            onDuplicateFile={handleDuplicateLocalFile}
            onDeleteFile={setDeleteTarget}
            onDeleteFiles={handleDeleteLocalFiles}
            onExport={exportInk}
          />
        )}
      </Suspense>

      <AlertDialog open={projectDeleteTarget !== null} onOpenChange={(open) => {
        if (!open) {
          setProjectDeleteTarget(null);
        }
      }}>
        <AlertDialogContent className="bg-panel-bg border-border-color text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project file?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              {projectDeleteTarget
                ? `${projectDeleteTarget} will be removed from this InkPad project. This cannot be undone.`
                : "This file will be removed from this InkPad project."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setProjectDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeleteProjectFile}
              className="bg-error text-editor-bg hover:brightness-110"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null);
        }
      }}>
        <AlertDialogContent className="bg-panel-bg border-border-color text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              {deleteTarget
                ? `${deleteTarget} and its included Ink files will be removed from this browser. This cannot be undone.`
                : "This project will be removed from this browser. This cannot be undone."}
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
