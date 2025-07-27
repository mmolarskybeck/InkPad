/**
 * Converts a title string into a URL/filename-safe slug
 * @param title The title to slugify
 * @returns A slug suitable for filenames
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Replace spaces and invalid filename characters with dashes
    .replace(/[^a-z0-9\-_.]/g, '-')
    // Replace multiple consecutive dashes with single dash
    .replace(/-+/g, '-')
    // Remove leading and trailing dashes
    .replace(/^-+|-+$/g, '');
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
  const slug = slugify(validTitle);
  return slug ? `${slug}${extension}` : `story${extension}`;
}
