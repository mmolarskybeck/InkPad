export function sanitizeFilenameBase(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/[ .]+$/g, "")
    .trim();
}

/**
 * Validates a title and returns a safe version
 * @param title The title to validate
 * @returns A safe title (never empty)
 */
export function validateTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed || 'story';
}

/**
 * Gets a filename from a title and extension
 * @param title The story title
 * @param extension The file extension (with dot)
 * @returns A safe filename
 */
export function getFilename(title: string, extension: string): string {
  const validTitle = validateTitle(title);
  const safeBase = sanitizeFilenameBase(validTitle);
  const hasMeaningfulCharacter = safeBase.replace(/[-_. ]/g, "").length > 0;
  return safeBase && hasMeaningfulCharacter
    ? `${safeBase}${extension}`
    : `story${extension}`;
}

export function replaceFilenameExtension(filename: string, extension: string): string {
  const baseName = filename.trim().replace(/\.[^.]+$/, "");
  return getFilename(baseName, extension);
}

export function getDisplayTitleFromFilename(filename: string): string {
  const baseName = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!baseName) return "Untitled Story";

  if (baseName === baseName.toLowerCase()) {
    return baseName
      .split(" ")
      .map((word) => word
        ? `${word.charAt(0).toUpperCase()}${word.slice(1)}`
        : word)
      .join(" ");
  }

  return baseName;
}
