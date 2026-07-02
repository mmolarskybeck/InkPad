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

- Move the CodeMirror diagnostic adapter out of the React component and cover it
  with fixture tests when the Phase 2 `fileId` diagnostic model lands.
- Decide whether to remove or hide raw `getEditor()` access from the public
  editor handle during the Monaco-removal checkpoint.
- Validate pointerdown-based mobile insertion and clipboard paste behavior on a
  real iPhone/iPad before signing off on Phase 4.

## Next Checkpoint

Phase 3 language-mode work:

- Expand fixture corpus for Ink highlighting/folding/parsing.
- Pull relevant fixtures from `ink-tmlanguage/tests/cases/`.
- Decide whether to patch/vendor/fork `@mavnn/codemirror-lang-ink` or fall back to a `StreamLanguage` tokenizer.
- Add InkPad `HighlightStyle`.
- Validate fold ranges.

## Later Checkpoints

- Phase 2 diagnostic model hardening:
  - Add `fileId` to editor diagnostics.
  - Separate `inkjs` and InkPad-authored diagnostics more explicitly.
  - Add diagnostic adapter tests.
  - Move CodeMirror lint-range conversion out of the editor component.
- Phase 4 mobile authoring:
  - Verify accessory insertion, snippet insertion, selection, keyboard survival, and drawer behavior on iPhone/iPad.
  - Confirm pointerdown insertion does not conflict with scroll gestures in drawers.
  - Confirm clipboard toolbar behavior on iOS Safari.
- Phase 5 multi-file-ready groundwork:
  - Normalize POSIX project paths.
  - Reject absolute paths and `..`.
  - Keep explicit `entryFile`.
- Phase 6 Monaco removal:
  - Remove Monaco packages, setup files, Monarch tests, completion/code-action adapters, and stale CSS.
  - Consolidate transitional editor-handle aliases and remove raw editor access if no longer needed.
  - Update README, architecture docs, notices, and bundle notes.
