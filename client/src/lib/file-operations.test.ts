import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FileOperations } from "./file-operations";
import { createSingleFileProject } from "./ink-project";

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

describe("FileOperations document lifecycle", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers a newer recovery draft for the active document", async () => {
    await FileOperations.saveFile("story.ink", "saved");
    FileOperations.saveRecoveryDraft("story.ink", "recovered");

    expect(FileOperations.loadStartupFile()).toMatchObject({
      name: "story.ink",
      content: "recovered",
    });
  });

  it("removes pre-CodeMirror local save keys after the storage namespace bump", () => {
    localStorage.setItem("inkpad_story.ink", JSON.stringify({
      name: "story.ink",
      content: "old saved content",
      lastModified: 1,
    }));
    localStorage.setItem("inkpad_story.ink:snap:1", JSON.stringify({
      timestamp: 1,
      content: "old snapshot content",
      hash: "old-hash",
    }));
    localStorage.setItem("inkpad_analytics_enabled", "true");
    localStorage.setItem("inkpad:active-file", "story.ink");
    localStorage.setItem("inkpad:recovery-draft", JSON.stringify({
      name: "story.ink",
      content: "old recovery content",
      lastModified: 2,
    }));

    expect(FileOperations.loadStartupFile()).toBeNull();

    expect(localStorage.getItem("inkpad_story.ink")).toBeNull();
    expect(localStorage.getItem("inkpad_story.ink:snap:1")).toBeNull();
    expect(localStorage.getItem("inkpad:active-file")).toBeNull();
    expect(localStorage.getItem("inkpad:recovery-draft")).toBeNull();
    expect(localStorage.getItem("inkpad_analytics_enabled")).toBe("true");
    expect(FileOperations.loadFile("story.ink")).toBeNull();
    expect(FileOperations.getActiveFileName()).toBeNull();
    expect(FileOperations.loadRecoveryDraft()).toBeNull();
    expect(FileOperations.getAllFiles()).toEqual([]);
  });

  it("renames a file and preserves its content", async () => {
    await FileOperations.saveFile("old.ink", "content");

    expect(await FileOperations.renameFile("old.ink", "new.ink", true)).toBe(true);
    expect(FileOperations.loadFile("old.ink")).toBeNull();
    expect(FileOperations.loadFile("new.ink")?.content).toBe("content");
  });

  it("duplicates and deletes local files independently", async () => {
    await FileOperations.saveFile("story.ink", "content", {
      title: "The Moonlit Garden",
      author: "Ink Writer",
      htmlExport: {
        title: "Export Title",
        author: "Export Author",
        theme: "sepia",
        font: "mono",
        includeReadme: false,
      },
      storyTypeface: "mono",
      previewMode: "scene",
    });
    const duplicate = await FileOperations.duplicateFile("story.ink");

    expect(duplicate?.name).toBe("story-copy.ink");
    expect(duplicate?.settings).toEqual({
      title: "The Moonlit Garden",
      author: "Ink Writer",
      htmlExport: {
        title: "Export Title",
        author: "Export Author",
        theme: "sepia",
        font: "mono",
        includeReadme: false,
      },
      storyTypeface: "mono",
      previewMode: "scene",
    });
    expect(FileOperations.deleteFile("story-copy.ink")).toBe(true);
    expect(FileOperations.loadFile("story.ink")?.content).toBe("content");
  });

  it("duplicates multi-file project saves as .inkpad containers", async () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Novel",
      fileName: "chapter1.ink",
      content: "Chapter one",
    });
    project.files["chapter2.ink"] = { content: "Chapter two" };
    const serializedProject = JSON.stringify(project);
    await FileOperations.saveFile("Novel.inkpad", serializedProject);

    const duplicate = await FileOperations.duplicateFile("Novel.inkpad");

    expect(duplicate?.name).toBe("Novel-copy.inkpad");
    expect(duplicate?.content).toBe(serializedProject);
    expect(FileOperations.loadFile("Novel.inkpad-copy.ink")).toBeNull();
  });

  it("preserves project settings through rename and recovery", async () => {
    const settings = {
      title: "A Carefully Cased Title",
      author: "Ink Writer",
      previewMode: "scene" as const,
    };
    await FileOperations.saveFile("old.ink", "content", settings);
    await FileOperations.renameFile("old.ink", "new.ink");
    FileOperations.saveRecoveryDraft("new.ink", "recovered", settings);

    expect(FileOperations.loadFile("new.ink")?.settings).toEqual(settings);
    expect(FileOperations.loadStartupFile()).toMatchObject({ settings });
  });
});
