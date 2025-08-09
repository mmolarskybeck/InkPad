// src/components/editor/MonacoEditor.tsx
import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { getMonaco } from "@/monaco-setup";
import { Code } from "lucide-react";

export interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: Array<{ line: number; message: string; column?: number }>;
  fileName: string;
  onNavigateToLine?: (lineNumber: number) => void;
}

export interface MonacoEditorHandle {
  getEditor: () => import("monaco-editor").editor.IStandaloneCodeEditor | undefined;
  getValue: () => string;
}

export const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(({
  value,
  onChange,
  errors,
  fileName,
  onNavigateToLine,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor>();
  const syncingRef = useRef(false);
  const initializingRef = useRef(false); // Prevent double creation

  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
    getValue: () => editorRef.current?.getValue() || "",
  }));

  // 1️⃣  Create / dispose editor
  useEffect(() => {
    (async () => {
      // Prevent double creation
      if (!containerRef.current || editorRef.current || initializingRef.current) {
        return;
      }
      
      initializingRef.current = true;

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
        // Additional settings to ensure proper keyboard handling
        tabSize: 2,
        insertSpaces: true,
        quickSuggestions: false,
        contextmenu: true,
      });

      // IMPORTANT: Don't override Monaco's built-in keyboard handling!
      // Monaco already handles Ctrl+A, Delete, Backspace perfectly.
      // Adding custom commands can break the default behavior.
      
      // However, if you need to ensure select-all works, you can ADD (not override) a command:
      // This uses a different key combination to avoid conflicts
      editorRef.current.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, 
        () => {
          // This is a backup select-all command (Ctrl+Shift+A)
          const model = editorRef.current?.getModel();
          if (model) {
            const fullRange = model.getFullModelRange();
            editorRef.current?.setSelection(fullRange);
          }
        }
      );

      // propagate changes
      editorRef.current.onDidChangeModelContent(() => {
        if (syncingRef.current) return;
        onChange(editorRef.current!.getValue());
      });

      // optional external "jumpToLine" util
      if (onNavigateToLine) {
        (window as any).jumpToLine = (line: number) => {
          const ed = editorRef.current;
          if (!ed) return;
          ed.revealLineInCenter(line);
          ed.setPosition({ lineNumber: line, column: 1 });
          ed.focus();
        };
      }
      
      // Focus the editor after creation to ensure keyboard events work
      editorRef.current.focus();
      
      initializingRef.current = false;
    })();

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = undefined;
      }
      // StrictMode-safe cleanup
      if (containerRef.current) {
        // Clear all Monaco DOM artifacts
        containerRef.current.innerHTML = '';
        // Also remove the context attribute that Monaco adds
        containerRef.current.removeAttribute('data-monaco-context');
      }
      // Block creation briefly to ensure DOM cleanup completes
      initializingRef.current = true;
      setTimeout(() => {
        initializingRef.current = false;
      }, 10);
    };
  }, []);

  // 2️⃣  Keep value in sync when parent updates
  useEffect(() => {
    const ed = editorRef.current;
    if (ed && ed.getValue() !== value) {
      syncingRef.current = true;
      
      // Preserve cursor position when updating value
      const position = ed.getPosition();
      ed.setValue(value);
      if (position) {
        // Restore cursor position after value update
        setTimeout(() => {
          ed.setPosition(position);
        }, 0);
      }
      
      setTimeout(() => (syncingRef.current = false), 0);
    }
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
        // IMPORTANT: No keyboard event handlers here!
        // Let Monaco handle ALL keyboard events internally.
        // Adding onKeyDown/onKeyDownCapture here will interfere with Monaco.
      />
    </div>
  );
});

MonacoEditor.displayName = "MonacoEditor";