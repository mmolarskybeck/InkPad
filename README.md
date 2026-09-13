# InkPad

InkPad is an independent, browser-based editor for writing, testing, and exporting interactive stories written in [ink](https://www.inklestudios.com/ink/), [Inkle Studios](https://www.inklestudios.com/)’ open-source scripting language for branching narratives.

InkPad gives writers and narrative designers a lightweight development environment in the browser: write ink code, run it instantly, test choices, inspect variables, debug errors, and export your story.

InkPad is local-first and runs entirely in the browser. No installation or account sign-up required.

> InkPad is an independent project and is not affiliated with or endorsed by Inkle Studios.

[Learn more here](https://shadowbox.games/inkpad)

## Use InkPad

Open the live web app:

**[https://inkpad.shadowbox.games](https://inkpad.shadowbox.games/)**

Start with the included sample story, write your own, or import an existing `.ink` file or `.inkpad` project bundle.

## Features

- **ink code editor** — Write ink in a CodeMirror 6 editor with custom ink syntax highlighting and folding.
- **Live compilation** — Check how your story plays as you type the code.
- **Interactive preview** — Play through your story in the browser. When an edit compiles, InkPad restores the current playthrough where it can. When an edit fails, it keeps the last successful preview available.
- **Transcript and scene preview modes** — Keep a playthrough history visible or focus on the current passage.
- **Choice navigation** — Step back to the previous choice or restart the story from the preview.
- **Problems and quick fixes** — View compiler errors with file and line information, jump to the relevant code, and apply supported fixes for common structural mistakes.
- **Ink-aware editing** — Complete divert targets, variables, lists, and functions; inspect knots and stitches on hover; and go to definitions within or across project files.
- **Insert palette** — Search syntax helpers, reusable examples, and snippets with `Cmd/Ctrl+Shift+I`. Create, edit, and delete custom snippets stored in the current browser.
- **Variable inspector** — Monitor story variables while testing.
- **Story navigation** — Jump between knots and go directly to their definitions in the editor.
- **Settings and accessibility** — Choose dark, light, or high-contrast themes. Adjust editor and preview font sizes. Control editor word wrap and manage privacy preferences.
- **Story details** — Store an author name and preferred preview mode with each local story.
- **Project manager** — Search, sort, open, rename, duplicate, expand, and delete locally saved projects from one project-focused view.
- **Local saves and recovery** — Save and manage multiple stories in your browser, with recovery drafts and local snapshots.
- **Multi-file projects** — Organize stories into multiple `.ink` files with `INCLUDE` support, project-relative paths, an entry-file model, and a collapsible project file rail.
- **Independent naming** — Story title (from `# title:` tag), project name (display label), and file names are independently editable.
- **Import/export** — Import `.ink` files or `.inkpad`/ZIP project bundles, and export your work as `.ink` source, `.inkpad` (full-fidelity project bundle), JSON, or a playable web story.
- **Responsive layout** — Use a desktop split view or a mobile editor/preview tab layout. Controls condense as panes get narrower, with shortcuts shown in menus and tooltips where available.

## Saving and privacy

InkPad is local-first.

Stories are currently saved in your browser’s local storage. Your writing is not uploaded to a server, and no account is required.

InkPad includes basic, privacy-preserving analytics to track coarse events (like app load, run times, or settings changes) using sanitized URLs. This is strictly opt-out and can be disabled completely in the Settings menu.

Because browser storage is local to your device and browser, you should export `.ink` files or `.inkpad` bundles regularly for backup or to move projects between devices.

InkPad separates browser-wide preferences from story-specific settings:

- InkPad theme, story theme, editor font size, preview font size, and word wrap apply across InkPad in the current browser.
- Author name and transcript/scene preview mode are stored with the current local story.
- Custom snippets are stored separately in the current browser. They are available to all local projects but are not included in `.ink` or `.inkpad` exports.

Plain `.ink` files contain Ink source only. To preserve project metadata (author, preview settings, file structure, story title) across devices or browsers, export as `.inkpad`, which bundles all files and settings together. `.ink` files are portable and can be opened in other editors; `.inkpad` files are InkPad-specific and preserve full project fidelity.

## Import and export

InkPad can import:

- Editable `.ink` source files (single-file stories)
- `.inkpad` bundles (multi-file projects with full metadata)

Export options include:

- `.ink` source files (individual files or the entry file of a multi-file project) — portable, editable in other tools
- `.inkpad` bundles (complete project with all files, metadata, and settings) — preserves full fidelity for backup or transfer between devices
- `.json` export (compiled story data for developers)
- Playable web story as a ZIP containing `index.html`, with an optional author guide (`README.html`) and optional editable project (`source.inkpad`)

Compiled JSON and `index.html` are output formats, not editable InkPad projects. If you include `source.inkpad` in a playable export, that file can be opened in InkPad again. Source inclusion is off by default because anyone with the ZIP can read comments, alternate branches, and unpublished material.

## What is ink?

ink is a scripting language created by Inkle Studios for writing interactive narrative. It is used to structure branching stories, choices, variables, conditions, and dialogue for narrative games.

[ink](https://github.com/inkle/ink) and [Inky](https://github.com/inkle/inky) are open-source projects released by Inkle Studios under the MIT License.

Learn more:

- [ink - Tutorial for complete beginners](https://www.inklestudios.com/ink/web-tutorial/)
- [Writing with ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md)

## How InkPad works

- **Frontend:** React, TypeScript, Vite
- **Editor:** CodeMirror 6, with a vendored Ink language grammar based on [@mavnn/codemirror-lang-ink](https://github.com/mavnn/codemirror-lang-ink) 
- **ink compiler/runtime:** inkjs
- **Styling:** Tailwind CSS, Radix UI, and shadcn/ui
- **Backend:** None for the current version

InkPad compiles and runs ink client-side using inkjs in a Web Worker, so stories can be tested without sending code to a server.

## Roadmap

InkPad’s next planned work keeps the app local-first and account-free:

- Shareable, immutable project snapshot links
- Project persistence and multi-tab conflict hardening
- Mobile project-file navigation, mobile quick fixes, and accessibility verification

See [docs/roadmap.md](./docs/roadmap.md) for the phased implementation checklist.

## Contributing

Issues, bug reports, and feature suggestions are welcome.

For setup instructions, pull request guidelines, and project conventions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

InkPad is released under the MIT License. See [`LICENSE`](./LICENSE) for details.

InkPad relies on existing third-party open-source software. See `THIRD_PARTY_NOTICES.md` for acknowledgments and license notices.

## Acknowledgments

InkPad builds on the Ink ecosystem and other open-source tools.

- [Inkle Studios](https://www.inklestudios.com/) for creating ink and Inky
- [inkjs](https://github.com/y-lohse/inkjs) for Ink compilation/runtime support in JavaScript
- [CodeMirror 6](https://codemirror.net/) for the browser-based code editor
- [@mavnn/codemirror-lang-ink](https://github.com/mavnn/codemirror-lang-ink) as the basis for InkPad's vendored Ink language grammar
- [Tailwind CSS](https://tailwindcss.com/docs/installation/using-vite) for styling
- [Radix UI](https://www.radix-ui.com/) and [shadcn/ui](https://ui.shadcn.com/) for accessible interface primitives
- [Lucide](https://lucide.dev/) for icons
