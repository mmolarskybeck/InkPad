/**
 * Utilities for reading and writing top-level Ink metadata tags.
 *
 * Top-level tags are # key: value lines that appear before the first knot,
 * stitch, or non-comment/non-tag content line. These carry story metadata
 * (title, author, theme) that can be read by InkPad and travel with the file.
 *
 * The parsing logic mirrors tag-interpreter.ts but operates on raw source text
 * rather than runtime-compiled global tags, so it works even when compilation
 * fails.
 */

import { THEME_NAMES } from "@/lib/tag-interpreter";
import type { MetadataField, ParsedGlobalTags } from "@/lib/tag-interpreter";

const METADATA_FIELD_ORDER: readonly MetadataField[] = ["title", "author", "theme"];

function parseTagLine(raw: string): { field: string; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("#")) return null;
  const body = trimmed.slice(1);
  const colonIndex = body.indexOf(":");
  if (colonIndex < 0) return null;
  return {
    field: body.slice(0, colonIndex).trim().toLowerCase(),
    value: body.slice(colonIndex + 1).trim(),
  };
}

interface TopLevelTagInfo {
  /** 0-based index of the first non-tag, non-blank, non-comment line. Equals lines.length if the whole file is tags/blanks. */
  firstContentLineIndex: number;
  /** Tag lines in document order. Each entry has the field name and 0-based line index. */
  tagLines: Array<{ lineIndex: number; field: string }>;
  /** Maps field name → 0-based line index (first occurrence only). */
  fieldToLineIndex: Record<string, number>;
}

function analyzeTopLevelTags(lines: string[]): TopLevelTagInfo {
  const tagLines: Array<{ lineIndex: number; field: string }> = [];
  const fieldToLineIndex: Record<string, number> = {};
  let firstContentLineIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (!trimmed.startsWith("#")) {
      firstContentLineIndex = i;
      break;
    }
    const parsed = parseTagLine(lines[i]);
    if (parsed && !(parsed.field in fieldToLineIndex)) {
      tagLines.push({ lineIndex: i, field: parsed.field });
      fieldToLineIndex[parsed.field] = i;
    }
  }

  return { firstContentLineIndex, tagLines, fieldToLineIndex };
}

/**
 * Parses top-level ink tags from raw source text, returning a ParsedGlobalTags
 * value compatible with parseGlobalTags() from tag-interpreter.ts.
 *
 * Use this when you need tag metadata but compilation may have failed — e.g.
 * the settings panel must show title/author/theme even when ink has errors.
 */
export function parseTagsFromSource(source: string): ParsedGlobalTags {
  const lines = source.split(/\r?\n/);
  const info = analyzeTopLevelTags(lines);
  const metadata: ParsedGlobalTags["metadata"] = {};
  const warnings: ParsedGlobalTags["warnings"] = [];

  for (const { lineIndex, field } of info.tagLines) {
    const parsed = parseTagLine(lines[lineIndex]);
    if (!parsed) continue;
    const value = parsed.value;

    if (field === "title") {
      if (!value) {
        warnings.push({
          field: "title",
          value,
          message: "The global title tag is empty and will be ignored.",
          line: lineIndex + 1,
        });
      } else {
        metadata.title = value;
      }
    } else if (field === "author") {
      metadata.author = value || null;
    } else if (field === "theme") {
      const normalized = value.toLowerCase();
      if ((THEME_NAMES as readonly string[]).includes(normalized)) {
        metadata.theme = normalized as ParsedGlobalTags["metadata"]["theme"];
      } else {
        warnings.push({
          field: "theme",
          value,
          message: value
            ? `Unknown story theme "${value}". Use light, dark, high-contrast, or sepia.`
            : "The global theme tag is empty. Use light, dark, high-contrast, or sepia.",
          line: lineIndex + 1,
        });
      }
    }
  }

  return { metadata, warnings };
}

/**
 * Returns the 1-indexed line number of the first top-level tag with the given
 * field name, or null if not found.
 *
 * Use this to implement "Show in file" navigation in Monaco.
 */
export function findTopLevelTagLine(
  source: string,
  field: MetadataField,
): number | null {
  const lines = source.split(/\r?\n/);
  const info = analyzeTopLevelTags(lines);
  const lineIndex = info.fieldToLineIndex[field.toLowerCase()];
  return lineIndex !== undefined ? lineIndex + 1 : null;
}

/**
 * Inserts or replaces a top-level ink tag, returning the updated source string.
 *
 * - If the tag already exists, the value is replaced in-place.
 * - If other top-level tags exist but this field is missing, inserts after the
 *   last tag in the block.
 * - If no tags exist at all, inserts at the very top of the file and ensures
 *   a blank line separates the new tag block from the first story content.
 */
export function setTopLevelTag(
  source: string,
  field: MetadataField,
  value: string,
): string {
  const lines = source.split(/\r?\n/);
  const info = analyzeTopLevelTags(lines);
  const fieldLower = field.toLowerCase();
  const newTagLine = `# ${fieldLower}: ${sanitizeTopLevelTagValue(value)}`;

  if (fieldLower in info.fieldToLineIndex) {
    lines[info.fieldToLineIndex[fieldLower]] = newTagLine;
    return lines.join("\n");
  }

  if (info.tagLines.length > 0) {
    // Insert at the canonically correct position (title → author → theme).
    // Find the first existing tag that should come after the new field.
    const newFieldOrder = METADATA_FIELD_ORDER.indexOf(fieldLower as MetadataField);
    let insertBeforeIndex: number | null = null;
    if (newFieldOrder !== -1) {
      for (const tagLine of info.tagLines) {
        const existingOrder = METADATA_FIELD_ORDER.indexOf(tagLine.field as MetadataField);
        if (existingOrder !== -1 && existingOrder > newFieldOrder) {
          insertBeforeIndex = tagLine.lineIndex;
          break;
        }
      }
    }

    if (insertBeforeIndex !== null) {
      lines.splice(insertBeforeIndex, 0, newTagLine);
    } else {
      const lastTagLineIndex = info.tagLines[info.tagLines.length - 1].lineIndex;
      lines.splice(lastTagLineIndex + 1, 0, newTagLine);
      const afterNewTag = lastTagLineIndex + 2;
      if (afterNewTag < lines.length && lines[afterNewTag].trim() !== "") {
        lines.splice(afterNewTag, 0, "");
      }
    }
  } else if (info.firstContentLineIndex < lines.length) {
    lines.splice(0, 0, newTagLine);
    if (lines[1] && lines[1].trim() !== "") {
      lines.splice(1, 0, "");
    }
  } else {
    lines.splice(0, 0, newTagLine);
  }

  return lines.join("\n");
}

export function sanitizeTopLevelTagValue(value: string): string {
  return value
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

/**
 * Removes the first top-level tag with the given field name, returning the
 * updated source string. Leading blank lines left after removal are stripped.
 */
export function removeTopLevelTag(
  source: string,
  field: MetadataField,
): string {
  const lines = source.split(/\r?\n/);
  const info = analyzeTopLevelTags(lines);
  const fieldLower = field.toLowerCase();
  const lineIndex = info.fieldToLineIndex[fieldLower];
  if (lineIndex === undefined) return source;

  lines.splice(lineIndex, 1);

  const result: string[] = [];
  let prevWasBlank = false;
  for (const line of lines) {
    const isBlank = !line.trim();
    if (isBlank && prevWasBlank) continue;
    result.push(line);
    prevWasBlank = isBlank;
  }

  while (result.length > 0 && !result[0].trim()) {
    result.shift();
  }

  return result.join("\n");
}
