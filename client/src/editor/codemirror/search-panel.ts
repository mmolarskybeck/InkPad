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
import { EditorView, type Panel, type ViewUpdate } from "@codemirror/view";

/**
 * Compact find/replace panel in the spirit of Monaco's find widget: one slim
 * row with inline match options and a live result count, plus a collapsible
 * replace row. Replaces the default @codemirror/search panel via createPanel.
 */

const MAX_COUNTED_MATCHES = 999;

const icons = {
  chevronRight: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"9 18 15 12 9 6\"/></svg>",
  arrowUp: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"5\"/><polyline points=\"5 12 12 5 19 12\"/></svg>",
  arrowDown: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><polyline points=\"19 12 12 19 5 12\"/></svg>",
  close: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>",
};

function iconButton(icon: string, label: string, onClick: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cm-ink-search-button";
  button.innerHTML = icon;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

function toggleChip(label: string, title: string, onToggle: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cm-ink-search-chip";
  button.textContent = label;
  button.setAttribute("aria-label", title);
  button.setAttribute("aria-pressed", "false");
  button.title = title;
  button.addEventListener("click", () => {
    setPressed(button, !isPressed(button));
    onToggle();
  });
  return button;
}

function isPressed(button: HTMLButtonElement) {
  return button.getAttribute("aria-pressed") === "true";
}

function setPressed(button: HTMLButtonElement, pressed: boolean) {
  button.setAttribute("aria-pressed", String(pressed));
  button.classList.toggle("cm-ink-search-chip--on", pressed);
}

class InkSearchPanel implements Panel {
  dom: HTMLElement;
  top: boolean;

  private view: EditorView;
  private query: SearchQuery;
  private searchInput: HTMLInputElement;
  private replaceInput: HTMLInputElement;
  private countEl: HTMLElement;
  private caseChip: HTMLButtonElement;
  private wordChip: HTMLButtonElement;
  private regexpChip: HTMLButtonElement;
  private replaceOpen = false;

  constructor(view: EditorView, top: boolean) {
    this.view = view;
    this.top = top;
    this.query = getSearchQuery(view.state);

    this.dom = document.createElement("div");
    this.dom.className = "cm-ink-search";
    this.dom.setAttribute("role", "search");
    this.dom.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearchPanel(this.view);
        this.view.focus();
      }
    });

    const replaceToggle = iconButton(icons.chevronRight, "Toggle replace", () => {
      this.replaceOpen = !this.replaceOpen;
      this.dom.classList.toggle("cm-ink-search--replace-open", this.replaceOpen);
      replaceToggle.setAttribute("aria-expanded", String(this.replaceOpen));
      if (this.replaceOpen) this.replaceInput.focus();
    });
    replaceToggle.classList.add("cm-ink-search-toggle");
    replaceToggle.setAttribute("aria-expanded", "false");

    const findField = document.createElement("div");
    findField.className = "cm-ink-search-field";

    this.searchInput = document.createElement("input");
    this.searchInput.className = "cm-ink-search-input";
    this.searchInput.placeholder = "Find";
    this.searchInput.setAttribute("main-field", "true");
    this.searchInput.setAttribute("aria-label", "Find");
    this.searchInput.value = this.query.search;
    this.searchInput.addEventListener("input", () => this.commit());
    this.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) findPrevious(this.view);
        else findNext(this.view);
      }
    });

    this.caseChip = toggleChip("Aa", "Match case", () => this.commit());
    this.wordChip = toggleChip("ab", "Match whole word", () => this.commit());
    this.regexpChip = toggleChip(".*", "Use regular expression", () => this.commit());
    setPressed(this.caseChip, this.query.caseSensitive);
    setPressed(this.wordChip, this.query.wholeWord);
    setPressed(this.regexpChip, this.query.regexp);

    findField.append(this.searchInput, this.caseChip, this.wordChip, this.regexpChip);

    this.countEl = document.createElement("span");
    this.countEl.className = "cm-ink-search-count";
    this.countEl.setAttribute("aria-live", "polite");

    const controls = document.createElement("div");
    controls.className = "cm-ink-search-controls";
    controls.append(
      this.countEl,
      iconButton(icons.arrowUp, "Previous match (Shift+Enter)", () => findPrevious(this.view)),
      iconButton(icons.arrowDown, "Next match (Enter)", () => findNext(this.view)),
      (() => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cm-ink-search-text-button";
        button.textContent = "all";
        button.title = "Select all matches";
        button.setAttribute("aria-label", "Select all matches");
        button.addEventListener("click", () => {
          selectMatches(this.view);
          this.view.focus();
        });
        return button;
      })(),
      (() => {
        const button = iconButton(icons.close, "Close (Escape)", () => {
          closeSearchPanel(this.view);
          this.view.focus();
        });
        button.classList.add("cm-ink-search-close");
        return button;
      })(),
    );

    const replaceField = document.createElement("div");
    replaceField.className = "cm-ink-search-field cm-ink-search-replace-field";

    this.replaceInput = document.createElement("input");
    this.replaceInput.className = "cm-ink-search-input";
    this.replaceInput.placeholder = "Replace";
    this.replaceInput.setAttribute("aria-label", "Replace");
    this.replaceInput.value = this.query.replace;
    this.replaceInput.addEventListener("input", () => this.commit());
    this.replaceInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        replaceNext(this.view);
      }
    });
    replaceField.append(this.replaceInput);

    const replaceControls = document.createElement("div");
    replaceControls.className = "cm-ink-search-controls cm-ink-search-replace-controls";
    for (const [label, title, action] of [
      ["replace", "Replace (Enter)", replaceNext],
      ["replace all", "Replace all matches", replaceAll],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cm-ink-search-text-button";
      button.textContent = label;
      button.title = title;
      button.addEventListener("click", () => action(this.view));
      replaceControls.append(button);
    }

    this.dom.append(replaceToggle, findField, controls, replaceField, replaceControls);
    this.updateCount();
  }

  private commit() {
    const query = new SearchQuery({
      search: this.searchInput.value,
      replace: this.replaceInput.value,
      caseSensitive: isPressed(this.caseChip),
      wholeWord: isPressed(this.wordChip),
      regexp: isPressed(this.regexpChip),
    });

    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
    }
    this.updateCount();
  }

  update(update: ViewUpdate) {
    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.query = effect.value;
          this.syncFromQuery();
        }
      }
    }
    if (update.docChanged || update.selectionSet) this.updateCount();
  }

  private syncFromQuery() {
    if (this.searchInput.value !== this.query.search) this.searchInput.value = this.query.search;
    if (this.replaceInput.value !== this.query.replace) this.replaceInput.value = this.query.replace;
    setPressed(this.caseChip, this.query.caseSensitive);
    setPressed(this.wordChip, this.query.wholeWord);
    setPressed(this.regexpChip, this.query.regexp);
    this.updateCount();
  }

  private updateCount() {
    if (!this.query.search || !this.query.valid) {
      this.countEl.textContent = "";
      this.countEl.classList.remove("cm-ink-search-count--empty");
      return;
    }

    const selection = this.view.state.selection.main;
    let count = 0;
    let current = 0;
    const cursor = this.query.getCursor(this.view.state);
    let step = cursor.next();
    while (!step.done && count <= MAX_COUNTED_MATCHES) {
      count += 1;
      if (step.value.from === selection.from && step.value.to === selection.to) current = count;
      step = cursor.next();
    }

    if (count === 0) {
      this.countEl.textContent = "No results";
      this.countEl.classList.add("cm-ink-search-count--empty");
      return;
    }

    this.countEl.classList.remove("cm-ink-search-count--empty");
    const total = count > MAX_COUNTED_MATCHES ? `${MAX_COUNTED_MATCHES}+` : String(count);
    this.countEl.textContent = current > 0 ? `${current} of ${total}` : `${total} results`;
  }

  mount() {
    this.searchInput.focus();
    this.searchInput.select();
  }
}

const searchPanelTheme = EditorView.baseTheme({
  ".cm-panel.cm-ink-search": {
    display: "grid",
    gridTemplateColumns: "auto minmax(160px, 380px) 1fr",
    gap: "6px 8px",
    alignItems: "center",
    padding: "6px 8px",
    backgroundColor: "var(--panel-bg)",
    borderTop: "1px solid var(--border-color)",
    borderBottom: "1px solid var(--border-color)",
  },
  ".cm-ink-search-field": {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "2px 4px 2px 8px",
    backgroundColor: "var(--editor-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: "6px",
  },
  ".cm-ink-search-field:focus-within": {
    borderColor: "var(--accent-blue)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent-blue) 22%, transparent)",
  },
  ".cm-ink-search-input": {
    flex: "1",
    minWidth: "0",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-emphasis)",
    fontSize: "13px",
    padding: "3px 0",
  },
  ".cm-ink-search-input::placeholder": {
    color: "var(--text-secondary)",
  },
  "@media (pointer: coarse)": {
    ".cm-ink-search-input": {
      fontSize: "16px",
    },
  },
  ".cm-ink-search-chip": {
    border: "1px solid transparent",
    borderRadius: "4px",
    background: "transparent",
    color: "var(--text-secondary)",
    font: "600 11px/1 inherit",
    fontFamily: "inherit",
    padding: "5px 5px",
    cursor: "pointer",
  },
  ".cm-ink-search-chip:hover": {
    backgroundColor: "color-mix(in srgb, var(--text-secondary) 14%, transparent)",
    color: "var(--text-primary)",
  },
  ".cm-ink-search-chip--on": {
    backgroundColor: "color-mix(in srgb, var(--accent-blue) 18%, transparent)",
    borderColor: "color-mix(in srgb, var(--accent-blue) 45%, transparent)",
    color: "var(--text-emphasis)",
  },
  ".cm-ink-search-controls": {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    minWidth: "0",
  },
  ".cm-ink-search-count": {
    color: "var(--text-secondary)",
    fontSize: "12px",
    whiteSpace: "nowrap",
    padding: "0 6px",
    minWidth: "70px",
  },
  ".cm-ink-search-count--empty": {
    color: "var(--error)",
  },
  ".cm-ink-search-button": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
  },
  ".cm-ink-search-button:hover": {
    backgroundColor: "color-mix(in srgb, var(--text-secondary) 14%, transparent)",
    color: "var(--text-emphasis)",
  },
  ".cm-ink-search-toggle svg": {
    transition: "transform 120ms ease",
  },
  ".cm-ink-search--replace-open .cm-ink-search-toggle svg": {
    transform: "rotate(90deg)",
  },
  ".cm-ink-search-close": {
    marginLeft: "auto",
  },
  ".cm-ink-search-text-button": {
    border: "1px solid var(--border-color)",
    borderRadius: "4px",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontFamily: "inherit",
    padding: "3px 8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ".cm-ink-search-text-button:hover": {
    backgroundColor: "var(--accent)",
    color: "var(--text-emphasis)",
  },
  ".cm-ink-search-replace-field": {
    gridColumn: "2",
  },
  ".cm-ink-search-replace-controls": {
    gridColumn: "3",
  },
  ".cm-ink-search:not(.cm-ink-search--replace-open) .cm-ink-search-replace-field": {
    display: "none",
  },
  ".cm-ink-search:not(.cm-ink-search--replace-open) .cm-ink-search-replace-controls": {
    display: "none",
  },
});

export function inkSearch(options: { top?: boolean } = {}) {
  return [
    search({
      top: options.top,
      createPanel: (view) => new InkSearchPanel(view, options.top ?? false),
    }),
    searchPanelTheme,
  ];
}
