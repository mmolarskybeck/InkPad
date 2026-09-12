# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Commit-aware live compilation after finished words and short idle periods, with delayed status feedback for slower compiles
- Choice-path replay after successful live recompilation, including safe restart notices when a previously visited target no longer exists
- A lazy shared compiler worker with request routing, crash recovery, and hot-module replacement cleanup
- Ink-aware completion for divert targets, variables, constants, lists, list items, functions, and built-in functions
- Go-to-definition and Ink Info hover for knots and stitches, including cross-file navigation
- Quick fixes for several common unresolved targets, declarations, function calls, and loose ends
- Searchable Insert palette for syntax helpers, built-in snippets, longer library examples, and browser-local custom snippets
- Create, edit, and delete controls for custom snippets
- Platform-aware shortcut labels in tooltips and menus
- Optional `source.inkpad` in playable story ZIPs, with source-disclosure guidance in the export dialog
- Generated `README.html` publishing and customization guide for playable exports
- Project manager for searching, sorting, opening, renaming, duplicating, expanding, and deleting browser-local projects
- `.inkpad`/ZIP project import with manifest validation, path-collision checks, metadata restoration, and local-project creation
- Full-fidelity `.inkpad` export containing the project manifest, all Ink source files, entry-file information, and supported settings
- Multi-file project rail with create, rename, duplicate, delete, entry-file protection, project-relative paths, and `INCLUDE` resolution
- Versioned, browser-local `UserPreferences` storage with migration from the previous theme key
- Responsive Settings sheet for story details, appearance, editor, preview, and About information
- Dark, light, and high-contrast application and CodeMirror themes
- Editor and preview font-size preferences plus editor word-wrap control
- Project-local author and transcript/scene preview settings, preserved through save, recovery, rename, and duplication
- Transcript and scene Story Preview renderers
- Back and restart controls in the Story Preview header with accessible labels and tooltips
- Versioned `InkProject` model with validation and single-file migration helpers
- Virtual-file compiler requests using `{ entryFile, files }`
- Ink `INCLUDE` compilation support through the worker’s in-memory file map
- Minimal multi-file authoring with a project file rail, active-file switching, strict project-file `INCLUDE` resolution, file-routed Problems jumps, and full `.inkpad` project export
- Collapsible desktop project file rail, collapsed by default for single-file stories, with a New menu for adding an Ink file or starting a blank project
- Recovery-aware top-level error boundary
- Automated project-model and multi-file compiler tests
- Phone/desktop progressive hydration split with viewport-gated editor loading, phone Preview default, delayed phone prefetch, and branded mobile loading fallback
- Centralized privacy-preserving analytics wrapper with allowlisted events, opt-out storage, URL sanitization, and Vercel Analytics gating
- Settings privacy/data toggle for analytics opt-in/out
- Privacy tests and telemetry for coarse app events (load, run results, layout changes, settings changes)
- `llms.txt` for AI assistant discoverability
- HTML character entity decoder for safe rendering of spaces/tiles and common named entities in story output and exported HTML
- Shared story typeface setting synchronized between Settings sheet and Playable HTML export modal
- Native support for `# theme: system` metadata across parsing, preview styling, and export
- Export labels now distinguish the current `.ink` file from the full `.inkpad` project when multiple files exist

### Changed

- Playable story ZIPs now use `index.html` as the entry page
- The editor toolbar and file pane now adapt their controls to the available pane width
- Routine successful background compiles stay quiet; failed edits keep the last successful preview available
- Snippet access is consolidated in the Insert palette on desktop, while mobile retains direct insertion controls
- Project persistence now uses the shared `InkProject` model for both single-file and multi-file stories
- Import and export menus now distinguish portable `.ink` source files from full `.inkpad` project bundles
- CodeMirror appearance preferences now update the existing editor instance through compartments
- Preview display mode is changed in Settings rather than through duplicate controls in the preview
- Restart moved from the global navigation into the Story Preview header
- Global preferences and story-local settings now use separate persistence scopes
- Removed the duplicate editor-to-React source debounce
- Simplified autosave by removing unused throttle machinery
- Centralized non-cryptographic content hashing
- Replaced blocking export error alerts with the existing toast system
- Reduced startup bundle pressure by lazy-loading story export services,
  splitting Vite vendor chunks by dependency family, keeping ZIP export code
  lazy, and replacing lodash debounce with a local helper
- Updated architecture and roadmap documentation around local-first project snapshots and eventual multi-file support
- Optimized mobile `Code` tab by replacing `forceMount` with intent-based prefetching
- Made mobile viewport detection synchronous and aligned to `max-width: 768px`
- Polished Playable HTML export dialog to clarify that title and author are download-only
- Playable HTML export now writes `# theme: ` tags to the Ink source when the export theme is changed
- Replaced Monaco's bundled Codicon CSS import with a local override using `font-display: swap` for better font loading performance
- Made Monaco Ink-only by dropping unused JSON/TS/HTML/CSS workers, reducing bundle size from 3.9MB to 3.3MB

### Fixed

- Mobile replay bug where restarting a completed story would load an empty state; now rebuilds a fresh runtime instance from compiled JSON on restart (applied to exported HTML as well)
- Story rendering bug where HTML character references (like `&nbsp;` and `&#9608;`) were displayed literally instead of as spaces/tiles

### Removed

- One-off root-level `scratch*.js` and `scratch*.cjs` compiler experiments
- Redundant project-local Impeccable skill bundle and GitHub Copilot hook; Codex uses the global skill with a minimal project hook
- Unused compiler fallback and syntax-check helpers
- Obsolete sample-story source files
- Monaco Editor: the `monaco-editor` and `@monaco-editor/react` dependencies, `monaco-editor.tsx`, `monaco-setup.ts`, the Monaco Monarch tokenizer (`ink-monarch.ts`), the Monaco quick-fix code-action adapter, the Monaco-specific completion-provider registration, Monaco CSS overrides, and the Monaco build-chunk rule. CodeMirror 6 is now the only editor (see `docs/archive/codemirror-migration/Editor Migration Plan.md` Phase 6).

### Verification

- 49 automated test files passing (647 tests)
- TypeScript check passing
- Production build passing
- Desktop and mobile browser smoke testing completed for Settings and Story Preview controls

## [1.0.0] - 2025-01-26

### Added

- Initial public release
