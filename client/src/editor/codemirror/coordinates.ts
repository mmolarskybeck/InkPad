import type { Text } from "@codemirror/state";

export function lineNumberToOffset(
  doc: Text,
  lineNumber: number,
  columnNumber = 1,
): number {
  const safeLine = Math.min(Math.max(lineNumber, 1), doc.lines);
  const line = doc.line(safeLine);
  const safeColumn = Math.max(columnNumber, 1);

  return Math.min(line.from + safeColumn - 1, line.to);
}

export function offsetToLineColumn(doc: Text, offset: number) {
  const safeOffset = Math.min(Math.max(offset, 0), doc.length);
  const line = doc.lineAt(safeOffset);

  return {
    lineNumber: line.number,
    columnNumber: safeOffset - line.from + 1,
  };
}
