import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileOperations } from "@/lib/file-operations";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("InkPad crashed while rendering:", error, errorInfo);
  }

  private exportRecoveryDraft = () => {
    const draft = FileOperations.loadRecoveryDraft();
    if (!draft) return;
    FileOperations.downloadFile(draft.content, draft.name);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let hasRecoveryDraft = false;
    try {
      hasRecoveryDraft = FileOperations.loadRecoveryDraft() !== null;
    } catch {
      // Storage may be the source of the render failure.
    }

    return (
      <main className="flex min-h-dvh items-center justify-center bg-editor-bg p-6 text-text-primary">
        <section className="w-full max-w-lg rounded-lg border border-border-color bg-panel-bg p-6 shadow-xl">
          <AlertTriangle className="mb-4 h-8 w-8 text-error" />
          <h1 className="text-xl font-semibold">InkPad hit an unexpected error</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Your latest recovery draft may still be stored in this browser. Export it if available,
            then reload InkPad.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {hasRecoveryDraft && (
              <Button variant="outline" onClick={this.exportRecoveryDraft}>
                <Download />
                Export recovery draft
              </Button>
            )}
            <Button onClick={() => window.location.reload()}>
              <RefreshCw />
              Reload InkPad
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
