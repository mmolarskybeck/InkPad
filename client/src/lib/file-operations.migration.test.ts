import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FileOperations } from "./file-operations";

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
});
