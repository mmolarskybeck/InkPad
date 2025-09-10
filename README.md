# InkPad

A modern, browser-based IDE for writing and testing Ink stories. InkPad provides a complete development environment for Inkle Studios' Ink scripting language, featuring real-time compilation, interactive story preview, and comprehensive debugging tools. MVP is 100% client-side; no backend required.

## Features

- **Real-time Ink Compilation**: Write Ink stories with instant feedback and error checking
- **Interactive Story Preview**: Test your stories directly in the browser with choice navigation
- **Variable Inspector**: Monitor and debug story variables in real-time
- **Syntax Highlighting**: Full Ink syntax support with Monaco Editor
- **Story Navigation**: Jump between knots and navigate your story structure
- **Import/Export**: Load and save Ink files locally
- **Modern UI**: Clean, VS Code-inspired interface with dark theme

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Editor**: Monaco Editor via @monaco-editor/react (custom Ink highlighting)
- **Runtime**: inkjs (compilation and runtime in a Web Worker)
- **Styling**: Tailwind CSS + shadcn/ui
- **Build Tool**: Vite (ESM), ES Module workers enabled
- **Backend**: _None for MVP_ (planned: cloud storage + auth)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mmolarskybeck/InkPad.git
cd InkPad
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
# Deploy the static 'dist/' folder to Vercel/Netlify/GitHub Pages/etc.
```

## Deployment

This is a static SPA; no serverless functions are required for the MVP.

### Cloudflare Pages

Cloudflare Pages is ideal for this static Vite + Web Worker app (workers are bundled by Vite; no server runtime needed).

1. In the Cloudflare dashboard, create a new Pages project and connect this GitHub repository.
2. Set build configuration:
   - Framework preset: None (or "Vite")
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: (leave blank)
3. (Optional) Environment variables (Pages > Settings > Environment Variables):
   - `VITE_PUBLIC_URL` = your production URL (e.g. `https://<project>.pages.dev` or custom domain)
4. Ensure SPA routing works:
   - The file `public/_redirects` with `/* /index.html 200` is included so client-side routing falls back to `index.html`.
5. Save and deploy. Subsequent pushes to the selected branch trigger automatic builds.

Local production preview prior to deployment:
```bash
npm install
npm run build
npm run preview
# Open http://localhost:4173
```

Custom domain:
1. Add domain in Pages project settings.
2. Update DNS to the provided Cloudflare Pages CNAME.
3. Wait for SSL to provision (usually a few minutes).

If later you add a backend or need serverless logic, you can introduce Cloudflare Workers separately without changing this static Pages setup.

## Project Structure

```
InkPad/
├── client/                 # React (Vite) app
│   ├── src/
│   │   ├── components/     # Editor, Preview, Toolbar, panels
│   │   ├── lib/            # Monaco setup, ink helpers, compiler worker
│   │   ├── pages/          # App shell / layout
│   │   ├── data/           # Sample stories
│   │   └── styles/         # Tailwind/shadcn
│   └── index.html
├── public/                 # Static assets
├── vite.config.ts          # ESM workers, aliases
└── package.json
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### Near-Term (MVP polish)

- Performance pass on worker compile debounce
- Usability: onboarding tooltips, keyboard shortcuts
- Accessibility: focus management, ARIA for panes
- Develop useful live error markers
- Onboarding flow and usability polish

### Cloud Save & Auth (Planned)

- Choose provider (Supabase / Firebase / GitHub OAuth + storage / Vercel KV + Blob)
- Add auth (email magic link or OAuth)
- Save/Load to cloud with offline fallback (LocalStorage)
- Document privacy considerations (files never leave browser unless user opts in)

### Stretch

- Graph view (React Flow)
- Dialogic export (Godot 4.x)?
- Collaborative editing (later)

MVP will remain fully usable offline; cloud features are opt-in.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Inkle Studios](https://www.inklestudios.com/) for creating the Ink scripting language
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the powerful code editor
- [Radix UI](https://www.radix-ui.com/) for accessible component primitives

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/mmolarskybeck/InkPad/issues) on GitHub.
