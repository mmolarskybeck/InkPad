# InkPad

A modern, browser-based IDE for writing and testing Ink stories. InkPad provides a complete development environment for Inkle Studios' Ink scripting language, featuring real-time compilation, interactive story preview, and comprehensive debugging tools.

![InkPad Screenshot](https://via.placeholder.com/800x400?text=InkPad+IDE+Screenshot)

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
- **Editor**: Monaco Editor with custom Ink language support
- **UI Components**: Radix UI with Tailwind CSS
- **Backend**: Express.js with TypeScript
- **Ink Compiler**: Native Inklecate integration
- **Build Tool**: Vite with ESBuild

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/marinamolarsky-beck/InkPad.git
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
npm start
```

## Deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/marinamolarsky-beck/InkPad)

1. Connect your GitHub repository to Vercel
2. Configure the build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/marinamolarsky-beck/InkPad)

1. Connect your GitHub repository to Netlify
2. Configure the build settings:
   - Build Command: `npm run build`
   - Publish Directory: `dist`

## Project Structure

```
InkPad/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   ├── pages/         # Page components
│   │   └── data/          # Sample data and stories
│   └── index.html
├── server/                # Backend Express server
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   └── storage.ts        # Data storage utilities
├── shared/               # Shared TypeScript schemas
└── package.json
```

## API Endpoints

- `POST /api/compile` - Compile Ink source code to JSON
- `GET /api/stories` - List saved stories (future feature)
- `POST /api/stories` - Save story (future feature)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Story persistence and user accounts
- [ ] Collaborative editing
- [ ] Plugin system for custom Ink extensions
- [ ] Advanced debugging tools
- [ ] Export to multiple formats (HTML, PDF, etc.)
- [ ] Mobile-responsive editor

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Inkle Studios](https://www.inklestudios.com/) for creating the Ink scripting language
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the powerful code editor
- [Radix UI](https://www.radix-ui.com/) for accessible component primitives

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/marinamolarsky-beck/InkPad/issues) on GitHub.
