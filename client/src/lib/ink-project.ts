import {
  INK_PROJECT_SCHEMA_VERSION,
  type InkProject,
  type InkProjectFile,
} from "@/types/ink-project";
import {
  isNormalizedInkProjectPath,
  normalizeInkProjectPath,
} from "@/lib/ink-project-paths";
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
}: {
  name: string;
  fileName: string;
  content: string;
  id?: string;
}): InkProject {
  const normalizedFileName = normalizeInkProjectPath(fileName);
  if (!normalizedFileName) {
    throw new Error("InkPad project file paths must be relative project paths.");
  }

  return {
    schemaVersion: INK_PROJECT_SCHEMA_VERSION,
    id,
    name,
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
    && Object.prototype.hasOwnProperty.call(files, candidate.entryFile)
    && fileNames.every((fileName) => (
      isNormalizedInkProjectPath(fileName)
      && typeof files[fileName]?.content === "string"
    ))
  );
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

  if (!isInkProject(parsed)) {
    throw new Error("This project file is missing required InkPad project data.");
  }

  return parsed;
}

export function projectToCompileInput(project: InkProject): InkCompileInput {
  return {
    entryFile: project.entryFile,
    files: Object.fromEntries(
      Object.entries(project.files).map(([fileName, file]) => [fileName, file.content]),
    ),
  };
}
