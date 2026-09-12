import { KeyboardEvent, useRef, useState } from "react";
import { ChevronRight, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  groupSnippetsByCategory,
  type InkSnippet,
  type SnippetCategory,
} from "@/features/snippets/ink-snippets";
import type { CustomSnippet } from "@/features/snippets/custom-snippets";

export interface SnippetsPanelProps {
  snippets: InkSnippet[];
  customSnippets: CustomSnippet[];
  showHeader?: boolean;
  onInsertSnippet: (snippet: InkSnippet) => void;
  onCreateCustomSnippet: () => void;
  onEditCustomSnippet: (snippet: CustomSnippet) => void;
  onDeleteCustomSnippet: (snippet: CustomSnippet) => void;
}

function matchesQuery(snippet: InkSnippet, query: string): boolean {
  const needle = query.toLowerCase();
  if (snippet.label.toLowerCase().includes(needle)) return true;
  if (snippet.description.toLowerCase().includes(needle)) return true;
  if (snippet.category.toLowerCase().includes(needle)) return true;
  return snippet.aliases.some((alias) => alias.toLowerCase().includes(needle));
}

function filterRank(snippet: InkSnippet, query: string): number {
  const needle = query.toLowerCase();
  if (snippet.label.toLowerCase().startsWith(needle)) return 0;
  if (snippet.aliases.some((alias) => alias.toLowerCase().startsWith(needle))) return 1;
  return 2;
}

export function SnippetsPanel({
  snippets,
  customSnippets,
  showHeader = true,
  onInsertSnippet,
  onCreateCustomSnippet,
  onEditCustomSnippet,
  onDeleteCustomSnippet,
}: SnippetsPanelProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<SnippetCategory>>(
    () => new Set(snippets.map((snippet) => snippet.category)),
  );
  const bodyRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const filteredFlat = hasQuery
    ? snippets
      .filter((snippet) => matchesQuery(snippet, trimmedQuery))
      .slice()
      .sort((a, b) => filterRank(a, trimmedQuery) - filterRank(b, trimmedQuery))
    : [];

  const groups = hasQuery ? [] : groupSnippetsByCategory(snippets);

  const toggleGroup = (category: SnippetCategory) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const findCustomSnippet = (snippet: InkSnippet): CustomSnippet | undefined =>
    customSnippets.find((custom) => custom.id === snippet.id);

  const focusRow = (delta: number) => {
    const body = bodyRef.current;
    if (!body) return;
    const rows = Array.from(body.querySelectorAll<HTMLButtonElement>("[data-snippet-row]"));
    if (rows.length === 0) return;
    const activeElement = document.activeElement;
    const currentIndex = rows.findIndex((row) => row === activeElement);
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= rows.length) nextIndex = rows.length - 1;
    rows[nextIndex]?.focus();
  };

  const handleListKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(-1);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const body = bodyRef.current;
      const firstRow = body?.querySelector<HTMLButtonElement>("[data-snippet-row]");
      firstRow?.focus();
    }
  };

  const renderRow = (snippet: InkSnippet) => {
    const firstAlias = snippet.aliases[0];
    const isCustom = snippet.category === "Custom";
    const customSnippet = isCustom ? findCustomSnippet(snippet) : undefined;

    const row = (
      <button
        type="button"
        data-snippet-row
        title={snippet.source === "library" ? snippet.description : snippet.desktopSnippet}
        onClick={() => onInsertSnippet(snippet)}
        className="flex flex-1 min-w-0 items-start gap-2 px-3 py-1.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-accent-blue"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.8125rem] font-medium text-text-emphasis">{snippet.label}</span>
            {firstAlias && (
              <span className="font-mono text-[0.75rem] text-text-secondary">{firstAlias}</span>
            )}
          </div>
          <div className="line-clamp-1 text-[0.75rem] text-text-secondary">{snippet.description}</div>
        </div>
      </button>
    );

    if (!isCustom || !customSnippet) {
      return <div key={snippet.id} className="flex items-stretch">{row}</div>;
    }

    return (
      <div key={snippet.id} className="flex items-stretch">
        {row}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 self-center"
          aria-label={`Edit ${snippet.label}`}
          onClick={() => onEditCustomSnippet(customSnippet)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 self-center"
          aria-label={`Delete ${snippet.label}`}
          onClick={() => onDeleteCustomSnippet(customSnippet)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const showEmptyFooter = !hasQuery && customSnippets.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader && (
        <div className="h-11 shrink-0 flex items-center justify-between gap-2 border-b border-border-color bg-panel-bg px-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 shrink-0 text-accent-blue" aria-hidden="true" />
            <span className="text-[0.875rem] font-medium text-text-emphasis">Snippets</span>
            {snippets.length > 0 && (
              <span className="tabular-nums text-text-secondary">{snippets.length}</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="New custom snippet"
            onClick={onCreateCustomSnippet}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      )}

      <div className="shrink-0 border-b border-border-color p-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search snippets…"
          aria-label="Search snippets"
          className="h-8 text-[0.8125rem]"
        />
      </div>

      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onKeyDown={handleListKeyDown}
      >
        {hasQuery ? (
          filteredFlat.length === 0 ? (
            <p className="p-4 text-[0.8125rem] text-text-secondary">
              No snippets match &ldquo;{trimmedQuery}&rdquo;.
            </p>
          ) : (
            filteredFlat.map((snippet) => renderRow(snippet))
          )
        ) : (
          <>
            {groups.map((group) => {
              const isExpanded = expanded.has(group.category);
              return (
                <div key={group.category}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleGroup(group.category)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-text-secondary hover:bg-accent"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    />
                    {group.category}
                  </button>
                  {isExpanded && group.snippets.map((snippet) => renderRow(snippet))}
                </div>
              );
            })}
            {showEmptyFooter && (
              <div className="border-t border-border-color p-3 text-[0.75rem] text-text-secondary">
                Add your own snippets with New.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
