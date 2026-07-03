export const INK_PROJECT_SCHEMA_VERSION = 2 as const;

export interface InkProjectFile {
  content: string;
}

export interface InkProject {
  schemaVersion: typeof INK_PROJECT_SCHEMA_VERSION;
  id: string;
  /** Project Name — shown in the topbar. Auto-follows the resolved Story Title until pinned. */
  name: string;
  /** false = `name` auto-follows the resolved Story Title (the `# title:` tag in the entry file). */
  nameIsExplicit: boolean;
  /** false = the entry file's own name auto-follows `name`, but only while it's the project's only file. */
  fileNameIsExplicit: boolean;
  /** Basis for the .inkpad bundle name (and the multi-file local-save key). Independent of any individual file's name. */
  exportNameBase: string;
  /** false = `exportNameBase` auto-follows `name`. */
  exportNameIsExplicit: boolean;
  entryFile: string;
  files: Record<string, InkProjectFile>;
}
