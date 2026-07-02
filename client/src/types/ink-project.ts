export const INK_PROJECT_SCHEMA_VERSION = 1 as const;

export interface InkProjectFile {
  content: string;
}

export interface InkProject {
  schemaVersion: typeof INK_PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  entryFile: string;
  files: Record<string, InkProjectFile>;
}
