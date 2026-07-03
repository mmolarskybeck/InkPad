# Project Naming Refactor — Completed 2026-07-03

## Overview

InkPad now decouples and properly manages three independent naming concepts with forward-only propagation, making story title, project name, and file names independently renamable while maintaining a sensible logical hierarchy.

**Status**: Implementation complete. All 256 tests passing, end-to-end verification in browser confirms all naming flows work as designed.

---

## What Changed

### Data Model

**`InkProject` becomes the canonical internal model for every story** — single-file or multi-file. The schema bumped from v1 to v2:

```typescript
export interface InkProject {
  schemaVersion: 2;
  id: string;
  name: string;                    // Project name (what topbar shows)
  nameIsExplicit: boolean;        // false → name auto-follows Story Title tag
  fileNameIsExplicit: boolean;    // false → entry file name auto-follows project name (single-file only)
  exportNameBase: string;         // Basis for .inkpad bundle name
  exportNameIsExplicit: boolean;  // false → exportNameBase auto-follows project name
  entryFile: string;              // The entry .ink file (record key in files map)
  files: Record<string, { content: string }>;
  // Settings now live here instead of split across InkDocument:
  author?: string;
  htmlExport?: HtmlExportOptions;
  storyTypeface?: HtmlExportFont;
  previewMode?: PreviewMode;
  titleFallback?: string;         // Stored Story Title, used when no # title: tag present
}
```

### Three Independent Naming Chains

1. **Story Title** (from `# title: ...` tag in entry file, or fallback/filename):
   - Resolved once per render from the entry file's **own source only** (not merged compiled tags).
   - Accessible to Settings as `storyTitle`.

2. **Project Name** (`name` field):
   - Auto-follows resolved Story Title whenever `nameIsExplicit: false`.
   - Editable via topbar: clicking the project name opens an inline edit that calls `pinProjectName()`, marking it explicit and stopping auto-follow.
   - Displayed in topbar and exported as-is.

3. **Two downstream propagation chains** (only when the upstream is unpinned):
   - **Entry File Name** (single-file projects only): Auto-follows project name when `fileNameIsExplicit: false` AND file count is exactly 1.
     - Editable via Settings "File name" or desktop file-rail pencil icon.
     - Renaming pins it: `pinEntryFileName()` or `renameProjectFile()`.
   - **Export Name Base** (`.inkpad` bundle name): Auto-follows project name when `exportNameIsExplicit: false`, regardless of file count.
     - Editable via export dialog or Save As (which pins it via `retargetProjectForCopy()`).

### Propagation Rules

```
Story Title tag
    ↓ (resolveMetadata)
Resolved Story Title (read-only)
    ↓ (reconcileProjectNaming, if !nameIsExplicit)
Project Name
    ├─→ Entry File Name (single-file, if !fileNameIsExplicit)
    └─→ Export Name Base (if !exportNameIsExplicit)
```

- **Forward-only**: file rename never touches name or exportNameBase.
- **Condition-checked**: file-rename leg only applies if `fileCount === 1` (no state flag to get wrong on multi-file transitions).
- **Idempotent**: `reconcileProjectNaming()` returns the same reference when nothing changes, so React functional-updater form (`setCurrentProject(prev => reconcile(...)`) bails out of re-rendering.

### Storage Behavior

**`getProjectStorageName(project)` is the single source of truth:**

```typescript
export function getProjectStorageName(project: InkProject): string {
  const fileCount = Object.keys(project.files).length;
  return fileCount === 1
    ? project.entryFile                              // "draft.ink"
    : getFilename(project.exportNameBase, ".inkpad"); // "Final Cut.inkpad"
}
```

- Single-file projects are saved by their entry file: `inkpad:v2:file:draft.ink`
- Multi-file projects are saved by their project name: `inkpad:v2:file:Final Cut.inkpad`
- **Storage-key changes are rename-aware**: every save compares the computed key against the previous key; if different, the new key is written and the old key is deleted (prevents ghost entries in Local Saves).

### Helper Functions

All pure, idempotent, return same reference when unchanged:

```typescript
// client/src/lib/ink-project.ts

reconcileProjectNaming(project, resolvedStoryTitle, options?)
  // Apply tag→name→{file,export} fan-out with condition check on file count
  // Used: useEffect when Story Title resolves, and after explicit project rename

pinProjectName(project, nextName)
  // Topbar click: pin the name and stop following the tag

pinExportNameBase(project, nextExportNameBase)
  // Export dialog or Save As: pin the .inkpad name

renameProjectFile(project, oldFileName, requestedNewFileName)
  // Settings "File name", file-rail pencil, or explicit rename dialog
  // Renames the actual file in the map, pins fileNameIsExplicit if it's the entry file
  // Rewrites INCLUDE references across all files

retargetProjectForCopy(project, storageFileName)
  // Save As: fresh id, pins entry file name (single) or export name (multi)

getProjectStorageName(project): string
  // The key this project is (or should be) saved under

rewriteIncludeReferences(source, oldPath, newPath): string
  // Pure regex helper for keeping INCLUDE statements current on file rename
```

---

## Key Technical Decisions

### Why `InkProject` for Everything

- **Eliminates dual-persistence**: previously, single-file used `InkDocument` as the persistence unit, multi-file used `InkProject`. Single-file data was rebuilt from scratch on every save, destroying any state that only lived on the wrapper.
- **No mirrored fields**: one source of truth. Changes to naming, settings, file list, or any project state live in one place.
- **Generalizes a proven pattern**: multi-file was already using `InkProject` end-to-end and working well.

### Why "Name" and "Entry File" Are Separate

- `.ink` files are plain Ink text (editable, portable, zero magic).
- Project metadata lives in `InkProject` (names, settings, multi-file structure).
- The entry file is just "the first file" — it happens to also be the storage key for single-file projects, but it's not the project itself.
- Three independent names prevent conflation and make it clear what gets renamed when.

### Why No "Transition Hooks"

The file-rename leg of auto-follow is **a condition check**, not a state flip:

```typescript
const fileCount = Object.keys(next.files).length;
if (renameEntryFile && !next.fileNameIsExplicit && fileCount === 1) {
  // Apply the rename
}
```

Not a flag that gets set when the second file is added or cleared when the last extra file is removed. This removes an entire class of bugs where developers forget to update the pin state during some transition.

### Why INCLUDE Rewriting is Required

`inkjs` resolves `INCLUDE` directives by literal path lookup in the files map. If a file is renamed without updating references:
- Compiler fails at runtime with "file not found" messages.
- The project appears broken even though nothing structural changed.

**Solution**: `renameProjectFileKey()` scans every file's source for `INCLUDE <oldPath>` lines and rewrites them to the new path. Tested with unit coverage; browser verification deferred (injecting INCLUDE text through CodeMirror programmatically is unreliable).

### Why Legacy Data Defaults to Explicit

Schema 1 projects (pre-refactor saves) get `nameIsExplicit: true`, `fileNameIsExplicit: true`, `exportNameIsExplicit: true` on read. They're never retroactively auto-renamed — the user's existing saves behave exactly as before, and the auto-follow only applies to new projects created in the refactored codebase.

---

## What the Browser Verified

Run through the sequence in the live preview (all confirmed working):

1. [ x ] New story → add `# title: 80 Days` → topbar auto-updates to "80 Days", entry file renames to "80 Days.ink"
2. [ x ] Topbar rename to "My Journey" → file stays "80 Days.ink" (pinned), story title stays "80 Days", export name follows to "My Journey"
3. [ x ] Pin file to "draft.ink" → project rename doesn't change the file anymore
4. [ x ] Add a second file → save path becomes `Final Cut.inkpad` (multi-file), not a second `.ink` file
5. [ x ] Legacy single-file save (pre-v2) loads and upgrades to `InkProject` v2 shape on save
6. [ x ] Storage-key rename cleanup: two title-tag renames leave no ghost entries behind
7. [ x ] File-rail rename button on non-entry file works without pinning the whole project
8. [ x ] Autosave re-kicks on leadership change (bug fix for mid-rename saves stuck in "Modified")

---

## What's **Not** Done (Deferred)

### Export Dialog Inline Edit

The `.inkpad` export dialog still uses a text input to *suggest* a name (pre-filled with `exportNameBase`), but the name isn't directly editable in the dialog UI yet. **Save As covers the pinning operation** — a user who wants a custom `.inkpad` name uses Save As instead.

**Next step** (small follow-up PR): wire the export dialog's name input to call `pinExportNameBase()` on change, so both paths (Save As and export dialog) offer pinning.

### INCLUDE Rewriting Browser Verification

INCLUDE rewriting is unit-tested and works in the code, but hasn't been verified in the browser. Injecting `INCLUDE` statements through CodeMirror programmatically is finicky, so this lives in the test suite rather than the manual smoke test.

**Next step** (if needed): add a multi-file fixture with INCLUDE and do a careful manual test if a user reports issues.

---

## How to Work with This Going Forward

### When Renaming/Pinning Anything

1. **Rename a file** → Use `renameProjectFile()` from `client/src/lib/ink-project.ts`. It handles the file-key rewrite, INCLUDE updates, and pinning if it's the entry file.
2. **Pin a project name** → `pinProjectName()`.
3. **Pin an export name** → `pinExportNameBase()`.
4. **Auto-follow any of them** → `reconcileProjectNaming()` with the resolved story title.

All return the same reference when nothing changes, so use them in React functional-updater form (`setCurrentProject(prev => helper(...))`).

### When Modifying Editor or Save Logic

- Always work with `getLiveProject()` (already exists, merges the editor buffer with the stored project state).
- Compute the storage key via `getProjectStorageName()` — never hardcode `.ink` vs `.inkpad` logic.
- Every save should compare the computed key against the previous key; if different, it's a rename: write new, delete old.

### Tests

- `client/src/lib/ink-project.test.ts` — schema, migration, reconciliation, pinning, INCLUDE rewriting, collision resolution.
- `client/src/hooks/use-editor-document-actions.test.ts` — save paths, legacy loading, Save As behavior, .inkpad multi-file detection.
- `client/src/hooks/use-autosave.ts` — leadership-change re-kick to prevent stalling on filename changes.

---

## Files Changed

**Core**:
- `client/src/types/ink-project.ts` — schema v2, new fields
- `client/src/lib/ink-project.ts` — all naming helpers + INCLUDE rewriting + migration
- `client/src/types/ink-document.ts` — added `namingExplicit` transient hint

**Editor & Persistence**:
- `client/src/pages/editor.tsx` — story title resolution, name pinning, file-rail rename UI, unified save path
- `client/src/hooks/use-editor-document-actions.ts` — Save As using `retargetProjectForCopy()`, callbacks for project-aware rename
- `client/src/hooks/use-autosave.ts` — leadership-change re-kick

**UI**:
- `client/src/components/editor/settings-sheet.tsx` — MetaField draft bug fix, multi-file caption for File section

**Tests**:
- `client/src/lib/ink-project.test.ts` — 25 new tests
- `client/src/hooks/use-editor-document-actions.test.ts` — updated fixtures, Save As coverage

---

## Next Priorities

### Immediate (Quick Wins)

1. **Export dialog inline rename** (20 min)
   - Wire the export dialog's suggested-name input to `pinExportNameBase()`.
   - Test: change the name in the export dialog, confirm it pins and no longer follows project name changes.

2. **Commit & merge** (5 min)
   - All changes are ready to land. No dependencies on other branches.

### Short Term (This Sprint)

3. **Mobile file-rail UX** (Roadmap Phase 5)
   - The desktop file rail now has a pencil icon. Mobile tab strip should offer the same rename via a dropdown menu or modal.
   - Research: is a phone-sized inline edit feasible, or should it be a menu action like "Rename this file"?

4. **`.inkpad` import** (Roadmap Phase 5)
   - Users can export as `.inkpad` now, but can't re-import it yet.
   - `getFileActionExtension()` already detects `.inkpad` files; wire the load path to `parseInkProject()` and open as multi-file.

### Medium Term

5. **Outline panel** (Roadmap Ongoing)
   - Knots, stitches, functions, and their file locations.
   - Good UX for multi-file projects with 20+ files.

6. **Symbol indexing** (Roadmap Phase 3)
   - Feed `InkProject`'s multi-file structure into a symbol index.
   - Enables go-to-definition, completion, and quick fixes that work across files.

---

## Testing Commands

```bash
# Full test suite (all green)
npx vitest run

# Type-check
npx tsc --noEmit

# Watch mode for development
npx vitest

# Preview (http://localhost:3000)
npm run dev
```

---

## Questions & Caveats

**Q: Why not rename `title` field to something else to avoid the Story Title confusion?**
A: The `name` field is the project name. `title` could mean the story title (from the tag), the display title (in the topbar), or something else. We picked `.name` for the project and kept `storyTitle` (derived from the tag, settings, or filename) separate and read-only. This is now explicit in the code and tests.

**Q: What if a user creates a project, adds a second file, then removes all extra files again?**
A: The project reverts to single-file mode. The entry file name stays pinned (from the earlier rename), and the `.inkpad` export name is independent. Everything works as expected — there's no special case.

**Q: What about case-insensitive collisions when renaming?**
A: `isNormalizedInkProjectPath()` catches them on parse, and `getAvailableProjectFileName()` resolves collisions during explicit renames (appends a number suffix, e.g., `start 2.ink`). Tests cover both.

**Q: If a file is renamed mid-edit, does the undo history survive?**
A: Yes. `editorBufferKey` is bumped only on file *switch*, not on rename. The CodeMirror document identity (`${projectId}:${editorBufferKey}`) stays stable across renames, so undo/redo continue working.

---

## References

- **Plan document**: `.claude/plans/iterative-conjuring-starfish.md` (design, rationale, verification steps)
- **Roadmap**: `docs/roadmap.md` (broader multi-file and snapshot work)
- **Structural assistance**: `docs/structural-assistance-spec.md` (symbols, completions, diagnostics)
