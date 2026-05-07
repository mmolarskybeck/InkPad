I took a codebase pass. High-level: InkPad has a good MVP architecture: a static Vite/React SPA, Monaco as the editing surface, inkjs compilation isolated in a Web Worker, and local browser storage for persistence. That is the right shape for a browser-only Ink IDE.

# What Looks Strong

Clear client-first app shell: editor.tsx (line 15) coordinates the editor, preview, problems panel, variables, autosave, and menu.

Compiler isolation is a good call: ink-compiler.ts creates a worker per compile, and ink-compiler.worker.ts keeps inkjs/full off the UI thread.

The worker contract is now small, explicit, and typed in `worker-messages.ts`. Compile requests use `{ type: "compile", requestId, source }`, and responses use either `compile-success` or `compile-error` while echoing the same `requestId`.

Monaco setup is centralized in monaco-setup.ts (line 12), which is exactly where that complexity belongs.


# Main Architecture Status

Live compile now has one clear pathway. `handleCodeChange` updates source state and calls `compileLive`, while autosave remains reactive to `code`.

Compiler stale-result protection is in place. `useInkStory` creates a fresh requestId for both live and immediate compiles, and ignores responses whose returned requestId is not the latest known request. The worker remains focused on compiling Ink only; runtime playback, export, and storage stay outside the worker.

TopMenu export orchestration has been split out. `TopMenu` now stays close to toolbar composition: new, open, save, run, restart, knot navigation, and export command wiring. Export UI lives in `story-export-dialog.tsx`, file import/download helpers live under `features/files`, and export/build operations live under `features/export`.

Current export structure:

```text
components/editor/
  top-menu.tsx
  story-export-dialog.tsx

features/
  export/
    useStoryExport.ts
    storyExportService.ts
    htmlTemplate.ts
    zipExport.ts

  files/
    useFileImport.ts
    fileDownload.ts
```

This keeps JSON compilation, HTML template rendering, ZIP generation, and file download details out of `TopMenu`.

Deployment config has been aligned with the static SPA architecture. Vercel and Netlify now serve the Vite build output directly and fall back to `index.html` for client-side routes.

`npm run check` and `npm run build` pass. Old sample Ink is wrapped as TypeScript string data rather than raw Ink in a `.ts` file.

File loading behavior is now unsurprising. File import reads the selected file and `handleLoad` uses the imported filename/source directly, instead of preferring a same-name localStorage draft. Autosave can still persist that imported content after it is loaded.

State ownership remains intentionally local. No global app store, Zustand, Redux, large Context provider, event bus, or command manager is needed for the current app shape. `editor.tsx` owns the active document/title and coordinates the shell; `useInkStory` owns compile/runtime playback state; `useAutosave` owns save timing/status; import/export stay in focused feature helpers.

`StoryPreview` is now presentation-only for runtime output and choices. Its unused independent compile state/path was removed, leaving compile orchestration in `useInkStory` via the editor shell.

# Suggested Next Refactor

The next useful slice is local persistence ergonomics. Browser drafts now behave safely during import, but there is still no explicit user-facing draft/recovery surface. Keep this local and KISS for now: a future `features/files/useLocalStories.ts` boundary may make sense if the app adds recent files, draft recovery, snapshot browsing, or multi-document tabs.

Global state should wait for concrete pressure such as multi-document/project tabs, persistent user settings, recent files, cloud sync, or command palette state shared across distant components.

Keep TypeScript and production build green after each slice:

```bash
npm run check
npm run build
```
