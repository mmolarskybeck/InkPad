# InkPad: Monaco -> CodeMirror 6 Migration Plan

Working plan for replacing Monaco with CodeMirror 6 on a dedicated branch.

The working decision is to migrate. The strongest practical evidence is that browser editors for adjacent narrative-scripting tools already use CodeMirror successfully: try.yarnspinner.dev for Yarn Spinner and borogove.app for Ink. That evidence matters more than generic bundle-size arguments because it proves the foundation works for this category of product. It does **not** prove InkPad's specific mobile choreography will work: tabs, drawers, preview panels, keyboard accessory buttons, and snippet insertion still need to be tested inside InkPad's real layout.

The high-level architecture is settled. The remaining risk is implementation discipline. CodeMirror must be built as a long-lived `EditorView` driven by transactions, not as a React-controlled text input with syntax highlighting bolted on. That lifecycle rule is the single most important constraint in this migration.

---
## Baseline, parity, and scope

### Official baselines

Inky is the official editor. Treat it as InkPad's baseline for editor feature scope, not as the implementation model. Inky uses Ace, and CodeMirror has different primitives, so the goal is feature parity and better product behavior, not a line-for-line port.

Use these Inkle-maintained references:

- [`ace-ink.js`](https://github.com/inkle/inky/blob/master/app/renderer/ace-ink-mode/ace-ink.js): Ace tokenizer, folding, escape handling, keywords, custom instruction prefix support.
- [`inkFileSymbols.js`](https://github.com/inkle/inky/blob/master/app/renderer/inkFileSymbols.js): Inky's token-derived symbol table.
- [`ink-tmlanguage`](https://github.com/inkle/ink-tmlanguage): official TextMate grammar for VS Code/Sublime/Atom, including a useful `tests/cases/` corpus.

Important operational detail: pull/copy `ink-tmlanguage` fixtures from the GitHub repository, not from the npm package. The package may only ship the grammar files; the useful corpus lives in the repo.

### Two kinds of parity

Keep these separate so the migration does not become endless:

1. **Migration parity**: enough current InkPad behavior is preserved to remove Monaco safely.
2. **Inky editor parity**: InkPad matches the official editor's expected authoring affordances, including go-to-definition.

Go-to-definition is **not required for the initial Monaco-removal merge** unless it already exists in the current Monaco build. But it **is required before claiming Inky editor parity**, because Inky exposes jump-to-definition as a core editor feature. The migration must preserve the architecture needed for it: symbol ranges, token-under-cursor resolution, line/offset helpers, and an editor API that can switch files and reveal/select a definition.

### Match

InkPad should match Inky for the core Ink authoring surface:

- knot, stitch, function, choice, gather, divert, var, list, include, external, tag, glue, comment, and TODO highlighting
- knot/stitch/function folding
- a tolerant symbol table feeding navigation and future completions
- full divert taxonomy:
  - `-> target`
  - `-> DONE`
  - `-> END`
  - tunnel diverts such as `->->`
  - three-part paths such as `knot.stitch.label`
  - parameterized divert targets such as `-> knot.stitch(args)`
  - nested function calls inside divert parameters, so an inner `)` is not misread as the end of the divert parameter list
- dictionary-style global tags at the top level, such as `# title: ...` and `# author: ...`, parsed into a key/value map where appropriate

The dictionary-style tag convention matters because InkPad already has title/author settings flows that touch source metadata. The migration should not accidentally degrade that behavior.

### Improve

InkPad should deliberately improve on the official desktop-oriented tooling in a few places:

- **Mobile authoring**: CodeMirror should feel calmer than Monaco on iPhone/iPad, especially around selection, keyboard focus, accessory insertion, drawers, and snippet insertion.
- **Conditional/expression highlighting**: `ink-tmlanguage` is limited by TextMate's line-oriented grammar model. A CodeMirror language mode can potentially do better with stateful parsing/highlighting.
- **Project-level UX**: Problems, target picker, snippets, preview/export state, and future multi-file support should remain React/project-level tools around the editor, not editor-internal hacks.

### Cut or defer deliberately

Do not silently port every Inky behavior.

- **`vocabWords`**: Inky's symbol scanner collects prose words of length 3+ into a set, likely for desktop autocomplete of already-used words. This has unclear value for InkPad and should be cut for now.
- **Custom instruction prefix**: Inky allows project-specific highlighted instruction syntax. This is a power-user feature with low payoff for InkPad's friendlier online scope. Defer indefinitely unless a concrete user need appears.
- **Full autocomplete polish**: not part of the editor-swap merge. Minimal insertion and future-safe architecture are in scope; rich completions can come later.
- **Project-wide search**: out of scope for the migration. CodeMirror search is active-file-only for v1.
- **Graph view, hover docs, command palette, custom snippet management**: out of scope for the migration.

### Online-only runtime policy for `EXTERNAL`

`EXTERNAL` is part of Ink syntax and should be highlighted and compiler-supported. But InkPad is browser-only, so runtime behavior needs a deliberate policy:

- InkPad preview should not execute arbitrary user-provided JavaScript for external functions.
- Unsupported external calls should produce a clear preview/runtime diagnostic.
- Safe/stubbed externals can be supported later if there is a concrete use case.
- Playable HTML export should either document unsupported externals clearly or require explicit user-provided runtime bindings in a future feature.

This is a product/security boundary, not just syntax highlighting.

### INCLUDE syntax and resolution policy

Ace's `INCLUDE` rule takes the rest of the line as the filepath and does not strip quotes. Do not assume quoted paths are valid or invalid based on earlier discussion. Verify accepted syntax against inkjs directly.

For InkPad's project model, decide path resolution explicitly:

- Store files by normalized POSIX-style relative path.
- Resolve `INCLUDE` only against `project.files`.
- Do not touch a real filesystem.
- Do not fetch remote includes.
- For v1, prefer resolving include paths against the normalized project-root path map. If inkjs expects a different base, adapt at the compiler-adapter boundary and fixture-test it.
- Keep quoted-path fixtures as defensive tests even if bare unquoted paths become the documented convention.

---
## Governing architecture

Do not let CodeMirror become the source of truth for anything except the editing surface.

| Layer | Responsibility | Owner |
|---|---|---|
| Editing surface | text, selection, cursor, viewport, decorations, lint markers | CodeMirror 6 |
| Syntax coloring / folding | Ink highlight tags + fold ranges | CodeMirror language mode + InkPad `HighlightStyle` |
| Project intelligence | knots, stitches, vars, lists, functions, divert targets, source metadata | InkPad tolerant symbol scanner |
| Compile truth | validity, compiler diagnostics, compiled story JSON | inkjs worker |
| Runtime truth | preview behavior, external-call handling, stale/success/error state | InkPad preview/runtime layer |
| File/project truth | files, normalized paths, active file, entry file | `InkProject` model |
| Writer tools | snippets, quick insert, target picker, Problems, export UI | React around the editor |

Rules:

- **User-facing validity comes from inkjs.** The CodeMirror parser can be imperfect without affecting whether preview/export succeed.
- **CodeMirror is replaceable infrastructure.** Higher-level features talk to it through one imperative API, not through scattered references to editor internals.
- **The compiler worker is not part of the migration.** Only make minimal adapter changes needed to feed CodeMirror diagnostics and future multi-file data.
- **Symbol intelligence must survive broken source.** Inky builds symbols from Ace tokens rather than compiler success; InkPad's tolerant scanner already follows the same principle and should remain the source of truth unless a token/tree-derived approach proves simpler during Phase 3.

A specific folder structure should emerge from the implementation. Do not over-plan scaffolding before the editor exists. The invariant is the three-way split: CodeMirror mechanics, Ink intelligence, and React UI.

---
## Editor lifecycle rules

This is the highest-risk part of the migration.

The likely failure mode is treating CodeMirror like this:

```tsx
<Editor value={source} onChange={setSource} />
```

Do **not** do that. A naive controlled implementation will damage cursor stability, undo history, mobile keyboard behavior, and performance.

Rules:

- Create one `EditorView` per mounted editor.
- Do not recreate `EditorView` or `EditorState` on every React render.
- Push editor changes upward through CodeMirror transactions/update listeners.
- Do not re-read and re-set the entire document on every keystroke.
- Push external file/project changes downward only when the active file's source actually differs from the current editor document.
- Use `Compartment`s for runtime preferences: theme, font size, line wrapping, editable/read-only state, language support, lint source, and keymaps where useful.
- Reconfigure compartments; do not destroy/recreate the view for ordinary preference changes.
- Dispose the `EditorView` cleanly on unmount, including React StrictMode's mount/unmount/remount cycle.
- Keep commands behind `InkEditorHandle` or explicit extension modules. No arbitrary call site should reach into the view directly.

### Document replacement API

Avoid a vague `setValue(value)` method. It is too easy to misuse.

Use an explicit document-replacement API so every full-document replacement declares what happens to selection and history:

```ts
type ReplaceDocumentOptions = {
  history: "reset" | "preserve";
  selection?: { from: number; to?: number };
};

type InkEditorHandle = {
  focus(): void;
  getValue(): string;
  replaceDocument(value: string, options: ReplaceDocumentOptions): void;
  insertText(text: string): void;
  replaceSelection(text: string): void;
  getSelection(): { from: number; to: number };
  setSelection(from: number, to?: number): void;
  revealLine(line: number): void;
  jumpToOffset(offset: number): void;
};
```

Full-document replacement is allowed only for:

- file switch
- import/open
- recovery restore
- reset
- explicit project replacement

Ordinary typing always flows through transactions.

Default policy:

- File switch: reset history unless per-file history is explicitly implemented.
- Import/open/reset/project replacement: reset history.
- Recovery restore: usually reset history, unless there is a specific recovery UX reason to preserve it.
- Programmatic snippet/toolbar insertion: never use `replaceDocument`; use transaction-based insertion/replacement.

---
## Existing Monarch language file

InkPad's current Monaco Monarch tokenizer is useful as a record of visual intent, not as a correctness baseline.

It can inform questions like:

- Should knots be visually prominent?
- Should divert arrows and divert targets receive distinct emphasis?
- Should TODO feel louder than an ordinary comment?
- Should built-ins be visually distinct?

It should **not** be treated as proof of syntax coverage. Do not assume porting Monarch is safer than adopting a community grammar unless the port passes the same fixture suite.

Sanity-check InkPad's taxonomy against:

- Inky's Ace mode
- Inky's symbol scanner
- `ink-tmlanguage` fixtures
- borogove's production behavior where observable
- inkjs compile/runtime behavior

---
## Branch strategy and checkpoint rules

Branch: `feature/codemirror-editor`.

There should be no long-term dual Monaco/CodeMirror maintenance. InkPad has not meaningfully launched, so an adapter-forever approach is extra surface area without user value. The imperative editor API remains after migration because it is good architecture, not because Monaco stays alive.

### Local storage during migration

Bump the storage key/schema version and discard old pre-CodeMirror local saves.

This is not a user-facing migration concern. It prevents stale local dev/test records from crashing or confusing the new project shape.

### Dependency pinning

Pin exact versions of all CodeMirror-related packages during the migration. Avoid `^` drift while validating editor behavior, so behavior changes can be attributed to InkPad code rather than dependency changes.

This applies to:

- CodeMirror core packages
- CodeMirror language packages
- any pre-1.0 Ink language package
- any vendored/forked grammar snapshot

### Migration freeze

Allowed during this branch:

- CodeMirror editor shell
- syntax highlighting
- folding
- diagnostics
- Problems jump
- mobile selection/focus testing
- accessory bar insertion
- minimal snippet insertion
- active-file editor API
- `fileId`-aware diagnostic model
- path-hygiene groundwork needed for future multi-file support

Not allowed during this branch:

- elaborate command palette
- full autocomplete polish
- graph view
- hover docs
- full multi-file UI
- custom snippet management beyond minimal insertion
- project-wide search
- major compiler-worker refactor

### Checkpoints

Test mobile at every checkpoint, not just at the end.

1. Reference study + InkPad-layout mobile spike complete.
2. CodeMirror renders and edits the active file using the lifecycle rules above.
3. Autosave / dirty-state works: `Saved -> Modified -> Saved`.
4. Compile + preview works end to end.
5. Coordinate helpers + `fileId` diagnostics wired; Problems jump-to-line works.
6. Language mode chosen via fixtures; highlighting + folding + theme parity shipped.
7. Mobile accessory bar / snippet insertion works inside the real layout.
8. Monaco removed; accessibility, path-hygiene, and export checks pass.

---
## Phase 0 - Reference study + InkPad-layout mobile spike

This is not a generic "does CodeMirror work on mobile?" gate. Production evidence already suggests that it can. This phase verifies InkPad-specific choreography.

### Reference study

On a real iPhone in mobile Safari, test:

- try.yarnspinner.dev
- borogove.app

Stress these behaviors:

- tap to focus
- cursor placement
- long-press selection
- selection-handle dragging
- copy/paste
- scroll while selecting
- editor scroll with keyboard open
- any available snippet/quick-insert behavior
- whether insertion keeps the keyboard open

If practical, inspect bundles/source maps to learn which CodeMirror extensions/keymaps they ship and how borogove handles Ink highlighting. This is useful but not required. Mobile behavior notes plus the InkPad-layout spike are the required outputs.

### InkPad-layout spike

Build a throwaway bare `EditorView` inside InkPad's actual mobile tab/drawer layout, not a blank page.

Include:

- typing inside the real Code tab
- selection/copy/paste inside the editor
- Problems/Variables drawer open while editing
- placeholder toolbar button that inserts text and tests focus/keyboard survival
- viewport resize when the iOS keyboard opens
- tab switching with the editor mounted/unmounted or hidden, depending on current layout

`basicSetup` is allowed for this spike only. It is not allowed in the final editor implementation unless deliberately justified.

Phase 0 exit: short notes describing mobile findings, observed risks, and whether any layout change is needed before the real implementation.

### Mobile tab persistence policy

InkPad opens to the lightweight Preview tab on mobile to keep first load fast. Preserve that behavior, but do not make tab switching destructive.

- On initial mobile load, do not mount CodeMirror until the user first opens the Code tab.
- After the Code tab has been opened once, keep the Code editor mounted while hidden so undo/redo history, cursor position, selection, scroll position, and editor compartments survive Code ↔ Preview tab switches.
- Keep the Preview/runtime pane mounted across tab switches so story state survives, including step-back and rewind state.
- Do not use unconditional `forceMount` for the Code tab on initial load. If using a tab library, implement "mount after first activation, then preserve" behavior manually if needed.
- Reset editor state only for explicit document/project changes.
- Reset preview runtime only for explicit compile/run/restart/rewind/project changes, not merely for switching tabs.

The cleanest behavior is:

- Existing preview/game state remains alive when switching tabs.
- If source changes after the story was run, show a subtle “Re-run to update preview?” state - which we currently have implemented! 
- Do not automatically destroy the player’s current run just because they typed.
- The **Run** button starts a fresh runtime from the latest compiled story.
- **Rewind** affects the current runtime, not the editor.

---
## Phase 1 - CodeMirror shell, single active file

Use `EditorView` directly. Do not use `@uiw/react-codemirror`.

Reason: InkPad needs direct ownership of focus, selection, snippet insertion, mobile behavior, and lifecycle. A wrapper abstracts the exact layer where most migration bugs are likely.

The editor edits exactly one file:

```ts
project.files[activeFileId].source
```

On change, update only that file in the project map. Wire the editor into the existing editor pane in place of Monaco.

Do not use `basicSetup` blindly in the final implementation. Assemble explicit extensions so behavior can be audited and adjusted.

Likely packages:

```txt
@codemirror/state
@codemirror/view
@codemirror/commands
@codemirror/search
@codemirror/lint
@codemirror/language
@lezer/highlight
@codemirror/autocomplete   # only once completion/target-picker work actually starts
+ whichever Ink language package Phase 3 selects
```

Avoid the old umbrella `codemirror` package unless `basicSetup` is intentionally wanted somewhere.

### Required editor features

Add explicitly, with compartments where runtime configuration matters:

- line numbers/gutter
- history / undo / redo
- search and replace
- default keymap
- InkPad keymap layer
- soft-wrap preference
- font-size preference
- current-line highlight, if retained
- read-only/editable mode
- lint source
- language support
- theme via CSS variables and `EditorView.theme`

### Keymap policy

Monaco gave default IDE behavior for free. CodeMirror requires explicit decisions.

- Put InkPad shortcuts on top of CodeMirror default/history/search keymaps.
- Do not override browser/OS text-editing shortcuts without a strong reason.
- Desktop shortcuts should have visible menu/toolbar equivalents where practical.
- Mobile features must never depend on hidden keyboard shortcuts.

Phase 1 exit:

- active file edits correctly
- dirty/saved state preserved
- autosave preserved
- compile-on-change preserved
- focus API works
- transaction-based insert/replace works
- no controlled-input pattern
- StrictMode does not double-attach listeners or leak views

---
## Phase 2 - Coordinates + diagnostics

Build this before language-mode work. Diagnostics, Problems jumps, symbol ranges, go-to-definition, and quick fixes all depend on it.

### Centralized line/offset helpers

CodeMirror positions are numeric offsets counted in UTF-16 code units. Lines are 1-based. Write one helper module and use it everywhere.

```ts
import type { Text } from "@codemirror/state";

export function lineNumberToOffset(
  doc: Text,
  lineNumber: number,
  columnNumber = 1,
): number {
  const safeLine = Math.min(Math.max(lineNumber, 1), doc.lines);
  const line = doc.line(safeLine);
  const safeColumn = Math.max(columnNumber, 1);
  return Math.min(line.from + safeColumn - 1, line.to);
}

export function offsetToLineColumn(doc: Text, offset: number) {
  const safeOffset = Math.min(Math.max(offset, 0), doc.length);
  const line = doc.lineAt(safeOffset);
  return {
    lineNumber: line.number,
    columnNumber: safeOffset - line.from + 1,
  };
}
```

Use this module for:

- Problems panel jumps
- compiler diagnostics
- CodeMirror lint ranges
- symbol ranges
- go-to-definition
- multi-file diagnostics
- quick fixes

Do not hand-roll conversions at call sites.

Important risk: columns from non-CodeMirror sources may not use UTF-16 code units. This can break CJK/Hangul/emoji offsets. Include fixtures for these cases.

### Shared diagnostic model

Add `fileId` now, even before multi-file UI exists.

```ts
type InkDiagnostic = {
  fileId: string;
  line: number;
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
  source: "inkjs" | "inkpad";
};
```

Render diagnostics in two places:

- Problems panel: all project diagnostics.
- CodeMirror lint: only diagnostics where `fileId === activeFileId`.

Problems-item click behavior:

1. If the diagnostic belongs to another file, switch active file first.
2. Reveal the line.
3. Place the cursor or selection using the coordinate helper.
4. Do not steal/corrupt useful editor selection unnecessarily.

Add a copy-message button on each Problems item. This should not depend on editor selection.

### Diagnostic fixture policy

Keep compiler diagnostics and InkPad-authored lint separate.

Fixture-test `source: "inkjs"` diagnostics by compiling real `.ink` fixtures under the pinned inkjs version and snapshotting normalized output for:

- unresolved divert
- empty choice
- missing return tilde / malformed function return, if inkjs emits this usefully
- loose end
- filename-bearing INCLUDE errors
- external-call/runtime behavior where applicable

Fixture-test `source: "inkpad"` diagnostics separately for:

- TODO markers, if surfaced as warnings/info
- author-warning conventions, if implemented
- missing include preflight, if InkPad checks before compile
- unsupported external runtime calls in preview

No quick fix should depend on an unfixtured diagnostic string. If inkjs rewords a message, tests should fail loudly instead of a quick fix silently breaking.

Phase 2 exit:

- shared diagnostics model exists
- active-file lint markers work
- Problems panel reads the same model
- click-to-jump works through shared helpers
- copy-message works
- diagnostic adapter tests exist

---
## Phase 3 - Language mode decision, fixture-gated

Treat this as an evaluation, not a default.

Build the fixture suite before choosing between `@mavnn/codemirror-lang-ink`, a fork/vendor of it, or a `StreamLanguage` tokenizer path.

### Fixture corpus

Do not author everything from scratch. Pull relevant cases from Inkle's `ink-tmlanguage/tests/cases/` corpus in the GitHub repo. Then add InkPad-specific fixtures.

Suggested fixture set:

```txt
client/src/editor/codemirror/__fixtures__/
  basic-knot.ink
  function-knot.ink
  stitch.ink
  nested-conditional.ink
  sequence.ink
  glue.ink
  include.ink
  include-quoted-path.ink
  include-subfolder-path.ink
  include-missing-file.ink
  divert-three-part-path.ink
  divert-function-call.ink
  divert-tunnel.ink
  divert-to-special.ink
  divert-parameterized.ink
  global-dictionary-tag.ink
  todo-author-warning.ink
  built-in-functions.ink
  cjk-hangul-identifiers.ink
  emoji-offsets.ink
  escape-sequences.ink
  external-declaration.ink
  external-runtime-unsupported.ink
  ink-roguelike.ink
  + relevant cases copied from ink-tmlanguage/tests/cases/
```

Escape fixture should include:

```txt
\[ \] \( \) \\ \~ \{ \} \/ \# \* \+ \-
```

### What to snapshot

Do not rely on visual spot-checks.

Snapshot:

- highlight tags/token spans
- fold ranges
- parse tree shape, if using a Lezer grammar
- selected range behavior for symbols where relevant
- fixture compile status where inkjs is expected to accept/reject the source

If using a Lezer language, token snapshots alone are not enough. Tree shape and fold ranges are part of the real output.

### Candidate: `@mavnn/codemirror-lang-ink`

Default first attempt: evaluate `@mavnn/codemirror-lang-ink`.

It is small and MIT-licensed, which makes a pre-1.0 dependency defensible if InkPad can vendor/fork a frozen snapshot if needed. Do not silently rely on upstream maintenance.

Keep it if the fixture suite shows:

- normal Ink highlights/parses acceptably
- weird but valid Ink highlights/parses acceptably
- folding works for knots/functions/stitches
- fold ranges roughly match Inky's behavior
- known gaps are fixable without major surgery
- styling can be shaped into InkPad's visual system through a custom `HighlightStyle`

Known gaps to test explicitly:

- three-part paths such as `knot.stitch.label`
- tunnel diverts
- parameterized divert targets
- nested function calls inside divert parameters
- CJK/Hangul identifier ranges
- TODO/author-warning styling
- built-in function distinction
- dictionary-style global tags
- INCLUDE path edge cases

If adopted and patched, choose one policy before merging:

- vendor the grammar into InkPad
- fork and pin the fork
- upstream PR plus local patch mechanism

Do not leave a silent undocumented patch strategy.

### Fallback: `StreamLanguage` tokenizer

Fall back to a CodeMirror `StreamLanguage` only if the mavnn path fails important fixtures or fights the desired visual design too hard.

If this fallback happens, Inky's `ace-ink.js` is a closer structural reference than the existing Monarch file because both Ace and `StreamLanguage` are stateful regex/tokenizer systems. But Ace is still not a compiler, and InkPad's Monarch is not verified, so the same fixtures remain mandatory.

### Built-ins policy

Do not trust any single autocomplete/highlighting list blindly.

Ace's autocomplete list is narrower than earlier assumptions and includes items like:

```txt
CONST, CHOICE_COUNT, DONE, END, INCLUDE, LIST, LIST_ALL, LIST_COUNT,
LIST_INVERT, LIST_MAX, LIST_MIN, LIST_RANGE, LIST_VALUE, LIST_RANDOM,
TODO, TURNS_SINCE, VAR
```

Before finalizing special highlighting, verify the canonical built-in functions/constants against the actual Ink language spec and/or inkjs source. Keep built-in highlighting as either:

- a grammar feature, if natural; or
- a separate decoration/highlight extension, if cleaner.

### Fold semantics

Match Inky unless there is a clear reason not to:

- knot fold runs until the next knot (`={2,}`)
- stitch fold runs until the next knot or stitch (`={1,}`)
- trailing blank lines are trimmed from the fold range so folding does not visually swallow empty space before the next declaration

### Symbol scanner policy

The language mode owns highlighting and folding only.

The InkPad tolerant symbol scanner remains the source of truth for:

- project-wide symbols
- completions
- target picker
- go-to-definition
- quick fixes
- source metadata extraction, unless specifically moved with tests

If CodeMirror tokens or syntax trees make symbol derivation simpler later, evaluate that as a separate implementation improvement, not as a migration requirement.

Phase 3 exit:

- language mode chosen
- fixture snapshots committed
- highlight style implemented
- folding implemented/validated
- INCLUDE quoting/resolution decision tested against inkjs
- built-in highlighting policy documented
- symbol scanner still independent from compile success

---
## Phase 4 - Mobile authoring

Keep three insertion concepts separate:

- **syntax button**: inserts a tiny literal, such as `->` or `~`
- **snippet item**: inserts a structure and selects the first placeholder
- **completion**: references an existing symbol

Ship a keyboard accessory bar before any command palette.

Suggested first bar:

```txt
[->] [*] [+] [~] [{ }] [Knot] [Choice] [More...]
```

Insertion rule:

```txt
focus -> dispatch change -> set selection/caret -> keep keyboard open if browser allows
```

### Single-shot pointer rule

Guard against the mobile bug class users hate most:

- a single tap must not insert twice
- `pointerdown`, `click`, and keyboard activation must not all trigger the same insertion
- scrolling inside a snippet drawer must never trigger insertion
- use a movement threshold so a scroll gesture is not misread as a tap
- do not let drawer close animations re-trigger insertion

### Snippet behavior

For snippets:

- insert the structure transactionally
- select the first placeholder
- keep the keyboard open when possible
- make escape/cancel behavior obvious
- do not require a hardware keyboard

Phase 4 exit:

- accessory bar inserts literals reliably
- snippets select first placeholder
- no double insertion on fast taps
- drawer scrolling does not insert
- keyboard/focus behavior is acceptable on iPhone

---
## Phase 5 - Multi-file-ready project model, prep only

Do not build the full multi-file UI during this migration. Do build the data boundaries that would be painful to retrofit later.

### Path hygiene

Treat paths as a security and data-integrity boundary, even in a client-only app.

Rules:

- Store project files by normalized POSIX-style relative path.
- Normalize backslashes to `/`.
- Reject absolute paths:
  - `/Users/...`
  - `/home/...`
  - `C:\...`
  - `file://...`
- Reject paths containing `..`.
- Decide case sensitivity explicitly and document it.
- Reject or rename-with-warning duplicate normalized paths.
- Keep `entryFile` explicit.
- Resolve `INCLUDE` only against `project.files`.
- Never fetch remote includes.
- Never resolve against the browser URL.

Valid examples:

```txt
main.ink
characters.ink
chapters/opening.ink
```

Rejected examples:

```txt
../secret.ink
/Users/marina/file.ink
C:\whatever\file.ink
https://example.com/story.ink
```

### Entry file policy

For `.inkpad` packages, use the manifest's explicit `entryFile`.

For plain ZIP without a manifest:

1. single `.ink` file -> use that file
2. else `main.ink`
3. else `story.ink`
4. else ask the user when the UI exists

Do not infer silently in ambiguous cases.

### Data flow

```txt
User edits active file in CodeMirror
  -> update project.files[activeFileId].source
  -> debounced project-wide symbol scan
  -> debounced inkjs compile worker receives { entryFile, files }
  -> compiler returns success/failure, diagnostics, story JSON
  -> InkPad updates:
       Problems panel: all files
       CodeMirror lint markers: active file only
       preview: stale/success/error state
       export availability
```

INCLUDE stays outside CodeMirror. CodeMirror does not resolve files, import files, fetch files, or know the project entry point.

### Export labels to settle before multi-file UI

Do not build concatenated export as a hidden default. Prefer explicit labels:

- Export current file as `.ink`
- Export full project as `.inkpad`
- Export compiled story JSON
- Export playable HTML
- Export web folder ZIP

Phase 5 exit:

- normalized path helpers exist
- invalid path tests exist
- project model can represent `entryFile`
- diagnostics already carry `fileId`
- no full multi-file UI added

---
## Phase 6 - Remove Monaco

Only remove Monaco once the CodeMirror branch can:

- edit
- save/autosave
- compile
- preview
- show Problems
- jump from Problems to source
- export raw `.ink`
- gracefully block compiled exports on errors
- pass desktop/mobile/iPad/accessibility acceptance tests

Remove:

- `monaco-editor`
- Monaco setup files
- Monaco themes
- Monarch language registration
- Monaco completion provider
- Monaco marker adapter
- Monaco-specific CSS hacks
- Monaco-specific tests that no longer apply

Then update:

- README / architecture notes
- acknowledgments
- THIRD_PARTY_NOTICES
- bundle analysis notes
- any docs/screenshots that mention Monaco-specific behavior

Rollback strategy: keep the currently deployed Monaco build untouched until the CodeMirror branch passes the full definition of done. No production dual-editor mode is needed.

---
## Definition of done

The migration is not done when the app compiles. It is done when authoring feels stable and calmer than Monaco.

### Desktop

- edit sample story
- state goes `Saved -> Modified -> Saved`
- compile error appears
- Problems item jumps to correct line
- copy-error works
- raw `.ink` export works even with compile errors
- JSON/playable export fails gracefully with compile errors
- playable HTML export works after fixing errors
- find/replace works
- replace all works
- select next occurrence works, if supported in the chosen setup
- select all occurrences works, if supported in the chosen setup
- undo/redo works
- theme settings work
- font settings work
- line wrapping works

### Mobile: iPhone

- tap opens keyboard
- tap places cursor
- long-press selects
- selection handles adjust
- copy selected editor text
- paste into editor
- scroll editor with keyboard open
- insert `->` from accessory bar without losing cursor
- fast tap does not double-insert
- snippet insertion selects first placeholder
- Problems jump does not trap focus permanently
- bottom drawer does not crush or trap the editor
- tab switching does not strand the keyboard/focus state

### iPad

- hardware keyboard shortcuts behave
- touch selection works
- split/tab layout remains usable
- accessory/snippet UI does not cover the active line catastrophically
- external keyboard + touch mixed workflow is acceptable

### Accessibility

Accessibility is part of done, not deferred polish.

- keyboard-only editing works end to end
- visible focus states are present
- editor has a sensible accessible label/description
- screen reader announces the editor sensibly
- diagnostics are reachable and understandable
- Problems panel is navigable without a mouse
- toolbar/accessory buttons are reachable and labeled
- there is an escape route out of editor focus
- high-contrast dark mode still works
- high-contrast light mode plan is not blocked by editor styling
- quick VoiceOver sanity pass on mobile

### Testing/build

- unit tests pass
- typecheck passes
- build passes
- fixture snapshots pass
- lint/diagnostic adapter tests pass
- mobile smoke test notes recorded
- bundle analysis rerun
- no Monaco dependency remains in production bundle

---
## Open decisions

Settle these as implementation reveals the real constraints:

- ~~**mavnn local patches vs fork vs vendored grammar**: decide after fixtures run.~~ Resolved 2026-07-02 (Checkpoint 7): vendored and patched. See `client/src/editor/codemirror/ink-lang/README.md` for the patch list and reasoning, and `docs/editor-migration-updates.md` for the fixture evidence behind the decision.
- **Built-in function highlighting mechanism**: grammar node vs separate decoration extension.
- **Canonical built-in set**: verify against Ink spec/inkjs, not Ace autocomplete or InkPad Monarch guesses.
- **INCLUDE quote handling**: verify against inkjs.
- **INCLUDE resolution base**: project-root path map by default; fixture-test whatever adapter behavior inkjs needs.
- **Case sensitivity for project paths**: choose and document before ZIP/`.inkpad` import ships.
- **Duplicate normalized paths**: reject vs rename-with-warning.
- **Undo history across file switches**: reset for v1 unless per-file `EditorState` is deliberately implemented.
- **Go-to-definition timing**: not required for Monaco removal, required before claiming Inky editor parity.
- **Search scope**: active-file-only for migration; project search later.
- **External runtime behavior**: syntax/compiler support now; safe/stubbed runtime policy later if needed.
- **`vocabWords` and custom instruction prefix**: cut for now; revisit only if a concrete feature needs them.
- **Symbols from tokens/tree vs separate scanner**: optional future simplification, not required.

---
## Codex handoff brief

> Migrate InkPad's editor from Monaco to CodeMirror 6 on `feature/codemirror-editor`.
>
> **Goals:** Replace Monaco completely. Preserve local-first saving, compile/preview, Problems panel, settings, and export flows. Improve mobile editing: iOS selection, keyboard focus, accessory insertion, and snippet insertion. Keep Ink language intelligence editor-independent. Match Inky as the official feature baseline over time, but do not let the migration balloon into unrelated editor features.
>
> **Most important constraint:** do not build CodeMirror as a controlled React input. Use one long-lived `EditorView`, transactions/update listeners for outward changes, compartments for runtime preferences, explicit document replacement for file switch/import/recovery/reset only, and clean disposal on unmount including StrictMode double-mount behavior.
>
> **Editor API:** expose `focus`, `getValue`, `replaceDocument(value, { history, selection })`, `insertText`, `replaceSelection`, `getSelection`, `setSelection`, `revealLine`, and `jumpToOffset`. Do not expose raw CodeMirror internals to arbitrary call sites.
>
> **Known simplifications:** single active file in the editor; no full multi-file UI; no command palette; no graph view; no hover docs; no full autocomplete polish; no custom snippet manager; active-file search only; old pre-CodeMirror local saves are discarded through a storage-key/schema bump. Go-to-definition is future-protected but not required for the Monaco-removal merge; it is required before claiming Inky editor parity.
>
> **Architecture boundaries:** CodeMirror owns the editing surface, highlighting, folding, selection, viewport, and active-file lint markers. InkPad's tolerant scanner owns project intelligence. inkjs owns validity and compiled output. React/project UI owns Problems, snippets, target picker, preview/export state, and project paths. Do not refactor the compiler worker except for minimal adapter changes needed for diagnostics/multi-file data.
>
> **Phase 0:** Test try.yarnspinner.dev and borogove.app on a real iPhone. Record selection, copy/paste, keyboard, scroll, and quick-insert behavior. Then build a throwaway `EditorView` using `basicSetup` inside InkPad's real mobile tab/drawer layout. Verify typing, selection, copy/paste, drawer behavior, toolbar insertion, and keyboard viewport resize. Report findings before proceeding.
>
> **Phase 1:** Add exact-pinned CodeMirror dependencies. Build `InkCodeMirrorEditor.tsx` directly on `EditorView`, not `@uiw/react-codemirror`. Do not use `basicSetup` in the real editor. Assemble explicit extensions: line numbers, history, search, default keymap, InkPad keymap, wrapping, font size, current-line highlight if retained, read-only/editable, lint, language, and theme via CSS variables. Preserve dirty/saved state, autosave, and compile-on-change.
>
> **Phase 2:** Build shared line/offset helpers for CodeMirror UTF-16 offsets. Build `InkDiagnostic[]` with `fileId` and `source: "inkjs" | "inkpad"`. Render all diagnostics in Problems and active-file diagnostics through `@codemirror/lint`. Problems click should switch files if needed, reveal the line, and place cursor/selection through shared helpers. Add copy-message buttons. Snapshot-test inkjs diagnostics separately from InkPad-authored lint.
>
> **Phase 3:** Treat Inky as the official feature baseline. Build fixtures before choosing a language mode. Pull relevant fixtures from `ink-tmlanguage/tests/cases/` in the GitHub repo, then add InkPad cases for three-part paths, tunnel diverts, parameterized diverts with nested function calls, DONE/END, dictionary tags, CJK/Hangul/emoji offsets, TODO/author warnings, built-ins, INCLUDE paths, escapes, and EXTERNAL behavior. Evaluate `@mavnn/codemirror-lang-ink` first using snapshots of highlight tags, fold ranges, and parse tree shape where applicable. If patched, vendor/fork/document the patch strategy. Fall back to a `StreamLanguage` port only if mavnn fails important fixtures. Build an InkPad `HighlightStyle` either way. Verify INCLUDE quote handling and canonical built-ins against inkjs/spec, not guesses.
>
> **Phase 4:** Ship mobile accessory insertion: `->`, `*`, `+`, `~`, `{ }`, Knot, Choice, More. Insertion must preserve focus/keyboard where possible, use transactions, select first snippet placeholder, guard against double insertion, and distinguish tap from scroll.
>
> **Phase 5:** Add multi-file-ready groundwork only. Normalize POSIX-relative paths, reject absolute paths and `..`, document case sensitivity, handle duplicate normalized paths, keep explicit `entryFile`, and resolve INCLUDE only against `project.files`. Do not build full multi-file UI.
>
> **Phase 6:** Remove Monaco dependencies, setup/theme files, Monarch registration, marker/completion adapters, and CSS hacks. Update README, acknowledgments, THIRD_PARTY_NOTICES, screenshots/docs, and bundle analysis. Run tests, typecheck, build, fixture snapshots, desktop/mobile/iPad/accessibility acceptance checks. Keep the current deployed Monaco build untouched until all checks pass.
>
> Test mobile at every checkpoint. The migration succeeds when InkPad feels more stable and calmer to write in than the Monaco build, not merely when the app compiles.
