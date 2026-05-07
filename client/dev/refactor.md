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

File loading may surprise users: handleLoad (line 102) prefers localStorage content with the same filename over the file the user just opened. Same-name imports can silently load stale browser storage.

Follow-up: audit whether `StoryPreview` still owns compile orchestration. If it has a real independent compile lifecycle, move compile ownership into `useInkStory` or a dedicated `useInkCompiler` hook so `StoryPreview` only receives runtime/preview state.

# Suggested Next Refactor

The next useful slice is file loading. `handleLoad` currently prefers localStorage content with the same filename over the file the user just opened, so same-name imports can silently load stale browser storage. Move local story persistence/import behavior into a `features/files/useLocalStories.ts` boundary and make import semantics explicit.

Keep TypeScript and production build green after each slice:

```bash
npm run check
npm run build
```
