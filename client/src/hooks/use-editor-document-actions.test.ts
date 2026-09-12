import { act, renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorDocumentActions } from "./use-editor-document-actions";
import { FileOperations } from "@/lib/file-operations";
import { createSingleFileProject, parseInkProject } from "@/lib/ink-project";
import type { AutosaveStatus } from "@/hooks/use-autosave";
import type { InkDocument } from "@/types/ink-document";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const autosave = {
  saveState: "saved",
  lastSavedAt: null,
  isLeader: true,
  saveNow: vi.fn(),
  markSaved: vi.fn(),
} satisfies AutosaveStatus;

const currentDocument = {
  id: "document-1",
  filename: "story.ink",
  title: "Story",
  source: "Story text",
  author: "",
  previewMode: "transcript",
  updatedAt: 1,
} satisfies InkDocument;

describe("useEditorDocumentActions", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  beforeEach(async () => {
    localStorage.clear();
    FileOperations.resetForTests();
    await FileOperations.init();
    vi.clearAllMocks();
  });

  it("opens stored InkPad project saves through the project loader instead of as raw JSON", async () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Novel",
      fileName: "chapter1.ink",
      content: "Chapter one",
    });
    project.files["chapter2.ink"] = { content: "Chapter two" };
    await FileOperations.saveFile("Novel.inkpad", JSON.stringify(project), { title: "Novel" });

    const setCurrentDocument = vi.fn();
    const applyLoadedProjectFile = vi.fn(() => true);
    const { result } = renderHook(() => useEditorDocumentActions({
      currentDocument,
      setCurrentDocument,
      setRecentFiles: vi.fn(),
      applyLoadedProjectFile,
      recoveredAt: null,
      setRecoveredAt: vi.fn(),
      setIsRecoveryBannerDismissed: vi.fn(),
      autosave,
      getCurrentSource: vi.fn(() => currentDocument.source),
      cancelPendingRecoveryDraft: vi.fn(),
      resetBufferedSource: vi.fn(),
      compileLive: vi.fn(),
      stopStory: vi.fn(),
    }));

    act(() => {
      result.current.handleOpenRecent("Novel.inkpad");
    });

    expect(applyLoadedProjectFile).toHaveBeenCalledWith(expect.objectContaining({
      name: "Novel.inkpad",
      content: JSON.stringify(project),
    }));
    expect(setCurrentDocument).not.toHaveBeenCalled();
  });

  it("renames multi-file local project saves as .inkpad containers", async () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Novel",
      fileName: "chapter1.ink",
      content: "Chapter one",
    });
    project.files["chapter2.ink"] = { content: "Chapter two" };
    const serializedProject = JSON.stringify(project);
    await FileOperations.saveFile("Novel.inkpad", serializedProject, { title: "Novel" });

    const { result } = renderHook(() => useEditorDocumentActions({
      currentDocument,
      setCurrentDocument: vi.fn(),
      setRecentFiles: vi.fn(),
      recoveredAt: null,
      setRecoveredAt: vi.fn(),
      setIsRecoveryBannerDismissed: vi.fn(),
      autosave,
      getCurrentSource: vi.fn(() => currentDocument.source),
      cancelPendingRecoveryDraft: vi.fn(),
      resetBufferedSource: vi.fn(),
      compileLive: vi.fn(),
      stopStory: vi.fn(),
    }));

    await act(async () => {
      result.current.openFileActionDialog("rename", "Novel.inkpad");
    });

    expect(result.current.getFileActionExtension()).toBe(".inkpad");

    await act(async () => {
      await result.current.handleConfirmFileAction("Better Novel");
    });

    await FileOperations.flush();

    expect(FileOperations.loadFile("Novel.inkpad")).toBeNull();
    expect(FileOperations.loadFile("Better Novel.ink")).toBeNull();
    expect(FileOperations.loadFile("Better Novel.inkpad")?.content).toBe(serializedProject);
  });

  it("saves active multi-file project copies as .inkpad without flattening to the active ink file", async () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Novel",
      fileName: "chapter1.ink",
      content: "Chapter one",
    });
    project.files["chapter2.ink"] = { content: "Chapter two" };
    const serializedProject = JSON.stringify(project);
    const setCurrentDocument = vi.fn();
    const applyLoadedProjectFile = vi.fn(() => true);
    const { result } = renderHook(() => useEditorDocumentActions({
      currentDocument,
      setCurrentDocument,
      setRecentFiles: vi.fn(),
      applyLoadedProjectFile,
      currentSaveFileName: "Novel.inkpad",
      getCurrentSaveFile: vi.fn(() => ({
        filename: "Novel.inkpad",
        content: serializedProject,
      })),
      recoveredAt: null,
      setRecoveredAt: vi.fn(),
      setIsRecoveryBannerDismissed: vi.fn(),
      autosave,
      getCurrentSource: vi.fn(() => currentDocument.source),
      cancelPendingRecoveryDraft: vi.fn(),
      resetBufferedSource: vi.fn(),
      compileLive: vi.fn(),
      stopStory: vi.fn(),
    }));

    await act(async () => {
      result.current.openFileActionDialog("save-as");
    });

    expect(result.current.getFileActionExtension()).toBe(".inkpad");

    await act(async () => {
      await result.current.handleConfirmFileAction("Novel Copy");
    });

    const savedCopy = FileOperations.loadFile("Novel Copy.inkpad");
    expect(savedCopy).not.toBeNull();
    // A Save As copy is an independent project: fresh id, and the chosen
    // name pins the export name. File contents are untouched.
    const copiedProject = parseInkProject(savedCopy!.content);
    expect(copiedProject.id).not.toBe(project.id);
    expect(copiedProject.exportNameBase).toBe("Novel Copy");
    expect(copiedProject.exportNameIsExplicit).toBe(true);
    expect(copiedProject.files).toEqual(project.files);
    expect(FileOperations.loadFile("Novel Copy.ink")).toBeNull();
    expect(applyLoadedProjectFile).toHaveBeenCalledWith(expect.objectContaining({
      name: "Novel Copy.inkpad",
    }));
    expect(setCurrentDocument).not.toHaveBeenCalled();
  });
});
