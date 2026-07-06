import {
  INK_PROJECT_SCHEMA_VERSION,
  type InkProject,
  type InkProjectFile,
} from "@/types/ink-project";
import {
  hasCaseInsensitiveInkProjectPathCollision,
  isNormalizedInkProjectPath,
  normalizeInkProjectPath,
} from "@/lib/ink-project-paths";
import { getDisplayTitleFromFilename, getFilename } from "@/lib/filename-utils";
import type { InkCompileInput } from "@/types/worker-messages";

function createProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createSingleFileProject({
  name,
  fileName,
  content,
  id = createProjectId(),
  /**
   * True when wrapping a document that predates this naming model (a returning
   * single-file save, or an import) — its name/filename/export name are treated
   * as already chosen so they're never auto-renamed out from under the user.
   * False for genuinely new/blank documents, which start auto-following.
   */
  explicit = false,
}: {
  name: string;
  fileName: string;
  content: string;
  id?: string;
  explicit?: boolean;
}): InkProject {
  const normalizedFileName = normalizeInkProjectPath(fileName);
  if (!normalizedFileName) {
    throw new Error("InkPad project file paths must be relative project paths.");
  }

  return {
    schemaVersion: INK_PROJECT_SCHEMA_VERSION,
    id,
    name,
    nameIsExplicit: explicit,
    fileNameIsExplicit: explicit,
    exportNameBase: name,
    exportNameIsExplicit: explicit,
    entryFile: normalizedFileName,
    files: {
      [normalizedFileName]: { content },
    },
  };
}

export function isInkProject(value: unknown): value is InkProject {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<InkProject>;
  if (
    candidate.schemaVersion !== INK_PROJECT_SCHEMA_VERSION
    || typeof candidate.id !== "string"
    || candidate.id.length === 0
    || typeof candidate.name !== "string"
    || candidate.name.length === 0
    || typeof candidate.nameIsExplicit !== "boolean"
    || typeof candidate.fileNameIsExplicit !== "boolean"
    || typeof candidate.exportNameBase !== "string"
    || candidate.exportNameBase.length === 0
    || typeof candidate.exportNameIsExplicit !== "boolean"
    || typeof candidate.entryFile !== "string"
    || !isNormalizedInkProjectPath(candidate.entryFile)
    || !candidate.files
    || typeof candidate.files !== "object"
  ) {
    return false;
  }

  const files = candidate.files as Record<string, Partial<InkProjectFile>>;
  const fileNames = Object.keys(files);

  return (
    fileNames.length > 0
    && !hasCaseInsensitiveInkProjectPathCollision(fileNames)
    && Object.prototype.hasOwnProperty.call(files, candidate.entryFile)
    && fileNames.every((fileName) => (
      isNormalizedInkProjectPath(fileName)
      && typeof files[fileName]?.content === "string"
    ))
  );
}

/**
 * Upgrades pre-naming-model project data (schema version 1, with no naming-pin
 * fields at all) to the current shape. Legacy projects are treated as already
 * explicit on every axis — they're never auto-renamed retroactively.
 */
function migrateToCurrentSchema(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion === INK_PROJECT_SCHEMA_VERSION) return value;

  const name = typeof candidate.name === "string" && candidate.name.length > 0
    ? candidate.name
    : "story";

  return {
    ...candidate,
    schemaVersion: INK_PROJECT_SCHEMA_VERSION,
    name,
    nameIsExplicit: true,
    fileNameIsExplicit: true,
    exportNameBase: name,
    exportNameIsExplicit: true,
  };
}

export function parseInkProject(value: unknown): InkProject {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("This project file does not contain valid JSON.");
    }
  }

  const migrated = migrateToCurrentSchema(parsed);

  if (!isInkProject(migrated)) {
    throw new Error("This project file is missing required InkPad project data.");
  }

  return migrated;
}

export function projectToCompileInput(project: InkProject): InkCompileInput {
  return {
    entryFile: project.entryFile,
    files: Object.fromEntries(
      Object.entries(project.files).map(([fileName, file]) => [fileName, file.content]),
    ),
  };
}

const INCLUDE_LINE_RE = /^([ \t]*INCLUDE[ \t]+)([^\r\n]+?)([ \t]*)(\r?\n|$)/gim;

/**
 * Rewrites `INCLUDE <oldPath>` references to `<newPath>` across a single
 * file's source. Used to keep multi-file projects compiling after a rename —
 * inkjs resolves INCLUDE by literal path lookup in the files map.
 */
export function rewriteIncludeReferences(source: string, oldPath: string, newPath: string): string {
  return source.replace(
    INCLUDE_LINE_RE,
    (match: string, prefix: string, includePath: string, trailingSpace: string, lineEnding: string) => (
      includePath.trim() === oldPath
        ? `${prefix}${newPath}${trailingSpace}${lineEnding}`
        : match
    ),
  );
}

function getAvailableProjectFileName(
  files: Record<string, InkProjectFile>,
  requestedName: string,
  currentName?: string,
): string {
  if (requestedName === currentName) return requestedName;
  if (!Object.prototype.hasOwnProperty.call(files, requestedName)) return requestedName;

  const match = requestedName.match(/^(.*?)(\.[^./]+)?$/);
  const base = match?.[1] ?? requestedName;
  const ext = match?.[2] ?? "";

  let counter = 2;
  let candidate = `${base} ${counter}${ext}`;
  while (
    Object.prototype.hasOwnProperty.call(files, candidate)
    && candidate !== currentName
  ) {
    counter += 1;
    candidate = `${base} ${counter}${ext}`;
  }
  return candidate;
}

/**
 * Rekeys a file within the project and rewrites any `INCLUDE` references to
 * it, without touching any naming-pin flags. Used both by explicit renames
 * (which additionally pin, see `renameProjectFile`) and by naming
 * auto-follow (which must not pin).
 */
function renameProjectFileKey(
  project: InkProject,
  oldFileName: string,
  requestedNewFileName: string,
): InkProject {
  if (!Object.prototype.hasOwnProperty.call(project.files, oldFileName)) return project;

  const normalizedRequested = normalizeInkProjectPath(requestedNewFileName);
  if (!normalizedRequested) return project;

  const newFileName = getAvailableProjectFileName(project.files, normalizedRequested, oldFileName);
  if (newFileName === oldFileName) return project;

  const nextFiles: Record<string, InkProjectFile> = {};
  for (const [fileName, file] of Object.entries(project.files)) {
    const rewrittenContent = rewriteIncludeReferences(file.content, oldFileName, newFileName);
    if (fileName === oldFileName) {
      nextFiles[newFileName] = { content: rewrittenContent };
    } else {
      nextFiles[fileName] = { content: rewrittenContent };
    }
  }

  return {
    ...project,
    entryFile: project.entryFile === oldFileName ? newFileName : project.entryFile,
    files: nextFiles,
  };
}

/**
 * Explicitly renames a file within the project (file rail, Settings "File
 * name", rename dialog). If the renamed file is the entry file, this pins
 * `fileNameIsExplicit` so it stops auto-following the project name.
 */
export function renameProjectFile(
  project: InkProject,
  oldFileName: string,
  requestedNewFileName: string,
): InkProject {
  const renamed = renameProjectFileKey(project, oldFileName, requestedNewFileName);
  if (oldFileName === project.entryFile && !renamed.fileNameIsExplicit) {
    return { ...renamed, fileNameIsExplicit: true };
  }
  return renamed;
}

function getProjectFileCopyName(fileName: string): string {
  const slashIndex = fileName.lastIndexOf("/");
  const directory = slashIndex === -1 ? "" : `${fileName.slice(0, slashIndex + 1)}`;
  const baseName = slashIndex === -1 ? fileName : fileName.slice(slashIndex + 1);
  const match = baseName.match(/^(.*?)(\.[^./]+)?$/);
  const base = match?.[1] || baseName;
  const ext = match?.[2] ?? "";
  return `${directory}${base}-copy${ext}`;
}

export function duplicateProjectFile(project: InkProject, fileName: string): InkProject {
  const sourceFile = project.files[fileName];
  if (!sourceFile) return project;

  const requestedName = getProjectFileCopyName(fileName);
  const copyName = getAvailableProjectFileName(project.files, requestedName);

  return {
    ...project,
    files: {
      ...project.files,
      [copyName]: { content: sourceFile.content },
    },
  };
}

export function deleteProjectFile(project: InkProject, fileName: string): InkProject {
  if (
    fileName === project.entryFile
    || !Object.prototype.hasOwnProperty.call(project.files, fileName)
    || Object.keys(project.files).length <= 1
  ) {
    return project;
  }

  const files: Record<string, InkProjectFile> = Object.fromEntries(
    Object.entries(project.files).filter(([candidate]) => candidate !== fileName),
  );
  return {
    ...project,
    files,
  };
}

export function pinProjectName(project: InkProject, nextName: string): InkProject {
  const trimmed = nextName.trim() || project.name;
  if (project.nameIsExplicit && project.name === trimmed) return project;
  return { ...project, name: trimmed, nameIsExplicit: true };
}

export function pinExportNameBase(project: InkProject, nextExportNameBase: string): InkProject {
  const trimmed = nextExportNameBase.trim() || project.exportNameBase;
  if (project.exportNameIsExplicit && project.exportNameBase === trimmed) return project;
  return { ...project, exportNameBase: trimmed, exportNameIsExplicit: true };
}

function getDerivedEntryFileName(name: string): string {
  return getFilename(name, ".ink");
}

export interface ReconcileProjectNamingOptions {
  /**
   * Set false to apply only the name/exportNameBase legs of the fan-out,
   * deferring the entry-file rename (callers debounce it because a rename
   * changes the storage key and editor identity mid-typing).
   */
  renameEntryFile?: boolean;
}

/**
 * Applies the tag → name → {entry file name, exportNameBase} fan-out
 * (see the naming plan). Pure and idempotent: returns the same reference
 * when nothing changes, so callers can use it directly inside a React
 * functional state update without triggering extra re-renders.
 *
 * Pass an empty `resolvedStoryTitle` to skip the title→name leg and only
 * fan the current name out to the file/export names (used after an
 * explicit project rename).
 */
export function reconcileProjectNaming(
  project: InkProject,
  resolvedStoryTitle: string,
  { renameEntryFile = true }: ReconcileProjectNamingOptions = {},
): InkProject {
  let next = project;

  if (!next.nameIsExplicit && next.name !== resolvedStoryTitle && resolvedStoryTitle) {
    next = { ...next, name: resolvedStoryTitle };
  }

  const fileCount = Object.keys(next.files).length;
  if (renameEntryFile && !next.fileNameIsExplicit && fileCount === 1) {
    const derivedFileName = getDerivedEntryFileName(next.name);
    // "story.ink" with name "Story" counts as in-sync: the name was derived
    // from the filename, so following it back would just churn the casing.
    const alreadyInSync = next.entryFile === derivedFileName
      || getDisplayTitleFromFilename(next.entryFile) === next.name;
    if (!alreadyInSync) {
      // renameProjectFileKey is a no-op (returns `next`) on collision/invalid path.
      next = renameProjectFileKey(next, next.entryFile, derivedFileName);
    }
  }

  if (!next.exportNameIsExplicit && next.exportNameBase !== next.name) {
    next = { ...next, exportNameBase: next.name };
  }

  return next;
}

/**
 * Prepares a project to be saved as an independent copy under a
 * user-chosen storage name (Save As): fresh id, and the chosen name is an
 * explicit naming act — it pins the entry file name (one-file projects,
 * where the storage key is the file) or the export name (multi-file).
 */
export function retargetProjectForCopy(project: InkProject, storageFileName: string): InkProject {
  const copy: InkProject = { ...project, id: createProjectId() };
  const fileCount = Object.keys(copy.files).length;

  if (fileCount === 1) {
    return renameProjectFile(copy, copy.entryFile, storageFileName);
  }

  return pinExportNameBase(copy, storageFileName.replace(/\.(?:inkpad|ink)$/i, ""));
}

/**
 * The storage key / download basis for this project: a one-file project is
 * named by its file, a multi-file project is named by the project itself.
 * The two never inherit from each other.
 */
export function getProjectStorageName(project: InkProject): string {
  const fileCount = Object.keys(project.files).length;
  return fileCount === 1
    ? project.entryFile
    : getFilename(project.exportNameBase, ".inkpad");
}
