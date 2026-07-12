# InkPad Development Notes

These notes cover implementation details that are easy to break and too specific for the architecture overview.

## CodeMirror editor invariants

See `docs/archive/codemirror-migration/Editor Migration Plan.md` for the full lifecycle rules this section assumes. `CodeMirrorEditor` (`client/src/components/editor/codemirror-editor.tsx`) owns exactly one long-lived `EditorView` per mount; nothing else should read or set `view.state.doc` directly.

### Let CodeMirror handle editor keyboard input

Do not add capture handlers to the editor container to implement selection, deletion, undo, or other native editor behavior. CodeMirror owns its command chain via `keymap.of([...])` in `buildExtensions()`.

Application-level shortcuts are registered on `window` and should be narrowly scoped. If a new shortcut overlaps a CodeMirror keymap entry (default/history/search/fold/lint), test the editor behavior directly.

Editor regression checklist:

- [ ] Backspace at the beginning of a line joins the previous line
- [ ] Select all covers the complete document
- [ ] Delete and Backspace remove multiline selections
- [ ] Undo and redo remain available
- [ ] Find/replace opens and closes correctly
- [ ] New/open actions replace the document without restoring stale text
- [ ] No duplicate `EditorView` or leaked instance on remount

### StrictMode and DOM cleanup

The mount effect in `codemirror-editor.tsx` creates exactly one `EditorView` and returns a cleanup function that flushes pending changes (`emitChangeNow`), clears timers, calls `view.destroy()`, and clears the container's `innerHTML`.

Treat this cleanup as failure-sensitive. Changes should be tested under React StrictMode, including mount/unmount and mobile/desktop layout changes. The migration plan's known open risk here: a phone/desktop breakpoint flip can still remount the editor because the pane moves between different layout trees, which resets undo history on rotation/resize.

### Live preference updates

Do not recreate the `EditorView` when editor font size, word wrap, or theme changes. Runtime preferences are wired through `Compartment`s (`themeCompartmentRef`, `wrappingCompartmentRef`, `editableCompartmentRef`, `contentAttributesCompartmentRef`, `languageCompartmentRef`) and applied with `view.dispatch({ effects: compartment.reconfigure(...) })`.

Add a corresponding application token set and `EditorView.theme(...)` variant together when introducing another theme; see `createThemeExtension`.

### Source ownership

Application document/project state is the canonical portable state. CodeMirror is the editing surface.

Because CodeMirror emits changes through a short debounce (`scheduleChangeEmit`, 120ms), immediate commands use `getCurrentSource()`/`editorRef.current.getValue()` or the latest source ref for freshness. That is an escape hatch for timing, not a declaration that the widget is the domain model.

There should be only one editor-to-React debounce. Do not add another delay in `useEditorSourceBuffer`.

### Document replacement

Full-document replacement always goes through `replaceDocument(value, options)`, never a raw `changes: { from: 0, to: doc.length, insert }` at a call site. `options.history: "reset"` is for file switch/import/reset; `"preserve"` is for same-document external updates (e.g. settings-panel metadata writes). Ordinary typing and toolbar/snippet insertion use `insertTextAtCursor`/`replaceRange`, never `replaceDocument`.

## Compilation

### Live versus immediate compilation

- Typing calls the debounced `compileLive`.
- Run and compile-dependent exports call immediate `compileNow`.
- The compiled `Story` JSON is stored, and a fresh runtime instance is created from it whenever the user runs or restarts the story (preventing empty states on replay).

Every compile receives a request ID. `useInkStory` ignores results that do not match the latest request so an older compile cannot overwrite newer diagnostics or symbols.

### Worker contract

The request contract is defined in `client/src/types/worker-messages.ts`:

```ts
interface CompilerCompileRequest {
  type: "compile";
  requestId: string;
  entryFile: string;
  files: Record<string, string>;
}
```

The worker response is either `compile-success` or `compile-error` and echoes the request ID.

`storyJson` is a JSON string, not a parsed object. Update the worker, main-thread wrapper, types, and tests together if this changes.

### Virtual files and INCLUDE

`compileInkProject` passes an `inkjs.JsonFileHandler` to the compiler. Exact filenames in `files` can therefore be loaded by Ink `INCLUDE`.

Current limitation: `JsonFileHandler` does not resolve relative import paths. Do not promise relative directory support until InkPad defines and tests its own resolver.

Worker regression checklist:

- [ ] Single-file story compiles
- [ ] Multi-file story resolves `INCLUDE`
- [ ] Missing entry file returns an actionable error
- [ ] Invalid Ink returns compiler diagnostics
- [ ] Warnings remain warnings
- [ ] Compiled JSON remains a string across the worker boundary
- [ ] Stale responses do not replace newer results

## Project model

`InkProject` is the portable, versioned domain object:

```ts
interface InkProject {
  schemaVersion: 2;
  id: string;
  name: string;
  nameIsExplicit: boolean;
  fileNameIsExplicit: boolean;
  exportNameBase: string;
  exportNameIsExplicit: boolean;
  entryFile: string;
  files: Record<string, { content: string }>;
  author?: string;
  previewMode?: "transcript" | "scene";
  storyTypeface?: "serif" | "sans" | "mono";
  htmlExport?: object;
}
```

Use the helpers in `client/src/lib/ink-project.ts` to create, validate, parse, or convert a project into compiler input.

Keep these concerns out of the project payload:

- Theme, word wrap, and other user preferences
- Derived completion/symbol indexes
- Save status and transient UI state
- Runtime story state and transcript history

Schema changes require an explicit version bump and migration strategy. Snapshot links and `.inkpad` files must never depend on undocumented React state.

Single-file stories are represented as one-file `InkProject`s, just like multi-file stories. Story-specific settings supported by the project model travel with `.inkpad` bundles; browser-wide preferences remain separate.

## Persistence architecture

InkPad currently has no backend. Persistence is browser-local and project-based, with one active file selected inside the current project.

### Storage records

| Record | Key shape | Purpose |
| --- | --- | --- |
| Main file | `inkpad:v2:file:<filename>` | Primary saved content |
| Recovery draft | `inkpad:v2:recovery-draft` | Best-effort crash/tab-close recovery |
| Snapshot | `inkpad:v2:file:<filename>:snap:<timestamp>` | Previous saved version, maximum 10 per file |
| Active file | `inkpad:v2:active-file` | Startup selection |
| User preferences | `inkpad:preferences` | Versioned global theme, font-size, and word-wrap preferences |

Main-file and recovery-draft records may include story-specific `settings` containing author and preview mode. Rename, duplicate, recovery, and save-as flows must preserve them.

The `v2` namespace exists because the CodeMirror migration bumped `LOCAL_FILE_STORAGE_SCHEMA_VERSION` in `client/src/lib/file-operations.ts` to discard pre-CodeMirror saves predictably. `FileOperations.cleanupLegacyLocalSaves()` runs a one-time sweep of the old unprefixed `inkpad_*` / `inkpad:active-file` / `inkpad:recovery-draft` keys on the relevant read paths, without touching unrelated `inkpad:*` preference keys.

### Timing

- CodeMirror emits source changes after its editor debounce.
- Recovery draft writes are scheduled shortly after the application receives a change.
- Autosave writes the main record after its own save debounce.
- Periodic checkpoints save dirty content.
- Visibility/page lifecycle handlers flush best-effort recovery and save work.

Recovery and autosave have different purposes. The recovery draft is synchronous `localStorage` protection; an asynchronous save started during unload may not finish.

### Quota behavior

`FileOperations.saveFile` snapshots the previous version before writing changed main content.

If storage is full:

1. Snapshot creation may purge old snapshots and then be skipped.
2. Recovery draft creation may purge snapshots and then be skipped.
3. A failed main-file write retries after snapshot cleanup.
4. If the main write still fails, autosave enters the error state and the user sees a toast.

Do not rethrow optional snapshot failures as main-file failures.

### Multi-tab behavior

Autosave currently elects one leader per filename using `BroadcastChannel`. A non-leader tab is described as read-only in status UI, but full editor enforcement and recovery-draft isolation are not complete.

Do not casually remove or expand this system. The roadmap requires an explicit choice between:

- enforced non-leader read-only behavior, or
- version/conflict detection without leader election.

Add tests before changing the policy.

### Persistence regression checklist

- [ ] Startup chooses a newer recovery draft for the active file
- [ ] Autosave writes the latest source
- [ ] Manual save uses the immediate editor value
- [ ] New/open/rename/save-as operations do not carry stale buffered source
- [ ] Rename, duplicate, recovery, and save-as preserve story settings
- [ ] Invalid or legacy preferences fall back or migrate safely
- [ ] Reset preferences leaves story title, author, and preview mode unchanged
- [ ] Quota failure preserves the editor session and displays an error
- [ ] Storage-disabled mode still permits editing and export
- [ ] Editing during an in-flight save cannot mark newer content saved
- [ ] Two tabs cannot silently overwrite each other’s recovery state

The final two checks are roadmap items and should become automated before project-level persistence ships.

## Error boundary

The top-level error boundary is for unexpected React render/lifecycle failures. It offers recovery-draft export when possible and a reload action.

Expected compiler errors, import validation errors, and save failures should remain ordinary UI state or toasts. Do not throw them into the boundary.

## Verification commands

Run:

```bash
npm test
npm run check
npm run build
```

For changes involving the CodeMirror editor, storage lifecycle events, or browser-only APIs, also perform an interactive browser smoke test.
