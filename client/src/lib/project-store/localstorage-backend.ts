import type { Snapshot, StorageBackend, StoredInkDocument } from "./backend";

export const LOCAL_FILE_STORAGE_SCHEMA_VERSION = 2;
export const LOCAL_FILE_STORAGE_PREFIX = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:file:`;
export const LOCAL_SNAPSHOT_INFIX = ":snap:";

export class LocalStorageBackend implements StorageBackend {
  readonly kind = "localstorage" as const;

  private fileKey(name: string): string {
    return LOCAL_FILE_STORAGE_PREFIX + name;
  }

  private snapshotKey(name: string, timestamp: number): string {
    return LOCAL_FILE_STORAGE_PREFIX + name + LOCAL_SNAPSHOT_INFIX + timestamp;
  }

  private allKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        keys.push(key);
      }
    }
    return keys;
  }

  open(): Promise<void> {
    return Promise.resolve();
  }

  async loadAllFiles(): Promise<StoredInkDocument[]> {
    const docs: StoredInkDocument[] = [];
    for (const key of this.allKeys()) {
      if (key.startsWith(LOCAL_FILE_STORAGE_PREFIX) && !key.includes(LOCAL_SNAPSHOT_INFIX)) {
        const raw = localStorage.getItem(key);
        try {
          docs.push(JSON.parse(raw as string) as StoredInkDocument);
        } catch (error) {
          console.error("Error parsing file data:", error);
        }
      }
    }
    return docs;
  }

  async putFile(doc: StoredInkDocument): Promise<void> {
    localStorage.setItem(this.fileKey(doc.name), JSON.stringify(doc));
  }

  async deleteFile(name: string): Promise<void> {
    localStorage.removeItem(this.fileKey(name));
  }

  async listSnapshots(fileName: string): Promise<Snapshot[]> {
    const prefix = this.fileKey(fileName) + LOCAL_SNAPSHOT_INFIX;
    const snapshots: Snapshot[] = [];
    for (const key of this.allKeys()) {
      if (key.startsWith(prefix)) {
        const raw = localStorage.getItem(key);
        try {
          snapshots.push(JSON.parse(raw as string) as Snapshot);
        } catch (error) {
          console.error("Error parsing snapshot data:", error);
        }
      }
    }
    return snapshots;
  }

  async putSnapshot(fileName: string, snapshot: Snapshot): Promise<void> {
    localStorage.setItem(this.snapshotKey(fileName, snapshot.timestamp), JSON.stringify(snapshot));
  }

  async deleteSnapshots(fileName: string, timestamps: number[]): Promise<void> {
    for (const t of timestamps) {
      localStorage.removeItem(this.snapshotKey(fileName, t));
    }
  }

  async deleteAllSnapshots(fileName: string): Promise<void> {
    const prefix = this.fileKey(fileName) + LOCAL_SNAPSHOT_INFIX;
    for (const key of this.allKeys()) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  async clear(): Promise<void> {
    for (const key of this.allKeys()) {
      if (key.startsWith(LOCAL_FILE_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }
}
