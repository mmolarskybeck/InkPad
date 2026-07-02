# InkPad Roadmap and TODO

This is the working implementation checklist. It favors small, testable slices and keeps InkPad local-first, static, and usable without an account.

## Completed foundation

- [x] Split editor orchestration into focused hooks and workspace components
- [x] Add automated tests for story runtime, preview, autosave, file operations, and leader coordination
- [x] Add local recovery drafts and bounded local snapshots
- [x] Protect live compilation from stale worker responses
- [x] Add a top-level error boundary with recovery-draft export
- [x] Remove duplicate source buffering and unused autosave throttle code
- [x] Centralize content hashing and remove obsolete compiler/sample code
- [x] Define a versioned `InkProject` model
- [x] Change the compiler contract to `{ entryFile, files }`
- [x] Verify virtual-file `INCLUDE` compilation with automated tests

## Phase 1: Preferences and settings

- [x] Define a versioned `UserPreferences` type separate from `InkProject`
- [x] Add a typed preferences storage module; avoid scattered `localStorage` calls
- [x] Add a settings menu
- [x] Add preview mode: `transcript` or `scene`
- [x] Add editor word-wrap preference
- [x] Add editor and preview font-size preferences
- [x] Expose supported color themes through settings
- [x] Add a high-contrast application and Monaco theme
- [x] Decide which settings are global user preferences versus project-specific behavior
- [x] Store author and preview mode with each local story
- [x] Add story typeface preference and synchronize with HTML export
- [x] Add privacy controls and coarse analytics opt-out
- [x] Add About links and preference reset behavior
- [x] Add preference migration/default tests
- [x] Verify keyboard navigation, focus behavior, and responsive settings layout
- [ ] Complete manual screen-reader verification

## Phase 2: Preview modes

- [x] Preserve the current transcript behavior as one renderer
- [x] Add a current-passage scene renderer
- [x] Keep runtime/story state independent from either presentation mode
- [x] Store the preferred preview mode with each local story
- [x] Move Back and restart into a consistent Story Preview header
- [x] Explain both modes in Settings
- [x] Test choices, tags, completion, restart, and stale-preview states in both modes

## Phase 3: Completions and snippets

> Authoritative design: [`structural-assistance-spec.md`](./structural-assistance-spec.md) (symbol table, completion, diagnostics, quick fixes, go-to-definition, Ink Info, snippets). Deferred until the core editor (compile, highlighting, save/load/export) is stable.

- [ ] Define a derived `InkSymbolIndex`
- [ ] Index knots, stitches, variables, lists, functions, and their source locations
- [ ] Make the index readable by the CodeMirror editor (e.g. a `@codemirror/autocomplete` source) without coupling it to React render state
- [ ] Register an Ink completion provider
- [ ] Add divert completion for known knots and stitches
- [ ] Add variable/list completion in relevant contexts
- [ ] Add a code snippet panel using static built-in snippets first
- [ ] Decide whether custom snippets belong in user preferences
- [ ] Add completion tests for incomplete and invalid Ink source

## Phase 4: Shareable project snapshots

- [ ] Define canonical `InkProject` serialization
- [ ] Add schema-version validation and migration boundaries
- [ ] Compress and URL-safe encode immutable project snapshots
- [ ] Establish a practical maximum URL size and show actionable errors
- [ ] Ensure opening a snapshot creates a new local project instead of overwriting existing work
- [ ] Add share/copy-link UI
- [ ] Add malformed, unsupported-version, and oversized snapshot tests
- [ ] Document privacy: links contain the shared project data and should be treated accordingly
- [ ] Keep a future anonymous blob/short-link service optional and compatible with the same snapshot payload

## Phase 5: Multi-file projects

- [x] Promote live editor compile state from `InkDocument` to `InkProject`
- [x] Add a project file list and active-file selection
- [ ] Add create, rename, duplicate, and delete file operations
- [ ] Prevent deletion or invalid renaming of the entry file without an explicit replacement
- [x] Add minimal create-file support
- [x] Resolve exact-name `INCLUDE` paths from the project file map
- [ ] Decide and document relative-path behavior; inkjs `JsonFileHandler` does not resolve relative imports
- [x] Display compiler errors with filename and line information
- [x] Route Problems clicks by file before jumping to the diagnostic line
- [ ] Finish project persistence hardening beyond serialized `.inkpad` autosave
- [x] Add `.inkpad` export
- [ ] Add `.inkpad` import
- [ ] Keep plain `.ink` import/export working as a single-file project workflow
- [ ] Migrate existing local single-file saves safely
- [ ] Add multi-file recovery and snapshot tests
- [ ] UI/UX pass - make project drawer collapsible, hidden by default when only a single ink file is open, and offer elegant responsive design for tablet/mobile phone versions of layout (possibly move file manager to small icon or to hamburger main menu on phones?) 

## Phase 6: Persistence hardening

- [ ] Consolidate lifecycle flush handling without removing crash recovery
- [ ] Define project-level autosave and snapshot keys
- [ ] Add save-in-flight protection so older writes cannot mark newer content saved
- [ ] Add tests for editing during an active save
- [ ] Add tests for file/project switching with pending recovery writes
- [ ] Decide the multi-tab policy explicitly:
  - [ ] enforce actual read-only behavior for non-leader tabs, or
  - [ ] replace leader election with version/conflict detection
- [ ] Prevent non-leader tabs from overwriting shared recovery data
- [ ] Revisit storage limits once snapshots contain multiple files

## Phase 7: Worker lifecycle and performance

- [ ] Measure compiler worker startup cost with representative projects
- [ ] Keep worker-per-compile if startup cost is negligible
- [ ] If warranted, add a managed long-lived compiler service with request routing
- [ ] Define cancellation, crash recovery, disposal, and stale-result behavior
- [ ] Benchmark live compilation for larger multi-file projects

## Ongoing quality work

- [ ] Accessibility audit against WCAG 2.1 AA
- [ ] Keyboard shortcuts reference
- [ ] Clear onboarding and Ink help links
- [ ] Error/warning filtering for larger projects
- [ ] Current knot/stitch breadcrumb
- [ ] Outline panel for knots, stitches, and functions
- [ ] Export safety messaging when compilation fails
- [x] Mobile authoring improvements

## Explicit non-goals for the current roadmap

- User accounts or authentication
- Live collaborative editing
- Required backend services
- Cloud persistence as the primary save model

These may be reconsidered later, but current sharing is intentionally based on portable, immutable project snapshots.
