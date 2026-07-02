export const THEME_NAMES = ["light", "dark", "high-contrast", "sepia"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];
export type MetadataField = "title" | "author" | "theme";

export interface StoryMetadata {
  title: string;
  author: string | null;
  theme: ThemeName | null;
  sourceFields: Set<MetadataField>;
}

export interface TagWarning {
  field: MetadataField;
  value: string;
  message: string;
  line?: number;
}

export interface ParsedGlobalTags {
  metadata: {
    title?: string;
    author?: string | null;
    theme?: ThemeName;
  };
  warnings: TagWarning[];
}

export interface StoredMetadataFallbacks {
  title?: string;
  author?: string | null;
  theme?: ThemeName | null;
}

function isThemeName(value: string): value is ThemeName {
  return (THEME_NAMES as readonly string[]).includes(value);
}

function parseTag(tag: string): { field: string; value: string } | null {
  const separatorIndex = tag.indexOf(":");
  if (separatorIndex < 0) return null;

  return {
    field: tag.slice(0, separatorIndex).trim().toLowerCase(),
    value: tag.slice(separatorIndex + 1).trim(),
  };
}

export function parseGlobalTags(tags: readonly string[] | null | undefined): ParsedGlobalTags {
  const metadata: ParsedGlobalTags["metadata"] = {};
  const warnings: TagWarning[] = [];

  for (const tag of tags ?? []) {
    const parsed = parseTag(tag);
    if (!parsed) continue;

    if (parsed.field === "title") {
      if (!parsed.value) {
        warnings.push({
          field: "title",
          value: parsed.value,
          message: "The global title tag is empty and will be ignored.",
        });
      } else {
        metadata.title = parsed.value;
      }
    } else if (parsed.field === "author") {
      metadata.author = parsed.value || null;
    } else if (parsed.field === "theme") {
      const normalizedTheme = parsed.value.toLowerCase();
      if (isThemeName(normalizedTheme)) {
        metadata.theme = normalizedTheme;
      } else {
        warnings.push({
          field: "theme",
          value: parsed.value,
          message: parsed.value
            ? `Unknown story theme "${parsed.value}". Use light, dark, high-contrast, or sepia.`
            : "The global theme tag is empty. Use light, dark, high-contrast, or sepia.",
        });
      }
    }
  }

  return { metadata, warnings };
}

export function resolveMetadata(
  parsedTags: ParsedGlobalTags,
  storedSettings: StoredMetadataFallbacks,
  filename: string,
): StoryMetadata {
  const sourceFields = new Set<MetadataField>();
  const filenameTitle = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .trim();

  const hasSourceTitle = Object.prototype.hasOwnProperty.call(parsedTags.metadata, "title");
  const hasSourceAuthor = Object.prototype.hasOwnProperty.call(parsedTags.metadata, "author");
  const hasSourceTheme = Object.prototype.hasOwnProperty.call(parsedTags.metadata, "theme");

  if (hasSourceTitle) sourceFields.add("title");
  if (hasSourceAuthor) sourceFields.add("author");
  if (hasSourceTheme) sourceFields.add("theme");

  return {
    title: (
      parsedTags.metadata.title
      ?? storedSettings.title?.trim()
      ?? filenameTitle
    ) || "Untitled Story",
    author: hasSourceAuthor
      ? parsedTags.metadata.author ?? null
      : storedSettings.author?.trim() || null,
    theme: parsedTags.metadata.theme ?? storedSettings.theme ?? null,
    sourceFields,
  };
}

export function attachTagWarningLines(
  warnings: readonly TagWarning[],
  source: string,
): TagWarning[] {
  const lines = source.split(/\r?\n/);
  const globalTagLines: Array<{ line: number; field: string; value: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (!trimmed.startsWith("#")) break;

    const parsed = parseTag(trimmed.slice(1));
    if (parsed) {
      globalTagLines.push({ line: index + 1, ...parsed });
    }
  }

  return warnings.map((warning) => {
    let matchingLine: number | undefined;

    globalTagLines.forEach((parsed) => {
      if (
        parsed.field === warning.field
        && parsed.value.toLowerCase() === warning.value.toLowerCase()
      ) {
        matchingLine = parsed.line;
      }
    });

    return { ...warning, line: matchingLine };
  });
}
