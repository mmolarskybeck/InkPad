import { simpleHash } from "@/lib/string-hash";
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

const LOCAL_FILE_STORAGE_SCHEMA_VERSION = 2;

export class FileOperations {
  private static readonly STORAGE_PREFIX = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:file:`;
  private static readonly ACTIVE_FILE_KEY = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:active-file`;
  private static readonly RECOVERY_DRAFT_KEY = `inkpad:v${LOCAL_FILE_STORAGE_SCHEMA_VERSION}:recovery-draft`;
  private static readonly SNAPSHOT_PREFIX = ':snap:';
  private static readonly MAX_SNAPSHOTS = 10;

  static checkAvailability(): { available: boolean; reason: 'quota-exceeded' | 'unavailable' | null } {
    const testKey = '__inkpad_storage_test__';
    try {
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return { available: true, reason: null };
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        return { available: false, reason: 'quota-exceeded' };
      }
      return { available: false, reason: 'unavailable' };
    }
  }

  static async saveFile(
    filename: string,
    source: string,
    settings?: StoredStorySettings,
  ): Promise<void> {
    const key = this.STORAGE_PREFIX + filename;
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

    try {
      // Create snapshot of previous version if it exists
      if (existingDocument && contentChanged) {
        await this.createSnapshot(filename, existingDocument.content, existingDocument.lastModified);
      }

      // Attempt to save
      localStorage.setItem(key, JSON.stringify(storedDocument));
      this.setActiveFile(filename);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Handle quota exceeded by cleaning up old snapshots
        const cleaned = await this.cleanupSnapshots(filename, 3);
        if (cleaned > 0) {
          try {
            // Retry save after cleanup
            localStorage.setItem(key, JSON.stringify(storedDocument));
            this.setActiveFile(filename);
          } catch (retryError) {
            throw new Error('Storage quota exceeded even after cleanup. Please export your work and free up space.');
          }
        } else {
          throw new Error('Storage quota exceeded. Please export your work and free up space.');
        }
      } else {
        throw error;
      }
    }
  }

  static loadFile(filename: string): StoredInkDocument | null {
    const key = this.STORAGE_PREFIX + filename;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const storedDocument = JSON.parse(data) as StoredInkDocument;
        // Ensure lastSavedAt exists (for backward compatibility)
        if (!storedDocument.lastSavedAt) {
          storedDocument.lastSavedAt = storedDocument.lastModified;
        }
        return storedDocument;
      } catch (error) {
        console.error('Error parsing file data:', error);
        return null;
      }
    }
    return null;
  }

  static fileExists(filename: string): boolean {
    return localStorage.getItem(this.STORAGE_PREFIX + filename) !== null;
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
    return localStorage.getItem(this.ACTIVE_FILE_KEY);
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
        // Free snapshot space for all known files and retry once
        const fileNames = this.getAllFiles().map(f => f.name);
        for (const name of fileNames) {
          this.cleanupSnapshots(name, Number.MAX_SAFE_INTEGER);
        }
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
    const data = localStorage.getItem(this.RECOVERY_DRAFT_KEY);
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
    const storedDocuments: StoredInkDocument[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX) && !key.includes(this.SNAPSHOT_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const storedDocument = JSON.parse(data) as StoredInkDocument;
            // Ensure lastSavedAt exists (for backward compatibility)
            if (!storedDocument.lastSavedAt) {
              storedDocument.lastSavedAt = storedDocument.lastModified;
            }
            storedDocuments.push(storedDocument);
          } catch (error) {
            console.error('Error parsing file data:', error);
          }
        }
      }
    }
    return storedDocuments.sort((a, b) => b.lastModified - a.lastModified);
  }

  static deleteFile(fileName: string): boolean {
    const key = this.STORAGE_PREFIX + fileName;
    if (localStorage.getItem(key)) {
      // Delete main file
      localStorage.removeItem(key);
      
      // Delete all snapshots for this file
      this.cleanupSnapshots(fileName, Number.MAX_SAFE_INTEGER);

      if (this.getActiveFileName() === fileName) {
        const nextFile = this.getAllFiles()[0]?.name;
        if (nextFile) {
          this.setActiveFile(nextFile);
        } else {
          localStorage.removeItem(this.ACTIVE_FILE_KEY);
        }
      }

      this.clearRecoveryDraft(fileName);
      
      return true;
    }
    return false;
  }

  static async duplicateFile(sourceName: string, requestedName?: string): Promise<StoredInkDocument | null> {
    const sourceFile = this.loadFile(sourceName);
    if (!sourceFile) return null;

    const fallbackName = sourceName.replace(/(\.ink)?$/i, "-copy.ink");
    const nextName = this.getAvailableFileName(requestedName || fallbackName, sourceName);
    await this.saveFile(nextName, sourceFile.content, sourceFile.settings);
    return this.loadFile(nextName);
  }

  // Rename a file (move to new key, optionally migrate snapshots)
  static async renameFile(oldName: string, newName: string, migrateSnapshots = false): Promise<boolean> {
    const fileData = this.loadFile(oldName);
    if (!fileData) return false;

    try {
      // Save under new name
      fileData.name = newName;
      await this.saveFile(newName, fileData.content, fileData.settings);

      // Optionally migrate snapshots
      if (migrateSnapshots) {
        const snapshots = this.getSnapshots(oldName);
        for (const snapshot of snapshots) {
          const newKey = `${this.STORAGE_PREFIX}${newName}${this.SNAPSHOT_PREFIX}${snapshot.timestamp}`;
          localStorage.setItem(newKey, JSON.stringify(snapshot));
        }
      }

      // Delete old file and its snapshots
      this.deleteFile(oldName);
      
      return true;
    } catch (error) {
      console.error('Error renaming file:', error);
      return false;
    }
  }

  // Get file snapshots (for recovery UI)
  static getFileSnapshots(fileName: string): Array<{ timestamp: number; preview: string }> {
    return this.getSnapshots(fileName)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(snapshot => ({
        timestamp: snapshot.timestamp,
        preview: snapshot.content.substring(0, 100) + (snapshot.content.length > 100 ? '...' : '')
      }));
  }

  // Restore from snapshot
  static async restoreFromSnapshot(fileName: string, timestamp: number): Promise<boolean> {
    const snapshots = this.getSnapshots(fileName);
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
  private static async createSnapshot(fileName: string, content: string, timestamp: number): Promise<void> {
    const hash = simpleHash(content);
    const snapshotKey = `${this.STORAGE_PREFIX}${fileName}${this.SNAPSHOT_PREFIX}${timestamp}`;
    
    const snapshot: Snapshot = {
      timestamp,
      content,
      hash
    };

    try {
      localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
      await this.cleanupSnapshots(fileName);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Purge all snapshots for this file and retry once before giving up
        await this.cleanupSnapshots(fileName, Number.MAX_SAFE_INTEGER);
        try {
          localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
        } catch {
          // Snapshot skipped — main save will still proceed normally
        }
      }
    }
  }

  // Clean up old snapshots, keeping only the most recent MAX_SNAPSHOTS
  private static async cleanupSnapshots(fileName: string, forceDeleteCount?: number): Promise<number> {
    const snapshots = this.getSnapshots(fileName);
    let deleteCount = forceDeleteCount || Math.max(0, snapshots.length - this.MAX_SNAPSHOTS);
    
    if (deleteCount <= 0) return 0;

    // Sort by timestamp (oldest first) and delete the oldest
    snapshots.sort((a, b) => a.timestamp - b.timestamp);
    let deletedCount = 0;

    for (let i = 0; i < Math.min(deleteCount, snapshots.length); i++) {
      const snapshotKey = `${this.STORAGE_PREFIX}${fileName}${this.SNAPSHOT_PREFIX}${snapshots[i].timestamp}`;
      try {
        localStorage.removeItem(snapshotKey);
        deletedCount++;
      } catch (error) {
        console.warn('Failed to delete snapshot:', error);
      }
    }

    return deletedCount;
  }

  // Get all snapshots for a file
  private static getSnapshots(fileName: string): Snapshot[] {
    const snapshots: Snapshot[] = [];
    const snapshotPrefix = `${this.STORAGE_PREFIX}${fileName}${this.SNAPSHOT_PREFIX}`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(snapshotPrefix)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            snapshots.push(JSON.parse(data) as Snapshot);
          }
        } catch (error) {
          console.error('Error parsing snapshot data:', error);
        }
      }
    }

    return snapshots;
  }
}
