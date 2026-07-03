import { act, renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorDocumentActions } from "./use-editor-document-actions";
import { FileOperations } from "@/lib/file-operations";
import { createSingleFileProject } from "@/lib/ink-project";
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

  beforeEach(() => {
    localStorage.clear();
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
});
