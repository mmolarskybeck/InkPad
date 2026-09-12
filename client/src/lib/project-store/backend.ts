import type { HtmlExportFont, HtmlExportOptions } from "@/features/export/html-export-options";
import type { PreviewMode } from "@/types/story-runtime";

export interface StoredStorySettings {
  title?: string;
  author?: string;
  htmlExport?: HtmlExportOptions;
  storyTypeface?: HtmlExportFont;
  previewMode?: PreviewMode;
}

export interface StoredInkDocument {
  name: string;
  content: string;
  settings?: StoredStorySettings;
  lastModified: number;
  lastSavedAt?: number; // When the file was last saved
}

export interface RecoveryDraft {
  name: string;
  content: string;
  settings?: StoredStorySettings;
  lastModified: number;
}

export interface Snapshot {
  timestamp: number;
  content: string;
  hash: string;
}

export type StorageBackendKind = "indexeddb" | "localstorage";

/**
 * Durable storage for project documents and their snapshots.
 *
 * Implementations are plain data stores: no caching, no business rules,
 * no quota-recovery logic. `FileOperations` owns the in-memory cache and all
 * policy (snapshot limits, quota cleanup, active-file tracking).
 *
 * All methods reject with the underlying error. A quota failure MUST surface
 * as an error whose `name` is `"QuotaExceededError"` so callers can react.
 */
export interface StorageBackend {
  readonly kind: StorageBackendKind;

  /** Open/prepare the store. Must be called once before any other method. */
  open(): Promise<void>;

  /** Every stored document, in no particular order. */
  loadAllFiles(): Promise<StoredInkDocument[]>;

  /** Insert or replace a document keyed by `doc.name`. */
  putFile(doc: StoredInkDocument): Promise<void>;

  /** Remove a document. Resolves normally if it does not exist. Does NOT touch snapshots. */
  deleteFile(name: string): Promise<void>;

  /** All snapshots for a document, in no particular order. */
  listSnapshots(fileName: string): Promise<Snapshot[]>;

  /** Insert or replace a snapshot keyed by (fileName, snapshot.timestamp). */
  putSnapshot(fileName: string, snapshot: Snapshot): Promise<void>;

  /** Remove the given snapshots. Missing timestamps are ignored. */
  deleteSnapshots(fileName: string, timestamps: number[]): Promise<void>;

  /** Remove every snapshot for a document. */
  deleteAllSnapshots(fileName: string): Promise<void>;

  /** Remove every document and every snapshot. Used by tests and migration rollback. */
  clear(): Promise<void>;
}
