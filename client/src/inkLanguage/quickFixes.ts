import type { InkSymbol } from "./inkSymbols";

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getDeclareGlobalVariableEdit(
  source: string,
  name: string,
  initialValue = "0",
): InkTextEdit | null {
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;

  const declarationRe = /^\s*(INCLUDE|VAR|CONST|LIST|EXTERNAL)\b/;
  const blankOrCommentRe = /^\s*(\/\/.*)?$/;

  let offset = 0;
  let lastDeclLineEnd: number | null = null;

  while (offset <= source.length) {
    const nextLineBreak = source.indexOf("\n", offset);
    const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
    const lineText = source.slice(offset, lineEnd);

    if (declarationRe.test(lineText)) {
      lastDeclLineEnd = nextLineBreak === -1 ? lineEnd : nextLineBreak + 1;
    } else if (!blankOrCommentRe.test(lineText)) {
      break;
    }

    if (nextLineBreak === -1) break;
    offset = nextLineBreak + 1;
  }

  const insertText = `VAR ${name} = ${initialValue}\n`;

  if (lastDeclLineEnd !== null) {
    return { from: lastDeclLineEnd, to: lastDeclLineEnd, insert: insertText };
  }

  const needsTrailingBlankLine = source.length > 0 && !source.startsWith("\n");
  return {
    from: 0,
    to: 0,
    insert: needsTrailingBlankLine ? `${insertText}\n` : insertText,
  };
}

export function getDeclareTempVariableEdit(
  source: string,
  lineNumber: number,
  name: string,
  initialValue = "0",
): InkTextEdit | null {
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;

  const line = getLineRange(source, lineNumber);
  if (!line) return null;

  const indent = line.text.match(/^[ \t]*/)?.[0] ?? "";
  return {
    from: line.from,
    to: line.from,
    insert: `${indent}~ temp ${name} = ${initialValue}\n`,
  };
}

export function getAddLooseEndDivertEdit(
  source: string,
  lineNumber: number,
  target: "END" | "DONE",
): InkTextEdit | null {
  const line = getLineRange(source, lineNumber);
  if (!line) return null;

  const indent = line.text.match(/^[ \t]*/)?.[0] ?? "";
  return {
    from: line.to,
    to: line.to,
    insert: `\n${indent}-> ${target}`,
  };
}

export function getCreateMissingStitchEdit(
  source: string,
  knotName: string,
  stitchName: string,
  symbols: readonly InkSymbol[],
  fileId: string,
): InkTextEdit | null {
  if (!/^[A-Za-z_]\w*$/.test(knotName) || !/^[A-Za-z_]\w*$/.test(stitchName)) return null;

  const knot = symbols.find(
    (symbol) => symbol.kind === "knot" && symbol.path === knotName && symbol.fileId === fileId,
  );
  if (!knot) return null;

  const nextSymbol = symbols
    .filter(
      (symbol) =>
        symbol.fileId === fileId
        && (symbol.kind === "knot" || symbol.kind === "function")
        && symbol.range.startLineNumber > knot.range.startLineNumber,
    )
    .reduce<InkSymbol | null>((closest, symbol) => {
      if (!closest || symbol.range.startLineNumber < closest.range.startLineNumber) return symbol;
      return closest;
    }, null);

  if (nextSymbol) {
    const line = getLineRange(source, nextSymbol.range.startLineNumber);
    if (!line) return null;

    const precedingText = source.slice(0, line.from);
    const needsBlankLinePrefix = !precedingText.endsWith("\n\n");
    return {
      from: line.from,
      to: line.from,
      insert: `${needsBlankLinePrefix ? "\n" : ""}= ${stitchName}\n\n`,
    };
  }

  return {
    from: source.length,
    to: source.length,
    insert: `${getAppendSeparator(source)}= ${stitchName}\n`,
  };
}

export function getCreateMissingFunctionEdit(
  source: string,
  name: string,
  paramCount: number,
): InkTextEdit | null {
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;
  if (!Number.isInteger(paramCount) || paramCount < 0) return null;

  const params = Array.from({ length: paramCount }, (_, index) => `p${index + 1}`).join(", ");

  return {
    from: source.length,
    to: source.length,
    insert: `${getAppendSeparator(source)}=== function ${name}(${params}) ===\n    ~ return 0\n`,
  };
}

export function getFunctionCallArity(lineText: string, name: string): number {
  const match = lineText.match(new RegExp(`\\b${escapeRegExp(name)}\\s*\\(([^)]*)\\)`));
  if (!match) return 0;

  const argsText = match[1].trim();
  if (argsText.length === 0) return 0;

  return argsText.split(",").length;
}
