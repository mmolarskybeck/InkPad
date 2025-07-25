export interface FileData {
  name: string;
  content: string;
  lastModified: number;
}

export class FileOperations {
  private static readonly STORAGE_PREFIX = 'inkpad_';

  static saveFile(fileName: string, content: string): void {
    const key = this.STORAGE_PREFIX + fileName;
    const fileData: FileData = {
      name: fileName,
      content,
      lastModified: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(fileData));
  }

  static loadFile(fileName: string): FileData | null {
    const key = this.STORAGE_PREFIX + fileName;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        return JSON.parse(data) as FileData;
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
      if (key && key.startsWith(this.STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            files.push(JSON.parse(data) as FileData);
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
      localStorage.removeItem(key);
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
}
