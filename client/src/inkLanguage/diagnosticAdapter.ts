import type { InkCompilerError } from "@/lib/ink-compiler";

export const UNRESOLVED_DIVERT_CODE = "unresolved-divert";
export const EMPTY_CHOICE_CODE = "empty-choice";

export type KnownInkDiagnosticCode = typeof UNRESOLVED_DIVERT_CODE | typeof EMPTY_CHOICE_CODE;

export interface AdaptedCompilerDiagnosticMetadata {
  code?: KnownInkDiagnosticCode;
  targetName?: string;
}

const UNRESOLVED_DIVERT_RE = /^Divert target not found:\s*'->\s*([^']+)'/;
const EMPTY_CHOICE_RE = /^Choice is completely empty\./;

export function getUnresolvedDivertTarget(message: string): string | null {
  const match = message.match(UNRESOLVED_DIVERT_RE);
  const targetName = match?.[1]?.trim();
  return targetName || null;
}

export function isEmptyChoiceDiagnostic(message: string): boolean {
  return EMPTY_CHOICE_RE.test(message);
}

export function adaptCompilerDiagnostic<T extends InkCompilerError>(
  diagnostic: T,
): T & AdaptedCompilerDiagnosticMetadata {
  if (isEmptyChoiceDiagnostic(diagnostic.message)) {
    return {
      ...diagnostic,
      code: EMPTY_CHOICE_CODE,
    };
  }

  if (diagnostic.type !== "error") return diagnostic;

  const targetName = getUnresolvedDivertTarget(diagnostic.message);
  if (!targetName) return diagnostic;

  return {
    ...diagnostic,
    code: UNRESOLVED_DIVERT_CODE,
    targetName,
  };
}
