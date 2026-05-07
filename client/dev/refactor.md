I took a codebase pass. High-level: InkPad has a good MVP architecture: a static Vite/React SPA, Monaco as the editing surface, inkjs compilation isolated in a Web Worker, and local browser storage for persistence. That is the right shape for a browser-only Ink IDE.

# What Looks Strong

Clear client-first app shell: editor.tsx (line 15) coordinates the editor, preview, problems panel, variables, autosave, and menu.

Compiler isolation is a good call: ink-compiler.ts (line 39) creates a worker per compile, and ink-compiler.worker.ts (line 17) keeps inkjs/full off the UI thread.

The worker contract is unusually well documented: worker-messages.ts (line 1). That’s a healthy architectural habit.

Monaco setup is centralized in monaco-setup.ts (line 12), which is exactly where that complexity belongs.


# Main Architecture Concerns

Live compile is architected but not wired. useInkStory exposes debounced compilation, but handleCodeChange (line 61) only updates code; it does not call compileStory. So the docs promise live errors, but current code only compiles on initial load, file load, Run, or export.

TopMenu has too much domain logic. It handles file open, export, JSON compile, HTML templating, ZIP creation, and UI state in one component: top-menu.tsx (line 86). I’d move export/build operations into a story-export service/hook.

Deployment config has architectural drift. The docs say static/no backend, but vercel.json (line 12), netlify.toml (line 7), and test-compilation.js (line 17) still reference API compiler routes. The server/ files are present but empty.

npm run check currently fails because sample-story-old.ts (line 5) contains raw Ink after TypeScript exports. That file should become .ink, be excluded from TS, or be wrapped as a string.

File loading may surprise users: handleLoad (line 102) prefers localStorage content with the same filename over the file the user just opened. Same-name imports can silently load stale browser storage.

# Suggested Next Refactor

I’d do this in order: fix sample-story-old.ts so TypeScript passes, remove or align the stale API/server deployment config, wire debounced compile from handleCodeChange, then split TopMenu export logic into a dedicated useStoryExport or StoryExportService.