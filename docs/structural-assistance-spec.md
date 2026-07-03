# InkPad Structural Writing Assistance — v1 Spec (Phase 3, authoritative)

Status: **authoritative spec for Roadmap Phase 3.** Supersedes and absorbs the
earlier `completions-and-snippets-spec.md` (now removed).
Owner: @mmolarskybeck
Last updated: 2026-07-03 — **retargeted from Monaco to CodeMirror 6** after the
editor migration (see `docs/archive/codemirror-migration/Editor Migration Plan.md` / `docs/archive/codemirror-migration/editor-migration-updates.md`)
and reconciled against the current repo state.

> **Read first — timing.** This is still a polish layer on top of the editor.
> The foundations it depends on (compile, syntax highlighting via the vendored
> Lezer grammar, save/load/export) landed with the CodeMirror migration; the
> remaining gate is migration soak, not missing features. The implementation
> order below front-loads the writer-visible wins that need only the symbol
> table, so partial delivery is useful.

---

## Editor target: CodeMirror 6

The editor is CodeMirror 6 (`client/src/components/editor/codemirror-editor.tsx`).
All Monaco surfaces named in earlier drafts of this spec are gone:
`monaco-setup.ts`, the Monarch tokenizer, the `CompletionItemProvider` snippet
registration, and the `CodeActionProvider` quick-fix adapter
(`inkLanguage/inkCodeActions.ts`) were all deleted during the migration.

Translation table for every Monaco concept this spec previously leaned on:

| Spec concept | Monaco (old) | CodeMirror 6 (now) |
| --- | --- | --- |
| Diagnostics rendering | `IMarkerData` + `setModelMarkers` | `Diagnostic[]` + `setDiagnostics` (`@codemirror/lint`, **installed & wired**) |
| Severity | `MarkerSeverity.Info` etc. | `Diagnostic.severity: "error" \| "warning" \| "info" \| "hint"` |
| Completion | `CompletionItemProvider` | `CompletionSource` (`@codemirror/autocomplete`, **not installed yet**) |
| Snippet tab stops | `${1:name}` insert text | same `${1:name}` syntax, via `snippetCompletion()` / `snippet()` |
| Quick fixes | `CodeActionProvider` + lightbulb | `Diagnostic.actions: Action[]` rendered in the lint hover tooltip |
| Hover info | `HoverProvider` | `hoverTooltip()` (`@codemirror/view`) |
| Position model | `ITextModel` + 1-based line/column | `EditorState` + document offsets; line/column ↔ offset via `editor/codemirror/coordinates.ts` (exists) |
| Language services registry | global `monaco.languages.register*` | extensions composed in `buildExtensions()` in `codemirror-editor.tsx`, or support extensions passed to `InkLanguageSupport()` |

**Dependencies to add when Phase 3 starts:** `@codemirror/autocomplete`
(completion + snippet fields). `fastest-levenshtein` is already installed and
exact-pinned for quick-fix fuzzy matching.

**New capability the Monaco draft didn't have:** a real error-tolerant syntax
tree. The vendored Lezer grammar (`editor/codemirror/ink-lang/`, forked from
`@mavnn/codemirror-lang-ink`) parses Ink into named nodes — `Knot`, `Stitch`,
`Function`, `KnotName`, `StitchName`, `Path`, `Name`, `DivertArrow`, `END`,
`DONE`, … — available via `syntaxTree(state)`. §Foundation below defines how
this coexists with the tolerant scanner.

---

## Scope

This spec covers one feature cluster: **structural writing assistance for Ink**.
It does not cover HTML export, the Modified indicator, Problems-panel copy, TODO
severity rendering, or other roadmap items, except where they touch architecture.

The product model is deliberately narrow:

> InkPad helps writers **connect, repair, and navigate** their story structure.
> It does not suggest story prose, plot, or narrative content.

This is diagnostics + quick fixes + quick insert + navigation — **not**
"autocomplete" in the predictive-text sense, and **never** AI writing assistance.

---

## Implementation status (2026-07-03)

More is built than at the last revision — but one previously-working surface is
now dormant.

**Shipped and wired:**

- **Error-tolerant symbol scanner** + tests:
  `client/src/inkLanguage/buildSymbolTable.ts` / `buildSymbolTable.test.ts`.
  Knots, stitches, and function knots indexed with `hasParameters`; function
  knots excluded from divert targets via `isDivertTarget`; parameterized
  sections excluded from missing-start candidates via `isMissingStartTarget`.
- **Missing-starting-divert diagnostic** (the InkPad-specific diagnostic below):
  `client/src/inkLanguage/inkDiagnostics.ts` (`getMissingStartDiagnostic`,
  severity `"hint"`), computed in `pages/editor.tsx`, merged with compiler
  errors into the `EditorDiagnostic` union (`types/editor-diagnostic.ts`),
  converted by `editor/codemirror/diagnostics.ts` (`toCodeMirrorDiagnostics`),
  and pushed with `setDiagnostics` in `codemirror-editor.tsx`. Its CodeMirror
  lint quick fix now exists as the first action pipeline proof: **Start at
  target** inserts `-> target` at the top of the active file.
- **Unresolved-divert quick fixes**:
  the pinned inkjs adapter recognizes unresolved divert messages, and the
  CodeMirror lint tooltip now offers both **Change to target** and
  **Create knot target** when the signal is confident enough.
- **Shared snippet library (12 snippets)** + compile-verification test:
  `client/src/features/snippets/ink-snippets.ts` / `ink-snippets.test.ts`.
  All 12 round-trip through the compiler. `desktopSnippet` uses `${n:default}`
  tab stops, directly compatible with `@codemirror/autocomplete`'s `snippet()`.
- **Mobile snippet drawer + syntax button bar** — shipped in
  `components/editor/editor-workspace.tsx`. This implements the §Mobile
  insertion product rules (synchronous in-gesture insertion, first-placeholder
  selection, tap-vs-scroll threshold, single-shot pointer/click/key guards,
  caret placement for syntax literals). Those rules are now **regression
  requirements**, not open design work.
- **Author/TODO severity fix**: inkjs `ErrorType.Author` (0) maps to `"info"`
  through the whole chain — worker → `InkCompilerMessage` → `InkCompilerError`
  → `Diagnostic.severity: "info"` (themed via `.cm-lintRange-info` /
  `.cm-diagnostic-info`). TODOs appear on clean compiles with a neutral icon.
- **Lezer grammar + resolver primitive**: `editor/codemirror/ink-lang/` plus
  `editor/codemirror/identifier-occurrences.ts`, whose exported
  `identifierWordAt(state, pos)` already answers "is the cursor on an Ink
  identifier, and which one?" — the seed of `resolveSymbolAtPosition`.
- **Diagnostics fixtures (partial)**:
  `client/src/workers/__fixtures__/inkjs-diagnostics/` exists
  (`missing-divert-target.ink`, `todo-author-warning.ink`,
  `include-missing-target.ink`, `included-file-error.ink`, `chapters/broken.ink`),
  exercised by `workers/compile-ink-project.test.ts`. inkjs is pinned exactly
  (`"inkjs": "2.3.2"`, no range).
- **inkjs diagnostic adapter (partial)**:
  `client/src/inkLanguage/diagnosticAdapter.ts` recognizes pinned inkjs
  unresolved-divert messages and adds `code: "unresolved-divert"` plus
  `targetName`, with fixture-backed coverage against `missing-divert-target.ink`.

**Dormant (regressed by the migration, by design):**

- **Desktop snippet completion.** The pure, tested matcher
  `features/snippets/ink-completion-provider.ts` (`getSnippetCompletions`)
  survives, but its Monaco adapter was deleted and no CodeMirror
  `CompletionSource` exists. There is **no completion UI of any kind in the
  editor today** — `@codemirror/autocomplete` is not installed.

**Not yet built:** divert completion, go-to-definition, Ink Info, mobile target
picker, command palette / desktop accessory surface, the remaining inkjs coded
diagnostics beyond unresolved diverts.

---

## Product principles

1. **No ghost features.** If a feature is visible on mobile, it must be usable
   on mobile. A reduced mobile version is fine; a broken or misleading one is not.
2. **No phantom interactions (the inverse).** Mobile must not respond to taps on
   plain, unmarked tokens. Hidden touch behavior that fights cursor placement,
   selection, and the OS magnifier is as bad as a ghost feature. Mobile
   assistance is exposed only through visible affordances or explicit actions.
3. **Correct connections, not creative content.** Broken diverts, missing starts,
   unresolved symbols, snippets, navigation — yes. Prose, choices, plot — no.
4. **Prefer compiler truth, but never depend on compiler success.** inkjs is the
   source of truth for validity (errors/warnings). It is **not** the source of
   symbols. Editor intelligence must keep working on broken input — that is
   exactly when writers need it.
5. **Be conservative with suggestions.** A wrong suggestion is worse than none.
   Fuzzy correction returns at most one confident candidate, never a ranked list.
6. **One symbol table, many consumers.** Navigator, completion, target picker,
   Ink Info, and go-to-definition all read from the same index. No feature gets
   its own parser.

---

## Foundation: the error-tolerant symbol table

This is the load-bearing decision, and it is **built and shipping**.

The symbol table is produced by **InkPad's own tolerant source scan**
(`inkLanguage/buildSymbolTable.ts`), not by inkjs compile output. The flagship
quick fix (unresolved divert → "change to closest match") fires precisely when
the file does **not** compile — so the symbol index must survive a
non-compiling file. A compile-derived index would, in the exact moment it's
needed, be missing.

```text
InkPad tolerant scan ──► symbols ──► completion / target picker / quick fixes /
                      │              missing-start check / go-to-definition / Ink Info
                      └─► top-level content facts ──► missing-start diagnostic  ✓ shipped

inkjs compile ──► errors / warnings / author messages ──► diagnostics + layered quick fixes
```

### Scanner vs. Lezer tree — decided: scanner owns the index, tree owns positions

The migration introduced a second error-tolerant parse of the same text: the
Lezer tree. Both survive broken input. The division of labor:

- **The regex scanner remains the source of truth for the symbol index.** It is
  editor-agnostic (no `EditorState` needed), unit-tested without a view, cheap,
  and will work on project files that aren't open in the editor once multi-file
  lands. This matches the migration plan's standing guidance ("InkPad's tolerant
  scanner … should remain the source of truth unless a token/tree-derived
  approach proves simpler during Phase 3").
- **The syntax tree is the tool for in-editor position and context questions**:
  "is the cursor on an identifier?" (`identifierWordAt` already does this via
  `syntaxTree(state).resolveInner`), "is this position in divert context?",
  token ranges for hover and go-to-definition.

Revisit only if the two demonstrably disagree on real documents. Do not build a
tree-walking symbol indexer speculatively.

### Where the scan runs — decided: main thread (v1) — as built

The scan runs on the main thread. As wired today, `pages/editor.tsx` rebuilds
the table in a `useMemo` keyed on the document source; the editor already
debounces change emission (~120ms in `codemirror-editor.tsx`), so the scan is
naturally debounced without its own timer. That satisfies the original ~200ms
guidance.

Move the scan into the worker **only if profiling shows real UI jitter**. That
move means extending `types/worker-messages.ts` (today carries only compile
requests/responses — no symbol channel exists). Don't pay that cost
speculatively.

### v1 symbol scope — as built

The shipped shape (`inkLanguage/inkSymbols.ts`):

```ts
interface InkSymbol {
  name: string
  kind: "knot" | "stitch" | "function"  // "function" = excluded from divert targets
  hasParameters: boolean  // `=== hit(x) ===` — excluded from missing-start fix targets
  path: string            // "living_room" for knot, "living_room.intro" for stitch
  parentPath?: string     // undefined for knots; "living_room" for a stitch inside it
  fileId: string
  range: SymbolRange      // 1-based line/column; editor-agnostic, converted to
                          // CodeMirror offsets by editor/codemirror/coordinates.ts
}
```

v1 indexes **knots, function knots, and stitches**. Function knots are indexed
so the scanner is aware of them, but they are **excluded from divert completion
and missing-start suggestions**. The scan is intentionally boring — a
line/pattern scan (with line/block-comment awareness), not a full parser.

`isDivertTarget(symbol)` is the single filter gate for completion and quick
fixes; `isMissingStartTarget(symbol)` additionally excludes parameterized
sections for the missing-start fix. Both live in `inkSymbols.ts`.

It is acceptable for v1 to miss edge cases. The goal is "InkPad can still find
declared sections in a broken file," not perfect semantic parsing.

> **`fileId` is already real; multi-file is not.** The project model and worker
> contract are `{ entryFile, files: Record<string, string> }` — the map key
> *is* the fileId — but the UI still compiles a single file
> (`createSingleFileCompileInput`), and `INCLUDE` is recognized-but-ignored
> with a warning (`workers/compile-ink-project.ts`). v1 threads the single
> current document through; multi-file `INCLUDE` later does not force a
> symbol-table refactor.

### Named fast-follows (not v1)

```text
v1.5: variables / lists  → enables logic-context completion + variable Ink Info
v2:   labels / gathers   → needed once divert targets to named gathers are completed
v2:   externals, includes, global/dictionary tags
```

---

## Diagnostics

### The as-built pipeline (keep it)

Diagnostics are **pushed**, not pulled. There is no `linter()` source; compile
results arrive asynchronously from the worker, so InkPad dispatches
`setDiagnostics` when they land. The chain today:

```text
worker (ink-compiler.worker.ts)
  → InkCompilerMessage[]                       (types/worker-messages.ts)
  → lib/ink-compiler.ts parse/normalize        (the volatile regex layer)
  → InkCompilerError[]  { line, column?, fileId?, type: "error"|"warning"|"info" }
  → pages/editor.tsx merges with InkPad diagnostics
  → EditorDiagnostic[]                          (types/editor-diagnostic.ts union)
  → toCodeMirrorDiagnostics(state, …)           (editor/codemirror/diagnostics.ts)
  → setDiagnostics dispatch                     (codemirror-editor.tsx effect)
```

Live compile is already debounced (`use-ink-story.ts`). Phase 3 does not change
this flow; it **extends** it — quick-fix `actions` attach where
`EditorDiagnostic` becomes a lint `Diagnostic`, i.e. in or alongside
`toCodeMirrorDiagnostics`.

### inkjs as the primary diagnostic source — behind a defensive adapter

inkjs already reports the cases that matter (unresolved diverts, unresolved
variables, duplicate declarations, invalid usage, empty choices, some loose-end
situations, and author/TODO messages). v1 does not recreate these.

inkjs messages are `string[]`, not a stable structured API. The error handler
receives `(message: string, errorType: ErrorType)`, and the parser formats text
like `ERROR: 'file.ink' line N: …` itself. The adapter must treat these strings
as volatile. Rather than a parallel diagnostic type, the adapter **extends the
existing union** with a recognized-code layer:

```ts
type KnownInkDiagnosticCode = "unresolved-divert" | "empty-choice"

// Adapter output: the existing CompilerEditorDiagnostic, plus optional
// recognition metadata that the quick-fix layer keys on.
type AdaptedCompilerDiagnostic = CompilerEditorDiagnostic & {
  code?: KnownInkDiagnosticCode
  // e.g. for "unresolved-divert": the target name recovered from the message
  targetName?: string
}
```

Behavior:

```text
Recognized message   → diagnostic + code → quick fixes attach
Unrecognized message → still shown with severity, no quick fix (never dropped)
```

Hard requirements for the adapter:

- inkjs version pinned in `package.json` — **done** (`"inkjs": "2.3.2"`, exact).
- Fixture tests that compile real `.ink` and snapshot the actual emitted strings
  under the pinned version. The directory **already exists** at
  `client/src/workers/__fixtures__/inkjs-diagnostics/` (used by
  `compile-ink-project.test.ts`); grow it there rather than creating a new tree:

  ```text
  missing-divert-target.ink   ✓ exists
  todo-author-warning.ink     ✓ exists
  empty-choice.ink            — add before the empty-choice fix
  loose-end.ink               — add
  missing-return-tilde.ink    — add
  ```

- No quick fix ships against a message that isn't covered by a verified fixture.

> **The volatile string layer already exists and is unguarded at the unit level.**
> `client/src/lib/ink-compiler.ts` (`parseInkError`) parses inkjs strings with
> regexes to strip prefixes and recover file/line. The fixture-pinning
> discipline above must wrap **this existing code**, not only new code.

> **Author/TODO severity — fixed and threaded.** inkjs enum: `Author = 0,
> Warning = 1, Error = 2`, mapped `0 → "info"`, `1 → "warning"`, `2 → "error"`.
> `"info"` flows through `InkCompilerMessage` → `InkCompilerError` → lint
> `Diagnostic.severity` and the Problems panel icon. (The old Monaco
> `MarkerSeverity.Info` step no longer exists.)

### InkPad-specific diagnostic: missing starting divert — ✓ shipped (diagnostic only)

A story that opens with a knot/stitch declaration and has no top-level content
compiles but previews blank — a top beginner "why is nothing showing?" trap.

```ink
=== find_help ===
You search desperately for a friendly face in the crowd.
```

> No opening content found. Start the story at `find_help`?

Shipped as `getMissingStartDiagnostic` (`inkLanguage/inkDiagnostics.ts`),
severity `"hint"`, anchored to the first playable symbol's declaration line.
It needs only the symbol table + `hasTopLevelContent` — no inkjs adapter. Its
quick fix is also shipped as a CodeMirror lint `Action`, using the pure edit in
`inkLanguage/quickFixes.ts`.

---

## Completion

**Prerequisite:** `npm i @codemirror/autocomplete`. Nothing renders completion
today.

### Wiring

Add `autocompletion()` plus two `CompletionSource`s in a new
`editor/codemirror/completion.ts`, registered either as support extensions via
`InkLanguageSupport()` (currently returns a bare `LanguageSupport` with no
support extensions — the natural slot) or as
`InkLanguage.data.of({ autocomplete: source })` entries composed in
`buildExtensions()`. `autocompletion()` brings its own keymap (Ctrl+Space,
arrows, Enter/Tab accept, Escape) by default.

### Product decision — Option A (probationary): keep both sources

Two completion sources coexist, distinguished by context:

```text
->  context (e.g. "->" or "-> liv")   → symbol / divert-target completions
lone structural keyword (e.g. "knot") → snippet completions
prose                                  → nothing (both sources return null)
```

The conservative word-alone gate for snippets is already implemented and tested
as the pure `getSnippetCompletions(lineContent, column)` — the CodeMirror
source is a thin adapter over it.

> **Probationary.** The Monaco-era `quickSuggestions` experiment did not
> survive the migration; its CodeMirror equivalent is `autocompletion()`'s
> default activate-on-typing behavior. The trial restarts on those terms: if
> dogfooding shows lone-keyword snippet popups are noisy or fire on accidental
> Tab/Enter, **gate the snippet source on `context.explicit`** (Ctrl+Space /
> palette / accessory bar only) — a one-line change — and reserve
> as-you-type completion strictly for divert targets. The divert-target source
> is not probationary; it stays either way.

### Completion v1: divert targets

Trigger: after `->`. Detection: `context.matchBefore(/->\s*[\w.]*$/)` (with a
tree-based check as an optional refinement — the grammar exposes `DivertArrow`).
Suggestions from the symbol table (filtered by `isDivertTarget`) plus keywords:

```text
living_room      knot
kitchen          knot
intro.phone      stitch
END              keyword
DONE             keyword
```

Return `{ from: startOfPartialWord, options, validFor: /^[\w.]*$/ }` so the
list filters as the writer types without re-querying.

- Suggest divert targets in divert/flow context only.
- Do **not** offer prose/vocabulary completion.
- Logic-context variable completion is a v1.5 follow (needs variable symbols).

### Snippet source

Map each `getSnippetCompletions` hit to
`snippetCompletion(snippet.desktopSnippet, { label, detail, info })`. The
`${1:name}` tab-stop syntax in `ink-snippets.ts` is natively understood by
`snippet()`; Tab/Shift-Tab move between fields while a snippet is active.
Verify the field keymap wins over the globally-bound `indentWithTab` while
fields are active (it should — snippet state adds its own high-precedence
keymap — but this is a cheap test to write).

### Mobile completion v1: target picker, not the autocomplete tooltip

CodeMirror's completion tooltip is a hover/keyboard UI; on touch it is exactly
the kind of half-usable surface Principles 1–2 prohibit. Same symbol data,
visible picker using the existing shadcn/ui `Command` + drawer/sheet. Desktop
inline completion and the mobile picker read the same symbol table; only the
UI differs.

---

## Snippets (folded from the prior completions-and-snippets spec)

Snippets are **separate from completion**:

- Completion answers "which existing symbol am I referencing?"
- Snippets answer "which common Ink structure do I want to insert?"

### Shared library — single source of truth — ✓ built

One definition feeds every surface: `client/src/features/snippets/ink-snippets.ts`.

```ts
interface InkSnippet {
  id: string;              // "knot"
  label: string;           // "Knot"
  category: SnippetCategory;
  context: SnippetContext; // "top-level" | "flow" | "inline"
  aliases: string[];       // ["knot", "==="] — desktop completion triggers
  desktopSnippet: string;  // "${1:name}" tab stops — @codemirror/autocomplete snippet() format
  mobileInsert: string;    // bracketed placeholders: "=== [knot_name] ===\n…"
  description: string;
}
```

`context` tells the completion source where a trigger may fire and tells the
test harness how to wrap a fragment so it compiles.

### Hard rules

1. **Every snippet must compile through InkPad's own compiler before shipping**
   — enforced by `ink-snippets.test.ts`. ✓ in place.
2. **Fewer, correct, tested snippets** beat a large plausible-looking library.
3. **Mind the problems inspector.** Live compile is debounced, which absorbs
   most of this; if half-filled placeholders still draw squiggles in practice,
   add a short grace period after snippet insertion before diagnostics update.

### Syntax buttons vs snippet buttons (keep distinct) — ✓ both shipped on mobile

- A **syntax button** inserts a tiny literal: `->`, `*`, `+`, `~`, `=`, `===`,
  `{ }` — shipped as `MOBILE_SYNTAX_INSERTS` in `editor-workspace.tsx`, with
  caret placement per button (`===  ===` puts the caret between the spaces;
  `{ }` inside the braces; `-> ` after the trailing space).
- A **snippet/palette item** inserts a structure — shipped as the mobile
  snippet drawer (categorized, expandable rows, insert selects the first
  `[placeholder]`).

### Architectural note — snippets power two surfaces

```text
Command palette  = expanded, searchable (desktop popover / mobile sheet) — planned
Accessory bar    = compact always-available shortcut strip (mobile)      — ✓ shipped
```

### Mobile insertion — the gating risk — ✓ implemented; now regression rules

The rules below are implemented across `editor-workspace.tsx` (gesture
handling, tap-move threshold, single-shot guards, drawer ordering) and
`codemirror-editor.tsx` (`insertTextAtCursor`: synchronous focus →
`view.dispatch` with `selectRange` → re-focus, all inside the activating
event). They remain product rules — any refactor must preserve them:

1. **Insertion must happen inside the activating pointer/key event.** Do not
   defer the edit/focus through `requestAnimationFrame`, `setTimeout`, or drawer
   animation callbacks. Mobile browsers usually open the keyboard only when
   `focus()` happens inside the original trusted user gesture.
2. **Toolbar buttons keep the writer in the editor.** A syntax toolbar tap
   inserts its literal, restores editor focus immediately, and places the caret
   at the useful typing point.
3. **Snippet buttons select the first placeholder.** After inserting a snippet,
   select the first bracketed placeholder (`[knot_name]`, `[Choice text]`, …)
   so typing replaces it immediately. Do not attempt full tab-stop navigation
   on mobile in v1.
4. **Closing the snippet drawer must not steal the gesture.** Keep the gesture
   path ordered as focus → insert → select placeholder → close drawer →
   reaffirm focus, all inside the same trusted tap/key event.
5. **Scrolling a snippet list is not insertion.** Movement past the mobile tap
   threshold scrolls the list and suppresses the follow-up click; only a
   deliberate tap inserts.
6. **Pointer and keyboard activation must be single-shot.** Pointer-up is used
   for mobile insertion reliability; click/keyboard fallbacks exist for
   accessibility and are guarded so one tap/press cannot insert twice.
7. **Keyboard reopening is best-effort, not magic.** If the browser refuses to
   show the keyboard after a valid synchronous focus, the fallback is that the
   editor remains focused with a visible caret/selection; the next direct
   editor tap must always recover without a page refresh.

New assistance surfaces (target picker, quick-fix sheet, palette) must follow
the same rules and should be device-tested (iPhone Safari/Chrome, Android
Chrome, iPad Safari) before polish.

### Explicit "no" list for snippets v1

- ❌ Wrap-selection — insert-at-cursor only.
- ❌ Full-story examples as a headline palette feature.
- ❌ Tab-stop navigation on mobile.
- ❌ Tab expansion as a primary path (demoted; autocomplete is enough for v1).

---

## Symbol resolution at position → go-to-definition and Ink Info

One work item, two consumers. Both need a token-under-position resolver:

```ts
resolveSymbolAtPosition(state: EditorState, pos: number): ResolvedInkToken | null
```

Build it on what exists: `identifierWordAt(state, pos)`
(`editor/codemirror/identifier-occurrences.ts`) already returns the identifier
word range under the cursor and rejects prose by checking the Lezer node name
(`KnotName` / `StitchName` / `Name` / `Path` / `SelectedName`). The resolver
adds the symbol-table lookup: word (or dotted `Path`) → `InkSymbol`.

- Go-to-definition reads it to jump.
- Ink Info reads it to render a tooltip.

### Go-to-definition

```text
Desktop: Cmd/Ctrl-click a divert target → jump to definition; plus a keymap binding.
Mobile:  cursor inside a divert target + explicit "Go to target" action.
```

CodeMirror has no built-in go-to-definition: implement Cmd/Ctrl-click with an
`EditorView.domEventHandlers` `mousedown` handler + `view.posAtCoords`, and the
keyboard path as a `keymap` command. The jump itself reuses the existing
`jumpToLine` / `flashLineField` machinery in `codemirror-editor.tsx`.

> **Modifier choice:** the old spec offered Alt-click as an alternative;
> Alt-drag is now taken by `rectangularSelection`. Use Cmd/Ctrl-click only.

### Ink Info

Implemented as a `hoverTooltip()` extension (desktop hover; the `.cm-tooltip`
theming already exists in `codemirror-editor.tsx`).

**A. Static keyword teaching** (zero infrastructure, low priority):
`END`, `DONE`, `*`, `+`, `VAR` — one-sentence explanations.

**B. Symbol identity** (needs symbol table; higher long-term value):
divert-target info + `[Go to definition]` link.

Constraints: no reference counts in v1; tooltip discipline: one title, one
sentence, at most one action.

---

## Quick fixes v1

### Mechanics (CodeMirror)

The vehicle is `Diagnostic.actions: Action[]` (`{ name, apply(view, from, to) }`)
from `@codemirror/lint`, attached where `EditorDiagnostic` is converted to a
lint `Diagnostic` — i.e. in/alongside `toCodeMirrorDiagnostics`. Actions render
as buttons in the lint hover tooltip on desktop.

Two implementation rules:

- **Fix computation is editor-agnostic; fix application is a dispatch.**
  `inkLanguage/quickFixes.ts` computes pure text edits
  (`{ from, to, insert }` or line-based equivalents); the CodeMirror layer
  wraps them as `Action.apply` calls that `view.dispatch` a transaction.
  Never apply a fix by mutating React state — the editor's `updateListener`
  already syncs the document back to React after any dispatch.
- **Fuzzy matching uses `fastest-levenshtein`** — installed exact-pinned.

### 1. Unresolved divert → change to closest match (flagship) — ✓ shipped

Conservative fuzzy match: same first char, length Δ ≤ 2, single clear best
candidate, at most one shown. Ties → suppress. No strong candidate → offer only
"Create knot." Requires the diagnostic adapter to have recognized
`unresolved-divert` and recovered `targetName` from a fixture-verified message.

### 2. Unresolved divert → create missing knot

Insert `=== target ===` at end of current file. ✓ shipped for bare knot names
only; dotted targets are suppressed until stitch/file-aware creation exists.

### 3. Missing starting divert → start story at first knot — ✓ shipped

Insert `-> first_knot` at the top of the file. The diagnostic already ships and
carries the target path; this is the first action built (no adapter needed)
and proves the whole actions pipeline.

### Out of v1: empty-choice quick fix

Good fast-follow, but must not ship until the warning output is verified against
the pinned inkjs version and covered by a fixture in
`workers/__fixtures__/inkjs-diagnostics/`.

---

## Diagnostics & fix UI

```text
Desktop: wavy underline (themed ✓) + hover lint tooltip with action buttons
         + fix button on the item in InkPad's own Problems panel
Mobile:  tap Problems item → jump + fix sheet · tap squiggle → fix sheet
```

No desktop-only path to any fix. Two CodeMirror-specific notes:

- Lint tooltips are hover-driven; they effectively don't exist on touch. The
  mobile path is InkPad's Problems drawer (`error-panel.tsx`) + a custom
  `QuickFixSheet`, fed by the same `EditorDiagnostic` + fix metadata. Tapping a
  squiggle can route to the fix sheet via a tap handler that checks
  `forEachDiagnostic` at the tap position.
- `lintKeymap` is already installed, which binds CodeMirror's own lint panel —
  that panel duplicates InkPad's Problems panel. Decide during implementation
  whether to unbind `openLintPanel` or leave it as a power-user redundancy;
  either way the Problems panel remains the product surface.

---

## Implementation order

```text
0. Install @codemirror/autocomplete (fastest-levenshtein is installed)
1. Error-tolerant symbol scan (knots/stitches + ranges + top-level-content)   ✓ DONE
2. Missing-starting-divert diagnostic                                          ✓ DONE
   └─ its quick fix = first lint Action; builds the actions pipeline          [done]
3. Desktop divert completion (knots, stitches, END, DONE)      [symbol table only]
   └─ CM snippet source rides along: getSnippetCompletions is ready, only the
      adapter is missing
4. Symbol resolution → go-to-definition + divert info    [tree + symbol table]
5. Mobile target picker / quick fix sheet                [symbol table; snippet
                                                          model already feeds the
                                                          shipped accessory bar]
6. inkjs diagnostic adapter (pinned version ✓ + grow existing fixtures)  [partial: unresolved-divert done]
7. Unresolved-divert quick fixes (closest-match + create)                  ✓ DONE

Fast-follows: empty-choice quick fix · more inkjs diagnostic codes · variables/lists in symbols ·
              logic completion · labels/gathers · static keyword tooltips
```

---

## Explicit v1 non-goals

Rename symbol · full reference graph · unreachable-knot warnings ·
incoming/outgoing divert counts · variable quick fixes · function signature help ·
case/spacing normalization · vocabulary/prose completion · AI writing suggestions ·
full language server.

---

## Architecture sketch

The split is **editor-agnostic core (`inkLanguage/`) vs. CodeMirror adapters
(`editor/codemirror/`)** — this replaces the old note about consolidating
snippets into `inkLanguage/`; `features/snippets/` stays where it is.

```text
inkLanguage/                       — pure, no CodeMirror imports
  buildSymbolTable.ts   ✓          // tolerant scan → InkSymbol[] + top-level facts
  inkSymbols.ts         ✓          // types, isDivertTarget, isMissingStartTarget
  inkDiagnostics.ts     ✓          // missing-start diagnostic
  diagnosticAdapter.ts  ✓          // unresolved-divert coded diagnostics; more planned
  quickFixes.ts         ✓          // missing-start + create bare knot; other fixes planned
  fuzzyMatch.ts         ✓          // conservative single-candidate edit distance

editor/codemirror/                 — CodeMirror-specific
  ink-lang/             ✓          // vendored Lezer grammar (parser, styleTags, folding)
  coordinates.ts        ✓          // 1-based line/column ↔ document offsets
  diagnostics.ts        ✓          // EditorDiagnostic[] → lint Diagnostic[] (+ missing-start action)
  identifier-occurrences.ts ✓      // identifierWordAt — resolver primitive
  completion.ts                    // divert + snippet CompletionSources
  resolve-at-position.ts           // resolveSymbolAtPosition(state, pos)
  hover.ts                         // Ink Info hoverTooltip
  go-to-definition.ts              // mod-click handler + keymap command

features/snippets/      ✓          // library, pure matching, compile tests
  ink-snippets.ts / ink-snippets.test.ts
  ink-completion-provider.ts / .test.ts   // pure matcher awaiting its CM adapter

lib/ink-compiler.ts     ✓          // the volatile inkjs string layer (wrap with adapter)

components/
  editor/editor-workspace.tsx ✓    // mobile syntax bar + snippet drawer (shipped)
  editor/error-panel.tsx      ✓    // Problems panel (gains fix buttons)
  TargetPicker.tsx                 // planned
  QuickFixSheet.tsx                // planned
  InkCommandPalette.tsx            // planned
```

### Core data flow

```text
Source change (editor emits, debounced ~120ms)
 → rebuild symbol table (main thread, pages/editor.tsx)     ─┐
 → compile with inkjs (worker, debounced live compile)       │  independent
 → adapt inkjs errors/warnings/author msgs (string layer)   ─┘
 → add InkPad custom diagnostics (from scanner facts)
 → merge into EditorDiagnostic[] → toCodeMirrorDiagnostics → setDiagnostics
 → attach quick-fix actions where confidence is high
 → expose symbols to completion sources, target picker, resolver
```
