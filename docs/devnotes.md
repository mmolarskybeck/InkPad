# InkPad Development Notes

These notes cover implementation details that are easy to break and too specific for the architecture overview.

## Monaco editor invariants

### Let Monaco handle editor keyboard input

Do not add capture handlers to the Monaco container to implement selection, deletion, undo, or other native editor behavior. Monaco owns its command chain and keybindings.

Application-level shortcuts are registered on `window` and should be narrowly scoped. If a new shortcut overlaps a Monaco command, test the editor behavior directly.

Editor regression checklist:

- [ ] Backspace at the beginning of a line joins the previous line
- [ ] Select all covers the complete document
- [ ] Delete and Backspace remove multiline selections
- [ ] Undo and redo remain available
- [ ] Find/replace opens and closes correctly
- [ ] New/open actions replace the model without restoring stale text
- [ ] No duplicate Monaco instance or context-attribute errors

### StrictMode and DOM cleanup

`MonacoEditor` guards asynchronous initialization with `initializingRef` and disposes the editor during cleanup. It also removes Monaco DOM artifacts from its container.

Treat this cleanup as failure-sensitive. Changes should be tested under React StrictMode, including mount/unmount and mobile/desktop layout changes.

### Live preference updates

Do not recreate Monaco when editor font size or word wrap changes. `MonacoEditor` receives primitive preference props and applies them to the existing instance with:

```ts
editor.updateOptions({
  fontSize,
  wordWrap: wordWrap ? "on" : "off",
});
```

Theme changes select one of the registered Ink Monaco themes. Add a corresponding application token set and Monaco theme together when introducing another theme.

### Source ownership

Application document/project state is the canonical portable state. Monaco is the editing surface.

Because Monaco emits changes through a short debounce, immediate commands use `getCurrentSource()`/`editorRef.current.getValue()` or the latest source ref for freshness. That is an escape hatch for timing, not a declaration that the widget is the domain model.

There should be only one editor-to-React debounce. Do not add another delay in `useEditorSourceBuffer`.

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
  schemaVersion: 1;
  id: string;
  name: string;
  entryFile: string;
  files: Record<string, { content: string }>;
}
```

Use the helpers in `client/src/lib/ink-project.ts` to create, validate, parse, or convert a project into compiler input.

Keep these concerns out of the project payload:

- Theme, word wrap, and other user preferences
- Derived completion/symbol indexes
- Save status and transient UI state
- Runtime story state and transcript history

Schema changes require an explicit version bump and migration strategy. Snapshot links and `.inkproject` files must never depend on undocumented React state.

The current single-file persistence layer does store limited story-specific settings—author and preview mode—beside source content. This is an interim `InkDocument` behavior, not yet part of the portable `InkProject` contract.

## Persistence architecture

InkPad currently has no backend. Persistence is browser-local and still document-based while the UI supports one active file.

### Storage records

| Record | Key shape | Purpose |
| --- | --- | --- |
| Main file | `inkpad_<filename>` | Primary saved content |
| Recovery draft | `inkpad:recovery-draft` | Best-effort crash/tab-close recovery |
| Snapshot | `inkpad_<filename>:snap:<timestamp>` | Previous saved version, maximum 10 per file |
| Active file | `inkpad:active-file` | Startup selection |
| User preferences | `inkpad:preferences` | Versioned global theme, font-size, and word-wrap preferences |

Main-file and recovery-draft records may include story-specific `settings` containing author and preview mode. Rename, duplicate, recovery, and save-as flows must preserve them.

### Timing

- Monaco emits source changes after its editor debounce.
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

For changes involving Monaco, storage lifecycle events, or browser-only APIs, also perform an interactive browser smoke test.
