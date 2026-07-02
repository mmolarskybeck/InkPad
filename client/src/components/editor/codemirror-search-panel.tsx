import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorView, Panel, ViewUpdate } from "@codemirror/view";
import { ArrowDown, ArrowUp, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Compact find/replace panel in the spirit of Monaco's find widget, rendered
 * as a React tree inside the CodeMirror panel host. Flex-wrap keeps every
 * control reachable at any pane width (the editor pane is user-resizable).
 */

const MAX_COUNTED_MATCHES = 999;

interface SearchSnapshot {
  search: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
  countLabel: string;
  noResults: boolean;
}

class SearchPanelController {
  readonly view: EditorView;
  private query: SearchQuery;
  private snapshot: SearchSnapshot;
  private listeners = new Set<() => void>();

  constructor(view: EditorView) {
    this.view = view;
    this.query = getSearchQuery(view.state);
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  commit = (changes: Partial<Pick<SearchSnapshot, "search" | "replace" | "caseSensitive" | "wholeWord" | "regexp">>) => {
    const next = new SearchQuery({
      search: changes.search ?? this.query.search,
      replace: changes.replace ?? this.query.replace,
      caseSensitive: changes.caseSensitive ?? this.query.caseSensitive,
      wholeWord: changes.wholeWord ?? this.query.wholeWord,
      regexp: changes.regexp ?? this.query.regexp,
    });

    if (!next.eq(this.query)) {
      this.query = next;
      this.view.dispatch({ effects: setSearchQuery.of(next) });
      this.refresh();
    }
  };

  handleViewUpdate(update: ViewUpdate) {
    let queryChanged = false;
    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.query = effect.value;
          queryChanged = true;
        }
      }
    }
    if (queryChanged || update.docChanged || update.selectionSet) this.refresh();
  }

  private refresh() {
    const next = this.buildSnapshot();
    const previous = this.snapshot;
    const changed = (Object.keys(next) as (keyof SearchSnapshot)[])
      .some((key) => next[key] !== previous[key]);
    if (!changed) return;

    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private buildSnapshot(): SearchSnapshot {
    const { current, total } = this.countMatches();
    let countLabel = "";
    if (this.query.search && this.query.valid) {
      const totalLabel = total > MAX_COUNTED_MATCHES ? `${MAX_COUNTED_MATCHES}+` : String(total);
      if (total === 0) countLabel = "No results";
      else countLabel = current > 0 ? `${current} of ${totalLabel}` : `${totalLabel} results`;
    }

    return {
      search: this.query.search,
      replace: this.query.replace,
      caseSensitive: this.query.caseSensitive,
      wholeWord: this.query.wholeWord,
      regexp: this.query.regexp,
      countLabel,
      noResults: countLabel === "No results",
    };
  }

  private countMatches() {
    if (!this.query.search || !this.query.valid) return { current: 0, total: 0 };

    const selection = this.view.state.selection.main;
    let total = 0;
    let current = 0;
    const cursor = this.query.getCursor(this.view.state);
    let step = cursor.next();
    while (!step.done && total <= MAX_COUNTED_MATCHES) {
      total += 1;
      if (step.value.from === selection.from && step.value.to === selection.to) current = total;
      step = cursor.next();
    }

    return { current, total };
  }
}

function OptionChip({ label, title, pressed, onPressedChange }: {
  label: string;
  title: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={title}
          aria-pressed={pressed}
          onClick={() => onPressedChange(!pressed)}
          className={cn(
            "h-6 rounded px-1.5 font-mono text-[11px] font-semibold text-text-secondary",
            pressed && "border border-accent-blue/45 bg-accent-blue/15 text-text-emphasis hover:bg-accent-blue/20",
          )}
        >
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

function IconAction({ title, onClick, children }: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={title}
          onClick={onClick}
          className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-emphasis"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

const fieldClass = "inkpad-search-field";
const inputClass = "inkpad-search-input";

function SearchPanelView({ controller }: { controller: SearchPanelController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const view = controller.view;

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  useEffect(() => {
    if (replaceOpen) replaceInputRef.current?.focus();
  }, [replaceOpen]);

  const close = useCallback(() => {
    closeSearchPanel(view);
    view.focus();
  }, [view]);

  return (
    <TooltipProvider delayDuration={500}>
      <div
        role="search"
        className="inkpad-search-panel"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Toggle replace"
          aria-expanded={replaceOpen}
          onClick={() => setReplaceOpen((open) => !open)}
          className="inkpad-search-disclosure h-7 w-7 shrink-0 text-text-secondary hover:text-text-emphasis"
        >
          <ChevronRight className={cn("transition-transform duration-150", replaceOpen && "rotate-90")} />
        </Button>

        <div className={cn(fieldClass, "inkpad-search-find-field")}>
          <input
            ref={(element) => {
              findInputRef.current = element;
              element?.setAttribute("main-field", "true");
            }}
            className={inputClass}
            placeholder="Find"
            aria-label="Find"
            value={snapshot.search}
            onChange={(event) => controller.commit({ search: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (event.shiftKey) findPrevious(view);
                else findNext(view);
              }
            }}
          />
          <OptionChip
            label="Aa"
            title="Match case"
            pressed={snapshot.caseSensitive}
            onPressedChange={(pressed) => controller.commit({ caseSensitive: pressed })}
          />
          <OptionChip
            label="ab"
            title="Match whole word"
            pressed={snapshot.wholeWord}
            onPressedChange={(pressed) => controller.commit({ wholeWord: pressed })}
          />
          <OptionChip
            label=".*"
            title="Use regular expression"
            pressed={snapshot.regexp}
            onPressedChange={(pressed) => controller.commit({ regexp: pressed })}
          />
        </div>

        <div className="inkpad-search-actions">
          {snapshot.countLabel && (
            <span
              aria-live="polite"
              className={cn(
                "whitespace-nowrap px-1.5 text-xs tabular-nums",
                snapshot.noResults ? "text-error" : "text-text-secondary",
              )}
            >
              {snapshot.countLabel}
            </span>
          )}
          <IconAction title="Previous match (Shift+Enter)" onClick={() => findPrevious(view)}>
            <ArrowUp />
          </IconAction>
          <IconAction title="Next match (Enter)" onClick={() => findNext(view)}>
            <ArrowDown />
          </IconAction>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Select all matches"
            onClick={() => {
              selectMatches(view);
              view.focus();
            }}
            className="h-7 px-1.5 text-xs text-text-secondary hover:text-text-emphasis"
          >
            all
          </Button>
          <IconAction title="Close (Escape)" onClick={close}>
            <X />
          </IconAction>
        </div>

        {replaceOpen && (
          <div className="inkpad-search-replace-row">
            <div className={cn(fieldClass, "inkpad-search-replace-field")}>
              <input
                ref={replaceInputRef}
                className={inputClass}
                placeholder="Replace"
                aria-label="Replace"
                value={snapshot.replace}
                onChange={(event) => controller.commit({ replace: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    replaceNext(view);
                  }
                }}
              />
            </div>
            <div className="inkpad-search-replace-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => replaceNext(view)}
                className="inkpad-search-text-button h-7 border-border-color bg-transparent px-2 text-xs text-text-primary hover:bg-accent hover:text-text-emphasis"
              >
                replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => replaceAll(view)}
                className="inkpad-search-text-button h-7 border-border-color bg-transparent px-2 text-xs text-text-primary hover:bg-accent hover:text-text-emphasis"
              >
                replace all
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function createSearchPanel(view: EditorView, top: boolean): Panel {
  const dom = document.createElement("div");
  dom.className = "cm-ink-search";
  const controller = new SearchPanelController(view);
  const root = createRoot(dom);
  root.render(<SearchPanelView controller={controller} />);

  return {
    dom,
    top,
    update: (update) => controller.handleViewUpdate(update),
    destroy: () => {
      // Deferred: CodeMirror calls destroy synchronously mid-update, and React
      // does not allow unmounting a root from inside an event or render cycle.
      setTimeout(() => root.unmount(), 0);
    },
  };
}

export function inkSearch(options: { top?: boolean } = {}) {
  return search({
    top: options.top,
    createPanel: (view) => createSearchPanel(view, options.top ?? false),
  });
}
