import type { InkCompilerError } from "@/lib/ink-compiler";

export const UNRESOLVED_DIVERT_CODE = "unresolved-divert";
export const EMPTY_CHOICE_CODE = "empty-choice";
export const UNRESOLVED_VARIABLE_CODE = "unresolved-variable";
export const UNASSIGNABLE_VARIABLE_CODE = "unassignable-variable";
export const LOOSE_END_CODE = "loose-end";
export const UNRESOLVED_FUNCTION_CODE = "unresolved-function";

export type KnownInkDiagnosticCode =
  | typeof UNRESOLVED_DIVERT_CODE
  | typeof EMPTY_CHOICE_CODE
  | typeof UNRESOLVED_VARIABLE_CODE
  | typeof UNASSIGNABLE_VARIABLE_CODE
  | typeof LOOSE_END_CODE
  | typeof UNRESOLVED_FUNCTION_CODE;

export interface AdaptedCompilerDiagnosticMetadata {
  code?: KnownInkDiagnosticCode;
  targetName?: string;
  variableName?: string;
}

const UNRESOLVED_DIVERT_RE = /^Divert target not found:\s*'->\s*([^']+)'/;
const EMPTY_CHOICE_RE = /^Choice is completely empty\./;
const UNRESOLVED_VARIABLE_RE = /^Unresolved variable:\s*([A-Za-z_]\w*)/;
const UNASSIGNABLE_VARIABLE_RE = /^Variable could not be found to assign to:\s*'([A-Za-z_]\w*)'/;
const LOOSE_END_RE = /^Apparent loose end exists where the flow runs out/;
const UNRESOLVED_FUNCTION_RE = /^Function call target not found:\s*'->\s*([A-Za-z_]\w*)/;

export function getUnresolvedDivertTarget(message: string): string | null {
  const match = message.match(UNRESOLVED_DIVERT_RE);
  const targetName = match?.[1]?.trim();
  return targetName || null;
}

export function isEmptyChoiceDiagnostic(message: string): boolean {
  return EMPTY_CHOICE_RE.test(message);
}

export function getUnresolvedVariableName(message: string): string | null {
  const match = message.match(UNRESOLVED_VARIABLE_RE);
  const variableName = match?.[1]?.trim();
  return variableName || null;
}

export function getUnassignableVariableName(message: string): string | null {
  const match = message.match(UNASSIGNABLE_VARIABLE_RE);
  const variableName = match?.[1]?.trim();
  return variableName || null;
}

export function isLooseEndDiagnostic(message: string): boolean {
  return LOOSE_END_RE.test(message);
}

export function getUnresolvedFunctionTarget(message: string): string | null {
  const match = message.match(UNRESOLVED_FUNCTION_RE);
  const targetName = match?.[1]?.trim();
  return targetName || null;
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
  if (targetName) {
    return {
      ...diagnostic,
      code: UNRESOLVED_DIVERT_CODE,
      targetName,
    };
  }

  const unresolvedVariableName = getUnresolvedVariableName(diagnostic.message);
  if (unresolvedVariableName) {
    return {
      ...diagnostic,
      code: UNRESOLVED_VARIABLE_CODE,
      variableName: unresolvedVariableName,
    };
  }

  const unassignableVariableName = getUnassignableVariableName(diagnostic.message);
  if (unassignableVariableName) {
    return {
      ...diagnostic,
      code: UNASSIGNABLE_VARIABLE_CODE,
      variableName: unassignableVariableName,
    };
  }

  if (isLooseEndDiagnostic(diagnostic.message)) {
    return {
      ...diagnostic,
      code: LOOSE_END_CODE,
    };
  }

  const unresolvedFunctionTarget = getUnresolvedFunctionTarget(diagnostic.message);
  if (unresolvedFunctionTarget) {
    return {
      ...diagnostic,
      code: UNRESOLVED_FUNCTION_CODE,
      targetName: unresolvedFunctionTarget,
    };
  }

  return diagnostic;
}
