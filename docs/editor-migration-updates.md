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

## Next Checkpoint

Phase 3 language-mode work:

- Create fixture corpus for Ink highlighting/folding/parsing.
- Pull relevant fixtures from `ink-tmlanguage/tests/cases/`.
- Add InkPad-specific fixtures for diverts, tunnel diverts, parameterized targets, dictionary tags, CJK/Hangul/emoji offsets, TODO/author warnings, built-ins, INCLUDE paths, escapes, and EXTERNAL behavior.
- Evaluate `@mavnn/codemirror-lang-ink` first.
- Decide whether to keep, patch/vendor/fork, or fall back to a `StreamLanguage` tokenizer.
- Add InkPad `HighlightStyle`.
- Validate fold ranges.

## Later Checkpoints

- Phase 2 diagnostic model hardening:
  - Add `fileId` to editor diagnostics.
  - Separate `inkjs` and InkPad-authored diagnostics more explicitly.
  - Add diagnostic adapter tests.
- Phase 4 mobile authoring:
  - Verify accessory insertion, snippet insertion, selection, keyboard survival, and drawer behavior on iPhone/iPad.
- Phase 5 multi-file-ready groundwork:
  - Normalize POSIX project paths.
  - Reject absolute paths and `..`.
  - Keep explicit `entryFile`.
- Phase 6 Monaco removal:
  - Remove Monaco packages, setup files, Monarch tests, completion/code-action adapters, and stale CSS.
  - Update README, architecture docs, notices, and bundle notes.
