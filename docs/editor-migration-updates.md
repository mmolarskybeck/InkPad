# Editor Migration Updates

Running log for the Monaco to CodeMirror 6 migration on `codex/monaco-to-codemirror`.

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
- Storage key/schema bumping for discarding pre-CodeMirror local saves is still
  pending and is now tracked under Phase 5/6 follow-ups.

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

## Next Checkpoint

Phase 3 remaining exit criteria:

- INCLUDE quoting/resolution decision tested against inkjs (fixture already
  exists: `include-quoted-path.ink` is confirmed `"invalid"`; the
  quoted-vs-bare-path product decision itself is still open, see Open
  Decisions in the migration plan).
- Fold semantics still need a targeted validation pass against the intended
  Inky behavior, especially trimming trailing blank lines before the next
  declaration.

## Later Checkpoints

- Phase 2 diagnostic model hardening:
  - Finish multi-file Problems-click behavior when the multi-file UI exists.
  - Separate `inkjs` and InkPad-authored diagnostics more explicitly if new
    InkPad-authored lint rules are added.
- Phase 4 mobile authoring:
  - Verify accessory insertion, snippet insertion, selection, keyboard survival, and drawer behavior on iPhone/iPad.
  - Confirm pointerdown insertion does not conflict with scroll gestures in drawers.
  - Confirm clipboard toolbar behavior on iOS Safari.
  - Decide whether phone/desktop breakpoint flips need undo-history
    preservation or whether remount-on-layout-change is acceptable.
- Phase 5 multi-file-ready groundwork:
  - Bump local storage key/schema version before Monaco removal so stale
    pre-CodeMirror saves are discarded predictably.
  - Normalize POSIX project paths.
  - Reject absolute paths and `..`.
  - Keep explicit `entryFile`.
- Phase 6 Monaco removal:
  - Remove Monaco packages, setup files, Monarch tests, completion/code-action adapters, and stale CSS.
  - Consolidate transitional editor-handle aliases and remove raw editor access if no longer needed.
  - Update README, architecture docs, notices, and bundle notes.
