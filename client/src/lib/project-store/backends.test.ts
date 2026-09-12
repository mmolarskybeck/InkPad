import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Snapshot, StorageBackend, StoredInkDocument } from "./backend";
import { IndexedDbBackend } from "./indexeddb-backend";
import { LocalStorageBackend, LOCAL_FILE_STORAGE_PREFIX } from "./localstorage-backend";

// Node's own built-in `localStorage` global (Node 22+) shadows jsdom's
// implementation and lacks a working `clear()`, so install a minimal
// in-memory Storage implementation before any test touches localStorage.
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

beforeAll(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

function doc(name: string, content: string, lastModified = 1): StoredInkDocument {
  return { name, content, lastModified, lastSavedAt: lastModified };
}

const backends: Array<[string, () => Promise<StorageBackend>]> = [
  [
    "IndexedDbBackend",
    async () => {
      // fresh database per test
      globalThis.indexedDB = new IDBFactory();
      const backend = new IndexedDbBackend();
      await backend.open();
      return backend;
    },
  ],
  [
    "LocalStorageBackend",
    async () => {
      localStorage.clear();
      const backend = new LocalStorageBackend();
      await backend.open();
      return backend;
    },
  ],
];

describe.each(backends)("%s", (_name, createBackend) => {
  let backend: StorageBackend;
  beforeEach(async () => {
    backend = await createBackend();
  });

  it("starts empty", async () => {
    await expect(backend.loadAllFiles()).resolves.toEqual([]);
  });

  it("puts and loads files", async () => {
    await backend.putFile(doc("a.ink", "A"));
    await backend.putFile(doc("b.ink", "B"));
    const files = await backend.loadAllFiles();
    files.sort((a, b) => a.name.localeCompare(b.name));
    expect(files).toEqual([doc("a.ink", "A"), doc("b.ink", "B")]);
  });

  it("putFile replaces an existing document by name", async () => {
    await backend.putFile(doc("a.ink", "A", 1));
    await backend.putFile(doc("a.ink", "A2", 2));
    const files = await backend.loadAllFiles();
    expect(files).toHaveLength(1);
    expect(files[0].content).toBe("A2");
  });

  it("deleteFile removes only that document and leaves snapshots alone", async () => {
    await backend.putFile(doc("a.ink", "A"));
    await backend.putFile(doc("b.ink", "B"));
    await backend.putSnapshot("a.ink", { timestamp: 5, content: "old", hash: "h" });

    await backend.deleteFile("a.ink");

    const files = await backend.loadAllFiles();
    expect(files.map((f) => f.name)).toEqual(["b.ink"]);

    const snapshots = await backend.listSnapshots("a.ink");
    expect(snapshots).toHaveLength(1);

    await expect(backend.deleteFile("missing.ink")).resolves.not.toThrow();
  });

  it("snapshots are scoped by file name", async () => {
    await backend.putSnapshot("a.ink", { timestamp: 1, content: "a1", hash: "h1" });
    await backend.putSnapshot("a.ink", { timestamp: 2, content: "a2", hash: "h2" });
    await backend.putSnapshot("b.ink", { timestamp: 3, content: "b1", hash: "h3" });

    const aSnapshots = await backend.listSnapshots("a.ink");
    const aTimestamps = aSnapshots.map((s) => s.timestamp).sort((x, y) => x - y);
    expect(aTimestamps).toEqual([1, 2]);

    const bSnapshots = await backend.listSnapshots("b.ink");
    expect(bSnapshots.map((s) => s.timestamp)).toEqual([3]);

    for (const snapshot of aSnapshots) {
      const expected: Snapshot = { timestamp: snapshot.timestamp, content: snapshot.content, hash: snapshot.hash };
      expect(snapshot).toEqual(expected);
    }
  });

  it("putSnapshot replaces by (fileName, timestamp)", async () => {
    await backend.putSnapshot("a.ink", { timestamp: 1, content: "x", hash: "hx" });
    await backend.putSnapshot("a.ink", { timestamp: 1, content: "y", hash: "hy" });

    const snapshots = await backend.listSnapshots("a.ink");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].content).toBe("y");
  });

  it("deleteSnapshots removes the given timestamps and ignores missing ones", async () => {
    await backend.putSnapshot("a.ink", { timestamp: 1, content: "a1", hash: "h1" });
    await backend.putSnapshot("a.ink", { timestamp: 2, content: "a2", hash: "h2" });
    await backend.putSnapshot("a.ink", { timestamp: 3, content: "a3", hash: "h3" });

    await backend.deleteSnapshots("a.ink", [1, 3, 99]);

    const snapshots = await backend.listSnapshots("a.ink");
    expect(snapshots.map((s) => s.timestamp)).toEqual([2]);

    await expect(backend.deleteSnapshots("a.ink", [])).resolves.not.toThrow();
  });

  it("deleteAllSnapshots clears one file's snapshots only", async () => {
    await backend.putSnapshot("a.ink", { timestamp: 1, content: "a1", hash: "h1" });
    await backend.putSnapshot("a.ink", { timestamp: 2, content: "a2", hash: "h2" });
    await backend.putSnapshot("b.ink", { timestamp: 3, content: "b1", hash: "h3" });

    await backend.deleteAllSnapshots("a.ink");

    expect(await backend.listSnapshots("a.ink")).toEqual([]);
    expect(await backend.listSnapshots("b.ink")).toHaveLength(1);
  });

  it("clear removes all files and snapshots", async () => {
    await backend.putFile(doc("a.ink", "A"));
    await backend.putSnapshot("a.ink", { timestamp: 1, content: "a1", hash: "h1" });

    await backend.clear();

    expect(await backend.loadAllFiles()).toEqual([]);
    expect(await backend.listSnapshots("a.ink")).toEqual([]);
  });

  it("snapshot key with unusual characters in file name round-trips", async () => {
    const fileName = "my story (draft):v2.inkpad";
    await backend.putSnapshot(fileName, { timestamp: 7, content: "c", hash: "h" });

    const snapshots = await backend.listSnapshots(fileName);
    expect(snapshots).toEqual([{ timestamp: 7, content: "c", hash: "h" }]);

    await backend.deleteAllSnapshots(fileName);
    expect(await backend.listSnapshots(fileName)).toEqual([]);
  });
});

describe("LocalStorageBackend key scheme", () => {
  it("uses the legacy v2 key layout", async () => {
    localStorage.clear();
    const backend = new LocalStorageBackend();
    await backend.open();

    await backend.putFile(doc("a.ink", "A"));
    await backend.putSnapshot("a.ink", { timestamp: 9, content: "snap", hash: "h9" });

    const fileRaw = localStorage.getItem(LOCAL_FILE_STORAGE_PREFIX + "a.ink");
    expect(fileRaw).not.toBeNull();
    expect(JSON.parse(fileRaw as string).content).toBe("A");

    const snapshotRaw = localStorage.getItem(LOCAL_FILE_STORAGE_PREFIX + "a.ink:snap:9");
    expect(snapshotRaw).not.toBeNull();
    expect(JSON.parse(snapshotRaw as string).timestamp).toBe(9);

    localStorage.setItem("inkpad:v2:active-file", "a.ink");
    await backend.clear();
    expect(localStorage.getItem("inkpad:v2:active-file")).toBe("a.ink");
  });
});
