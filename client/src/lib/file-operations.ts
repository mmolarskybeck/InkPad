import { simpleHash } from "@/lib/string-hash";
import { parseInkProject } from "@/lib/ink-project";

export type { StoredStorySettings, StoredInkDocument, RecoveryDraft, Snapshot } from "@/lib/project-store/backend";
import type { Snapshot, StorageBackend, StoredInkDocument, StoredStorySettings, RecoveryDraft } from "@/lib/project-store/backend";
import { IndexedDbBackend, isIndexedDbAvailable } from "@/lib/project-store/indexeddb-backend";
import { LocalStorageBackend } from "@/lib/project-store/localstorage-backend";

const LOCAL_FILE_STORAGE_SCHEMA_VERSION = 2;
const LEGACY_ACTIVE_FILE_KEY = 'inkpad:active-file';
const LEGACY_RECOVERY_DRAFT_KEY = 'inkpad:recovery-draft';
const LEGACY_FILE_STORAGE_PREFIX = 'inkpad_';

const PROJECT_STORE_CHANNEL = "inkpad/project-store";

type StorageAvailability = { available: boolean; reason: 'quota-exceeded' | 'unavailable' | null };

function getProjectFileCount(content: string): number | null {
  try {
    return Object.keys(parseInkProject(content).files).length;
  } catch {
    return null;
  }
}

function getCopyFilename(sourceName: string, content: string): string {
  const projectFileCount = getProjectFileCount(content);
  const extension = projectFileCount !== null && projectFileCount > 1 ? ".inkpad" : ".ink";
  return `${sourceName.trim().replace(/\.(?:inkpad|ink)$/i, "")}-copy${extension}`;
}

export class FileOperations {
  private static readonly ACTIVE_FILE_KEY = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:active-file`;
  private static readonly RECOVERY_DRAFT_KEY = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:recovery-draft`;
  private static readonly LEGACY_CLEANUP_KEY = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:legacy-cleanup-complete`;
  private static readonly MAX_SNAPSHOTS = 10;

  private static backend: StorageBackend | null = null;
  private static cache = new Map<string, StoredInkDocument>();
  private static initPromise: Promise<void> | null = null;
  private static ready = false;
  private static availability: StorageAvailability = { available: false, reason: 'unavailable' };
  private static writeQueue: Promise<void> = Promise.resolve();
  private static listeners = new Set<() => void>();
  private static channel: BroadcastChannel | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  static init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private static async doInit(): Promise<void> {
    try {
      // a. Probe localStorage. A failure here is recorded but must not stop
      // IndexedDB from serving as the durable store; the active-file and
      // recovery-draft keys are conveniences, not the project store.
      const testKey = '__inkpad_storage_test__';
      let localAvailability: StorageAvailability;
      try {
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        localAvailability = { available: true, reason: null };
      } catch (error) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          localAvailability = { available: false, reason: 'quota-exceeded' };
        } else {
          localAvailability = { available: false, reason: 'unavailable' };
        }
      }

      // b. Drop pre-CodeMirror local saves.
      try {
        this.cleanupLegacyLocalSaves();
      } catch (error) {
        console.warn('Failed to clean up legacy local saves:', error);
      }

      // c. Choose a backend.
      let chosen: StorageBackend | null = null;
      if (isIndexedDbAvailable()) {
        try {
          const idb = new IndexedDbBackend();
          await idb.open();
          // If legacy data could not be moved across, serve it from
          // localStorage this session rather than hiding it behind an empty
          // IndexedDB store that later saves would shadow.
          if (await this.migrateFromLocalStorage(idb)) {
            chosen = idb;
            this.backend = idb;
            // Project storage is durable regardless of the localStorage probe.
            this.availability = { available: true, reason: null };
          }
        } catch (error) {
          console.warn("IndexedDB unavailable, falling back to localStorage", error);
          chosen = null;
        }
      }

      if (!chosen) {
        const local = new LocalStorageBackend();
        await local.open();
        this.backend = local;
        this.availability = localAvailability;
      }

      // d. Hydrate the in-memory cache.
      const docs = await this.requireBackend().loadAllFiles();
      this.cache.clear();
      for (const doc of docs) {
        if (!doc.lastSavedAt) doc.lastSavedAt = doc.lastModified;
        this.cache.set(doc.name, doc);
      }

      // e. Cross-tab change notifications.
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(PROJECT_STORE_CHANNEL);
        this.channel.onmessage = (event) => void this.handleRemoteChange(event.data);
      }

      // f. Reads are now allowed.
      this.ready = true;
    } catch (error) {
      console.error("InkPad storage failed to initialise:", error);
      this.availability = { available: false, reason: 'unavailable' };
      this.cache.clear();
      this.ready = true;
    }
  }

  /**
   * Returns false when legacy documents exist but could not be migrated.
   *
   * Documents and snapshots are reconciled independently so that a retry after
   * a partially completed migration still carries over whatever is missing, and
   * the legacy keys are only cleared after every document and snapshot has been
   * read back from IndexedDB.
   */
  private static async migrateFromLocalStorage(target: IndexedDbBackend): Promise<boolean> {
    const source = new LocalStorageBackend();
    let legacyDocs: StoredInkDocument[];
    let legacySnapshots: Map<string, Snapshot[]>;
    try {
      await source.open();
      legacyDocs = await source.loadAllFiles();
      legacySnapshots = new Map();
      for (const doc of legacyDocs) {
        legacySnapshots.set(doc.name, await source.listSnapshots(doc.name));
      }
    } catch (error) {
      // localStorage cannot be read at all, so there is nothing to migrate.
      console.warn("Legacy localStorage store unreadable; skipping migration:", error);
      return true;
    }

    if (legacyDocs.length === 0) {
      return true;
    }

    try {
      const existing = new Map((await target.loadAllFiles()).map(d => [d.name, d]));

      for (const doc of legacyDocs) {
        const current = existing.get(doc.name);
        if (!current || current.lastModified < doc.lastModified) {
          await target.putFile(doc);
        }
        const present = new Set((await target.listSnapshots(doc.name)).map(s => s.timestamp));
        for (const snapshot of legacySnapshots.get(doc.name) ?? []) {
          if (!present.has(snapshot.timestamp)) {
            await target.putSnapshot(doc.name, snapshot);
          }
        }
      }

      // Verify by reading back before touching the legacy keys.
      const migrated = new Set((await target.loadAllFiles()).map(d => d.name));
      for (const doc of legacyDocs) {
        if (!migrated.has(doc.name)) {
          throw new Error(`Document "${doc.name}" missing from IndexedDB after migration`);
        }
        const present = new Set((await target.listSnapshots(doc.name)).map(s => s.timestamp));
        for (const snapshot of legacySnapshots.get(doc.name) ?? []) {
          if (!present.has(snapshot.timestamp)) {
            throw new Error(`Snapshot ${snapshot.timestamp} of "${doc.name}" missing from IndexedDB after migration`);
          }
        }
      }

      await source.clear();
      return true;
    } catch (error) {
      console.error("Storage migration failed; localStorage data left in place:", error);
      return false;
    }
  }

  static flush(): Promise<void> {
    return this.writeQueue;
  }

  static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  static resetForTests(): void {
    this.backend = null;
    this.cache.clear();
    this.initPromise = null;
    this.ready = false;
    this.availability = { available: false, reason: 'unavailable' };
    this.writeQueue = Promise.resolve();
    this.listeners.clear();
    this.channel?.close();
    this.channel = null;
  }

  private static assertReady(): void {
    if (!this.ready) {
      throw new Error("FileOperations.init() must complete before use");
    }
  }

  private static notify(): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener();
      } catch (error) {
        console.error('Storage listener failed:', error);
      }
    }
  }

  private static enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.writeQueue.then(op);
    // A failed write must not wedge the queue, but its caller still sees it.
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  private static requireBackend(): StorageBackend {
    if (!this.backend) {
      throw new Error("FileOperations storage backend is not available");
    }
    return this.backend;
  }

  private static isQuotaError(e: unknown): boolean {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      return true;
    }
    return (
      typeof e === 'object'
      && e !== null
      && (e as { name?: string }).name === 'QuotaExceededError'
    );
  }

  private static broadcast(name: string): void {
    try {
      this.channel?.postMessage({ type: "changed", name });
    } catch (error) {
      console.warn('Failed to broadcast storage change:', error);
    }
  }

  private static async handleRemoteChange(data: unknown): Promise<void> {
    if (!this.backend) return;
    if (
      typeof data !== 'object'
      || data === null
      || (data as { type?: unknown }).type !== "changed"
      || typeof (data as { name?: unknown }).name !== 'string'
    ) {
      return;
    }

    const name = (data as { name: string }).name;
    try {
      const docs = await this.backend.loadAllFiles();
      const fresh = docs.find(d => d.name === name);
      if (fresh) {
        if (!fresh.lastSavedAt) fresh.lastSavedAt = fresh.lastModified;
        this.cache.set(name, fresh);
      } else {
        this.cache.delete(name);
      }
    } catch (error) {
      console.error('Failed to apply remote storage change:', error);
      return;
    }

    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  static checkAvailability(): StorageAvailability {
    return this.availability;
  }

  static async saveFile(
    filename: string,
    source: string,
    settings?: StoredStorySettings,
  ): Promise<void> {
    const now = Date.now();
    const sourceHash = simpleHash(source);

    // Check if content actually changed
    const existingDocument = this.loadFile(filename);
    const nextSettings = settings ?? existingDocument?.settings;
    const contentChanged = existingDocument
      ? simpleHash(existingDocument.content) !== sourceHash
      : true;
    const settingsUnchanged =
      JSON.stringify(existingDocument?.settings ?? {}) === JSON.stringify(nextSettings ?? {});
    if (
      existingDocument
      && !contentChanged
      && settingsUnchanged
    ) {
      this.setActiveFile(filename);
      return; // No change, skip save
    }

    const storedDocument: StoredInkDocument = {
      name: filename,
      content: source,
      settings: nextSettings,
      lastModified: now,
      lastSavedAt: now
    };

    const previous = existingDocument;
    this.cache.set(filename, storedDocument);
    this.setActiveFile(filename);
    await this.enqueue(async () => {
      const backend = this.requireBackend();
      if (previous && contentChanged) {
        await this.createSnapshot(backend, filename, previous.content, previous.lastModified);
      }
      try {
        await backend.putFile(storedDocument);
      } catch (error) {
        if (!this.isQuotaError(error)) throw error;
        const cleaned = await this.cleanupSnapshots(backend, filename, 3);
        if (cleaned === 0) throw new Error('Storage quota exceeded. Please export your work and free up space.');
        try { await backend.putFile(storedDocument); }
        catch { throw new Error('Storage quota exceeded even after cleanup. Please export your work and free up space.'); }
      }
    }).catch((error) => {
      // Roll the cache back so the UI does not believe an unsaved doc is
      // durable, unless a newer save for this name has already replaced it.
      if (this.cache.get(filename) === storedDocument) {
        if (previous) this.cache.set(filename, previous); else this.cache.delete(filename);
      }
      throw error;
    });
    this.broadcast(filename);
    this.notify();
  }

  static loadFile(filename: string): StoredInkDocument | null {
    this.assertReady();
    const storedDocument = this.cache.get(filename);
    return storedDocument ? { ...storedDocument } : null;
  }

  static fileExists(filename: string): boolean {
    this.assertReady();
    return this.cache.has(filename);
  }

  static getAvailableFileName(filename: string, excludeName?: string): string {
    if (!this.fileExists(filename) || filename === excludeName) {
      return filename;
    }

    const extensionMatch = filename.match(/(\.[^.]+)$/);
    const extension = extensionMatch?.[1] ?? "";
    const baseName = extension ? filename.slice(0, -extension.length) : filename;
    let counter = 2;
    let candidate = `${baseName}-${counter}${extension}`;

    while (this.fileExists(candidate) && candidate !== excludeName) {
      counter += 1;
      candidate = `${baseName}-${counter}${extension}`;
    }

    return candidate;
  }

  static setActiveFile(filename: string): void {
    try {
      localStorage.setItem(this.ACTIVE_FILE_KEY, filename);
    } catch (error) {
      console.warn('Failed to remember active file:', error);
    }
  }

  static getActiveFileName(): string | null {
    try {
      return localStorage.getItem(this.ACTIVE_FILE_KEY);
    } catch (error) {
      console.warn('Failed to read active file:', error);
      return null;
    }
  }

  static loadActiveFile(): StoredInkDocument | null {
    const activeFileName = this.getActiveFileName();
    return activeFileName ? this.loadFile(activeFileName) : null;
  }

  static loadStartupFile(): StoredInkDocument | RecoveryDraft | null {
    const activeFileName = this.getActiveFileName();
    const activeFile = activeFileName ? this.loadFile(activeFileName) : null;
    const recoveryDraft = this.loadRecoveryDraft();

    if (
      recoveryDraft &&
      (!activeFileName || recoveryDraft.name === activeFileName) &&
      recoveryDraft.lastModified >= (activeFile?.lastModified ?? 0)
    ) {
      return recoveryDraft;
    }

    if (activeFile) {
      return activeFile;
    }

    if (recoveryDraft && !this.loadFile(recoveryDraft.name)) {
      return recoveryDraft;
    }

    return this.getAllFiles()[0] ?? null;
  }

  static saveRecoveryDraft(
    filename: string,
    source: string,
    settings?: StoredStorySettings,
  ): void {
    const recoveryDraft: RecoveryDraft = {
      name: filename,
      content: source,
      settings,
      lastModified: Date.now(),
    };
    const value = JSON.stringify(recoveryDraft);

    try {
      localStorage.setItem(this.RECOVERY_DRAFT_KEY, value);
      this.setActiveFile(filename);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Free snapshot space for all known files in the background — the draft
        // path stays synchronous, so the retry does not wait on the purge.
        void this.enqueue(async () => {
          for (const name of Array.from(this.cache.keys())) await this.backend?.deleteAllSnapshots(name);
        });
        try {
          localStorage.setItem(this.RECOVERY_DRAFT_KEY, value);
          this.setActiveFile(filename);
        } catch {
          // Recovery draft skipped — autosave handles the primary save
        }
      }
    }
  }

  static loadRecoveryDraft(): RecoveryDraft | null {
    let data: string | null;
    try {
      data = localStorage.getItem(this.RECOVERY_DRAFT_KEY);
    } catch (error) {
      console.warn('Failed to read recovery draft:', error);
      return null;
    }
    if (!data) return null;

    try {
      return JSON.parse(data) as RecoveryDraft;
    } catch (error) {
      console.error('Error parsing recovery draft:', error);
      return null;
    }
  }

  static clearRecoveryDraft(filename?: string): void {
    if (filename) {
      const recoveryDraft = this.loadRecoveryDraft();
      if (recoveryDraft && recoveryDraft.name !== filename) {
        return;
      }
    }

    try {
      localStorage.removeItem(this.RECOVERY_DRAFT_KEY);
    } catch (error) {
      console.warn('Failed to clear recovery draft:', error);
    }
  }

  static getAllFiles(): StoredInkDocument[] {
    this.assertReady();
    return Array.from(this.cache.values())
      .map(d => ({ ...d }))
      .sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Optimistically removes a document from the cache and queues the durable
   * delete. Returns false synchronously when the document does not exist.
   * Use {@link deleteFileDurably} to await the backend result.
   */
  static deleteFile(fileName: string): boolean {
    return this.startDelete(fileName) !== null;
  }

  /** Like {@link deleteFile}, but resolves only once the delete is durable. */
  static async deleteFileDurably(fileName: string): Promise<boolean> {
    const pending = this.startDelete(fileName);
    if (!pending) return false;
    try {
      await pending;
      return true;
    } catch {
      return false;
    }
  }

  private static startDelete(fileName: string): Promise<void> | null {
    this.assertReady();
    const previous = this.cache.get(fileName);
    if (!previous) {
      return null;
    }

    this.cache.delete(fileName);

    if (this.getActiveFileName() === fileName) {
      const nextFile = this.getAllFiles()[0]?.name;
      if (nextFile) {
        this.setActiveFile(nextFile);
      } else {
        try {
          localStorage.removeItem(this.ACTIVE_FILE_KEY);
        } catch (error) {
          console.warn('Failed to clear active file:', error);
        }
      }
    }

    this.clearRecoveryDraft(fileName);
    this.notify();

    const pending = this.enqueue(async () => {
      const b = this.requireBackend();
      // Snapshots first: if this fails the document is still durable, so the
      // in-memory restore below reflects what survives a reload.
      await b.deleteAllSnapshots(fileName);
      await b.deleteFile(fileName);
    });
    pending.then(
      // Other tabs reload from the backend, so only tell them once it is gone.
      () => this.broadcast(fileName),
      (error) => {
        console.error('Failed to delete file from storage:', error);
        // Restore the optimistic removal unless a newer save re-created the name.
        if (!this.cache.has(fileName)) {
          this.cache.set(fileName, previous);
          this.notify();
        }
      },
    );
    return pending;
  }

  static async duplicateFile(sourceName: string, requestedName?: string): Promise<StoredInkDocument | null> {
    const sourceFile = this.loadFile(sourceName);
    if (!sourceFile) return null;

    const fallbackName = getCopyFilename(sourceName, sourceFile.content);
    const nextName = this.getAvailableFileName(requestedName || fallbackName, sourceName);
    await this.saveFile(nextName, sourceFile.content, sourceFile.settings);
    return this.loadFile(nextName);
  }

  // Rename a file (move to new key, optionally migrate snapshots)
  static async renameFile(oldName: string, newName: string, migrateSnapshots = false): Promise<boolean> {
    const fileData = this.loadFile(oldName);
    if (!fileData) return false;
    if (oldName === newName) return true;
    const destinationAlreadyExisted = this.fileExists(newName);

    try {
      // Save under new name
      fileData.name = newName;
      await this.saveFile(newName, fileData.content, fileData.settings);

      // Optionally migrate snapshots
      if (migrateSnapshots) {
        await this.enqueue(async () => {
          const b = this.requireBackend();
          const snaps = await b.listSnapshots(oldName);
          for (const s of snaps) await b.putSnapshot(newName, s);
        });
      }

      // Delete old file and its snapshots. The backend removes the document
      // last, so a failure means the old copy is still durable. Roll back the
      // destination we just created so the same rename can be retried without
      // colliding with a partial copy.
      const removedOldFile = await this.deleteFileDurably(oldName);
      if (!removedOldFile && !destinationAlreadyExisted) {
        const rolledBackDestination = await this.deleteFileDurably(newName);
        if (!rolledBackDestination) {
          console.error(`Failed to roll back partial rename destination "${newName}"`);
        }
      }
      return removedOldFile;
    } catch (error) {
      console.error('Error renaming file:', error);
      return false;
    }
  }

  // Get file snapshots (for recovery UI)
  static async getFileSnapshots(fileName: string): Promise<Array<{ timestamp: number; preview: string }>> {
    await this.flush();
    const snaps = await this.requireBackend().listSnapshots(fileName);
    return snaps
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(snapshot => ({
        timestamp: snapshot.timestamp,
        preview: snapshot.content.substring(0, 100) + (snapshot.content.length > 100 ? '...' : '')
      }));
  }

  // Restore from snapshot
  static async restoreFromSnapshot(fileName: string, timestamp: number): Promise<boolean> {
    await this.flush();
    const snapshots = await this.requireBackend().listSnapshots(fileName);
    const snapshot = snapshots.find(s => s.timestamp === timestamp);

    if (snapshot) {
      const existing = this.loadFile(fileName);
      await this.saveFile(fileName, snapshot.content, existing?.settings);
      return true;
    }

    return false;
  }

  static exportToBlob(content: string, mimeType: string = 'text/plain'): Blob {
    return new Blob([content], { type: mimeType });
  }

  static downloadFile(content: string, fileName: string, mimeType: string = 'text/plain'): void {
    const blob = this.exportToBlob(content, mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async loadFromFile(): Promise<{ fileName: string; content: string } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ink,.txt';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            resolve({ fileName: file.name, content });
          };
          reader.onerror = () => resolve(null);
          reader.readAsText(file);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  // Create a snapshot of the current file content
  private static async createSnapshot(
    backend: StorageBackend,
    fileName: string,
    content: string,
    timestamp: number,
  ): Promise<void> {
    const snapshot: Snapshot = {
      timestamp,
      content,
      hash: simpleHash(content),
    };

    try {
      await backend.putSnapshot(fileName, snapshot);
      await this.cleanupSnapshots(backend, fileName);
    } catch (error) {
      if (this.isQuotaError(error)) {
        // Purge all snapshots for this file and retry once before giving up
        await backend.deleteAllSnapshots(fileName);
        try {
          await backend.putSnapshot(fileName, snapshot);
        } catch {
          // Snapshot skipped — main save will still proceed normally
        }
      }
    }
  }

  // Clean up old snapshots, keeping only the most recent MAX_SNAPSHOTS
  private static async cleanupSnapshots(
    backend: StorageBackend,
    fileName: string,
    forceDeleteCount?: number,
  ): Promise<number> {
    const snapshots = await backend.listSnapshots(fileName);
    const deleteCount = forceDeleteCount || Math.max(0, snapshots.length - this.MAX_SNAPSHOTS);

    if (deleteCount <= 0) return 0;

    // Sort by timestamp (oldest first) and delete the oldest
    snapshots.sort((a, b) => a.timestamp - b.timestamp);
    const victims = snapshots
      .slice(0, Math.min(deleteCount, snapshots.length))
      .map(s => s.timestamp);

    await backend.deleteSnapshots(fileName, victims);

    return victims.length;
  }

  private static cleanupLegacyLocalSaves(): void {
    if (localStorage.getItem(this.LEGACY_CLEANUP_KEY) === '1') {
      return;
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key === LEGACY_ACTIVE_FILE_KEY || key === LEGACY_RECOVERY_DRAFT_KEY) {
        keysToRemove.push(key);
        continue;
      }

      if (!key.startsWith(LEGACY_FILE_STORAGE_PREFIX)) {
        continue;
      }

      const data = localStorage.getItem(key);
      if (!data) continue;

      try {
        const parsed = JSON.parse(data) as Partial<StoredInkDocument & Snapshot>;
        if (this.isLegacyStoredDocument(parsed) || this.isLegacySnapshot(parsed)) {
          keysToRemove.push(key);
        }
      } catch {
        // Leave unrelated inkpad_* preferences alone.
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    try {
      localStorage.setItem(this.LEGACY_CLEANUP_KEY, '1');
    } catch {
      // Cleanup is best-effort; storage availability checks handle quota issues.
    }
  }

  private static isLegacyStoredDocument(value: Partial<StoredInkDocument & Snapshot>): boolean {
    return (
      typeof value.name === 'string'
      && typeof value.content === 'string'
      && typeof value.lastModified === 'number'
    );
  }

  private static isLegacySnapshot(value: Partial<StoredInkDocument & Snapshot>): boolean {
    return (
      typeof value.timestamp === 'number'
      && typeof value.content === 'string'
      && typeof value.hash === 'string'
    );
  }
}
