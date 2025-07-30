# InkPad – Browser-Based Ink IDE

## Overview

**InkPad** is a lightweight, modern web application for writing and testing stories written in [Inkle Studios’ Ink scripting language](https://www.inklestudios.com/ink/). Designed to work entirely in the browser, InkPad requires no installation or backend service. It's ideal for writers, narrative designers, and students looking for an intuitive, in-browser alternative to Inky, the official desktop-only editor.

InkPad compiles and runs Ink scripts on the client side using [`inkjs`](https://github.com/y-lohse/inkjs), with syntax highlighting and editing support provided by Monaco Editor.

## Key Features

- **Split View Interface**
    
    Write Ink code on the left, and preview interactive story output on the right. Users can run and re-run stories with a single click.
    
- **Live Error Panel**
    
    Errors are parsed using a debounced inkjs compiler and shown with inline markers and a collapsible error panel.
    
- **Knot Navigator**
    
    Dropdown menu listing all knots in the story. Clicking a knot scrolls the editor to its definition.
    
- **Variable Inspector**
    
    Runtime variables are displayed in real time during story execution.
    
- **Local Persistence**
    
    Save and load stories using browser `localStorage`. Export `.ink` or compiled `.json` files directly.
    
- **No Backend Required**
    
    The app compiles stories in-browser using a Web Worker for speed and isolation. No external API or server is needed to run stories.
    

## Architecture

### App Structure

```
InkPad/
├── client/                 # React frontend (Vite app)
│   ├── src/
│   │   ├── components/     # UI components (Editor, Preview, Toolbar, etc.)
│   │   ├── lib/            # Compiler logic, Ink helpers, Monaco setup
│   │   ├── pages/          # Main app layout
│   │   ├── data/           # Sample stories
│   │   └── styles/         # Tailwind + custom styles
│   └── index.html
├── public/                 # Static assets
└── vite.config.ts          # Build config
```

### Frontend Stack

- **React 18 + TypeScript**
    
    Component-based SPA built using React and TypeScript.
    
- **Vite**
    
    Fast build tool with optimized dev server and ES module support.
    
- **Tailwind CSS + shadcn/ui**
    
    Utility-first CSS and accessible UI primitives for styling.
    
- **Monaco Editor**
    
    Embedded code editor with custom Ink language registration for syntax highlighting and code navigation.
    
- **inkjs**
    
    The official JavaScript runtime for Ink, compiled to run in a Web Worker to offload heavy parsing.

## Ink Compilation Flow

1. User types Ink code into Monaco Editor.
2. A debounced function sends the code to a Web Worker that runs `inkjs.Compiler`.
3. If parsing succeeds, the compiled story is instantiated and previewed in the right panel.
4. Compilation errors are extracted and shown both inline and in the error panel.
5. Users can click “Run” or “Restart” to re-initialize the story.
6. Variable state and knot progress are monitored in real time.

## Deployment

InkPad is a fully static frontend application. It can be deployed via any static hosting platform such as:

- **Vercel**
- **Netlify**
- **GitHub Pages**
- **Replit**
- **Self-hosted (e.g. nginx or S3)**

No backend or server runtime is required.

## Development

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
git clone https://github.com/mmolarskybeck/InkPad.git
cd InkPad
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
```

Output is located in `client/dist/`.

## Project Status

This version of InkPad focuses on:

- Local authoring and testing of Ink stories
- Live code editing, error handling, and previewing
- Fully browser-based execution

Future work may include:

- Story saving via cloud services such as Dropbox, Google Drive, etc.
- Visual story graphing

## License

MIT. See the LICENSE file for full terms.

## Acknowledgments

- [Inkle Studios](https://www.inklestudios.com/) for the Ink language
- [inkjs](https://github.com/y-lohse/inkjs) for client-side compilation
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for code editing
- shadcn/ui for composable, accessible UI components