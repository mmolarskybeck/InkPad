import type { InkCompilerError } from "@/lib/ink-compiler";

export const UNRESOLVED_DIVERT_CODE = "unresolved-divert";

export type KnownInkDiagnosticCode = typeof UNRESOLVED_DIVERT_CODE;

export interface AdaptedCompilerDiagnosticMetadata {
  code?: KnownInkDiagnosticCode;
  targetName?: string;
}

const UNRESOLVED_DIVERT_RE = /^Divert target not found:\s*'->\s*([^']+)'/;

export function getUnresolvedDivertTarget(message: string): string | null {
  const match = message.match(UNRESOLVED_DIVERT_RE);
  const targetName = match?.[1]?.trim();
  return targetName || null;
}

export function adaptCompilerDiagnostic<T extends InkCompilerError>(
  diagnostic: T,
): T & AdaptedCompilerDiagnosticMetadata {
  if (diagnostic.type !== "error") return diagnostic;

  const targetName = getUnresolvedDivertTarget(diagnostic.message);
  if (!targetName) return diagnostic;

  return {
    ...diagnostic,
    code: UNRESOLVED_DIVERT_CODE,
    targetName,
  };
}
