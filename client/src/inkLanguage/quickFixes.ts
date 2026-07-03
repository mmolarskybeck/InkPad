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
