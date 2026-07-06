# InkPad Architecture

This is the canonical architecture overview. Low-level failure-sensitive notes live in [docs/devnotes.md](./docs/devnotes.md), and planned work lives in [docs/roadmap.md](./docs/roadmap.md).

## Product constraints

InkPad is a local-first, browser-based Ink editor. It is a static React application with no required backend, account, or server-side compiler.

The primary constraints are:

- Preserve writers’ work and make failures recoverable.
- Keep the write → compile → preview loop responsive.
- Remain deployable as static assets.
- Add project sharing without making authentication a prerequisite.
- Grow into multi-file Ink projects incrementally rather than replacing the current single-file workflow all at once.

## Technology

- React 18 and TypeScript
- Vite
- CodeMirror 6 with a custom Ink language definition
- `inkjs` compiler/runtime
- Web Workers for compilation
- Tailwind CSS and Radix/shadcn UI primitives
- Browser `localStorage` for current persistence
- Vitest and Testing Library

## Main ownership boundaries

### Editor shell

`client/src/pages/editor.tsx` coordinates the active document, layout, dialogs, toolbar commands, editor, preview, problems, variables, and feature hooks.

It is an orchestration boundary, not the implementation home for persistence, compilation, import/export, or editor internals.

### CodeMirror editor

`client/src/components/editor/codemirror-editor.tsx` owns the CodeMirror instance and its imperative editor controls.

CodeMirror delays change emission once to avoid a React update for every keystroke. Application document state remains canonical; `latestSourceRef` and `getCurrentSource()` provide immediate access for save, run, and export operations before the debounced React echo arrives.

Theme changes use CodeMirror compartments and reconfiguration. Editor font-size and word-wrap preference changes update the existing view; do not recreate the editor to apply preference changes.

Do not treat the CodeMirror view as the portable domain model.

### Settings and preferences

`client/src/components/preferences-provider.tsx` owns browser-wide preferences. The versioned type and defaults live in `client/src/types/user-preferences.ts`, while `client/src/lib/preferences-storage.ts` owns validation, persistence, and migration from the legacy `inkpad-theme` key.

Global preferences currently include:

- application theme: dark, light, or high contrast
- editor font size
- preview font size
- story theme
- editor word wrap

Story-specific settings currently include display title, author name, transcript/scene preview mode, and an optional remembered playable-HTML export profile. They are stored with each local `InkDocument` record and recovery draft. The display title is independent from the local filename and preserves the writer’s capitalization and punctuation. HTML export overrides never modify Ink source or Story Details. Global `title`, `author`, and `theme` tags provide portable presentation values without renaming the local file. The story theme is a browser preference unless the user explicitly writes a `theme` tag from Settings.

Resetting preferences affects only browser-wide preferences. It must not reset story title, author, or preview mode.

### Story compiler and runtime

`client/src/hooks/use-ink-story.ts` owns:

- queued/immediate compilation
- stale-request rejection
- compiled runtime story state
- transcript and choice history
- variables and knot data

`client/src/lib/ink-compiler.ts` wraps worker communication and constructs runtime `Story` objects from compiled JSON.

The worker request contract is:

```ts
{
  type: "compile";
  requestId: string;
  entryFile: string;
  files: Record<string, string>;
}
```

Single-file calls are wrapped into that shape. The worker compiles the entry source with an `inkjs.JsonFileHandler`, allowing exact-name `INCLUDE` resolution from the virtual file map.

The worker still sends `storyJson` as a JSON string. Sender and receiver must change together if that representation changes.

### Project domain model

`client/src/types/ink-project.ts` defines the portable project:

```ts
interface InkProject {
  schemaVersion: 2;
  id: string;
  name: string;                    // Project name (topbar display, export basis)
  nameIsExplicit: boolean;        // false → auto-follows Story Title tag
  fileNameIsExplicit: boolean;    // false → entry file name auto-follows project name (single-file only)
  exportNameBase: string;         // Basis for .inkpad bundle name
  exportNameIsExplicit: boolean;  // false → auto-follows project name
  entryFile: string;              // The entry .ink file
  files: Record<string, { content: string }>;
  // Story settings (now part of the portable project):
  author?: string;
  htmlExport?: HtmlExportOptions;
  storyTypeface?: HtmlExportFont;
  previewMode?: PreviewMode;
  titleFallback?: string;         // Fallback Story Title when no # title: tag present
}
```

The model is intentionally serializable and versioned because it is shared by:

- Local project persistence (single-file and multi-file)
- `.inkpad` import/export (full-fidelity project bundles)
- shareable project snapshots
- compiler virtual-file input

**Single-file stories are modeled as one-file `InkProject`s.** This unifies the persistence model: every story (single or multi-file) is an `InkProject`, stored in localStorage with a computed storage key based on file count.

**Story title, project name, and file names are now independent** — see [`docs/naming-refactor-completed.md`](./docs/naming-refactor-completed.md) for the full design, propagation rules, and pin semantics.

User preferences do not belong in `InkProject`. Source-authored global tags (`# author:`, `# theme:`) remain portable with `.ink` exports. Derived data such as compiler symbols does not belong there.

### Persistence

Current persistence is local and document-based:

- Primary autosave record containing source plus optional story settings
- A fixed recovery-draft record for crash/tab-close recovery
- Bounded snapshots of previous saved versions
- An active-file pointer
- A separate versioned global-preferences record

`client/src/lib/file-operations.ts` owns storage keys, snapshots, quota recovery, local file operations, and downloads.

`client/src/hooks/use-autosave.ts` owns save timing, status, checkpoints, and current multi-tab leadership behavior.

Recovery and autosave are separate safety layers. Do not remove recovery merely because autosave exists: asynchronous work triggered during unload is not guaranteed to finish.

### Import and export

Focused helpers live under:

```text
client/src/features/
  files/
  export/
```

Editable import currently accepts `.ink`. Export supports source, compiled JSON, and playable web output. `.inkproject` and snapshot-link support are planned.

## State strategy

InkPad currently uses local React state and focused hooks. A small React context exposes global user preferences; there is no general-purpose global application store.

Add a shared store only when concrete cross-tree state makes it simpler—for example project tabs, project-wide file state, or preferences consumed by distant components. Do not add one solely because the roadmap is growing.

The state separation is:

```text
InkProject              portable user-authored content
InkDocument settings    current browser-local story metadata and preview mode
UserPreferences         browser-wide editor and appearance preferences
InkSymbolIndex          derived completion/navigation data
```

## Error resilience

The top-level error boundary displays a recovery-oriented fallback and offers recovery-draft export when available.

Compilation errors remain ordinary application state and are displayed in the problems panel and CodeMirror lint markers; they should not trigger the error boundary.

## Multi-file support

The compiler foundation supports exact filenames in a virtual file map. Multi-file projects are now fully persistent in the `.inkpad` format.

Completed work:

- [x] Single-file and multi-file use the same `InkProject` domain model.
- [x] Projects persist as JSON to localStorage, keyed by filename or project name.
- [x] Compiler diagnostics include filenames and line numbers.
- [x] Entry-file rename behavior is defined and tested (pins the file name).
- [x] Existing local single-file saves migrate safely (legacy schema-v1 → v2 with explicit pin defaults).
- [x] Create, duplicate, and delete file operations are available from the project file rail.
- [x] File rename updates INCLUDE references across the project.

Remaining work for Phase 5 (see [docs/roadmap.md](./docs/roadmap.md)):

- [ ] `.inkpad` import support (export is complete)
- [ ] Mobile file-rail UX for phones
- [ ] Relative-path semantics (currently only exact-name INCLUDE is supported)

## Verification

Run all three before handing off a change:

```bash
npm test
npm run check
npm run build
```

Changes involving editor input, storage, worker messages, or project serialization need targeted tests in addition to the general suite.
