# InkPad Structural Writing Assistance — v1 Spec (Phase 3, authoritative)

Status: **authoritative spec for Roadmap Phase 3.** Supersedes and absorbs the
earlier `completions-and-snippets-spec.md` (now a stub pointing here; the
snippet-specific detail lives in §Snippets below).
Owner: @mmolarskybeck
Last updated: 2026-06-26

> **Read first — timing.** This is still a polish layer on top of the editor.
> Build it only once compile, syntax highlighting, and save/load/export are
> solid. The implementation order below front-loads the writer-visible wins that
> need only the symbol table, so partial delivery is useful.

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

## Implementation status (2026-06-26)

Partially started, ahead of the foundation, as an intentional Phase-1-of-snippets
slice:

- **Shared snippet library (12 snippets)** + compile-verification test:
  `client/src/features/snippets/ink-snippets.ts` / `ink-snippets.test.ts`.
  All 12 round-trip through `compileInkProject`.
- **Desktop snippet completion provider** (lone-keyword trigger, pure
  `getSnippetCompletions` + Monaco adapter):
  `client/src/features/snippets/ink-completion-provider.ts`, registered in
  `monaco-setup.ts`, tested in `ink-completion-provider.test.ts`.
- **Inline auto-suggest enabled** (`quickSuggestions: { other: true }`) — see the
  probationary product decision in §Completion.
- **Error-tolerant symbol scanner** + tests:
  `client/src/inkLanguage/buildSymbolTable.ts` / `buildSymbolTable.test.ts`.
  Knots, stitches, and function knots indexed; function knots excluded from
  divert targets via `isDivertTarget`.
- **Author/TODO severity fix**: inkjs `ErrorType.Author` (0) now maps to
  `"info"` throughout the type chain. TODOs appear in the Problems panel on
  clean compiles and show with a neutral icon, not an error icon.

Not yet built: divert completion (needs symbol table wired to Monaco), quick
fixes, go-to-definition, Ink Info, mobile target picker, command palette /
accessory bar.

> Snippet code lives under `features/snippets/`; symbol scanner under
> `inkLanguage/`. The architecture sketch below proposes consolidating into
> `inkLanguage/` when the rest of Phase 3 lands.

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

This is the load-bearing decision and the first thing to build.

The symbol table is produced by **InkPad's own tolerant source scan**, not by
inkjs compile output. The flagship quick fix (unresolved divert → "change to
closest match") fires precisely when the file does **not** compile — so the
symbol index must survive a non-compiling file. A compile-derived index would,
in the exact moment it's needed, be missing.

This is not theoretical: Inky already proves the pattern — its editor symbol
index scans Ace tokens on a debounced document-change listener, independent of
any successful compile. We adopt the same backbone.

```text
InkPad tolerant scan ──► symbols ──► completion / target picker / quick fixes /
                      │              missing-start check / go-to-definition / Ink Info
                      └─► top-level content facts ──► missing-start diagnostic

inkjs compile ──► errors / warnings / author messages ──► diagnostics + layered quick fixes
```

### Where the scan runs — decided: main thread (v1)

The tolerant scan runs on the **main thread**, debounced (~200ms), for v1.

Rationale: the symbol table must be available *exactly* when compilation is
failing or in-flight (Principle 4). Running on the main thread keeps it fully
decoupled from the inkjs worker's compile lifecycle. A debounced regex pass over
even a 10k-line file is not where InkPad's jank will come from.

Move the scan into the worker **only if profiling shows real UI jitter**. That
move means extending `worker-messages.ts` (today carries only compile results —
no symbol channel exists). Don't pay that cost speculatively.

### v1 symbol scope

```ts
type InkSymbol = {
  name: string
  kind: "knot" | "stitch" | "function"  // "function" = excluded from divert targets
  path: string        // "living_room" for knot, "living_room.intro" for stitch
  parentPath?: string // undefined for knots; "living_room" for a stitch inside it
  fileId: string
  range: SymbolRange
}
```

v1 indexes **knots, function knots, and stitches**. Function knots are indexed
so the scanner is aware of them, but they are **excluded from divert completion
and missing-start suggestions**. The scan is intentionally boring — a
line/pattern scan, not a full parser:

```text
=== knot_name ===                     → kind "knot"
=== function func_name(params) ===    → kind "function" (excluded from divert targets)
= stitch_name                         → kind "stitch", parentPath = enclosing knot
```

`isDivertTarget(symbol)` is the single filter gate for both completion and the
missing-start suggestion: returns `true` only for `"knot"` and `"stitch"`.

It is acceptable for v1 to miss edge cases. The goal is "InkPad can still find
declared sections in a broken file," not perfect semantic parsing. Rebuild is
debounced on source change (Inky uses ~200ms; match or tune).

> **`fileId` is already real.** The project model is already
> `{ entryFile, files: Record<string, InkProjectFile> }` and the compiler
> contract is `{ entryFile, files }`. The map key *is* the fileId. v1 threads
> the existing single `entryFile` through; multi-file `INCLUDE` later does not
> force a symbol-table refactor.

### Named fast-follows (not v1)

```text
v1.5: variables / lists  → enables logic-context completion + variable Ink Info
v2:   labels / gathers   → needed once divert targets to named gathers are completed
v2:   externals, includes, global/dictionary tags
```

---

## Diagnostics

### inkjs as the primary diagnostic source — behind a defensive adapter

inkjs already reports the cases that matter (unresolved diverts, unresolved
variables, duplicate declarations, invalid usage, empty choices, some loose-end
situations, and author/TODO messages). v1 does not recreate these. v1:

1. Compiles with inkjs.
2. Captures `errors`, `warnings`, and `authorMessages`.
3. Attaches them to Monaco markers + the Problems panel.
4. Adds quick-fix metadata only for selected high-confidence cases.

inkjs messages are `string[]`, not a stable structured API. The error handler
receives `(message: string, errorType: ErrorType)`, and the parser formats text
like `ERROR: 'file.ink' line N: …` itself. The adapter must treat these strings
as volatile:

```ts
type KnownInkDiagnostic =
  | { code: "unresolved-divert"; targetName: string }
  | { code: "empty-choice" }
  | { code: "unknown"; rawMessage: string }

type InkDiagnostic = {
  source: "inkjs" | "inkpad"
  severity: "error" | "warning" | "hint" | "info"
  message: string
  fileId: string
  range: SymbolRange | null
  code?: KnownInkDiagnostic["code"]
  quickFixes?: InkQuickFix[]
}
```

Behavior:

```text
Recognized message   → diagnostic + attach quick fixes
Unrecognized message → still shown with severity, no quick fix (never dropped)
```

Hard requirements for the adapter:

- inkjs version pinned in `package.json`.
- Fixture tests that compile real `.ink` and snapshot the actual emitted strings
  under the pinned version:

  ```text
  test/fixtures/inkjs-diagnostics/
    unresolved-divert.ink  empty-choice.ink  missing-return-tilde.ink  loose-end.ink
  ```

- No quick fix ships against a message that isn't covered by a verified fixture.

> **The volatile string layer already exists and is unguarded.**
> `client/src/lib/ink-compiler.ts` already parses inkjs strings with a regex
> to strip prefixes and recover line numbers. The fixture-pinning discipline
> above must wrap **this existing code**, not only new code.

> **Author/TODO severity — fixed.** inkjs enum: `Author = 0, Warning = 1,
> Error = 2`. The worker previously mapped `errorType === 1 ? "warning" :
> "error"`, so Author/TODO messages (0) were mislabeled as errors. Now:
> `0 → "info"`, `1 → "warning"`, `2 → "error"`. The `"info"` type is threaded
> through `InkCompilerMessage`, `InkCompilerError`, Monaco marker severity
> (`MarkerSeverity.Info`), and the Problems panel icon. TODOs appear on clean
> compiles and show a neutral icon, not an error icon.

### InkPad-specific diagnostic: missing starting divert

A story that opens with a knot/stitch declaration and has no top-level content
compiles but previews blank — a top beginner "why is nothing showing?" trap.

```ink
=== find_help ===
You search desperately for a friendly face in the crowd.
```

> No opening content found. Start the story at `find_help`?
> Quick fix → inserts `-> find_help` at the top of the file.

This needs only the symbol table + `hasTopLevelContent` — no inkjs adapter —
so it ships early. The scanner already produces both. Other custom diagnostics
wait for the reference layer.

---

## Completion

### Product decision — Option A (probationary): keep both providers

Two Monaco completion providers coexist, distinguished by context:

```text
->  context (e.g. "->" or "-> liv")   → symbol / divert-target completions
lone structural keyword (e.g. "knot") → snippet completions
prose                                  → nothing
```

The conservative word-alone gate (already implemented) keeps the editor silent
during ordinary prose.

> **Probationary.** Inline auto-suggest for snippets is on trial. If dogfooding
> shows the lone-keyword popups are noisy or fire on accidental Tab/Enter,
> **revert snippets to Ctrl+Space / palette / accessory bar only** and reserve
> Monaco completion strictly for divert targets. The divert-target provider is
> not probationary; it stays either way.

### Completion v1: divert targets

Trigger: after `->`. Suggestions from the symbol table plus keywords:

```text
living_room      knot
kitchen          knot
intro.phone      stitch
END              keyword
DONE             keyword
```

- Suggest divert targets in divert/flow context only.
- Do **not** offer prose/vocabulary completion.
- Logic-context variable completion is a v1.5 follow (needs variable symbols).

### Mobile completion v1: target picker, not Tab

Same symbol data, visible picker using the existing shadcn/ui `Command` +
drawer/sheet. Desktop inline completion and the mobile picker read the same
symbol table; only the UI differs.

---

## Snippets (folded from the prior completions-and-snippets spec)

Snippets are **separate from completion**:

- Completion answers "which existing symbol am I referencing?"
- Snippets answer "which common Ink structure do I want to insert?"

### Shared library — single source of truth

One definition feeds every surface. Built at
`client/src/features/snippets/ink-snippets.ts`.

```ts
interface InkSnippet {
  id: string;              // "knot"
  label: string;           // "Knot"
  category: SnippetCategory;
  context: SnippetContext; // "top-level" | "flow" | "inline"
  aliases: string[];       // ["knot", "==="] — desktop completion triggers
  desktopSnippet: string;  // Monaco tab stops: "=== ${1:knot_name} ===\n…"
  mobileInsert: string;    // bracketed placeholders: "=== [knot_name] ===\n…"
  description: string;
}
```

`context` tells the completion provider where a trigger may fire and tells the
test harness how to wrap a fragment so it compiles.

### Hard rules

1. **Every snippet must compile through InkPad's own compiler before shipping**
   — enforced by `ink-snippets.test.ts`.
2. **Fewer, correct, tested snippets** beat a large plausible-looking library.
3. **Mind the problems inspector.** Add a brief debounce / grace period after
   snippet insertion so live diagnostics don't fire on half-filled placeholders.

### Syntax buttons vs snippet buttons (keep distinct)

- A **syntax button** inserts a tiny literal: `->`, `*`, `+`, `~`, `{ }`.
- A **snippet/palette item** inserts a structure (full scaffold with placeholders).

### Architectural note — snippets power two surfaces

```text
Command palette  = expanded, searchable (desktop popover / mobile sheet)
Accessory bar    = compact always-available shortcut strip (mobile, planned)
```

### Mobile insertion — the gating risk

When the user taps a toolbar or snippet button, the browser may blur Monaco,
lose the cursor, and close or fail to reopen the keyboard. These are product
rules, not incidental implementation details:

1. **Insertion must happen inside the activating pointer/key event.** Do not
   defer the edit/focus through `requestAnimationFrame`, `setTimeout`, or drawer
   animation callbacks. Mobile browsers usually open the keyboard only when
   `focus()` happens inside the original trusted user gesture.
2. **Toolbar buttons keep the writer in the editor.** A syntax toolbar tap
   inserts its literal, restores Monaco focus immediately, and places the caret
   at the useful typing point. Examples: `===  ===` places the caret between the
   spaces; `{ }` places it inside the braces; `-> ` leaves the caret after the
   trailing space.
3. **Snippet buttons select the first placeholder.** After inserting a snippet,
   select the first bracketed placeholder (`[knot_name]`, `[Choice text]`,
   `[target_knot]`, etc.) so typing replaces it immediately. Do not attempt full
   tab-stop navigation on mobile in v1.
4. **Closing the snippet drawer must not steal the gesture.** If a snippet comes
   from the drawer, keep the gesture path ordered as focus -> insert -> select
   placeholder -> close drawer -> reaffirm focus. Drawer close/re-render work
   must happen after Monaco has received the edit and selection; the post-close
   focus call is allowed only while still inside the same trusted tap/key event.
5. **Scrolling a snippet list is not insertion.** Snippet rows inside a scrollable
   drawer must distinguish a still tap from a moving touch. Movement past the
   mobile tap threshold scrolls the list and suppresses the follow-up click; only
   a deliberate tap inserts.
6. **Pointer and keyboard activation must be single-shot.** Pointerdown is used
   for mobile focus reliability; click/keyboard fallbacks exist for accessibility
   and must be guarded so one tap/press cannot insert twice.
7. **Keyboard reopening is best-effort, not magic.** If the browser refuses to
   show the keyboard after a valid synchronous focus, the fallback is that Monaco
   remains focused with a visible caret/selection; the next direct editor tap
   must always recover without requiring a page refresh.

Before building any palette polish, test one ugly `[Insert ->]` button on real
devices (iPhone Safari/Chrome, Android Chrome, iPad Safari; emulator is backup):
type, move cursor, tap, confirm insertion lands where expected and keyboard stays
open.

### Explicit "no" list for snippets v1

- ❌ Wrap-selection — insert-at-cursor only.
- ❌ Full-story examples as a headline palette feature.
- ❌ Tab-stop navigation on mobile.
- ❌ Tab expansion as a primary path (demoted; autocomplete is enough for v1).

---

## Symbol resolution at position → go-to-definition and Ink Info

One work item, two consumers. Both need a token-under-position resolver:

```ts
resolveSymbolAtPosition(model, position): ResolvedInkToken | null
```

- Go-to-definition reads it to jump.
- Ink Info reads it to render a tooltip.

### Go-to-definition

```text
Desktop: Cmd/Ctrl-click or Alt-click a divert target → jump to definition.
Mobile:  cursor inside a divert target + explicit "Go to target" action.
```

### Ink Info

**A. Static keyword teaching** (zero infrastructure, low priority):
`END`, `DONE`, `*`, `+`, `VAR` — one-sentence explanations.

**B. Symbol identity** (needs symbol table; higher long-term value):
divert-target info + `[Go to definition]` link.

Constraints: no reference counts in v1; tooltip discipline: one title, one
sentence, at most one action.

---

## Quick fixes v1

### 1. Unresolved divert → change to closest match (flagship)

Conservative fuzzy match (`fastest-levenshtein`): same first char, length
Δ ≤ 2, single clear best candidate, at most one shown. Ties → suppress.
No strong candidate → offer only "Create knot."

### 2. Unresolved divert → create missing knot

Insert `=== target ===` at end of current file.

### 3. Missing starting divert → start story at first knot

Insert `-> first_knot` at top of file.

### Out of v1: empty-choice quick fix

Good fast-follow, but must not ship until the warning output is verified against
the pinned inkjs version and covered by a fixture test.

---

## Diagnostics & fix UI

```text
Desktop: squiggle + right-click / lightbulb / Problems-panel fix button
Mobile:  tap squiggle → fix sheet · tap Problems item → jump + fix sheet
```

No desktop-only path to any fix.

---

## Implementation order

```text
1. Error-tolerant symbol scan (knots/stitches + ranges + top-level-content)  ✓ DONE
2. Missing-starting-divert diagnostic + fix          [symbol table only]
3. Desktop divert completion (knots, stitches, END, DONE)  [symbol table only]
4. Symbol resolution → go-to-definition + divert info     [symbol table + resolver]
5. Mobile target picker / quick insert palette            [symbol table; snippet model
                                                            also feeds accessory bar]
6. inkjs diagnostic adapter (pinned version + fixtures)   [string layer]
7. Unresolved-divert quick fixes (closest-match + create) [adapter + symbol table + fuzzy]

Fast-follows: empty-choice quick fix · variables/lists in symbols ·
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

```text
inkLanguage/
  buildSymbolTable.ts     // tolerant scan → InkSymbol[] + top-level-content facts  ✓
  inkSymbols.ts           // types, isDivertTarget                                   ✓
  resolveAtPosition.ts    // token-under-cursor → symbol
  diagnosticAdapter.ts    // inkjs strings → InkDiagnostic (defensive, fixture-backed)
  quickFixes.ts           // unresolved-divert, create-knot, missing-start
  fuzzyMatch.ts           // conservative single-candidate edit distance
  completionProvider.ts   // Monaco divert completion from symbol table
                          //   (snippet half: features/snippets/ink-completion-provider.ts)

features/snippets/
  ink-snippets.ts             // shared InkSnippet library                  ✓
  ink-snippets.test.ts        // compile-verification for every snippet     ✓
  ink-completion-provider.ts  // lone-keyword snippet completion provider   ✓
  ink-completion-provider.test.ts                                           ✓

components/
  InkCommandPalette.tsx
  TargetPicker.tsx
  QuickFixSheet.tsx
  InkInfoTooltip.tsx
```

### Core data flow

```text
Source change
 → rebuild symbol table (debounced ~200ms, main thread)  ─┐
 → compile with inkjs (worker)                             │  independent
 → adapt inkjs errors/warnings/author msgs                ─┘
 → add InkPad custom diagnostics (from scanner facts)
 → render Monaco markers + Problems panel
 → attach quick fixes where confidence is high
 → expose symbols to completion, target picker, resolver
```
