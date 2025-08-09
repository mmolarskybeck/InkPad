export interface FileData {
  name: string;
  content: string;
  lastModified: number;
  lastSavedAt?: number; // When the file was last saved
}

export interface Snapshot {
  timestamp: number;
  content: string;
  hash: string;
}

export class FileOperations {
  private static readonly STORAGE_PREFIX = 'inkpad_';
  private static readonly SNAPSHOT_PREFIX = ':snap:';
  private static readonly MAX_SNAPSHOTS = 10;

  // Simple non-crypto hash for change detection
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  static async saveFile(fileName: string, content: string): Promise<void> {
    const key = this.STORAGE_PREFIX + fileName;
    const now = Date.now();
    const contentHash = this.simpleHash(content);
    
    // Check if content actually changed
    const existing = this.loadFile(fileName);
    if (existing && this.simpleHash(existing.content) === contentHash) {
      return; // No change, skip save
    }

    const fileData: FileData = {
      name: fileName,
      content,
      lastModified: now,
      lastSavedAt: now
    };

    try {
      // Create snapshot of previous version if it exists
      if (existing) {
        await this.createSnapshot(fileName, existing.content, existing.lastModified);
      }

      // Attempt to save
      localStorage.setItem(key, JSON.stringify(fileData));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Handle quota exceeded by cleaning up old snapshots
        const cleaned = await this.cleanupSnapshots(fileName, 3);
        if (cleaned > 0) {
          try {
            // Retry save after cleanup
            localStorage.setItem(key, JSON.stringify(fileData));
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

  static loadFile(fileName: string): FileData | null {
    const key = this.STORAGE_PREFIX + fileName;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const fileData = JSON.parse(data) as FileData;
        // Ensure lastSavedAt exists (for backward compatibility)
        if (!fileData.lastSavedAt) {
          fileData.lastSavedAt = fileData.lastModified;
        }
        return fileData;
      } catch (error) {
        console.error('Error parsing file data:', error);
        return null;
      }
    }
    return null;
  }

  static getAllFiles(): FileData[] {
    const files: FileData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX) && !key.includes(this.SNAPSHOT_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const fileData = JSON.parse(data) as FileData;
            // Ensure lastSavedAt exists (for backward compatibility)
            if (!fileData.lastSavedAt) {
              fileData.lastSavedAt = fileData.lastModified;
            }
            files.push(fileData);
          } catch (error) {
            console.error('Error parsing file data:', error);
          }
        }
      }
    }
    return files.sort((a, b) => b.lastModified - a.lastModified);
  }

  static deleteFile(fileName: string): boolean {
    const key = this.STORAGE_PREFIX + fileName;
    if (localStorage.getItem(key)) {
      // Delete main file
      localStorage.removeItem(key);
      
      // Delete all snapshots for this file
      this.cleanupSnapshots(fileName, Number.MAX_SAFE_INTEGER);
      
      return true;
    }
    return false;
  }

  // Rename a file (move to new key, optionally migrate snapshots)
  static async renameFile(oldName: string, newName: string, migrateSnapshots = false): Promise<boolean> {
    const fileData = this.loadFile(oldName);
    if (!fileData) return false;

    try {
      // Save under new name
      fileData.name = newName;
      await this.saveFile(newName, fileData.content);

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
      await this.saveFile(fileName, snapshot.content);
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
    const hash = this.simpleHash(content);
    const snapshotKey = `${this.STORAGE_PREFIX}${fileName}${this.SNAPSHOT_PREFIX}${timestamp}`;
    
    const snapshot: Snapshot = {
      timestamp,
      content,
      hash
    };

    try {
      localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
      
      // Clean up old snapshots to maintain max limit
      await this.cleanupSnapshots(fileName);
    } catch (error) {
      // If we can't create snapshot, continue with main save
      console.warn('Failed to create snapshot:', error);
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
