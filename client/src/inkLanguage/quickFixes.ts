export interface InkTextEdit {
  from: number;
  to: number;
  insert: string;
}

function getAppendSeparator(source: string): string {
  if (source.length === 0 || source.endsWith("\n\n")) return "";
  return source.endsWith("\n") ? "\n" : "\n\n";
}

export function getMissingStartingDivertEdit(target: string): InkTextEdit {
  return {
    from: 0,
    to: 0,
    insert: `-> ${target}\n\n`,
  };
}

export function canCreateMissingKnot(target: string): boolean {
  return /^[A-Za-z_]\w*$/.test(target);
}

export function getCreateMissingKnotEdit(source: string, target: string): InkTextEdit | null {
  if (!canCreateMissingKnot(target)) return null;

  return {
    from: source.length,
    to: source.length,
    insert: `${getAppendSeparator(source)}=== ${target} ===\n`,
  };
}

function getLineRange(source: string, lineNumber: number): { from: number; to: number; text: string } | null {
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return null;

  let from = 0;
  for (let currentLine = 1; currentLine < lineNumber; currentLine += 1) {
    const nextLineBreak = source.indexOf("\n", from);
    if (nextLineBreak === -1) return null;
    from = nextLineBreak + 1;
  }

  const nextLineBreak = source.indexOf("\n", from);
  const to = nextLineBreak === -1 ? source.length : nextLineBreak;
  const text = source.slice(from, to).replace(/\r$/, "");

  return { from, to: from + text.length, text };
}

export function getAddEmptyChoicePlaceholderEdit(
  source: string,
  lineNumber: number,
  placeholder = "Choice text",
): InkTextEdit | null {
  const line = getLineRange(source, lineNumber);
  if (!line || placeholder.length === 0) return null;

  const match = line.text.match(/^([ \t]*(?:\*+|\++)[ \t]*)$/);
  if (!match) return null;

  const markerText = match[1];
  const needsSeparator = !/[ \t]$/.test(markerText);

  return {
    from: line.from + markerText.length,
    to: line.from + markerText.length,
    insert: `${needsSeparator ? " " : ""}${placeholder}`,
  };
}
