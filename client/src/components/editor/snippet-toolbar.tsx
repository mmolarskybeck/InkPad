import { useRef, type KeyboardEvent } from "react";
import { ScrollText } from "lucide-react";
import { SYNTAX_INSERTS } from "@/features/snippets/syntax-inserts";
import type { InkSnippet } from "@/features/snippets/ink-snippets";
import type { CodeMirrorEditorInsertOptions } from "@/components/editor/codemirror-editor";

export interface SnippetToolbarProps {
  snippets: InkSnippet[];
  onInsertSyntax: (insert: CodeMirrorEditorInsertOptions) => void;
  onInsertSnippet: (snippet: InkSnippet) => void;
  onOpenSnippetsPane: () => void;
}

/** The handful of snippets worth a permanent button; the rest live in the pane. */
export const TOOLBAR_PINNED_SNIPPET_IDS = [
  "choice",
  "sticky-choice",
  "divert",
  "knot",
  "stitch",
  "var",
  "conditional",
] as const;

const BUTTON_CLASSES = "flex h-full min-w-9 shrink-0 items-center justify-center rounded border border-border-color bg-panel-bg px-2 text-[0.8125rem] font-medium text-text-emphasis transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue";

export function SnippetToolbar({
  snippets,
  onInsertSyntax,
  onInsertSnippet,
  onOpenSnippetsPane,
}: SnippetToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const pinnedSnippets = TOOLBAR_PINNED_SNIPPET_IDS
    .map((id) => snippets.find((snippet) => snippet.id === id))
    .filter((snippet): snippet is InkSnippet => snippet !== undefined);

  // Roving tabindex: the toolbar is one tab stop, arrows move within it.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"));
    if (buttons.length === 0) return;

    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    if (currentIndex === -1) return;

    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  // Every button suppresses mousedown so the editor keeps focus and the
  // insertion lands at the caret the writer was already sitting on.
  const preventFocusLoss = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Quick inserts"
      onKeyDown={handleKeyDown}
      className="flex h-10 shrink-0 items-stretch gap-1 border-t border-border-color bg-editor-bg px-1 py-1"
    >
      <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
        {SYNTAX_INSERTS.map((item, index) => (
          <button
            key={item.label}
            type="button"
            tabIndex={index === 0 ? 0 : -1}
            onMouseDown={preventFocusLoss}
            onClick={() => onInsertSyntax(item.insert)}
            className={`${BUTTON_CLASSES} font-mono`}
            aria-label={`Insert ${item.label}`}
            title={`Insert ${item.label}`}
          >
            {item.label}
          </button>
        ))}

        <div className="mx-0.5 w-px self-stretch bg-border-color" aria-hidden="true" />

        {pinnedSnippets.map((snippet) => (
          <button
            key={snippet.id}
            type="button"
            tabIndex={-1}
            onMouseDown={preventFocusLoss}
            onClick={() => onInsertSnippet(snippet)}
            className={BUTTON_CLASSES}
            aria-label={`Insert ${snippet.label} snippet`}
            title={snippet.description}
          >
            {snippet.label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-stretch gap-1 border-l border-border-color pl-1">
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventFocusLoss}
          onClick={onOpenSnippetsPane}
          className={`${BUTTON_CLASSES} gap-1.5`}
          aria-label="Open snippets pane"
          title="Open snippets pane"
        >
          <ScrollText className="h-4 w-4" aria-hidden="true" />
          Snippets
        </button>
      </div>
    </div>
  );
}
