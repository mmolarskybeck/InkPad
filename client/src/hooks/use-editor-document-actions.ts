import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { FileActionMode } from "@/components/editor/file-action-dialog";
import { useFileImport } from "@/features/files/useFileImport";
import type { ImportedFile } from "@/features/files/useFileImport";
import type { AutosaveStatus } from "@/hooks/use-autosave";
import { toast } from "sonner";
import {
  FileOperations,
  type StoredInkDocument,
  type StoredStorySettings,
} from "@/lib/file-operations";
import {
  trackImportClicked,
  trackProjectCreated,
  trackProjectSavedLocal,
} from "@/lib/analytics";
import { getDisplayTitleFromFilename, getFilename } from "@/lib/filename-utils";
import { createInkDocumentId } from "@/lib/ink-document-id";
import { getProjectStorageName, parseInkProject, retargetProjectForCopy } from "@/lib/ink-project";
import type { InkDocument } from "@/types/ink-document";
import type { InkProject } from "@/types/ink-project";

export interface PendingDocumentAction {
  label: string;
  run: () => void;
}

export interface FileActionRequest {
  mode: FileActionMode;
  fileName?: string;
}

interface UseEditorDocumentActionsOptions {
  currentDocument: InkDocument;
  setCurrentDocument: Dispatch<SetStateAction<InkDocument>>;
  setRecentFiles: Dispatch<SetStateAction<StoredInkDocument[]>>;
  applyLoadedProjectFile?: (file: StoredInkDocument) => boolean;
  currentSaveFileName?: string;
  getCurrentSaveFile?: () => { filename: string; content: string };
  /** Project-aware save; when provided, saveCurrentDocument delegates to it. */
  persistCurrentSave?: (showToast?: boolean) => Promise<boolean>;
  /** Project-aware rename of the open file; when provided, renameCurrentDocument delegates to it. */
  renameActiveDocument?: (requestedName: string) => Promise<{ nextFilename: string; sourceName: string }>;
  recoveredAt: number | null;
  setRecoveredAt: Dispatch<SetStateAction<number | null>>;
  setIsRecoveryBannerDismissed: Dispatch<SetStateAction<boolean>>;
  autosave: AutosaveStatus;
  getCurrentSource: () => string;
  cancelPendingRecoveryDraft: () => void;
  resetBufferedSource: (source: string) => void;
  compileLive: (source: string) => void;
  stopStory: () => void;
}

type InkStorageExtension = ".ink" | ".inkpad";

function stripInkStorageExtension(input: string): string {
  return input.trim().replace(/\.(?:inkpad|ink)$/i, "");
}

function getInkStorageFilenameFromInput(input: string, extension: InkStorageExtension): string {
  return getFilename(stripInkStorageExtension(input), extension);
}

function getCopyFilename(filename: string, extension: InkStorageExtension): string {
  return `${stripInkStorageExtension(filename)}-copy${extension}`;
}

function getStoredProjectFileCount(content: string): number | null {
  try {
    return Object.keys(parseInkProject(content).files).length;
  } catch {
    return null;
  }
}

function getStorageExtensionForContent(content: string): InkStorageExtension {
  const projectFileCount = getStoredProjectFileCount(content);
  return projectFileCount !== null && projectFileCount > 1 ? ".inkpad" : ".ink";
}

function getStoredSettings(document: InkDocument): StoredStorySettings {
  return {
    title: document.title,
    author: document.author,
    htmlExport: document.htmlExport,
    storyTypeface: document.storyTypeface,
    previewMode: document.previewMode,
  };
}

export function useEditorDocumentActions({
  currentDocument,
  setCurrentDocument,
  setRecentFiles,
  applyLoadedProjectFile,
  currentSaveFileName = currentDocument.filename,
  getCurrentSaveFile,
  persistCurrentSave,
  renameActiveDocument,
  recoveredAt,
  setRecoveredAt,
  setIsRecoveryBannerDismissed,
  autosave,
  getCurrentSource,
  cancelPendingRecoveryDraft,
  resetBufferedSource,
  compileLive,
  stopStory,
}: UseEditorDocumentActionsOptions) {
  const [pendingAction, setPendingAction] = useState<PendingDocumentAction | null>(null);
  const [isSavingBeforeAction, setIsSavingBeforeAction] = useState(false);
  const [fileAction, setFileAction] = useState<FileActionRequest | null>(null);
  const [isLocalSavesOpen, setIsLocalSavesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const requestGuardedAction = useCallback((label: string, run: () => void) => {
    const unguarded = autosave.saveState === "saved" || autosave.saveState === "disabled";
    if (!unguarded || recoveredAt !== null) {
      setPendingAction({ label, run });
      return;
    }
    run();
  }, [autosave.saveState, recoveredAt]);

  const saveCurrentDocument = useCallback(async (showToast = false): Promise<boolean> => {
    if (persistCurrentSave) {
      return persistCurrentSave(showToast);
    }

    const currentSource = getCurrentSource();
    try {
      await FileOperations.saveFile(
        currentDocument.filename,
        currentSource,
        getStoredSettings(currentDocument),
      );
      autosave.markSaved(currentDocument.filename, currentSource);
      cancelPendingRecoveryDraft();
      FileOperations.clearRecoveryDraft(currentDocument.filename);
      setRecoveredAt(null);
      setIsRecoveryBannerDismissed(false);
      resetBufferedSource(currentSource);
      setCurrentDocument((document) => ({
        ...document,
        source: currentSource,
        updatedAt: Date.now(),
        lastSavedAt: Date.now(),
      }));
      setRecentFiles(FileOperations.getAllFiles());
      trackProjectSavedLocal({ storage: "local_storage", storyText: currentSource });
      if (showToast) {
        toast.success(`Saved ${currentDocument.filename}`);
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
    cancelPendingRecoveryDraft,
    currentDocument.author,
    currentDocument.filename,
    currentDocument.htmlExport,
    currentDocument.previewMode,
    currentDocument.storyTypeface,
    currentDocument.title,
    getCurrentSource,
    resetBufferedSource,
    persistCurrentSave,
    setCurrentDocument,
    setIsRecoveryBannerDismissed,
    setRecentFiles,
    setRecoveredAt,
  ]);

  const applyLoadedDocument = useCallback((
    filename: string,
    source: string,
    savedAt?: number,
    settings?: StoredStorySettings,
  ) => {
    cancelPendingRecoveryDraft();
    resetBufferedSource(source);
    FileOperations.setActiveFile(filename);
    FileOperations.clearRecoveryDraft(filename);
    setRecoveredAt(null);
    setIsRecoveryBannerDismissed(false);
    setCurrentDocument({
      id: createInkDocumentId(),
      filename,
      title: settings?.title ?? getDisplayTitleFromFilename(filename),
      source,
      author: settings?.author ?? "",
      htmlExport: settings?.htmlExport,
      storyTypeface: settings?.storyTypeface ?? settings?.htmlExport?.font,
      previewMode: settings?.previewMode ?? "transcript",
      updatedAt: Date.now(),
      lastSavedAt: savedAt,
    });
    setRecentFiles(FileOperations.getAllFiles());
    stopStory();
    compileLive(source);
  }, [
    cancelPendingRecoveryDraft,
    compileLive,
    resetBufferedSource,
    setCurrentDocument,
    setIsRecoveryBannerDismissed,
    setRecentFiles,
    setRecoveredAt,
    stopStory,
  ]);

  const applyLoadedFile = useCallback((file: StoredInkDocument) => {
    if (applyLoadedProjectFile?.(file)) {
      return;
    }

    applyLoadedDocument(
      file.name,
      file.content,
      file.lastSavedAt ?? file.lastModified,
      file.settings,
    );
  }, [applyLoadedDocument, applyLoadedProjectFile]);

  const handleLoad = useCallback(async (importedFile: ImportedFile) => {
    const { importedFilename: filename, importedSource, kind } = importedFile;
    if (kind === "archive") {
      if (!(importedSource instanceof ArrayBuffer)) {
        throw new Error("Could not read this project archive.");
      }

      const { parseInkPadBundle } = await import("@/lib/inkpad-bundle");
      let importedProject: InkProject;
      let importedSettings: StoredStorySettings | undefined;
      try {
        const parsedBundle = await parseInkPadBundle(importedSource);
        importedProject = parsedBundle.project;
        importedSettings = parsedBundle.settings;
      } catch (bundleError) {
        try {
          importedProject = parseInkProject(new TextDecoder().decode(importedSource));
        } catch {
          throw bundleError;
        }
      }
      const project = importedProject;
      const settings = importedSettings;
      const storageName = getProjectStorageName(project);
      const content = JSON.stringify(project, null, 2);
      cancelPendingRecoveryDraft();
      resetBufferedSource(project.files[project.entryFile]?.content ?? "");
      FileOperations.saveRecoveryDraft(storageName, content, settings);
      const opened = applyLoadedProjectFile?.({
        name: storageName,
        content,
        settings,
        lastModified: Date.now(),
      });
      if (!opened) {
        throw new Error("This InkPad project could not be opened.");
      }
      trackProjectCreated("import");
      return;
    }

    const source = typeof importedSource === "string"
      ? importedSource
      : new TextDecoder().decode(importedSource);
    cancelPendingRecoveryDraft();
    resetBufferedSource(source);
    FileOperations.saveRecoveryDraft(filename, source);
    setCurrentDocument({
      id: createInkDocumentId(),
      filename,
      title: getDisplayTitleFromFilename(filename),
      source,
      namingExplicit: false,
      author: "",
      previewMode: "transcript",
      updatedAt: Date.now(),
    });
    trackProjectCreated("import");
    stopStory();
    compileLive(source);
  }, [
    applyLoadedProjectFile,
    cancelPendingRecoveryDraft,
    compileLive,
    resetBufferedSource,
    setCurrentDocument,
    stopStory,
  ]);

  const createNewDocument = useCallback(() => {
    cancelPendingRecoveryDraft();
    resetBufferedSource("");
    setRecoveredAt(null);
    setIsRecoveryBannerDismissed(false);
    stopStory();
    setCurrentDocument({
      id: createInkDocumentId(),
      filename: "untitled.ink",
      title: "Untitled",
      source: "",
      namingExplicit: false,
      author: "",
      previewMode: "transcript",
      updatedAt: Date.now(),
    });
    trackProjectCreated("blank");
  }, [
    cancelPendingRecoveryDraft,
    resetBufferedSource,
    setCurrentDocument,
    setIsRecoveryBannerDismissed,
    setRecoveredAt,
    stopStory,
  ]);

  const handleNew = useCallback(() => {
    requestGuardedAction("create a new story", createNewDocument);
  }, [createNewDocument, requestGuardedAction]);

  const importFromDisk = useFileImport({
    onLoad: handleLoad,
    onError: (message) => {
      toast.error("Import failed", { description: message });
    },
  });

  const handleOpenFromDisk = useCallback(() => {
    trackImportClicked("file_picker");
    requestGuardedAction("open another file", importFromDisk);
  }, [importFromDisk, requestGuardedAction]);

  const handleOpenRecent = useCallback((fileName: string) => {
    requestGuardedAction(`open ${fileName}`, () => {
      const file = FileOperations.loadFile(fileName);
      if (!file) {
        toast.error("Could not open file", { description: `${fileName} is no longer available in local storage.` });
        setRecentFiles(FileOperations.getAllFiles());
        return;
      }
      applyLoadedFile(file);
    });
  }, [applyLoadedFile, requestGuardedAction, setRecentFiles]);

  const handleOpenManagedFile = useCallback((fileName: string) => {
    setIsLocalSavesOpen(false);
    handleOpenRecent(fileName);
  }, [handleOpenRecent]);

  const handleSaveAndContinue = useCallback(async () => {
    if (!pendingAction) return;
    setIsSavingBeforeAction(true);
    const saved = await saveCurrentDocument(false);
    setIsSavingBeforeAction(false);
    if (saved) {
      const action = pendingAction;
      setPendingAction(null);
      action.run();
    }
  }, [pendingAction, saveCurrentDocument]);

  const handleDiscardAndContinue = useCallback(() => {
    if (!pendingAction) return;
    const action = pendingAction;
    cancelPendingRecoveryDraft();
    resetBufferedSource(currentDocument.source);
    FileOperations.clearRecoveryDraft(currentDocument.filename);
    setRecoveredAt(null);
    setIsRecoveryBannerDismissed(false);
    setPendingAction(null);
    action.run();
  }, [
    cancelPendingRecoveryDraft,
    currentDocument.filename,
    currentDocument.htmlExport,
    currentDocument.source,
    pendingAction,
    resetBufferedSource,
    setIsRecoveryBannerDismissed,
    setRecoveredAt,
  ]);

  const openFileActionDialog = useCallback((mode: FileActionMode, fileName?: string) => {
    setFileAction({ mode, fileName });
  }, []);

  const handleSaveAs = useCallback(() => openFileActionDialog("save-as"), [openFileActionDialog]);

  const getFileActionExtension = useCallback((): InkStorageExtension => {
    if (!fileAction) {
      return currentSaveFileName.toLowerCase().endsWith(".inkpad") ? ".inkpad" : ".ink";
    }

    if (fileAction.mode === "add-file") {
      return ".ink";
    }

    if (fileAction.mode === "save-as") {
      const currentSaveFile = getCurrentSaveFile?.();
      return currentSaveFile
        ? getStorageExtensionForContent(currentSaveFile.content)
        : currentSaveFileName.toLowerCase().endsWith(".inkpad") ? ".inkpad" : ".ink";
    }

    const sourceFile = FileOperations.loadFile(fileAction.fileName ?? currentSaveFileName);
    return sourceFile ? getStorageExtensionForContent(sourceFile.content) : ".ink";
  }, [currentSaveFileName, fileAction, getCurrentSaveFile]);

  const getFileActionInitialName = useCallback(() => {
    if (!fileAction) return currentDocument.filename;
    const extension = getFileActionExtension();
    if (fileAction.mode === "save-as") {
      const currentSaveFile = getCurrentSaveFile?.();
      return FileOperations.getAvailableFileName(
        getCopyFilename(currentSaveFile?.filename ?? currentSaveFileName, extension),
      );
    }
    return fileAction.fileName ?? currentDocument.filename;
  }, [
    currentDocument.filename,
    currentSaveFileName,
    fileAction,
    getCurrentSaveFile,
    getFileActionExtension,
  ]);

  const renameCurrentDocument = useCallback(async (name: string) => {
    if (renameActiveDocument) {
      return renameActiveDocument(name);
    }

    const requestedFilename = getInkStorageFilenameFromInput(name, ".ink");
    const sourceName = currentDocument.filename;
    const nextFilename = FileOperations.getAvailableFileName(requestedFilename, sourceName);
    const currentSource = getCurrentSource();
    const storedSettings = getStoredSettings(currentDocument);
    await FileOperations.saveFile(nextFilename, currentSource, storedSettings);
    cancelPendingRecoveryDraft();
    if (nextFilename !== sourceName && FileOperations.fileExists(sourceName)) {
      FileOperations.deleteFile(sourceName);
    }
    FileOperations.clearRecoveryDraft(sourceName);
    applyLoadedDocument(nextFilename, currentSource, Date.now(), storedSettings);
    return { nextFilename, sourceName };
  }, [
    applyLoadedDocument,
    cancelPendingRecoveryDraft,
    currentDocument,
    getCurrentSource,
    renameActiveDocument,
  ]);

  const handleRenameCurrentDocument = useCallback(async (name: string) => {
    try {
      await renameCurrentDocument(name);
    } catch (error) {
      toast.error("Rename failed", { description: error instanceof Error ? error.message : "Unknown error" });
      throw error;
    }
  }, [
    renameCurrentDocument,
  ]);

  const handleConfirmFileAction = useCallback(async (name: string) => {
    if (!fileAction) return;
    const extension = getFileActionExtension();
    const requestedFilename = getInkStorageFilenameFromInput(name, extension);
    const sourceName = fileAction.fileName ?? currentDocument.filename;
    try {
      if (fileAction.mode === "save-as") {
        const currentSaveFile = getCurrentSaveFile?.();
        const nextFilename = FileOperations.getAvailableFileName(requestedFilename);
        let currentSource = currentSaveFile?.content ?? getCurrentSource();
        // Project-shaped content must carry its own identity: a copy gets a
        // fresh id, and the user-chosen name pins the entry file (one-file)
        // or the export name (multi-file) so the storage key and the
        // project's internal names stay consistent.
        try {
          const retargeted = retargetProjectForCopy(parseInkProject(currentSource), nextFilename);
          currentSource = JSON.stringify(retargeted, null, 2);
        } catch {
          // Raw ink source, not project JSON — save as-is.
        }
        const storedSettings = getStoredSettings(currentDocument);
        await FileOperations.saveFile(nextFilename, currentSource, storedSettings);
        cancelPendingRecoveryDraft();
        FileOperations.clearRecoveryDraft(currentDocument.filename);
        FileOperations.clearRecoveryDraft(nextFilename);
        const savedFile = FileOperations.loadFile(nextFilename);
        if (savedFile) {
          applyLoadedFile(savedFile);
        } else {
          applyLoadedDocument(nextFilename, currentSource, Date.now(), storedSettings);
        }
        trackProjectSavedLocal({ storage: "local_storage", storyText: currentSource });
      } else if (sourceName === currentDocument.filename) {
        await renameCurrentDocument(requestedFilename);
      } else {
        const nextFilename = FileOperations.getAvailableFileName(requestedFilename, sourceName);
        const renamed = await FileOperations.renameFile(sourceName, nextFilename, true);
        if (!renamed) throw new Error(`${sourceName} could not be renamed.`);
        setRecentFiles(FileOperations.getAllFiles());
      }
      setFileAction(null);
    } catch (error) {
      toast.error(fileAction.mode === "save-as" ? "Save As failed" : "Rename failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [
    applyLoadedDocument,
    applyLoadedFile,
    cancelPendingRecoveryDraft,
    currentDocument,
    fileAction,
    getCurrentSaveFile,
    getCurrentSource,
    getFileActionExtension,
    renameCurrentDocument,
    setRecentFiles,
  ]);

  const handleDuplicateLocalFile = useCallback(async (fileName: string) => {
    try {
      const duplicate = await FileOperations.duplicateFile(fileName);
      if (!duplicate) throw new Error(`${fileName} could not be duplicated.`);
      setRecentFiles(FileOperations.getAllFiles());
    } catch (error) {
      toast.error("Duplicate failed", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  }, [setRecentFiles]);

  const handleDeleteLocalFiles = useCallback((fileNames: string[]) => {
    const uniqueFileNames = Array.from(new Set(fileNames));
    if (uniqueFileNames.length === 0) return;

    const missingFiles: string[] = [];
    const deletedCurrentFile = uniqueFileNames.includes(currentSaveFileName);

    for (const fileName of uniqueFileNames) {
      if (!FileOperations.deleteFile(fileName)) {
        missingFiles.push(fileName);
      }
    }

    const nextFiles = FileOperations.getAllFiles();
    setRecentFiles(nextFiles);
    setDeleteTarget(null);

    if (missingFiles.length > 0) {
      toast.error("Delete failed", {
        description: `${missingFiles.join(", ")} ${missingFiles.length === 1 ? "is" : "are"} no longer available.`,
      });
    }

    if (deletedCurrentFile) {
      const nextFile = nextFiles[0];
      if (nextFile) {
        applyLoadedFile(nextFile);
      } else {
        createNewDocument();
      }
    }
  }, [
    applyLoadedFile,
    createNewDocument,
    currentSaveFileName,
    setRecentFiles,
  ]);

  const handleConfirmDeleteLocalFile = useCallback(() => {
    if (!deleteTarget) return;
    handleDeleteLocalFiles([deleteTarget]);
  }, [deleteTarget, handleDeleteLocalFiles]);

  return {
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
  };
}
