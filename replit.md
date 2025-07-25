# InkPad - Open Source Browser-based Ink IDE

## Overview

InkPad is a web-based IDE for writing and testing Ink interactive fiction scripts. The application provides a split-view interface with a Monaco code editor on the left and a live story preview on the right, allowing writers to see their stories come to life in real-time. The project is built as a full-stack application with a React frontend and Express backend, designed to be a free, open-source alternative to desktop-only Ink editors.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Code Editor**: Monaco Editor with custom Ink syntax highlighting
- **State Management**: React hooks with TanStack Query for server state
- **Routing**: Wouter for client-side routing

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Development**: TSX for TypeScript execution in development
- **Build**: ESBuild for server bundling, Vite for client bundling

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in shared directory for type safety
- **Current Storage**: In-memory storage for development (MemStorage class)
- **Future**: PostgreSQL database with connection to Neon serverless

## Key Components

### Editor Interface
- **Split Layout**: Resizable panels with Monaco editor and story preview
- **Top Menu**: File operations (New, Save, Load, Export), run controls, knot navigation
- **Error Panel**: Collapsible panel showing Ink compilation errors with line highlighting
- **Variable Inspector**: Real-time display of Ink story variables during execution

### Ink Integration
- **Compiler**: Custom Ink compiler using inkjs library
- **Error Handling**: Real-time parsing with debounced compilation
- **Story Runtime**: Live story execution with choice handling
- **Syntax Highlighting**: Custom Monaco language definition for Ink syntax

### File Management
- **Local Storage**: Browser localStorage for file persistence (MVP)
- **File Operations**: Save/load .ink files, export to JSON
- **Sample Content**: Includes sample Ink story for demonstration

### UI Components
- **Design System**: Comprehensive shadcn/ui component library
- **Theme**: Custom dark theme optimized for code editing
- **Responsive**: Mobile-friendly with adaptive layouts
- **Icons**: Lucide React for consistent iconography

## Data Flow

1. **Code Input**: User types Ink script in Monaco editor
2. **Real-time Compilation**: Debounced compilation triggers error checking
3. **Error Display**: Compilation errors shown in collapsible error panel
4. **Story Execution**: User clicks Run to execute compiled story
5. **Interactive Preview**: Story displays with clickable choices
6. **Variable Inspection**: Runtime variables displayed in inspector panel
7. **File Persistence**: Stories saved to localStorage or future database

## External Dependencies

### Core Dependencies
- **inkjs**: Ink story runtime for browser execution
- **monaco-editor**: Code editor with syntax highlighting
- **@radix-ui/***: Accessible UI component primitives
- **@tanstack/react-query**: Server state management
- **drizzle-orm**: Type-safe database ORM
- **@neondatabase/serverless**: PostgreSQL serverless driver

### Development Tools
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **tailwindcss**: Utility-first CSS framework
- **@replit/vite-plugin-***: Replit-specific development tools

### Utility Libraries
- **lodash**: Utility functions (debounce, etc.)
- **file-saver**: Client-side file downloads
- **date-fns**: Date manipulation utilities
- **wouter**: Lightweight client-side routing

## Deployment Strategy

### Development
- **Local Development**: Vite dev server with HMR and TypeScript checking
- **Backend**: Express server with automatic restart via tsx
- **Database**: In-memory storage for rapid development iteration

### Production Build
- **Client Build**: Vite builds React app to `dist/public`
- **Server Build**: ESBuild bundles Express server to `dist/index.js`
- **Static Assets**: Served from Express server in production
- **Database**: Future PostgreSQL deployment with Drizzle migrations

### Deployment Targets
- **Primary**: Static deployment to Vercel or Netlify
- **Alternative**: Full-stack deployment with PostgreSQL backend
- **Self-hosted**: Docker container with embedded database
- **Replit**: Direct deployment with integrated database provisioning

### Database Migration Strategy
- **Current**: MemStorage class provides in-memory persistence
- **Migration Path**: Drizzle schema already defined for PostgreSQL
- **Future**: `npm run db:push` command ready for database provisioning
- **Data Model**: Users and Stories tables with foreign key relationships