const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:(?:\/|$)/;
const URI_SCHEME_PREFIX = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export function normalizeInkProjectPath(path: string): string | null {
  const normalizedSeparators = path.normalize("NFC").replace(/\\/g, "/");

  if (
    normalizedSeparators.length === 0
    || normalizedSeparators.startsWith("/")
    || WINDOWS_DRIVE_PREFIX.test(normalizedSeparators)
    || URI_SCHEME_PREFIX.test(normalizedSeparators)
    || normalizedSeparators.includes("\0")
  ) {
    return null;
  }

  const segments: string[] = [];
  for (const segment of normalizedSeparators.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      return null;
    }

    segments.push(segment);
  }

  return segments.length > 0 ? segments.join("/") : null;
}

export function normalizeInkProjectFilePath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;

  const withExtension = trimmed.replace(/\.ink$/i, "") + ".ink";
  return normalizeInkProjectPath(withExtension);
}

export function isNormalizedInkProjectPath(path: string): boolean {
  return normalizeInkProjectPath(path) === path;
}

export function hasCaseInsensitiveInkProjectPathCollision(
  paths: readonly string[],
): boolean {
  const seen = new Set<string>();

  for (const path of paths) {
    const normalizedPath = normalizeInkProjectPath(path);
    if (!normalizedPath) {
      return true;
    }

    const lookupKey = normalizedPath.toLowerCase();
    if (seen.has(lookupKey)) {
      return true;
    }

    seen.add(lookupKey);
  }

  return false;
}
