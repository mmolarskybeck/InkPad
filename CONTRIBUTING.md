# Contributing to InkPad

InkPad is an independent, browser-based editor for writing, testing, and exporting stories written in Ink. Contributions are welcome, especially bug reports, usability feedback, accessibility fixes, and focused feature work.

## Getting help, asking questions, or reporting issues

### I have a question

Before opening a new issue, please check whether the question has already been asked.

If you do not find an existing issue, open a new one and include as much context as you can.

Useful details include:

- What you were trying to do
- What you expected to happen
- What actually happened
- Your browser and operating system
- Whether you were using the live app or running InkPad locally

### I found a bug

Please open an issue with a clear description of the problem.

If possible, include:

- Steps to reproduce the bug
- A small `.ink` example that triggers the issue
- Screenshots or screen recordings
- Browser and operating system
- Console errors, if any

If you already know how to fix the bug, pull requests are welcome.

### I have a feature idea

Feature ideas are welcome, but InkPad aims to stay lightweight, local-first, and focused on writing/testing ink stories in the browser.

Good feature proposals should explain:

- What problem the feature solves
- Who it helps
- How it fits InkPad’s current scope
- Whether it can be implemented without making the app harder to use

InkPad is not trying to fully replace every advanced feature of Inky, VS Code, or a full game engine pipeline. Large features may be better discussed in an issue before implementation.

## Current project priorities

Near-term priorities include:

- Complete accessibility verification and polish for Settings and preview modes
- Ink-aware completions and reusable code snippets
- Shareable project snapshot links without accounts
- Incremental multi-file support built on Ink `INCLUDE`
- Persistence and multi-tab conflict hardening

Small, focused improvements are usually easier to review than large rewrites.

The detailed checklist lives in [docs/roadmap.md](./docs/roadmap.md).

## Local development

Prerequisites:

- Node.js 18+
- npm

Clone the repository:

```bash
git clone https://github.com/mmolarskybeck/InkPad.git
cd InkPad
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local development URL shown in your terminal, usually:

```text
http://localhost:5173
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Project structure

```text
InkPad/
├── client/                 # React/Vite app
│   ├── src/
│   │   ├── components/     # Editor, preview, toolbar, panels, UI primitives
│   │   ├── features/       # Focused import/export feature helpers
│   │   ├── hooks/          # Editor, story runtime, autosave orchestration
│   │   ├── lib/            # Project model, preferences, persistence, compiler helpers
│   │   ├── pages/          # App shell and layout
│   │   ├── data/           # Sample stories
│   │   ├── types/          # Project, worker, and runtime contracts
│   │   └── workers/        # inkjs compiler worker
│   └── index.html
├── docs/                   # Roadmap and implementation notes
├── core.md                 # Canonical architecture overview
├── vite.config.ts
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── package.json
```

## Development guidelines

### Keep InkPad local-first

The current version of InkPad runs entirely in the browser. Projects are saved locally and no account is required.

Changes should preserve that local-first workflow unless they are explicitly part of an opt-in cloud feature.

### Avoid unnecessary backend dependencies

InkPad should remain usable as a static web app. The planned sharing model is an immutable project snapshot link, not an account system. Do not add backend services, server requirements, or account-based features without prior discussion.

### Keep the writing/testing loop fast

The core loop is:

1. Write Ink
2. Run or compile
3. Preview the story
4. Inspect errors or variables
5. Revise

Changes should support that loop rather than distract from it.

### Prefer focused UI changes

InkPad’s interface is inspired by code editors, but it is primarily for writers and narrative designers. Favor clarity, readable labels, and predictable behavior over visual complexity.

### Be careful with user data

InkPad users may be writing original stories. Avoid changes that risk data loss.

Before submitting changes that affect saving, loading, importing, exporting, local storage, or editor state, test carefully.

The portable domain object is `InkProject`. Browser-wide user preferences remain separate from project content. Current display title, author, preview mode, and optional remembered HTML-export profile are stored with local single-file documents until the portable project schema supports metadata. Display titles and filenames are independent. HTML export overrides do not rewrite Ink source. See [core.md](./core.md).

## Pull request guidelines

Before opening a pull request:

1. Make sure the app runs locally.
2. Test the feature or bug fix in the browser.
3. Run the test, typecheck, and production build commands.
4. Keep the change focused.
5. Update documentation if the behavior changes.

A good pull request should include:

- A clear description of what changed
- Why the change was made
- Screenshots or screen recordings for UI changes
- Notes about testing

## Code style

InkPad uses TypeScript, React, Tailwind CSS, and shadcn/ui.

Please follow the existing code style and component patterns where possible.

Before opening a pull request, run:

```bash
npm test
npm run check
npm run build
```

## Working with Ink, inkjs, and Inky

InkPad builds on the ink ecosystem but is an independent project.

ink and Inky are created by Inkle Studios and released under the MIT License. InkPad uses `inkjs` for Ink compilation/runtime support in JavaScript.

InkPad should always preserve compatibility with ink and inkjs. If you notice a difference between InkPad behavior and the reference Ink/Inky behavior, please document it clearly in the issue or pull request.

InkPad should not imply that it is an official Inkle or ink project.

## Documentation contributions

Documentation improvements are very welcome.

Useful documentation contributions include:

- Example ink stories
- Troubleshooting notes

## License

By contributing to InkPad, you agree that your contributions will be licensed under the project’s MIT License.

See [`LICENSE`](./LICENSE) for details.

Third-party acknowledgments and license notices are listed in `THIRD_PARTY_NOTICES.md`.
