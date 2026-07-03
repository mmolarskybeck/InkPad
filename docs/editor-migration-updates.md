# Editor Migration Updates

Running log for the Monaco to CodeMirror 6 migration on `codex/monaco-to-codemirror`.

## 2026-07-03 - Checkpoint 16: Closest-match unresolved-divert quick fix

### Implemented

- Added exact-pinned `fastest-levenshtein@1.0.16`.
- Added `client/src/inkLanguage/fuzzyMatch.ts` for conservative divert-target
  matching:
  - same first character
  - length delta no greater than 2
  - edit distance no greater than 2
  - ties suppressed
  - function knots excluded through `isDivertTarget`
- Threaded project symbols into the CodeMirror diagnostic conversion.
- Added a CodeMirror lint action for unresolved diverts with one confident
  candidate: **Change to target**.
- The action replaces only the unresolved target text on the diagnostic line,
  preserving the rest of the divert line.

### Verified

- Focused tests cover the pure matcher, tied-candidate suppression, function
  exclusion, and the CodeMirror action dispatch.

## 2026-07-03 - Checkpoint 15: Unresolved-divert diagnostic adapter and create-knot action

### Implemented

- Added `client/src/inkLanguage/diagnosticAdapter.ts` to recognize pinned
  inkjs unresolved-divert messages and enrich compiler diagnostics with:
  - `code: "unresolved-divert"`
  - `targetName`
- Routed compiler diagnostics through the adapter before rendering Problems and
  CodeMirror lint diagnostics.
- Extended `client/src/inkLanguage/quickFixes.ts` with a pure create-missing-knot
  edit.
- Attached a CodeMirror lint action for bare unresolved divert targets:
  **Create knot target** appends `=== target ===` to the active file.
- Suppressed the create-knot action for dotted targets such as
  `chapter.missing`, where a bare knot declaration would be invalid.
- Added fixture-backed adapter coverage using the existing
  `missing-divert-target.ink` compiler fixture, plus CodeMirror action tests.

### Notes

- The flagship closest-match action is still pending. It should be added after
  installing the exact-pinned fuzzy-match dependency described in
  `docs/structural-assistance-spec.md`.

## 2026-07-03 - Checkpoint 14: First CodeMirror lint quick fix

### Implemented

- Added `client/src/inkLanguage/quickFixes.ts` for editor-agnostic text edits.
- Attached the missing-starting-divert diagnostic's first CodeMirror
  `Diagnostic.actions` quick fix: **Start at target**.
- The action inserts `-> target` at the top of the active file through a
  CodeMirror transaction with isolated history, then leaves the caret after the
  inserted starting divert.
- Added unit coverage for the pure edit and for applying the lint action in an
  `EditorView`.

### Notes

- This proves the CodeMirror lint-action pipeline for InkPad-authored
  diagnostics. Unresolved-divert quick fixes still need the fixture-backed
  inkjs diagnostic adapter and fuzzy matching described in
  `docs/structural-assistance-spec.md`.

## 2026-07-01 - Checkpoint 1: CodeMirror shell wired

### Implemented

- Added exact-pinned CodeMirror packages:
  - `@codemirror/commands@6.10.4`
  - `@codemirror/language@6.12.4`
  - `@codemirror/lint@6.9.7`
  - `@codemirror/search@6.7.1`
  - `@codemirror/state@6.7.0`
  - `@codemirror/view@6.43.4`
  - `@lezer/highlight@1.2.3`
- Added `client/src/components/editor/codemirror-editor.tsx`.
- Added `client/src/editor/codemirror/coordinates.ts`.
- Swapped the active editor lazy import from Monaco to CodeMirror in `client/src/pages/editor.tsx`.
- Updated editor-dependent types in:
  - `client/src/components/editor/editor-workspace.tsx`
  - `client/src/hooks/use-editor-source-buffer.ts`
- Added CodeMirror container/input CSS adjustments in `client/src/index.css`.

### Current Editor Behavior

- Uses a direct, long-lived `EditorView`.
- Does not use a React CodeMirror wrapper.
- Does not use a controlled-input pattern.
- Uses CodeMirror transactions for typing, insertion, cut, paste, undo, redo, selection, and full-document replacement.
- Uses compartments for theme, font size, wrapping, editable state, and content accessibility attributes.
- Keeps the existing InkPad editor handle shape for the surrounding app, while adding the explicit migration-plan API:
  - `replaceDocument`
  - `insertText`
  - `replaceSelection`
  - `getSelection`
  - `setSelection`
  - `revealLine`
  - `jumpToOffset`
- Wires active-file diagnostics into CodeMirror lint markers.
- Preserves Problems jump-to-line behavior through the shared coordinate helper.
- Provides line numbers, fold gutter, history, search, selection match highlighting, active line highlighting, and accessible editor labeling.

### Verified

- `npm run check` passes.
- `npm run build` passes.
- `npm test` passes: 23 test files, 189 tests.
- Browser smoke on `http://127.0.0.1:5184/`:
  - InkPad loads.
  - CodeMirror DOM is present.
  - Monaco DOM is absent from the active editor.
  - Typing in the editor changes save state.
  - Run shortcut compiles into preview.

### Known Notes

- `npm test` still prints a Monaco source-map warning because old Monaco language tests remain in the repo.
- Monaco files, dependencies, CSS hacks, docs, and tests are intentionally not removed yet. That belongs to the later remove-Monaco checkpoint after language mode parity is safer.
- The active editor does not yet have Ink syntax highlighting/folding parity. That is the next major migration checkpoint.
- Mobile behavior still needs real-device testing per the migration plan.

## 2026-07-02 - Checkpoint 2: Ink language candidate evaluated

### Implemented

- Added exact-pinned `@mavnn/codemirror-lang-ink@0.9.27`.
- Added the first CodeMirror Ink fixture corpus in
  `client/src/editor/codemirror/__fixtures__/`.
- Added `client/src/editor/codemirror/ink-language-evaluation.test.ts`.

### Docs Consulted

- CodeMirror language-package docs:
  <https://codemirror.net/examples/lang-package/>
- CodeMirror reference for `LanguageSupport`, `ensureSyntaxTree`,
  `syntaxTree`, `foldable`, `HighlightStyle`, and `syntaxHighlighting`:
  <https://codemirror.net/docs/ref/>
- `@mavnn/codemirror-lang-ink` README and package metadata:
  <https://github.com/mavnn/codemirror-lang-ink>
- Inkle's official writing guide for fixture shape:
  <https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md>

### Evaluation Result

`@mavnn/codemirror-lang-ink` is useful but not ready to wire into the editor
as-is.

It produces helpful highlight tags for cleanly parsed basics:

- knot headings and names
- ordinary content
- choices and bracketed choice text
- inline tags
- diverts to `END`
- comments and block comments
- list declarations
- conditionals
- glue
- include statements in some forms

The fixture test currently records Lezer error nodes for important InkPad
cases:

- CJK/Hangul identifiers and non-ASCII knot names
- function return/function-call paths
- several parameterized divert forms
- tunnel diverts
- sequence variants
- some stitch/fold boundaries
- built-in function expressions
- EXTERNAL declarations and calls
- TODO/FIXME author warnings are parsed as plain content, not author-warning
  tokens

Checkpoint 5 tightened this evidence by compiling every fixture with the repo's
pinned inkjs before treating CodeMirror parser errors as candidate gaps. Most
fixtures are now expected to compile successfully under inkjs; the quoted
INCLUDE fixture is explicitly recorded as invalid because pinned inkjs rejects
quoted relative include paths.

### Decision

Do not wire `@mavnn/codemirror-lang-ink` into the active editor yet. The next
step is to either patch/vendor this Lezer grammar against the fixture corpus or
start the fallback `StreamLanguage` path using the same fixtures.

## 2026-07-02 - Checkpoint 3: Editor lifecycle review fixes

### Implemented

- Fixed pending-edit loss on editor unmount by flushing debounced CodeMirror
  changes before destroying the `EditorView`.
- Changed the phone Code tab to mount lazily after first activation and then
  stay mounted while hidden. This preserves undo history, selection, cursor,
  scroll position, and editor compartments across Code ↔ Preview switches.
- Added explicit document identity for startup, import, open, save-as/rename,
  and new-document flows. CodeMirror now resets document state from
  `documentId`, not from filename/focus heuristics alone.
- Changed settings-panel metadata tag writes to apply a targeted single-range
  CodeMirror transaction instead of whole-document replacement, with a source
  state fallback when the editor has not mounted yet.
- Suppressed duplicate `onControlStateChange` emissions so cursor/selection
  movement does not force unnecessary `EditorPage` state updates.
- Reapplied CodeMirror lint diagnostics immediately after `replaceDocument`
  resets the editor state.
- Added `userEvent` annotations to programmatic replace, insert, paste, and cut
  transactions.

### Review Follow-Ups Not Yet Done

- Decide whether to remove or hide raw `getEditor()` access from the public
  editor handle during the Monaco-removal checkpoint.
- Validate pointerdown-based mobile insertion and clipboard paste behavior on a
  real iPhone/iPad before signing off on Phase 4.

## 2026-07-02 - Checkpoint 4: Diagnostic adapter hardening

### Implemented

- Moved CodeMirror lint diagnostic conversion out of
  `client/src/components/editor/codemirror-editor.tsx` and into
  `client/src/editor/codemirror/diagnostics.ts`.
- Added active-file filtering for CodeMirror lint markers via explicit
  `fileId`, while leaving the Problems panel able to render the full diagnostic
  list.
- Added `fileId` to InkPad-authored diagnostics and to the editor-facing
  compiler diagnostic union. Compiler messages now preserve a parsed file id
  when inkjs includes one in the message text.
- Kept current single-file compiler messages visible by normalizing the
  compiler helper's internal `story.ink` id to the active document filename at
  the editor page boundary.
- Added `client/src/editor/codemirror/diagnostics.test.ts` to cover active-file
  filtering, UTF-16 line/column conversion with CJK/emoji text, and hint
  severity preservation.
- Added icon-only copy buttons to Problems rows so diagnostic messages can be
  copied without depending on editor selection.

### Verified

- `npm run check` passes.
- `npm test` passes: 25 test files, 195 tests.
- `npm run build` passes.
- `npm test` still prints the known Monaco `marked.umd.js.map` sourcemap
  warning.

### Remaining Follow-Ups

- Add compiler-diagnostic fixture snapshots from real `.ink` programs for the
  Phase 2 diagnostic fixture policy.
- When multi-file editing lands, make Problems clicks switch to the diagnostic's
  `fileId` before revealing the range.
- Continue to keep CodeMirror lint scoped to the active file only.

## 2026-07-02 - Checkpoint 5: Language evaluation evidence cleanup

### Implemented

- Fixed invalid language-evaluation fixtures so grammar gaps are not inflated
  by Ink source that inkjs also rejects:
  - `built-in-functions.ink` now uses legal top-level `VAR`/`LIST`
    declarations and runtime built-in calls inside `start`.
  - `function-knot.ink` no longer collides a `ref` parameter name with the
    global `VAR total`.
  - `divert-three-part-path.ink` now defines a real three-part target through a
    labelled gather.
  - `divert-function-call.ink` now keeps the choice tag on the choice text and
    places the parameterized divert in the choice body.
- Added an inkjs compile-status gate to
  `client/src/editor/codemirror/ink-language-evaluation.test.ts`.
- Replaced boolean-only parser error reporting with error-node counts and
  parser-context snippets, so partial grammar improvements and regressions are
  visible in test diffs.
- Kept the "do not wire `@mavnn/codemirror-lang-ink` into the active editor
  yet" decision. Valid fixtures such as CJK/Hangul identifiers, parameterized
  diverts, tunnel returns, sequences, EXTERNAL calls, and function/ref forms
  still produce Lezer error nodes.
- Fixed document-switch lint behavior so `replaceDocument(..., { history:
  "reset" })` clears old diagnostics on true document switches while still
  reapplying diagnostics for same-document resets.
- Made `InkDocument.id` required and removed the editor call-site fallback to
  filename identity.

### Verified

- `npm run check` passes.
- `npm test` passes: 25 test files, 195 tests.
- `npm run build` passes.
- `npm test` still prints the known Monaco `marked.umd.js.map` sourcemap
  warning.

### Notes

- Phone-to-desktop layout flips can still remount the editor because the editor
  pane moves between different layout trees around the mobile breakpoint. This
  can reset undo history on rotation/resizing and remains a Phase 4 mobile
  validation item.
- Storage key/schema bumping for discarding pre-CodeMirror local saves was
  completed later in Checkpoint 11.

## 2026-07-02 - Checkpoint 6: Compiler diagnostic fixture snapshots

### Implemented

- Added fixture-backed snapshots for raw inkjs compiler diagnostics in
  `client/src/workers/compile-ink-project.test.ts`.
- Added compiler diagnostic fixtures under
  `client/src/workers/__fixtures__/inkjs-diagnostics/` for:
  - missing divert targets in the entry file
  - TODO author messages on successful compilation
  - missing INCLUDE files
  - errors emitted from an included file
- Normalized worker-side inkjs messages so `InkCompilerMessage` now carries
  parsed `fileId` and `line` when inkjs includes them in the message text.
- Kept compiler messages clean at the worker boundary by stripping redundant
  `ERROR:`/`WARNING:` file-line prefixes while preserving the user-facing
  `TODO:` label for author notes.

### Findings

- Pinned inkjs emits `TODO:` as an author/info diagnostic. The fixture includes
  `FIXME:` intentionally, but this pinned version treats it as ordinary story
  content rather than an author diagnostic.
- Missing INCLUDE files still arrive from inkjs without file/line metadata:
  `Cannot locate chapters/missing.ink. Are you trying a relative import ? This
  is not yet implemented.`
- Included-file compiler errors preserve the included path, e.g.
  `chapters/broken.ink`, which keeps future multi-file Problems routing
  testable.

### Verified

- `npm run check` passes.
- `npm test -- compile-ink-project.test.ts ink-language-evaluation.test.ts diagnostics.test.ts` passes.
- `npm test` passes: 25 test files, 196 tests.
- `npm run build` passes.
- `npm test` still prints the known Monaco `marked.umd.js.map` sourcemap
  warning.

## 2026-07-02 - Checkpoint 7: Language mode decided, vendored, and wired in

### Root-cause investigation, not just fixture patching

Before deciding keep-vs-fork-vs-fallback, cloned `mavnn/codemirror-lang-ink`
at the `v0.9.27` tag (the exact pinned version) to test against the real
grammar source, not just the published bundle. Findings:

- **Upstream's own test suite cannot catch parser errors.** `test/ink.test.ts`
  uses `@lezer/generator`'s `testTree(tree, expected, mayIgnore)` with the
  default `mayIgnore = (type) => /\W/.test(type.name)`. The anonymous error
  node's type name is the single non-word character `⚠`, so `mayIgnore`
  silently skips it on every comparison. Upstream's fixtures showing a
  "clean" parse (27/27 passing) says nothing about whether error nodes are
  present -- confirmed by running their own `knot.ink` fixture through a raw
  `parser.parse()` call outside their test harness and finding 5 real error
  nodes in a file their own `.expect` file shows as fully clean.
- **A systemic, universal parser bug**: every `Knot`/`Function`/`Stitch` in
  every file produces at least one spurious zero-width error node, either
  right before the next knot/stitch header or at end-of-file. Minimal repro:
  `=== a ===\n` alone. Root cause and practical-impact assessment are
  written up in `client/src/editor/codemirror/ink-lang/README.md` (short
  version: the top-level grammar's `lineSep<context>` requires a trailing
  `endOfLine+` after every item including knots, but a knot's own body
  already greedily consumes all available trailing newlines internally, so
  there's nothing left for the outer wrapper -- not fixable by document
  formatting, verified). Zero-width, so it doesn't corrupt highlighting or
  fold ranges, and per the migration plan inkjs (not CodeMirror's tree)
  already owns user-facing validity -- but it does mean a naive "does this
  file have error nodes" check is meaningless for this grammar without
  filtering zero-width nodes.
- **Real, fixable gaps** confirmed with exact reproductions (not guesses):
  CJK/Hangul/Hiragana/Katakana identifiers entirely missing from
  `identifierStartChar`; parameterized divert targets and function-call
  diverts (`-> knot(args)`) entirely unsupported by the `Path`/`DivertTarget`
  rule (a required "Match" case per the migration plan); `AuthorWarning`
  mapped to the exact same highlight tag as `LineComment`.
- **Real, un-fixed-this-session gaps**: a leading `SequenceTypeMarker`
  (`{~a|b|c}`) and compound `blockSequenceKeyword` forms (`{shuffle once:
  ...}`) both produce a real (non-zero-width) 1-character content swallow.
  `AuthorWarning`/`todo` recognition turned out to be context-sensitive, not
  simply unsupported -- the same `TODO: ...` text parses as `AuthorWarning`
  when immediately followed by a comment, but as plain `ContentLine` when
  followed by another content line (as in InkPad's own
  `todo-author-warning.ink` fixture). All documented in
  `client/src/editor/codemirror/ink-lang/README.md`.

### Decision: vendor a patched fork, not the npm package, not a `StreamLanguage` fallback

Reasoning: the grammar's overall structure (proper Lezer tree, not a
regex/state tokenizer) is sound and covers the large majority of Ink syntax
well once patched; throwing it away for `StreamLanguage` would be a real
downgrade (no real fold precision, no bracket matching from tree structure,
worse incremental reparse) to work around gaps that turned out to be
narrower and more fixable than Checkpoint 2's evaluation assumed. The
remaining known gaps (compound sequence keywords, AuthorWarning
context-sensitivity, the systemic zero-width knot-boundary node) are real
but scoped and don't block wiring the language in for highlighting/folding,
which is the only thing CodeMirror's parse tree is responsible for in
InkPad's architecture.

### Implemented

- Vendored `@mavnn/codemirror-lang-ink` `0.9.27` into
  `client/src/editor/codemirror/ink-lang/` (grammar source, `context.ts`,
  `tokens.ts`, `index.ts`, and the generated parser tables -- see that
  directory's README for exactly what's checked in and why, and how to
  regenerate after a further grammar edit). Removed the
  `@mavnn/codemirror-lang-ink` npm dependency; added `@lezer/common` and
  `@lezer/lr` as exact-pinned direct dependencies (previously transitive)
  and `@lezer/generator` as a pinned devDependency for future regeneration.
- Patched three things in the vendored grammar (all verified against
  upstream's own 27-test suite, still 27/27 after each patch, plus
  InkPad's fixture corpus):
  1. `identifierStartChar` now includes Hangul Jamo, Hiragana/Katakana, CJK
     Unified Ideographs (+ Extension A), and Hangul Syllables.
  2. `AuthorWarning` now tags as `t.special(t.comment)` instead of
     `t.comment`, so a `HighlightStyle` can style it distinctly from an
     ordinary comment (recognition itself remains unreliable, see above).
  3. Added `DivertCallArguments` to the `Path` rule so
     `-> knot.stitch(args)` and `-> functionKnot(args)` parse without error
     nodes.
- Added `client/src/editor/codemirror/ink-highlight-style.ts`: an InkPad
  `HighlightStyle` mapping the grammar's highlight tags onto InkPad's
  existing theme CSS variables (`--syntax-keyword`, `--syntax-string`,
  `--syntax-number`, `--secondary-blue`, `--warning`, `--error`,
  `--success`, `--text-primary`, `--text-secondary`) rather than hardcoded
  colors, so light/dark/high-contrast themes all work without extra work.
  Visual intent (knots bold and prominent, diverts distinct and warm-colored,
  TODO louder than a comment, tags distinct) follows
  `client/src/utils/ink-monarch.ts`'s Monaco theme, per the migration plan's
  guidance to treat the Monarch file as a record of visual intent.
- Wired `InkLanguageSupport()` (behind a new `Compartment`, matching the
  plan's compartment rule for language support) and
  `syntaxHighlighting(inkHighlightStyle)` into
  `codemirror-editor.tsx`'s `buildExtensions()`.
- Expanded the fixture corpus from 19 to 37 files: added 18 fixtures pulled
  from `inkle/ink-tmlanguage`'s `tests/cases/` corpus (MIT), covering
  tunnels, self-diverts, parameterized divert targets, conditional/default
  choices, glue, knot/stitch/function declarations, tags, TODO, variable
  declarations, external bindings, arithmetic, and string literals. Fixed 4
  InkPad-authored fixtures that were themselves invalid Ink (contaminating
  earlier grammar-gap evidence): `built-in-functions.ink`,
  `function-knot.ink`, `divert-three-part-path.ink`,
  `divert-function-call.ink`.
- Rewrote `ink-language-evaluation.test.ts`: real committed snapshots
  (`__snapshots__/tree/*.tree.txt`, `__snapshots__/highlights/*.txt`, one
  per fixture) replace the old boolean-only `hasErrorNodes` check, per the
  migration plan's requirement that token snapshots alone aren't enough for
  a Lezer-based language. Kept the inkjs compile-status gate from
  Checkpoint 5 and extended it to all 37 fixtures (`ink-tmlanguage`'s corpus
  is a TextMate scope-testing corpus, not a runnable-story corpus, so
  several of those fixtures are correctly recorded as `"invalid"`).

### Verified

- `npm run check` passes.
- `npm test` passes: 25 test files, 202 tests.
- `npm run build` passes (`codemirror-editor` chunk grew from ~14kB to
  ~44kB gzipped, now that it includes the vendored parser).
- Browser smoke test on the running dev server: knot headers, `VAR`
  keywords, diverts, strings, and numbers all render with the intended
  distinct colors (confirmed via computed-style inspection, not just
  screenshot pixels) in both the desktop and mobile layouts. Fold
  gutter/triangle correctly collapses a knot to its `═══ name ═══ …`
  placeholder and back. No console or server errors on either viewport.
- Did not do a real-device iPhone/iPad pass this checkpoint -- that's still
  Phase 0/4 work, tracked below.

### Remaining Follow-Ups

- `sequence.ink`-class gap (compound sequence keywords, leading
  `SequenceTypeMarker`) and `AuthorWarning` context-sensitivity are real,
  scoped, unpatched gaps -- see
  `client/src/editor/codemirror/ink-lang/README.md` for exact repro steps
  before attempting either.
- The systemic zero-width knot-boundary error node means any future code
  that walks the CodeMirror tree for its own diagnostics (rather than
  trusting inkjs, which is already the architecture) must explicitly ignore
  zero-width error nodes.
- `client/src/editor/codemirror/ink-highlight-style.ts` doesn't yet
  differentiate `KnotName`/`StitchName`/`Path` from a generic variable
  `Name` -- they share the same `t.name` tag in the grammar's `styleTags`
  map. Splitting that out would need a further grammar patch, not just a
  `HighlightStyle` change.

## 2026-07-02 - Checkpoint 8: Built-in highlighting policy settled

### Implemented

- Added `client/src/editor/codemirror/ink-builtins.ts` as a separate
  CodeMirror decoration extension for Ink built-in function names.
- Verified the highlighted built-in set against pinned inkjs instead of the
  old Monaco/Ace guesses:
  - native runtime names from `node_modules/inkjs/engine/NativeFunctionCall.js`
  - compiler-recognized special calls from
    `node_modules/inkjs/compiler/Parser/ParsedHierarchy/FunctionCall.js`
- Wired `inkBuiltinFunctions` into the CodeMirror extension stack beside the
  language support and identifier-occurrence extension.
- Styled built-ins with `cm-inkBuiltin` through the CodeMirror theme extension,
  using `--secondary-blue` so light/dark/high-contrast themes inherit the app's
  existing syntax palette.
- Added `client/src/editor/codemirror/ink-builtins.test.ts` to assert the
  canonical set and to confirm prose mentions such as `RANDOM` or
  `TURNS_SINCE` are not decorated unless parsed as `ExpressionFunctionCall`.
- Documented the policy in `docs/Editor Migration Plan.md`: this is an editor
  decoration, not a vendored grammar keyword patch.

### Verified

- `npm test -- ink-builtins.test.ts ink-language-evaluation.test.ts` passes.
- `npm run check` passes.
- `npm test` passes: 27 test files, 211 tests. It still prints the known
  Monaco `marked.umd.js.map` sourcemap warning.
- `npm run build` passes.
- Browser smoke on `http://127.0.0.1:5173/`: a real `RANDOM(1, 6)` call
  renders with `cm-inkBuiltin` and the expected theme color/font weight, while
  a prose mention of `RANDOM` remains unmarked.

## 2026-07-02 - Checkpoint 9: Fold semantics validated

### Implemented

- Replaced the inline `Knot`/`Function`/`Stitch` fold callbacks in
  `client/src/editor/codemirror/ink-lang/index.ts` with a shared
  `foldSection` helper.
- The helper keeps the existing Lezer node-boundary strategy but trims trailing
  blank lines from the fold range, so spacer lines before the next knot/stitch
  remain visible after folding.
- Empty section headers now return no fold range.
- Added `client/src/editor/codemirror/ink-folding.test.ts` to validate:
  - knot folds run until the next knot, including nested stitch content
  - stitch folds run until the next stitch/knot
  - function folds run through the function body
  - spacer blank lines are trimmed from all section fold ranges
  - empty headers are not foldable
- Documented the fold status in `docs/Editor Migration Plan.md`.

### Verified

- `npm test -- ink-folding.test.ts ink-language-evaluation.test.ts` passes.
- `npm run check` passes.
- `npm test` passes: 28 test files, 213 tests. It still prints the known
  Monaco `marked.umd.js.map` sourcemap warning.
- `npm run build` passes.

## 2026-07-02 - Checkpoint 10: INCLUDE policy settled for single-file editor

### Product Decision

- `INCLUDE` is valid Ink syntax in InkPad now.
- The current single-file editor does not require included files to exist yet.
- Unresolved include directives are ignored for single-file preview/export and
  surfaced as non-blocking info diagnostics.
- When the compiler receives a real virtual file map containing the include
  target, inkjs resolution still runs. This preserves the path to future
  multi-file support.
- InkPad's documented path convention is bare normalized project-relative
  paths, e.g. `INCLUDE chapters/start.ink`. Pinned inkjs rejects quoted
  relative paths under strict compilation, so the quoted-path fixture remains a
  defensive invalid fixture.

### Implemented

- Added `unresolvedIncludePolicy?: "strict" | "ignore"` to the worker compile
  contract.
- `createSingleFileCompileInput()` now requests `ignore` so the current editor
  can compile source containing unresolved future include directives.
- `compileInkProject()` blanks unresolved entry-file `INCLUDE` lines before
  calling inkjs when the policy is `ignore`, preserving line numbers for later
  diagnostics.
- Ignored includes produce `info` diagnostics with the entry `fileId` and
  source line.
- Strict compilation remains the default for project-shaped inputs.
- Added worker tests for ignored unresolved includes and for resolved virtual
  includes under the ignore policy.
- Updated `docs/Editor Migration Plan.md` with the settled policy.

### Verified

- `npm test -- compile-ink-project.test.ts ink-language-evaluation.test.ts`
  passes.
- `npm run check` passes.
- `npm test` passes: 28 test files, 215 tests. It still prints the known
  Monaco `marked.umd.js.map` sourcemap warning.
- `npm run build` passes.

## 2026-07-02 - Checkpoint 11: Phase 5 multi-file-ready groundwork

### Implemented

- Bumped browser-local draft storage into a versioned namespace:
  - files: `inkpad:v2:file:*`
  - active file: `inkpad:v2:active-file`
  - recovery draft: `inkpad:v2:recovery-draft`
- Left pre-CodeMirror local saves intentionally invisible instead of migrating
  them into the CodeMirror/project-shaped world.
- Added a one-time v2 cleanup sweep for old pre-CodeMirror local save keys and
  snapshots, while leaving unrelated `inkpad_*` preferences alone.
- Added normalized project path helpers in
  `client/src/lib/ink-project-paths.ts`.
- Project paths now normalize Unicode to NFC, normalize backslashes to POSIX
  `/`, collapse `.` and empty segments, and reject:
  - empty paths
  - absolute POSIX paths
  - Windows drive paths
  - URI-style paths such as `file://...` or `https://...`
  - paths containing `..`
  - NUL bytes
- Project lookup remains case-sensitive, including future `INCLUDE` resolution,
  but project validation rejects paths that collide case-insensitively.
- Duplicate normalized paths are rejected at the boundary rather than renamed.
- `createSingleFileProject()` normalizes the active filename before storing it
  as both `entryFile` and the sole `files` key.
- `isInkProject()` now only accepts already-normalized project-relative
  `entryFile` and `files` keys.
- Exact-pinned `inkjs` to `2.3.2` because diagnostic snapshots, INCLUDE policy,
  and built-in highlighting are verified against that version.
- Kept the product surface single-file. No multi-file UI was added.

### Verified

- iPhone smoke pass reported by Marina on July 2, 2026: current CodeMirror
  editing, accessory/snippet interactions, and layout behavior work okay on
  iPhone. More extensive mobile and iPad testing remains later.
- `npm test -- file-operations.test.ts ink-project.test.ts ink-project-paths.test.ts`
  passes.

## 2026-07-02 - Checkpoint 12: Phase 6 Monaco removal

### Implemented

- Removed `monaco-editor` and `@monaco-editor/react` from `package.json` and
  reinstalled (`package-lock.json` updated); `npm install` dropped 4 packages.
- Deleted `client/src/components/editor/monaco-editor.tsx`,
  `client/src/monaco-setup.ts`, `client/src/monaco-codicons.css`, and the
  Monaco Monarch tokenizer (`client/src/utils/ink-monarch.ts` and its test).
- Deleted `client/src/inkLanguage/inkCodeActions.ts` (the Monaco
  `CodeActionProvider` adapter for the missing-start-divert quick fix). The
  underlying editor-agnostic logic it wrapped —
  `client/src/inkLanguage/buildSymbolTable.ts` and
  `client/src/inkLanguage/inkDiagnostics.ts` — was already wired directly into
  `client/src/pages/editor.tsx` independent of Monaco and is untouched.
- Split `client/src/features/snippets/ink-completion-provider.ts`: kept the
  pure, independently-tested `getSnippetCompletions` matching logic (see
  Phase 3 completions roadmap item); removed `registerInkSnippetCompletions`
  and its Monaco-only `CompletionItemProvider`/command-registration glue,
  which had no callers outside the deleted Monaco setup path.
- Removed the Monaco `monaco-editor/esm/vs/editor/edcore.main` module
  declaration from `client/src/vite-env.d.ts`.
- Removed all Monaco-specific CSS (`.monaco-editor`, `.find-widget`,
  mobile find-widget overrides, iPad keyboard-toggle hiding, textarea-cover
  rules) from `client/src/index.css`; kept the still-needed
  `.cm-editor textarea { font-size: 16px !important; }` iOS zoom-prevention
  rule.
- Removed the Monaco `manualChunks` bucket and the
  `chunkSizeWarningLimit: 3500` override (justified only by Monaco's size) from
  `vite.config.ts`. The `vendor` chunk (~693kB) now surfaces the default 500kB
  Rollup warning; left as honest signal rather than re-inflating the limit.
- Removed the dead `getEditor(): EditorView | undefined` escape hatch from
  `CodeMirrorEditorHandle`. Its only two live callers
  (`editor-workspace.tsx`'s Problems-chip and Snippets-drawer toggles) used it
  solely for `.contentDOM.blur()` to dismiss the mobile keyboard; added a
  proper `blur(): void` handle method and updated both call sites, keeping
  the migration plan's rule that no call site reaches into raw view internals.
- Updated stale Monaco references in comments/docstrings that described
  future or current behavior (not historical log entries): `ink-snippets.ts`'s
  `desktopSnippet` doc comment (now describes the TextMate/`@codemirror/autocomplete`-compatible
  tab-stop format), `ink-source-tags.ts`'s `findTopLevelTagLine` doc comment
  (now points at the editor handle's `jumpToLine`/`revealLine`).
- Updated `README.md` (features list, "How InkPad works", acknowledgments) and
  `THIRD_PARTY_NOTICES.md` (removed the Monaco Editor section) to describe
  CodeMirror 6 as the editor.
- Updated `docs/devnotes.md`: replaced the "Monaco editor invariants" section
  with "CodeMirror editor invariants" grounded in the actual
  `codemirror-editor.tsx` implementation (compartments, `replaceDocument`
  history/diagnostics options, StrictMode cleanup); corrected the storage-key
  table to the `inkpad:v2:*` namespace and documented
  `cleanupLegacyLocalSaves()`.
- Fixed the one still-open (`[ ]`) roadmap item in `docs/roadmap.md` that
  referenced Monaco; left the historical `[x]` "high-contrast application and
  Monaco theme" entry as an accurate point-in-time record.
- Appended a dated `CHANGELOG.md` "Removed" entry rather than editing its
  historical Monaco-era entries.
- Left `docs/structural-assistance-spec.md` (the authoritative, not-yet-built
  Phase 3 completions/quick-fix/go-to-definition design) unchanged. It is
  written throughout against Monaco's `IMarkerData`/`CompletionItemProvider`/
  model APIs and needs a real retarget to `@codemirror/lint`/
  `@codemirror/autocomplete` before Phase 3 implementation starts; flagged as
  separate follow-up work rather than folded into this removal pass.

### Verified

- `npm run check` passes.
- `npm test` passes: 28 test files, 218 tests (down from 226; the removed
  `ink-monarch.test.ts` accounted for the difference). The long-standing
  Monaco `marked.umd.js.map` sourcemap warning is gone from test output.
- `npm run build` passes; no `monaco` chunk in `dist/assets`, and
  `grep -ril monaco dist/assets` finds nothing.
- Browser smoke test on the running dev server (desktop and mobile 375×812
  viewports): app loads with zero console errors, CodeMirror renders full Ink
  syntax highlighting/folding/mobile accessory bar on the Code tab, and
  `document.querySelector('.monaco-editor')` / `[class*="monaco"]` are both
  null anywhere in the DOM.
- Found and filed as follow-up (not fixed here, pre-existing and unrelated to
  this removal): clicking the Problems or Snippets drawer toggle does not
  actually blur the editor / dismiss the mobile keyboard, despite the intent
  documented in `editor-workspace.tsx`'s comments. Confirmed via A/B testing
  that this predates the `getEditor()` → `blur()` handle refactor (the
  underlying `contentDOM.blur()` call is unchanged); `contentDOM.blur()` works
  correctly in isolation, so something in the click → drawer-open flow is
  interfering.

## 2026-07-02 - Checkpoint 13: Phase 7 minimal multi-file support

Implemented the narrow Phase 7 slice on top of the CodeMirror-only editor:

- The editor page now keeps an `InkProject` in memory with explicit
  `entryFile`, `files`, and `activeFileId`, while preserving the existing
  plain `.ink` single-file flow.
- Added a compact project file rail:
  - desktop: left sidebar inside the code pane
  - desktop rail can collapse to a narrow icon strip and defaults collapsed
    for single-file projects
  - phone: horizontal file strip above CodeMirror
  - New controls offer `Ink file` first and `Blank project` second
  - add-file uses InkPad's existing dialog pattern instead of a native prompt
  - active file switching goes through CodeMirror's document replacement path
- Live compile, Run, JSON export, and playable HTML export now pass the full
  `{ entryFile, files }` input from the current project. This enables strict
  `INCLUDE` resolution against `project.files` in the app surface.
- Current `.ink` export is explicitly the active file. Multi-file projects also
  expose full `.inkpad` project export, and multi-file autosave/manual save
  store the serialized project JSON.
- Problems rows keep and route by `fileId`; clicking a problem switches to the
  diagnostic's file before jumping to the line.
- Knot navigation searches the project file map and switches files before
  revealing the declaration.
- Added a `useInkStory` regression test proving project compile inputs are
  passed through without being flattened to a single string.

Verification:

- `npm run check`
- `npm test` (28 files, 219 tests)
- `npm run build`
- Browser smoke on desktop:
  - CodeMirror rendered with the file rail
  - added `chapter.ink`
  - typed included-file content
  - changed `story.ink` to `INCLUDE chapter.ink` + `-> chapter`
  - Run succeeded and preview showed included content
  - Problems reported no issues
  - no Monaco DOM or Monaco script chunks
- Browser smoke on mobile viewport `390x844`:
  - CodeMirror mounted after opening the Code tab
  - file strip rendered at 40px tall
  - exactly one accessible add-file button
  - no horizontal overflow
  - no Monaco DOM

Notes:

- The browser console log API retained old errors from the earlier native
  `window.prompt` implementation during the same automation session. The
  prompt was removed and the final state uses an in-app dialog.
- Follow-up desktop UI work added after the initial checkpoint made the file
  rail collapsible and retuned New actions. Mobile/tablet checks for that
  follow-up were intentionally skipped on 2026-07-02 at user request and are
  tracked below.
- Rich file management remains out of scope for this checkpoint: rename,
  duplicate, delete, entry-file replacement, project-wide search, and graph
  view are still later work.

## 2026-07-02 - Checkpoint 14: Bundle chunk cleanup

Followed up on the production build's oversized `vendor` warning:

- Lazy-loaded `storyExportService` from `useStoryExport`, so `.ink`, JSON, and
  playable HTML export code is fetched when an export is requested instead of
  during app startup.
- Split Vite manual chunks into named dependency groups:
  - `zip-vendor` for `jszip`
  - `download-vendor` for `file-saver`
  - `ui-vendor` for Radix / Vaul primitives
  - `layout-vendor` for `react-resizable-panels`
  - `analytics` for Vercel Analytics
- Moved HTML template and ZIP creation imports into the playable HTML export
  path so plain `.ink` and JSON export do not fetch ZIP code.
- Replaced the runtime `lodash/debounce` dependency with a tiny local helper
  used by live compile and autosave scheduling.
- Removed `lodash` and `@types/lodash` from package metadata.

Verification:

- `npm run check`
- `npm test` (28 files, 219 tests)
- `npm run build`

Build result:

- The Vite large-chunk warning is gone.
- The former `vendor` chunk was reduced from about `693 kB` minified / `223 kB`
  gzip to about `441 kB` minified / `145 kB` gzip.
- Export-only dependencies now land in lazy chunks:
  - `download-vendor`: about `3 kB` minified / `1.3 kB` gzip
  - `storyExportService`: about `2.3 kB` minified / `1 kB` gzip
  - `zip-vendor`: about `97 kB` minified / `30 kB` gzip, only needed for
    playable HTML ZIP export

## Later Checkpoints

- Phase 2 diagnostic model hardening:
  - Separate `inkjs` and InkPad-authored diagnostics more explicitly if new
    InkPad-authored lint rules are added.
- Phase 4 mobile authoring:
  - Broaden real-device validation beyond the initial iPhone smoke pass,
    especially iPad behavior.
  - Re-check accessory insertion, snippet insertion, selection, keyboard survival, and drawer behavior on iPhone/iPad before final sign-off.
  - Confirm pointerdown insertion does not conflict with scroll gestures in drawers.
  - Confirm clipboard toolbar behavior on iOS Safari.
  - Decide whether phone/desktop breakpoint flips need undo-history
    preservation or whether remount-on-layout-change is acceptable.
  - Fix the Problems/Snippets drawer-open keyboard-dismiss regression noted
    above.
- Multi-file follow-up:
  - Add rename, duplicate, delete, and entry-file replacement flows.
  - Add `.inkpad` import from disk once the file picker accepts project files.
  - Add project-level recovery/snapshot tests beyond serialized autosave.
  - Validate the collapsible project rail and New menu on phone and tablet
    layouts; check keyboard behavior, horizontal overflow, and accessible
    labels before closing the UI/UX pass.
  - Keep project-wide search, graph view, and advanced file management out of
    the migration-critical path.