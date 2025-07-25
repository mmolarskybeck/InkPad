import { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import { Code } from "lucide-react";

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: Array<{ line: number; message: string; column?: number }>;
  fileName: string;
}

export function MonacoEditor({ value, onChange, errors, fileName }: MonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current && !monacoEditor.current) {
      // Register Ink language
      monaco.languages.register({ id: 'ink' });
      
      // Define Ink syntax highlighting
      monaco.languages.setMonarchTokensProvider('ink', {
        tokenizer: {
          root: [
            [/VAR\b/, 'keyword'],
            [/CONST\b/, 'keyword'],
            [/LIST\b/, 'keyword'],
            [/EXTERNAL\b/, 'keyword'],
            [/INCLUDE\b/, 'keyword'],
            [/===.*?===/, 'type'],
            [/==.*?==/, 'type'],
            [/=.*?=/, 'type'],
            [/->/, 'operator'],
            [/<-/, 'operator'],
            [/\*/, 'delimiter'],
            [/\+/, 'delimiter'],
            [/".*?"/, 'string'],
            [/'.*?'/, 'string'],
            [/\{/, 'delimiter.bracket'],
            [/\}/, 'delimiter.bracket'],
            [/\d+/, 'number'],
            [/\/\/.*/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
          ],
          comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
          ]
        }
      });

      // Create editor
      monacoEditor.current = monaco.editor.create(editorRef.current, {
        value,
        language: 'ink',
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
      });

      // Handle content changes
      monacoEditor.current.onDidChangeModelContent(() => {
        const currentValue = monacoEditor.current?.getValue() || '';
        onChange(currentValue);
      });
    }

    return () => {
      if (monacoEditor.current) {
        monacoEditor.current.dispose();
        monacoEditor.current = null;
      }
    };
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (monacoEditor.current && monacoEditor.current.getValue() !== value) {
      monacoEditor.current.setValue(value);
    }
  }, [value]);

  // Update error markers
  useEffect(() => {
    if (monacoEditor.current && errors.length > 0) {
      const model = monacoEditor.current.getModel();
      if (model) {
        const markers = errors.map(error => ({
          startLineNumber: error.line,
          endLineNumber: error.line,
          startColumn: error.column || 1,
          endColumn: error.column ? error.column + 10 : model.getLineMaxColumn(error.line),
          message: error.message,
          severity: monaco.MarkerSeverity.Error,
        }));
        monaco.editor.setModelMarkers(model, 'ink', markers);
      }
    }
  }, [errors]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-panel-bg px-4 py-2 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="text-accent-blue text-sm" />
          <span className="text-xs font-medium text-text-emphasis">{fileName}</span>
          <span className="text-xs text-text-secondary">• Modified</span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-text-secondary">
          <span>UTF-8</span>
        </div>
      </div>
      <div ref={editorRef} className="flex-1" />
    </div>
  );
}
