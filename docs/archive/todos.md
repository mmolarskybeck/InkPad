# To Do

## Structural assistance next slices (2026-07-04)

Canonical detail lives in `docs/structural-assistance-spec.md`.

### Recommended next slice
* **Mobile target picker + quick-fix sheet** — mobile-visible surfaces for the same symbol/fix data already used on desktop.

### Then
* **Fixture-backed diagnostic expansion** — add one inkjs coded diagnostic at a time, starting with an inkjs fixture; empty choice is the likely first candidate.
* ~~**Ink Info hover** — reuse the resolver to show target identity and a Go to definition action.~~
* ~~**Symbol resolution + go-to-definition** — add `resolveSymbolAtPosition`, then wire Cmd/Ctrl-click and a keyboard command for jumping from `-> target` / `-> knot.stitch` to the target declaration.~~
* ~~**Choice/gather continuation on Enter** — pressing Enter at the end of `* Some choice` inserts a matching marker (`* `, `** `, `+ `, …) on the next line, markdown-list style; Enter on an empty marker clears it instead. Same custom-keymap pattern as the knot Enter handler in `auto-close.ts`.~~
* ~~**Block comment auto-close** — typing `/*` inserts ` */` with type-over, reusing the input-handler pattern in `auto-close.ts` (CodeMirror's `closeBrackets` only handles single-character pairs).~~

## After naming refactor (2026-07-03)

### Quick wins
* **Export dialog inline rename** — wire the suggested-name input to `pinExportNameBase()` so users can edit the `.inkpad` name in the export dialog, not just in Save As. (20 min)
* ~~**`.inkpad` import** — detect, validate, and open `.inkpad`/ZIP bundles as multi-file projects.~~

### Documentation
* Update project onboarding with the new naming model: independent story title, project name, and file names.
* Add a "Project structure" help page explaining `.ink` vs `.inkpad` vs internal InkProject model.

## rn

* add a bit more whitespace in gutter on desktop, between line numbers and code?
* show/hide multi file tabs somehow on mobile?
* settings toggle to show/hide code symbols/snippets toolbar on mobile
* consider replacing Save success modal w an animation on the save button itself (state for saving, success, then goes back to neutral/rest? perhaps…)
	* consider if we should still have modals sometimes (for save errors, etc), if so when, polish their appearance/make them more noticeable if actually important, and try to avoid modals for things that are not supposed to be that important and are just giving feedback (example - modal for failed save, but not for success? prefer animated/multi-state existing UI chrome for small actions like save success etc)
	* fold save as into save menu, as caret dropdown
	* make export initial menu a dropdown, rather than modal, and consider making export html settings modal into a popover that appears next to the export button, that feels like an extension or transformation of the dropdown menu itself?
* consider making code snippets a popover w multiple columns/expandable tiers instead of a drawer/vaul?
* polish settings menu
* more graceful handling for failed exports - export fails on failed compile for json/html but not for raw ink, which is sensible, but should be better explained
	* The failure state should be helpful, not punitive: *"Couldn’t export playable HTML because the story has compile errors. {possibly display list of errors, this should be truncated or scrollable in case there are many errors} You can still export as .ink to save/backup your work."*
* fix html export
	* Default = playable html. One self-contained file. Includes bundled `inkjs`, story JSON, theme CSS, title, author, and InkPad player code.
	* Web folder / ZIP. For people uploading to itch.io, Neocities, GitHub Pages, etc. Includes local assets, no CDN required.
* story typeface applies to HTML export only - we should make this affect the story preview in InkPad, too (same controls/setting, just affects 2 things instead of 1)

## Refinements

### Fixes to Settings / theme handling
* refine settings menu layout and microcopy

### Fixes to open/import flow
* Rename "import .ink from disk" to "Import story..." (maybe)
* rename "open" indicator of current open file in Open dropdown to "current"

## Features to develop
* word count, knot count, stitch count
* Fast-forward on recompile 
* Inline jump-to-definition (Cmd/Ctrl-click on -> diverts)
* Mobile target picker
* Quick-fix sheet / Problems-panel fix buttons
* Quick insert tool / palette
* Custom project snippets
* Multi-file project refinements
	* mobile file-rail UX
	* export/import as `.inkpad` format is complete; continue hardening validation and persistence
* [[Monaco features to build out]]

### Done
* ~~URGENT: fix broken "Modified" indicator in code editor top bar~~
	* ~~currently not updating at all - should either go between "Saved" and "Modified" or just say "Modified" when save state is dirty~~
* ~~URGENT: error handling~~
	* ~~Line 1 - Error processing choice: Ink had 1 error. It is strongly suggested that you assign an error handler to story.onError. The first issue was: RUNTIME ERROR: ran out of content. Do you need a '-> DONE' or '-> END'?~~
* ~~Simplify status dots~~
	* ~~Remove status dot for story preview~~
		* ~~Indicate story preview is stale with a "Re-run to update preview" option that is clickable perhaps?~~
	* ~~Ensure status dots for saved/unsaved files match the "modified" indicator, and considered removing one of the other~~
* ~~allow copy/paste from context menu in Monaco editor~~
* ~~make light preview theme match app light mode~~
* ~~refine how titles and author name are handled in settings when defined in source via tags~~
	* ~~what if by default, editing these adds the tags to your ink source, and you can enter content into these fields and choose to overwrite the source on button click - not necessarily a modal but a confirmation button w brief warning message appears when you write in a new title/author~~
	* ~~add theme selection for story preview to the settings which is independent of the editor theme color~~
	* ~~[[Story Metadata Settings Flow]]~~
* ~~when renaming file name in settings, the drawer should NOT go away once you confirm renaming via modal~~
* ~~Refine Problems panel~~
	* ~~currently parse TODOs as errors so compilation fails~~
		* ~~Update the Problems panel to render three severity levels with distinct visual treatment: red for errors, amber for warnings, muted/dim with a comment-style icon for TODOs. Jump-to-line works the same way for all three since they all carry line numbers. (red for errors and amber for warnings currently already implemented)~~
		* ~~currently, TODO: is highlighted by syntax and TODO is not, fix this~~
* ~~ASAP: harden text entry for author/title & other settings that may allow sql injection, etc.~~
* ~~test why this doesn't work correctly: [https://github.com/nbush/ink_roguelike/blob/master/ink_roguelike.ink](https://github.com/nbush/ink_roguelike/blob/master/ink_roguelike.ink)~~
	* ~~[[ink rougelike]]~~
* ~~* [[Performance Accessibility SEO cleanup]]~~
* ~~Autocompletions: desktop divert targets plus explicit snippet completion~~
