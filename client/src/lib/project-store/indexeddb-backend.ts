import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Snapshot, StorageBackend, StoredInkDocument } from "./backend";

export const INKPAD_DB_NAME = "inkpad";
export const INKPAD_DB_VERSION = 1;

interface SnapshotRecord extends Snapshot {
  fileName: string;
}

interface InkPadDB extends DBSchema {
  files: { key: string; value: StoredInkDocument };
  snapshots: {
    key: [string, number];
    value: SnapshotRecord;
    indexes: { byFile: string };
  };
}

export class IndexedDbBackend implements StorageBackend {
  readonly kind = "indexeddb" as const;
  private db: IDBPDatabase<InkPadDB> | null = null;

  async open(): Promise<void> {
    if (this.db) {
      return;
    }
    this.db = await openDB<InkPadDB>(INKPAD_DB_NAME, INKPAD_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "name" });
        }
        if (!db.objectStoreNames.contains("snapshots")) {
          const store = db.createObjectStore("snapshots", {
            keyPath: ["fileName", "timestamp"],
          });
          store.createIndex("byFile", "fileName");
        }
      },
    });
  }

  private getDb(): IDBPDatabase<InkPadDB> {
    if (!this.db) {
      throw new Error("IndexedDbBackend is not open");
    }
    return this.db;
  }

  loadAllFiles(): Promise<StoredInkDocument[]> {
    return this.getDb().getAll("files");
  }

  async putFile(doc: StoredInkDocument): Promise<void> {
    await this.getDb().put("files", doc);
  }

  async deleteFile(name: string): Promise<void> {
    await this.getDb().delete("files", name);
  }

  async listSnapshots(fileName: string): Promise<Snapshot[]> {
    const records = await this.getDb().getAllFromIndex("snapshots", "byFile", fileName);
    return records.map(({ fileName: _ignored, ...snapshot }) => snapshot);
  }

  async putSnapshot(fileName: string, snapshot: Snapshot): Promise<void> {
    await this.getDb().put("snapshots", { ...snapshot, fileName });
  }

  async deleteSnapshots(fileName: string, timestamps: number[]): Promise<void> {
    if (timestamps.length === 0) {
      return;
    }
    const tx = this.getDb().transaction("snapshots", "readwrite");
    await Promise.all([
      ...timestamps.map((t) => tx.store.delete([fileName, t] as [string, number])),
      tx.done,
    ]);
  }

  async deleteAllSnapshots(fileName: string): Promise<void> {
    const tx = this.getDb().transaction("snapshots", "readwrite");
    let cursor = await tx.store.index("byFile").openCursor(fileName);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  async clear(): Promise<void> {
    const tx = this.getDb().transaction(["files", "snapshots"], "readwrite");
    await Promise.all([
      tx.objectStore("files").clear(),
      tx.objectStore("snapshots").clear(),
      tx.done,
    ]);
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}
