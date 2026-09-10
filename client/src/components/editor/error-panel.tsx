import { AlertCircle, AlertTriangle, CheckCircle2, Clock3, Copy, Loader2, XCircle } from "lucide-react";
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

export function ErrorPanel({
  errors,
  compileStatus,
  onErrorClick,
  showHeader = true,
  showCompactStatus = true,
}: ErrorPanelProps) {
  const errorCount = errors.filter(e => getEditorDiagnosticSeverity(e) === 'error').length;
  const warningCount = errors.filter(e => getEditorDiagnosticSeverity(e) === 'warning').length;
  const statusConfig = getCompileStatusConfig(compileStatus);
  const sortedErrors = [...errors].sort(
    (a, b) => getSeverityRank(getEditorDiagnosticSeverity(a)) - getSeverityRank(getEditorDiagnosticSeverity(b)),
  );
  const StatusIcon = statusConfig.icon;
  const handleCopyMessage = (event: React.MouseEvent<HTMLButtonElement>, error: EditorDiagnostic) => {
    event.stopPropagation();
    const fileLabel = error.fileId ? `${error.fileId} ` : "";
    const location = `${fileLabel}line ${getEditorDiagnosticLine(error)}${getEditorDiagnosticColumn(error) ? `:${getEditorDiagnosticColumn(error)}` : ""}`;
    void navigator.clipboard?.writeText(`${location} - ${error.message}`);
  };

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="bg-panel-bg px-4 h-11 shrink-0 border-b border-border-color flex items-center justify-between">
          <div className="flex items-center space-x-2">
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
          <div className={`flex items-center gap-1.5 text-[0.75rem] tabular-nums ${statusConfig.className}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${compileStatus === "compiling" ? "animate-spin" : ""}`} />
            <span>{statusConfig.label}</span>
          </div>
        </div>
      )}

      {!showHeader && showCompactStatus && (
        <div className={`flex h-9 shrink-0 items-center justify-end border-b border-border-color px-4 text-[0.75rem] tabular-nums ${statusConfig.className}`}>
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-3.5 w-3.5 ${compileStatus === "compiling" ? "animate-spin" : ""}`} />
            <span>{statusConfig.label}</span>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-auto bg-editor-bg">
        <div className="p-2 space-y-1">
          {errors.length === 0 ? (
            <div className="p-4 text-center text-[0.875rem] text-text-secondary">
              No problems detected
            </div>
          ) : (
            sortedErrors.map((error, index) => (
              <div
                key={index}
                onClick={() => onErrorClick(error)}
                className="group flex items-start gap-3 p-2 hover:bg-accent rounded cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0 font-mono text-[0.875rem] leading-relaxed">
                  <span className={`inline-block w-10 text-[0.6875rem] font-bold tracking-wider ${
                    getEditorDiagnosticSeverity(error) === "warning"
                      ? "text-warning"
                      : getEditorDiagnosticSeverity(error) === "info" || getEditorDiagnosticSeverity(error) === "hint"
                      ? "text-text-secondary"
                      : "text-error"
                  }`}>
                    {getEditorDiagnosticSeverity(error) === "warning" ? "WARN" : getEditorDiagnosticSeverity(error) === "error" ? "ERR" : "INFO"}
                  </span>
                  <span className="text-[0.8125rem] text-text-secondary mr-2">
                    line {getEditorDiagnosticLine(error)}{getEditorDiagnosticColumn(error) ? `:${getEditorDiagnosticColumn(error)}` : ''}
                    {error.fileId && ` ${error.fileId}`}
                    {" -"}
                  </span>
                  <span className="text-text-emphasis">{error.message}</span>
                </div>
                <button
                  type="button"
                  onClick={(event) => handleCopyMessage(event, error)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-panel-bg hover:text-text-emphasis opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Copy problem message"
                  title="Copy problem message"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 };

function getSeverityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 4;
}

function getCompileStatusConfig(status: CompileStatus) {
  switch (status) {
    case "queued":
      return {
        icon: Clock3,
        label: "Queued",
        className: "text-text-secondary",
      };
    case "compiling":
      return {
        icon: Loader2,
        label: "Compiling",
        className: "text-accent-blue",
      };
    case "success":
      return {
        icon: CheckCircle2,
        label: "Updated",
        className: "text-success",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        label: "Warnings",
        className: "text-warning",
      };
    case "error":
      return {
        icon: XCircle,
        label: "Failed",
        className: "text-error",
      };
    default:
      return {
        icon: Clock3,
        label: "Waiting",
        className: "text-text-secondary",
      };
  }
}
