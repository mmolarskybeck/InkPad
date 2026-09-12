import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FileOperations } from "./file-operations";
import { IndexedDbBackend } from "./project-store/indexeddb-backend";

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

describe("FileOperations storage migration", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    localStorage.clear();
    FileOperations.resetForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function seedLegacy(name: string, content: string, lastModified: number, snapshots: number[] = []) {
    localStorage.setItem(`inkpad:v2:file:${name}`, JSON.stringify({ name, content, lastModified, lastSavedAt: lastModified }));
    for (const ts of snapshots) {
      localStorage.setItem(`inkpad:v2:file:${name}:snap:${ts}`, JSON.stringify({ timestamp: ts, content: `snap-${ts}`, hash: "h" }));
    }
  }

  it("moves v2 localStorage documents and snapshots into IndexedDB and clears the old keys", async () => {
    localStorage.setItem("inkpad:v2:file:a.ink", JSON.stringify({
      name: "a.ink",
      content: "A",
      lastModified: 10,
      lastSavedAt: 10,
    }));
    localStorage.setItem("inkpad:v2:file:a.ink:snap:5", JSON.stringify({
      timestamp: 5,
      content: "old",
      hash: "h",
    }));
    localStorage.setItem("inkpad:v2:active-file", "a.ink");

    await FileOperations.init();

    expect(FileOperations.loadFile("a.ink")?.content).toBe("A");
    expect((await FileOperations.getFileSnapshots("a.ink")).length).toBe(1);
    expect(localStorage.getItem("inkpad:v2:file:a.ink")).toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:5")).toBeNull();
    expect(localStorage.getItem("inkpad:v2:active-file")).toBe("a.ink");
  });

  it("does not overwrite a newer IndexedDB copy", async () => {
    await FileOperations.init();
    await FileOperations.saveFile("a.ink", "NEW");
    await FileOperations.flush();
    FileOperations.resetForTests();

    localStorage.setItem("inkpad:v2:file:a.ink", JSON.stringify({
      name: "a.ink",
      content: "OLD",
      lastModified: 1,
      lastSavedAt: 1,
    }));

    await FileOperations.init();

    expect(FileOperations.loadFile("a.ink")?.content).toBe("NEW");
    expect(localStorage.getItem("inkpad:v2:file:a.ink")).toBeNull();
  });

  it("uses the indexeddb backend when available and survives re-init", async () => {
    await FileOperations.init();
    await FileOperations.saveFile("b.ink", "beta");
    await FileOperations.flush();
    FileOperations.resetForTests();

    await FileOperations.init();

    expect(FileOperations.loadFile("b.ink")?.content).toBe("beta");
    expect(localStorage.getItem("inkpad:v2:file:b.ink")).toBeNull();
  });

  it("still migrates snapshots when IndexedDB already holds an equal document (retry after partial migration)", async () => {
    await FileOperations.init();
    await FileOperations.saveFile("a.ink", "SAME");
    await FileOperations.flush();
    const saved = FileOperations.loadFile("a.ink")!;
    FileOperations.resetForTests();

    seedLegacy("a.ink", "SAME", saved.lastModified, [1, 2]);

    await FileOperations.init();

    const snapshots = await FileOperations.getFileSnapshots("a.ink");
    expect(snapshots.map(s => s.timestamp).sort()).toEqual([1, 2]);
    expect(localStorage.getItem("inkpad:v2:file:a.ink")).toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:1")).toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:2")).toBeNull();
  });

  it("leaves localStorage intact when a snapshot write fails, then completes on the next boot", async () => {
    seedLegacy("a.ink", "A", 10, [5, 6]);
    vi.spyOn(IndexedDbBackend.prototype, "putSnapshot").mockRejectedValueOnce(new Error("disk"));

    await FileOperations.init();

    // Served from localStorage this session; nothing was cleared.
    expect(FileOperations.loadFile("a.ink")?.content).toBe("A");
    expect(localStorage.getItem("inkpad:v2:file:a.ink")).not.toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:5")).not.toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:6")).not.toBeNull();

    vi.restoreAllMocks();
    FileOperations.resetForTests();
    await FileOperations.init();

    expect(FileOperations.loadFile("a.ink")?.content).toBe("A");
    expect((await FileOperations.getFileSnapshots("a.ink")).map(s => s.timestamp).sort()).toEqual([5, 6]);
    expect(localStorage.getItem("inkpad:v2:file:a.ink")).toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:5")).toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:6")).toBeNull();
  });

  it("does not clear legacy keys when the document itself fails to write", async () => {
    seedLegacy("a.ink", "A", 10, [5]);
    vi.spyOn(IndexedDbBackend.prototype, "putFile").mockRejectedValueOnce(new Error("disk"));

    await FileOperations.init();

    expect(localStorage.getItem("inkpad:v2:file:a.ink")).not.toBeNull();
    expect(localStorage.getItem("inkpad:v2:file:a.ink:snap:5")).not.toBeNull();
  });

  it("reports storage available when localStorage is full but IndexedDB works", async () => {
    await FileOperations.init();
    await FileOperations.saveFile("kept.ink", "kept");
    await FileOperations.flush();
    FileOperations.resetForTests();

    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      const error = new Error("full");
      error.name = "QuotaExceededError";
      throw error;
    });

    await FileOperations.init();

    expect(FileOperations.checkAvailability()).toEqual({ available: true, reason: null });
    expect(FileOperations.loadFile("kept.ink")?.content).toBe("kept");
    await FileOperations.saveFile("kept.ink", "edited");
    await FileOperations.flush();
    expect(FileOperations.loadFile("kept.ink")?.content).toBe("edited");
    setItem.mockRestore();
  });

  it("serves existing IndexedDB projects when localStorage throws on every access", async () => {
    await FileOperations.init();
    await FileOperations.saveFile("kept.ink", "kept");
    await FileOperations.flush();
    FileOperations.resetForTests();

    const boom = () => { throw new Error("SecurityError"); };
    vi.spyOn(localStorage, "setItem").mockImplementation(boom);
    vi.spyOn(localStorage, "getItem").mockImplementation(boom);
    vi.spyOn(localStorage, "removeItem").mockImplementation(boom);
    vi.spyOn(localStorage, "key").mockImplementation(boom);

    await FileOperations.init();

    expect(FileOperations.checkAvailability().available).toBe(true);
    expect(FileOperations.loadFile("kept.ink")?.content).toBe("kept");
    expect(FileOperations.loadStartupFile()?.name).toBe("kept.ink");
    expect(FileOperations.deleteFile("kept.ink")).toBe(true);
    await FileOperations.flush();
  });
});

describe("FileOperations durable delete", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    localStorage.clear();
    FileOperations.resetForTests();
    await FileOperations.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("broadcasts only after the backend delete completes", async () => {
    const posted: unknown[] = [];
    vi.spyOn(BroadcastChannel.prototype, "postMessage").mockImplementation((message) => {
      posted.push(message);
    });
    FileOperations.resetForTests();
    await FileOperations.init();
    await FileOperations.saveFile("doc.ink", "x");
    await FileOperations.flush();
    posted.length = 0;

    expect(FileOperations.deleteFile("doc.ink")).toBe(true);
    expect(posted).toEqual([]);

    await FileOperations.flush();
    expect(posted).toEqual([{ type: "changed", name: "doc.ink" }]);
  });

  it("restores the cache and notifies when the backend delete fails", async () => {
    await FileOperations.saveFile("doc.ink", "x");
    await FileOperations.flush();
    vi.spyOn(IndexedDbBackend.prototype, "deleteFile").mockRejectedValueOnce(new Error("disk"));
    let notifications = 0;
    FileOperations.subscribe(() => { notifications += 1; });

    expect(FileOperations.deleteFile("doc.ink")).toBe(true);
    expect(FileOperations.loadFile("doc.ink")).toBeNull();
    expect(notifications).toBe(1);

    await FileOperations.flush();
    expect(FileOperations.loadFile("doc.ink")?.content).toBe("x");
    expect(notifications).toBe(2);
  });

  it("deleteFileDurably reports backend failure and does not broadcast", async () => {
    const posted: unknown[] = [];
    vi.spyOn(BroadcastChannel.prototype, "postMessage").mockImplementation((message) => {
      posted.push(message);
    });
    FileOperations.resetForTests();
    await FileOperations.init();
    await FileOperations.saveFile("doc.ink", "x");
    await FileOperations.flush();
    posted.length = 0;
    vi.spyOn(IndexedDbBackend.prototype, "deleteFile").mockRejectedValueOnce(new Error("disk"));

    await expect(FileOperations.deleteFileDurably("doc.ink")).resolves.toBe(false);
    expect(posted).toEqual([]);
    expect(FileOperations.loadFile("doc.ink")?.content).toBe("x");

    await expect(FileOperations.deleteFileDurably("doc.ink")).resolves.toBe(true);
    expect(FileOperations.loadFile("doc.ink")).toBeNull();
    expect(posted).toEqual([{ type: "changed", name: "doc.ink" }]);
  });

  it("does not resurrect a document re-created while the failed delete was pending", async () => {
    await FileOperations.saveFile("doc.ink", "x");
    await FileOperations.flush();
    vi.spyOn(IndexedDbBackend.prototype, "deleteFile").mockRejectedValueOnce(new Error("disk"));

    FileOperations.deleteFile("doc.ink");
    const resave = FileOperations.saveFile("doc.ink", "fresh");
    await FileOperations.flush();
    await resave;

    expect(FileOperations.loadFile("doc.ink")?.content).toBe("fresh");
  });

  it("restores the document when only snapshot cleanup fails, and the document survives reload", async () => {
    await FileOperations.saveFile("doc.ink", "one");
    await FileOperations.saveFile("doc.ink", "two");
    await FileOperations.flush();
    vi.spyOn(IndexedDbBackend.prototype, "deleteAllSnapshots").mockRejectedValueOnce(new Error("disk"));

    await expect(FileOperations.deleteFileDurably("doc.ink")).resolves.toBe(false);
    expect(FileOperations.loadFile("doc.ink")?.content).toBe("two");

    FileOperations.resetForTests();
    await FileOperations.init();
    expect(FileOperations.loadFile("doc.ink")?.content).toBe("two");
  });

  it("renameFile returns false when retiring the old name fails", async () => {
    await FileOperations.saveFile("old.ink", "x");
    await FileOperations.flush();
    vi.spyOn(IndexedDbBackend.prototype, "deleteFile").mockRejectedValueOnce(new Error("disk"));

    await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(false);
    expect(FileOperations.loadFile("old.ink")?.content).toBe("x");
    expect(FileOperations.loadFile("new.ink")).toBeNull();

    await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(true);
    expect(FileOperations.loadFile("old.ink")).toBeNull();
  });

  it("renameFile stores replacement content and settings under the new name", async () => {
    await FileOperations.saveFile("old.ink", "stored", { title: "Old" });
    await FileOperations.flush();

    await expect(FileOperations.renameFile("old.ink", "new.ink", {
      content: "live buffer",
      settings: { title: "New" },
    })).resolves.toBe(true);
    await FileOperations.flush();

    expect(FileOperations.loadFile("new.ink")).toMatchObject({ content: "live buffer", settings: { title: "New" } });
    expect(FileOperations.loadFile("old.ink")).toBeNull();
  });

  describe("renameFile active-file pointer", () => {
    const failNextDelete = () =>
      vi.spyOn(IndexedDbBackend.prototype, "deleteFile").mockRejectedValueOnce(new Error("disk"));

    it("follows the renamed file when it was active", async () => {
      await FileOperations.saveFile("other.ink", "o");
      await FileOperations.saveFile("old.ink", "x");
      await FileOperations.flush();
      expect(FileOperations.getActiveFileName()).toBe("old.ink");

      await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(true);
      expect(FileOperations.getActiveFileName()).toBe("new.ink");
    });

    it("keeps the old name active when the rename rolls back", async () => {
      // "other" is the most recently modified file, so a naive delete would
      // repoint at it instead of the document the user was editing.
      await FileOperations.saveFile("old.ink", "x");
      await FileOperations.saveFile("other.ink", "o");
      FileOperations.setActiveFile("old.ink");
      await FileOperations.flush();
      failNextDelete();

      await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(false);
      expect(FileOperations.loadFile("old.ink")?.content).toBe("x");
      expect(FileOperations.loadFile("new.ink")).toBeNull();
      expect(FileOperations.getActiveFileName()).toBe("old.ink");
    });

    it("leaves another active file alone on success", async () => {
      await FileOperations.saveFile("old.ink", "x");
      await FileOperations.saveFile("active.ink", "a");
      await FileOperations.flush();

      await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(true);
      expect(FileOperations.getActiveFileName()).toBe("active.ink");
    });

    it("leaves another active file alone when the rename rolls back", async () => {
      await FileOperations.saveFile("old.ink", "x");
      await FileOperations.saveFile("active.ink", "a");
      await FileOperations.flush();
      failNextDelete();

      await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(false);
      expect(FileOperations.getActiveFileName()).toBe("active.ink");
    });

    it("does not make anything active when nothing was", async () => {
      await FileOperations.saveFile("old.ink", "x");
      await FileOperations.flush();
      // Documents live in IndexedDB; localStorage only holds the pointer here.
      localStorage.clear();
      expect(FileOperations.getActiveFileName()).toBeNull();

      await expect(FileOperations.renameFile("old.ink", "new.ink")).resolves.toBe(true);
      expect(FileOperations.getActiveFileName()).toBeNull();
    });
  });
});
