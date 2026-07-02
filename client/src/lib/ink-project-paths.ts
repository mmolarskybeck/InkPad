const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:(?:\/|$)/;

export function normalizeInkProjectPath(path: string): string | null {
  const normalizedSeparators = path.replace(/\\/g, "/");

  if (
    normalizedSeparators.length === 0
    || normalizedSeparators.startsWith("/")
    || WINDOWS_DRIVE_PREFIX.test(normalizedSeparators)
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

export function isNormalizedInkProjectPath(path: string): boolean {
  return normalizeInkProjectPath(path) === path;
}
