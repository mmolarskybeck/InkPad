import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Pencil, Plus, SquarePlus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toAriaKeyShortcuts } from "@/lib/keyboard-shortcuts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SYNTAX_INSERTS, SYNTAX_LABELS } from "@/features/snippets/syntax-inserts";
import { groupSnippetsByCategory, type InkSnippet, type SnippetCategory } from "@/features/snippets/ink-snippets";
import type { CodeMirrorEditorInsertOptions } from "@/components/editor/codemirror-editor";
import type { CustomSnippet } from "@/features/snippets/custom-snippets";

export interface InsertPaletteProps {
  snippets: InkSnippet[];
  onInsertSyntax: (insert: CodeMirrorEditorInsertOptions) => void;
  onInsertSnippet: (snippet: InkSnippet) => void;
  /** The user's own snippets; the Custom category offers New / Edit / Delete for these. */
  customSnippets: CustomSnippet[];
  onCreateCustomSnippet: () => void;
  onEditCustomSnippet: (snippet: CustomSnippet) => void;
  onDeleteCustomSnippet: (snippet: CustomSnippet) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The left rail's rows: the fixed Syntax list plus every non-empty snippet category. */
type Category = "Syntax" | SnippetCategory;

const SYNTAX_CATEGORY: Category = "Syntax";
const CUSTOM_CATEGORY: Category = "Custom";
const NEW_CUSTOM_VALUE = "custom:new";
const NEW_CUSTOM_DESCRIPTION = "Save a snippet of your own. Custom snippets live in this browser.";
const STORAGE_KEY = "inkpad:insert-palette-category";
const KEYBOARD_HINT = "↑↓ navigate · ↵ insert";

function readStoredCategory(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredCategory(category: Category) {
  try {
    localStorage.setItem(STORAGE_KEY, category);
  } catch {
    // Ignore storage failures (private browsing, quota, etc).
  }
}

function snippetKeywords(snippet: InkSnippet): string[] {
  return [snippet.label, ...snippet.aliases, ...snippet.description.split(/\s+/)];
}

function syntaxValue(label: string) {
  return `syntax:${label}`;
}

function syntaxDescription(insert: CodeMirrorEditorInsertOptions) {
  return `Inserts \`${insert.text.replace(/\n/g, "⏎")}\``;
}

export function InsertPalette({
  snippets,
  onInsertSyntax,
  onInsertSnippet,
  customSnippets,
  onCreateCustomSnippet,
  onEditCustomSnippet,
  onDeleteCustomSnippet,
  open,
  onOpenChange,
}: InsertPaletteProps) {
  const [category, setCategory] = useState<Category>(SYNTAX_CATEGORY);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingInsert = useRef<(() => void) | null>(null);

  const groups = useMemo(() => groupSnippetsByCategory(snippets), [snippets]);
  const customById = useMemo(
    () => new Map(customSnippets.map((snippet) => [snippet.id, snippet])),
    [customSnippets],
  );

  /**
   * Rail rows, in display order: Syntax first, then the snippet groups. Custom
   * is always present (even when empty) so the "New custom snippet…" row has a
   * home.
   */
  const rail = useMemo(() => {
    const rows = [
      { category: SYNTAX_CATEGORY, count: SYNTAX_INSERTS.length },
      ...groups.map((group) => ({ category: group.category as Category, count: group.snippets.length })),
    ];
    if (!rows.some((row) => row.category === CUSTOM_CATEGORY)) {
      rows.push({ category: CUSTOM_CATEGORY, count: 0 });
    }
    return rows;
  }, [groups]);

  /** Description text for the footer, keyed by the cmdk value of each row. */
  const descriptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of SYNTAX_INSERTS) {
      map.set(syntaxValue(item.label), syntaxDescription(item.insert));
    }
    for (const snippet of snippets) {
      map.set(`snippet:${snippet.id}`, snippet.description);
    }
    map.set(NEW_CUSTOM_VALUE, NEW_CUSTOM_DESCRIPTION);
    return map;
  }, [snippets]);

  const isSearching = query.length > 0;

  const categorySnippets = useMemo(
    () => groups.find((group) => group.category === category)?.snippets ?? [],
    [groups, category],
  );

  /** cmdk value of the first row of a category, used to reset the highlight. */
  const firstValueOf = useCallback(
    (next: Category) => {
      if (next === SYNTAX_CATEGORY) {
        return SYNTAX_INSERTS.length > 0 ? syntaxValue(SYNTAX_INSERTS[0].label) : "";
      }
      const group = groups.find((item) => item.category === next);
      if (group && group.snippets.length > 0) return `snippet:${group.snippets[0].id}`;
      return next === CUSTOM_CATEGORY ? NEW_CUSTOM_VALUE : "";
    },
    [groups],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const stored = readStoredCategory();
    const restored = rail.find((row) => row.category === stored)?.category ?? SYNTAX_CATEGORY;
    setCategory(restored);
    setHighlighted(firstValueOf(restored));
  }, [open, rail, firstValueOf]);

  const selectCategory = useCallback(
    (next: Category) => {
      setCategory(next);
      setQuery("");
      setHighlighted(firstValueOf(next));
      writeStoredCategory(next);
      inputRef.current?.focus();
    },
    [firstValueOf],
  );

  const handleSelectSyntax = useCallback((insert: CodeMirrorEditorInsertOptions) => {
    pendingInsert.current = () => onInsertSyntax(insert);
    onOpenChange(false);
  }, [onInsertSyntax, onOpenChange]);

  const handleSelectSnippet = useCallback((snippet: InkSnippet) => {
    pendingInsert.current = () => onInsertSnippet(snippet);
    onOpenChange(false);
  }, [onInsertSnippet, onOpenChange]);

  // Managing custom snippets opens a dialog, which the popover must yield to
  // first; run the action once the popover has closed, like an insert.
  const handleCreateCustom = useCallback(() => {
    pendingInsert.current = onCreateCustomSnippet;
    onOpenChange(false);
  }, [onCreateCustomSnippet, onOpenChange]);

  const handleEditCustom = useCallback((snippet: CustomSnippet) => {
    pendingInsert.current = () => onEditCustomSnippet(snippet);
    onOpenChange(false);
  }, [onEditCustomSnippet, onOpenChange]);

  const handleDeleteCustom = useCallback((snippet: CustomSnippet) => {
    pendingInsert.current = () => onDeleteCustomSnippet(snippet);
    onOpenChange(false);
  }, [onDeleteCustomSnippet, onOpenChange]);

  // Radix would otherwise return focus to the trigger button on close; we
  // want it to land back in the editor at the caret the writer was at, which
  // is what the insert handlers below do via editorRef.
  const handleCloseAutoFocus = useCallback((event: Event) => {
    const insert = pendingInsert.current;
    pendingInsert.current = null;
    if (insert) {
      event.preventDefault();
      insert();
    }
  }, []);

  // ←/→ walk the category rail while the query is empty. Focus never leaves
  // the input, so the rail has no roving tabindex of its own.
  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (query.length > 0) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (rail.length < 2) return;

      event.preventDefault();
      const index = rail.findIndex((row) => row.category === category);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + rail.length) % rail.length;
      selectCategory(rail[nextIndex].category);
    },
    [query, rail, category, selectCategory],
  );

  // Global Ctrl/Cmd+Shift+I toggle. Skipped while another dialog is open
  // (unless the palette itself is what's open) and while typing in a form
  // field other than the CodeMirror editor's contenteditable content.
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key.toLowerCase() !== "i" || !event.shiftKey || !(event.metaKey || event.ctrlKey)) return;

      // Ignore ordinary form fields (but the CodeMirror content, which is
      // contenteditable, is fair game) so the shortcut doesn't fire while
      // typing in an unrelated text input.
      const target = event.target as HTMLElement | null;
      if (target && !target.isContentEditable && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      if (!open && document.querySelector('[role="dialog"][data-state="open"]')) return;

      event.preventDefault();
      onOpenChange(!open);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const renderSyntaxItems = () => SYNTAX_INSERTS.map((item) => (
    <CommandItem
      key={item.label}
      value={syntaxValue(item.label)}
      keywords={[SYNTAX_LABELS[item.label], item.label]}
      className="h-8 gap-2 px-2.5"
      onSelect={() => handleSelectSyntax(item.insert)}
    >
      <span className="w-10 shrink-0 font-mono text-[0.8125rem] text-text-primary">{item.label}</span>
      <span className="truncate text-text-emphasis">{SYNTAX_LABELS[item.label]}</span>
    </CommandItem>
  ));

  const rowActionClass =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-editor-bg hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  /* Edit / Delete stay quiet until the row is highlighted (always visible on touch). */
  const rowActionsClass =
    "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-data-[selected=true]/row:opacity-100 focus-within:opacity-100 motion-reduce:transition-none [@media(pointer:coarse)]:opacity-100";

  const renderSnippetItems = (items: InkSnippet[]) => items.map((snippet) => {
    const custom = customById.get(snippet.id);
    return (
      <CommandItem
        key={snippet.id}
        value={`snippet:${snippet.id}`}
        keywords={snippetKeywords(snippet)}
        className="group/row h-8 gap-2 px-2.5"
        onSelect={() => handleSelectSnippet(snippet)}
      >
        <span className="flex-1 truncate font-medium text-text-emphasis">{snippet.label}</span>
        {snippet.aliases[0] && (
          <span className="shrink-0 font-mono text-[0.75rem] text-text-secondary">{snippet.aliases[0]}</span>
        )}
        {custom && (
          <span className={rowActionsClass}>
            <button
              type="button"
              className={rowActionClass}
              aria-label={`Edit ${snippet.label}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleEditCustom(custom);
              }}
            >
              <Pencil className="!size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={rowActionClass}
              aria-label={`Delete ${snippet.label}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteCustom(custom);
              }}
            >
              <Trash2 className="!size-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
      </CommandItem>
    );
  });

  const renderNewCustomItem = () => (
    <CommandItem
      key={NEW_CUSTOM_VALUE}
      value={NEW_CUSTOM_VALUE}
      keywords={["new", "custom", "snippet", "create"]}
      className="h-8 gap-2 px-2.5"
      onSelect={handleCreateCustom}
    >
      <Plus className="!size-3.5 text-text-secondary" aria-hidden="true" />
      <span className="flex-1 truncate text-text-emphasis">New custom snippet…</span>
    </CommandItem>
  );

  const renderCustomItems = () => (
    <>
      {renderSnippetItems(categorySnippets)}
      {renderNewCustomItem()}
    </>
  );

  const footerText = descriptions.get(highlighted) ?? KEYBOARD_HINT;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue data-[state=open]:bg-accent data-[state=open]:text-text-emphasis"
              aria-label="Insert snippet or syntax"
              aria-keyshortcuts={toAriaKeyShortcuts(["mod", "shift", "i"])}
            >
              <SquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="bottom" shortcut={["mod", "shift", "i"]}>
            Insert snippet or syntax
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="end"
        collisionPadding={12}
        className="w-[30rem] border-border-color bg-panel-bg p-0 shadow-lg"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <Command
          shouldFilter={isSearching}
          loop
          value={highlighted}
          onValueChange={setHighlighted}
        >
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleInputKeyDown}
            placeholder="Search snippets and syntax…"
          />

          {/*
            Just tall enough for every rail row (Syntax + 8 categories at 2rem each,
            plus padding) so Custom never needs a scroll; shrinks to fit the
            viewport when the window is short. 5.5rem covers the input, footer
            and borders around this body.
          */}
          <div className="flex h-[19rem] max-h-[calc(var(--radix-popover-content-available-height)-5.5rem)] min-h-[8rem] overflow-hidden">
            {!isSearching && (
              <div
                aria-label="Categories"
                className="w-40 shrink-0 overflow-y-auto border-r border-border-color p-1"
              >
                {rail.map((row) => {
                  const selected = row.category === category;
                  return (
                    <button
                      key={row.category}
                      type="button"
                      tabIndex={-1}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => selectCategory(row.category)}
                      className={`flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-[0.8125rem] transition-colors ${
                        selected
                          ? "bg-accent font-medium text-text-emphasis"
                          : "text-text-primary hover:bg-accent/60 hover:text-text-emphasis"
                      }`}
                    >
                      <span className="flex-1 truncate">{row.category}</span>
                      <span className="shrink-0 text-[0.75rem] text-text-secondary">{row.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <CommandList className="h-full max-h-none flex-1 overflow-y-auto">
              {isSearching ? (
                <>
                  <CommandEmpty>{`No matches for “${query}”.`}</CommandEmpty>
                  <CommandGroup heading="Syntax">{renderSyntaxItems()}</CommandGroup>
                  {groups.map((group) => (
                    <CommandGroup key={group.category} heading={group.category}>
                      {renderSnippetItems(group.snippets)}
                      {group.category === CUSTOM_CATEGORY && renderNewCustomItem()}
                    </CommandGroup>
                  ))}
                  {!groups.some((group) => group.category === CUSTOM_CATEGORY) && (
                    <CommandGroup heading="Custom">{renderNewCustomItem()}</CommandGroup>
                  )}
                </>
              ) : (
                <CommandGroup>
                  {category === SYNTAX_CATEGORY
                    ? renderSyntaxItems()
                    : category === CUSTOM_CATEGORY
                      ? renderCustomItems()
                      : renderSnippetItems(categorySnippets)}
                </CommandGroup>
              )}
            </CommandList>
          </div>

          <div className="flex h-8 shrink-0 items-center border-t border-border-color px-3">
            <span className="truncate text-[0.75rem] text-text-secondary">{footerText}</span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
