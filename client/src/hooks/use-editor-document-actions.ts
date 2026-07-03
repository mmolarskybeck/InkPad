import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { FileActionMode } from "@/components/editor/file-action-dialog";
import { useFileImport } from "@/features/files/useFileImport";
import type { AutosaveStatus } from "@/hooks/use-autosave";
import { useToast } from "@/hooks/use-toast";
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
import { parseInkProject } from "@/lib/ink-project";
import type { InkDocument } from "@/types/ink-document";

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
  recoveredAt: number | null;
  setRecoveredAt: Dispatch<SetStateAction<number | null>>;
  setIsRecoveryBannerDismissed: Dispatch<SetStateAction<boolean>>;
  autosave: AutosaveStatus;
  getCurrentSource: () => string;
  cancelPendingRecoveryDraft: () => void;
  resetBufferedSource: (source: string) => void;
  compileLive: (source: string) => void;
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
  recoveredAt,
  setRecoveredAt,
  setIsRecoveryBannerDismissed,
  autosave,
  getCurrentSource,
  cancelPendingRecoveryDraft,
  resetBufferedSource,
  compileLive,
}: UseEditorDocumentActionsOptions) {
  const [pendingAction, setPendingAction] = useState<PendingDocumentAction | null>(null);
  const [isSavingBeforeAction, setIsSavingBeforeAction] = useState(false);
  const [fileAction, setFileAction] = useState<FileActionRequest | null>(null);
  const [isLocalSavesOpen, setIsLocalSavesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  const requestGuardedAction = useCallback((label: string, run: () => void) => {
    const unguarded = autosave.saveState === "saved" || autosave.saveState === "disabled";
    if (!unguarded || recoveredAt !== null) {
      setPendingAction({ label, run });
      return;
    }
    run();
  }, [autosave.saveState, recoveredAt]);

  const saveCurrentDocument = useCallback(async (showToast = false): Promise<boolean> => {
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
        toast({ title: "Saved", description: `${currentDocument.filename} saved successfully.` });
      }
      return true;
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
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
    setCurrentDocument,
    setIsRecoveryBannerDismissed,
    setRecentFiles,
    setRecoveredAt,
    toast,
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
    compileLive(source);
  }, [
    cancelPendingRecoveryDraft,
    compileLive,
    resetBufferedSource,
    setCurrentDocument,
    setIsRecoveryBannerDismissed,
    setRecentFiles,
    setRecoveredAt,
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

  const handleLoad = useCallback((filename: string, source: string) => {
    cancelPendingRecoveryDraft();
    resetBufferedSource(source);
    FileOperations.saveRecoveryDraft(filename, source);
    setCurrentDocument({
      id: createInkDocumentId(),
      filename,
      title: getDisplayTitleFromFilename(filename),
      source,
      author: "",
      previewMode: "transcript",
      updatedAt: Date.now(),
    });
    trackProjectCreated("import");
    compileLive(source);
  }, [cancelPendingRecoveryDraft, compileLive, resetBufferedSource, setCurrentDocument]);

  const createNewDocument = useCallback(() => {
    cancelPendingRecoveryDraft();
    resetBufferedSource("");
    setRecoveredAt(null);
    setIsRecoveryBannerDismissed(false);
    setCurrentDocument({
      id: createInkDocumentId(),
      filename: "untitled.ink",
      title: "Untitled",
      source: "",
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
  ]);

  const handleNew = useCallback(() => {
    requestGuardedAction("create a new story", createNewDocument);
  }, [createNewDocument, requestGuardedAction]);

  const importFromDisk = useFileImport({
    onLoad: handleLoad,
    onError: (message) => {
      toast({ title: "Import failed", description: message, variant: "destructive" });
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
        toast({
          title: "Could not open file",
          description: `${fileName} is no longer available in local storage.`,
          variant: "destructive",
        });
        setRecentFiles(FileOperations.getAllFiles());
        return;
      }
      applyLoadedFile(file);
    });
  }, [applyLoadedFile, requestGuardedAction, setRecentFiles, toast]);

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
  ]);

  const handleRenameCurrentDocument = useCallback(async (name: string) => {
    try {
      const { nextFilename, sourceName } = await renameCurrentDocument(name);
      toast({ title: "Renamed", description: `${sourceName} is now ${nextFilename}.` });
    } catch (error) {
      toast({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      throw error;
    }
  }, [
    renameCurrentDocument,
    toast,
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
        const currentSource = currentSaveFile?.content ?? getCurrentSource();
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
        toast({ title: "Saved copy", description: `${nextFilename} is now open.` });
      } else if (sourceName === currentDocument.filename) {
        const result = await renameCurrentDocument(requestedFilename);
        toast({ title: "Renamed", description: `${result.sourceName} is now ${result.nextFilename}.` });
      } else {
        const nextFilename = FileOperations.getAvailableFileName(requestedFilename, sourceName);
        const renamed = await FileOperations.renameFile(sourceName, nextFilename, true);
        if (!renamed) throw new Error(`${sourceName} could not be renamed.`);
        setRecentFiles(FileOperations.getAllFiles());
        toast({ title: "Renamed", description: `${sourceName} is now ${nextFilename}.` });
      }
      setFileAction(null);
    } catch (error) {
      toast({
        title: fileAction.mode === "save-as" ? "Save As failed" : "Rename failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
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
    toast,
  ]);

  const handleDuplicateLocalFile = useCallback(async (fileName: string) => {
    try {
      const duplicate = await FileOperations.duplicateFile(fileName);
      if (!duplicate) throw new Error(`${fileName} could not be duplicated.`);
      setRecentFiles(FileOperations.getAllFiles());
      toast({ title: "Duplicated", description: `${duplicate.name} was created.` });
    } catch (error) {
      toast({
        title: "Duplicate failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [setRecentFiles, toast]);

  const handleConfirmDeleteLocalFile = useCallback(() => {
    if (!deleteTarget) return;
    const deletedCurrentFile = deleteTarget === currentDocument.filename;
    const deleted = FileOperations.deleteFile(deleteTarget);
    if (!deleted) {
      toast({ title: "Delete failed", description: `${deleteTarget} is no longer available.`, variant: "destructive" });
      setDeleteTarget(null);
      setRecentFiles(FileOperations.getAllFiles());
      return;
    }
    const nextFiles = FileOperations.getAllFiles();
    setRecentFiles(nextFiles);
    setDeleteTarget(null);
    toast({ title: "Deleted", description: `${deleteTarget} was removed from local saves.` });
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
    currentDocument.filename,
    deleteTarget,
    setRecentFiles,
    toast,
  ]);

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
    handleConfirmDeleteLocalFile,
  };
}
