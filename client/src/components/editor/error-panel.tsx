import { AlertTriangle, CheckCircle2, Clock3, Info, Loader2, XCircle } from "lucide-react";
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
  onErrorClick: (line: number) => void;
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
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="bg-panel-bg px-4 h-11 shrink-0 border-b border-border-color flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="text-error text-sm" />
            <span className="text-[0.875rem] font-semibold tracking-[0.01em] text-error">Problems</span>
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
      
      <div className="flex-1 overflow-auto">
        <div className="p-2 space-y-1">
          {errors.length === 0 ? (
            <div className="p-4 text-center text-[0.875rem] text-text-secondary">
              No problems detected
            </div>
          ) : (
            errors.map((error, index) => (
              <div
                key={index}
                onClick={() => onErrorClick(getEditorDiagnosticLine(error))}
                className="flex items-start space-x-3 p-2 hover:bg-accent rounded cursor-pointer transition-colors"
              >
                {getEditorDiagnosticSeverity(error) === "warning" ? (
                  <AlertTriangle className="text-warning text-sm mt-0.5 flex-shrink-0" />
                ) : getEditorDiagnosticSeverity(error) === "info" || getEditorDiagnosticSeverity(error) === "hint" ? (
                  <Info className="text-text-secondary text-sm mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="text-error text-sm mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[0.875rem] leading-6 text-text-emphasis font-mono">
                    <span className="text-[0.8125rem] text-text-secondary">
                      line {getEditorDiagnosticLine(error)}{getEditorDiagnosticColumn(error) ? `:${getEditorDiagnosticColumn(error)}` : ''}
                    </span>
                    {' - '}
                    <span>{error.message}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
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
