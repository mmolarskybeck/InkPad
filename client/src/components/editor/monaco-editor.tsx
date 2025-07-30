// src/components/editor/MonacoEditor.tsx
import { useRef, useEffect } from "react";
import { getMonaco } from "@/monaco-setup";
import { Code } from "lucide-react";

export interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: Array<{ line: number; message: string; column?: number }>;
  fileName: string;
  onNavigateToLine?: (lineNumber: number) => void;
}

export function MonacoEditor({
  value,
  onChange,
  errors,
  fileName,
  onNavigateToLine,
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor>();

  // 1️⃣  Create / dispose editor
  useEffect(() => {
    (async () => {
      if (!containerRef.current || editorRef.current) return;

      const monaco = await getMonaco(); // workers + Ink already set up
      editorRef.current = monaco.editor.create(containerRef.current, {
        value,
        language: "ink",
        theme: "vs-dark",
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: 14,
        lineNumbers: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        renderWhitespace: "selection",
        renderControlCharacters: true,
        folding: true,
        lineDecorationsWidth: 20,
        lineNumbersMinChars: 3,
      });

      // propagate changes
      editorRef.current.onDidChangeModelContent(() => {
        onChange(editorRef.current!.getValue());
      });

      // optional external “jumpToLine” util
      if (onNavigateToLine) {
        (window as any).jumpToLine = (line: number) => {
          const ed = editorRef.current;
          if (!ed) return;
          ed.revealLineInCenter(line);
          ed.setPosition({ lineNumber: line, column: 1 });
          ed.focus();
        };
      }
    })();

    return () => editorRef.current?.dispose();
  }, []);

  // 2️⃣  Keep value in sync when parent updates
  useEffect(() => {
    const ed = editorRef.current;
    if (ed && ed.getValue() !== value) ed.setValue(value);
  }, [value]);

  // 3️⃣  Show error markers
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;

    const monaco = (window as any).monaco ?? undefined; // global from loader
    if (!monaco) return;

    const markers = errors.map((err) => ({
      startLineNumber: err.line,
      endLineNumber: err.line,
      startColumn: err.column || 1,
      endColumn: err.column
        ? err.column + 10
        : model.getLineMaxColumn(err.line),
      message: err.message,
      severity: monaco.MarkerSeverity.Error,
    }));
    monaco.editor.setModelMarkers(model, "ink", markers);
  }, [errors]);

  /* ---------------- Render ---------------- */
  return (
    <div className="flex flex-col h-full">
      <div className="bg-panel-bg px-4 py-2 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="text-accent-blue text-sm" />
          <span className="text-xs font-medium text-text-emphasis">
            {fileName}
          </span>
          <span className="text-xs text-text-secondary">• Modified</span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-text-secondary">
          <span>UTF‑8</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ minHeight: "400px" }}
      />
    </div>
  );
}
