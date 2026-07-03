import JSZip from "jszip";
import {
  INK_PROJECT_SCHEMA_VERSION,
  type InkProject,
  type InkProjectFile,
} from "@/types/ink-project";
import type { StoredStorySettings } from "@/lib/file-operations";
import type { HtmlExportFont, HtmlExportTheme } from "@/features/export/html-export-options";
import {
  hasCaseInsensitiveInkProjectPathCollision,
  normalizeInkProjectPath,
} from "@/lib/ink-project-paths";

export const INKPAD_BUNDLE_FORMAT_VERSION = 3 as const;

const MANIFEST_PATH = "inkpad.json";
const README_PATH = "README.txt";
const INK_ROOT = "ink/";
const ZIP_MIME_TYPE = "application/zip";

export interface InkPadBundleManifest {
  format: "inkpad";
  formatVersion: typeof INKPAD_BUNDLE_FORMAT_VERSION;
  schemaVersion: typeof INK_PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  entryFile: string;
  files: string[];
  settings?: StoredStorySettings;
}

export interface ParsedInkPadBundle {
  project: InkProject;
  settings?: StoredStorySettings;
}

function toArchiveInkPath(projectPath: string): string {
  return `${INK_ROOT}${projectPath}`;
}

function fromArchiveInkPath(archivePath: string): string | null {
  if (!archivePath.startsWith(INK_ROOT)) return null;
  return normalizeInkProjectPath(archivePath.slice(INK_ROOT.length));
}

function sanitizeSettings(value: unknown): StoredStorySettings | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as Record<string, unknown>;
  const settings: StoredStorySettings = {};

  if (typeof candidate.title === "string") settings.title = candidate.title;
  if (typeof candidate.author === "string") settings.author = candidate.author;
  if (
    candidate.previewMode === "transcript"
    || candidate.previewMode === "scene"
  ) {
    settings.previewMode = candidate.previewMode;
  }
  if (
    candidate.storyTypeface === "serif"
    || candidate.storyTypeface === "sans"
    || candidate.storyTypeface === "mono"
  ) {
    settings.storyTypeface = candidate.storyTypeface;
  }
  if (candidate.htmlExport && typeof candidate.htmlExport === "object") {
    const htmlExport = candidate.htmlExport as Record<string, unknown>;
    const title = typeof htmlExport.title === "string" ? htmlExport.title : "";
    const author = typeof htmlExport.author === "string" ? htmlExport.author : "";
    let theme: HtmlExportTheme | undefined;
    let font: HtmlExportFont | undefined;
    let includeReadme: boolean | undefined;
    if (
      htmlExport.theme === "light"
      || htmlExport.theme === "dark"
      || htmlExport.theme === "sepia"
      || htmlExport.theme === "high-contrast"
    ) {
      theme = htmlExport.theme;
    }
    if (
      htmlExport.font === "serif"
      || htmlExport.font === "sans"
      || htmlExport.font === "mono"
    ) {
      font = htmlExport.font;
    }
    if (typeof htmlExport.includeReadme === "boolean") {
      includeReadme = htmlExport.includeReadme;
    }
    if (theme && font && includeReadme !== undefined) {
      settings.htmlExport = {
        title,
        author,
        theme,
        font,
        includeReadme,
      };
    }
  }

  return Object.keys(settings).length > 0 ? settings : undefined;
}

function createManifest(project: InkProject, settings?: StoredStorySettings): InkPadBundleManifest {
  const filePaths = Object.keys(project.files);

  return {
    format: "inkpad",
    formatVersion: INKPAD_BUNDLE_FORMAT_VERSION,
    schemaVersion: INK_PROJECT_SCHEMA_VERSION,
    id: project.id,
    name: project.name,
    entryFile: toArchiveInkPath(project.entryFile),
    files: filePaths.map(toArchiveInkPath),
    ...(settings ? { settings } : {}),
  };
}

export async function createInkPadBundleBlob(
  project: InkProject,
  settings?: StoredStorySettings,
): Promise<Blob> {
  const zip = new JSZip();
  const manifest = createManifest(project, settings);

  zip.file(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  zip.file(README_PATH, [
    "This InkPad project is a ZIP archive.",
    "",
    "Ink source files live in the ink/ folder.",
    "Open the .inkpad file in InkPad, or rename/copy it to .zip to inspect it in Finder.",
    "",
  ].join("\n"));

  for (const [projectPath, file] of Object.entries(project.files)) {
    zip.file(toArchiveInkPath(projectPath), file.content);
  }

  return zip.generateAsync({ type: "blob", mimeType: ZIP_MIME_TYPE });
}

function assertManifest(value: unknown): InkPadBundleManifest {
  if (!value || typeof value !== "object") {
    throw new Error("inkpad.json is missing required InkPad bundle metadata.");
  }

  const candidate = value as Partial<InkPadBundleManifest>;
  if (
    candidate.format !== "inkpad"
    || candidate.formatVersion !== INKPAD_BUNDLE_FORMAT_VERSION
    || candidate.schemaVersion !== INK_PROJECT_SCHEMA_VERSION
    || typeof candidate.id !== "string"
    || candidate.id.length === 0
    || typeof candidate.name !== "string"
    || candidate.name.length === 0
    || typeof candidate.entryFile !== "string"
    || !Array.isArray(candidate.files)
    || candidate.files.length === 0
    || !candidate.files.every((filePath) => typeof filePath === "string")
  ) {
    throw new Error("inkpad.json is missing required InkPad bundle metadata.");
  }

  return {
    format: "inkpad",
    formatVersion: candidate.formatVersion,
    schemaVersion: candidate.schemaVersion,
    id: candidate.id,
    name: candidate.name,
    entryFile: candidate.entryFile,
    files: candidate.files,
    settings: sanitizeSettings(candidate.settings),
  };
}

export async function parseInkPadBundle(
  data: ArrayBuffer,
): Promise<ParsedInkPadBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("This InkPad project is not a readable ZIP archive.");
  }

  const manifestFile = zip.file(MANIFEST_PATH);
  if (!manifestFile) {
    throw new Error("This archive is missing inkpad.json.");
  }

  let manifest: InkPadBundleManifest;
  try {
    manifest = assertManifest(JSON.parse(await manifestFile.async("string")));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("inkpad.json does not contain valid JSON.");
    }
    throw error;
  }

  if (
    !manifest.entryFile.startsWith(INK_ROOT)
    || manifest.files.some((path) => !path.startsWith(INK_ROOT))
    || hasCaseInsensitiveInkProjectPathCollision(manifest.files)
  ) {
    throw new Error("This archive contains invalid or conflicting Ink file paths.");
  }

  const files: Record<string, InkProjectFile> = {};
  for (const archivePath of manifest.files) {
    const projectPath = fromArchiveInkPath(archivePath);
    const zipEntry = zip.file(archivePath);
    if (!projectPath || !zipEntry) {
      throw new Error(`This archive is missing ${archivePath}.`);
    }
    files[projectPath] = { content: await zipEntry.async("string") };
  }

  const entryFile = fromArchiveInkPath(manifest.entryFile);
  if (!entryFile || !Object.prototype.hasOwnProperty.call(files, entryFile)) {
    throw new Error("The InkPad bundle entry file is not listed in the archive.");
  }

  return {
    project: {
      schemaVersion: INK_PROJECT_SCHEMA_VERSION,
      id: manifest.id,
      name: manifest.name,
      nameIsExplicit: true,
      fileNameIsExplicit: true,
      exportNameBase: manifest.name,
      exportNameIsExplicit: true,
      entryFile,
      files,
    },
    settings: manifest.settings,
  };
}
