export interface InkTextEdit {
  from: number;
  to: number;
  insert: string;
}

export function getMissingStartingDivertEdit(target: string): InkTextEdit {
  return {
    from: 0,
    to: 0,
    insert: `-> ${target}\n\n`,
  };
}
