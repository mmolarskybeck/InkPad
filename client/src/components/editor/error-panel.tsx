import { AlertCircle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CompileStatus } from "@/hooks/use-ink-story";
import type { EditorDiagnostic } from "@/types/editor-diagnostic";
import {
  getEditorDiagnosticColumn,
  getEditorDiagnosticLine,
  getEditorDiagnosticSeverity,
} from "@/types/editor-diagnostic";

interface ErrorPanelProps {
  errors: EditorDiagnostic[];
  compileStatus: CompileStatus;
  onErrorClick: (error: EditorDiagnostic) => void;
  showHeader?: boolean;
  showCompactStatus?: boolean;
}

type DiagnosticSeverity = ReturnType<typeof getEditorDiagnosticSeverity>;

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 };

function getSeverityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 4;
}

function getSeverityPresentation(severity: DiagnosticSeverity) {
  switch (severity) {
    case "warning":
      return { code: "WARN", label: "Warning", className: "text-warning" };
    case "info":
    case "hint":
      return { code: "INFO", label: "Info", className: "text-text-secondary" };
    default:
      return { code: "ERR", label: "Error", className: "text-error" };
  }
}

function formatLocation(error: EditorDiagnostic): string {
  const column = getEditorDiagnosticColumn(error);
  const position = `${getEditorDiagnosticLine(error)}${column ? `:${column}` : ""}`;
  return error.fileId ? `${error.fileId}:${position}` : `line ${position}`;
}

function CompilingIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-[0.75rem] text-text-secondary" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Compiling
    </span>
  );
}

export function ErrorPanel({
  errors,
  compileStatus,
  onErrorClick,
  showHeader = true,
  showCompactStatus = true,
}: ErrorPanelProps) {
  const errorCount = errors.filter(e => getEditorDiagnosticSeverity(e) === 'error').length;
  const warningCount = errors.filter(e => getEditorDiagnosticSeverity(e) === 'warning').length;
  const isCompiling = compileStatus === "compiling";
  const sortedErrors = [...errors].sort(
    (a, b) => getSeverityRank(getEditorDiagnosticSeverity(a)) - getSeverityRank(getEditorDiagnosticSeverity(b)),
  );
  const handleCopyMessage = (event: React.MouseEvent<HTMLButtonElement>, error: EditorDiagnostic) => {
    event.stopPropagation();
    void navigator.clipboard?.writeText(`${formatLocation(error)} - ${error.message}`);
  };

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="bg-panel-bg px-4 h-11 shrink-0 border-b border-border-color flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="shrink-0 text-sm text-accent-blue" />
            <span className="text-[0.875rem] font-medium tracking-[0.01em] text-text-emphasis">Problems</span>
            {errorCount > 0 && (
              <span className="bg-error text-editor-bg text-[0.75rem] px-1.5 py-0.5 rounded font-semibold tabular-nums">
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="bg-warning text-editor-bg text-[0.75rem] px-1.5 py-0.5 rounded font-semibold tabular-nums">
                {warningCount}
              </span>
            )}
          </div>
          {isCompiling && <CompilingIndicator />}
        </div>
      )}

      {!showHeader && showCompactStatus && isCompiling && (
        <div className="flex h-9 shrink-0 items-center justify-end border-b border-border-color px-4">
          <CompilingIndicator />
        </div>
      )}

      <div className="flex-1 overflow-auto bg-editor-bg">
        {errors.length === 0 ? (
          <div className="flex h-full min-h-[6rem] items-center justify-center gap-2 p-4 text-[0.875rem] text-text-secondary">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            No problems
          </div>
        ) : (
          <ul className="p-2" aria-label="Problems">
            {sortedErrors.map((error, index) => {
              const severity = getSeverityPresentation(getEditorDiagnosticSeverity(error));
              return (
                <li key={index} className="group relative">
                  <button
                    type="button"
                    onClick={() => onErrorClick(error)}
                    className="flex w-full items-start gap-2.5 rounded px-2 py-1.5 pr-9 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span
                      className={`w-10 shrink-0 pt-px font-mono text-[0.6875rem] font-bold leading-5 tracking-wider ${severity.className}`}
                      aria-label={severity.label}
                    >
                      {severity.code}
                    </span>
                    <span className="min-w-0 flex-1 font-mono text-[0.8125rem] leading-5">
                      <span className="mr-2 text-text-secondary">{formatLocation(error)}</span>
                      <span className="text-text-emphasis">{error.message}</span>
                    </span>
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(event) => handleCopyMessage(event, error)}
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-secondary opacity-0 transition-[opacity,color,background-color] hover:bg-panel-bg hover:text-text-emphasis focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
                        aria-label="Copy problem message"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Copy problem message</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
