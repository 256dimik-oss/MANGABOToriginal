# IdeaBox

## Overview

IdeaBox is a community-driven idea submission and voting platform. Users can submit ideas, evaluate others' ideas through voting, and view a leaderboard of ideas ranked by category. The platform enforces a "vote before you submit" model where users must evaluate all existing ideas before submitting their own.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state and caching
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for page transitions and interactions
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints defined in shared/routes.ts with Zod schemas for type safety
- **Build**: Vite for frontend, esbuild for server bundling

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: shared/schema.ts contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command for schema sync

### Authentication
- **Method**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **User Management**: Automatic user upsert on login

### Key Data Models
- **Users**: Managed by Replit Auth, stored in `users` table
- **Ideas**: User-submitted content with category classification
- **Votes**: Tracks which users voted for which ideas
- **Sessions**: Authentication session storage

### API Structure
Routes are defined declaratively in `shared/routes.ts` with:
- Input/output Zod schemas for validation
- Type-safe path definitions
- Shared between client and server

## External Dependencies

### Database
- PostgreSQL (requires DATABASE_URL environment variable)
- Drizzle ORM for query building and schema management

### Authentication
- Replit Auth OIDC provider
- Requires ISSUER_URL, REPL_ID, and SESSION_SECRET environment variables

### UI Component Library
- shadcn/ui components (Radix UI primitives)
- Full component set in client/src/components/ui/

### Development Tools
- Vite dev server with HMR
- Replit-specific plugins for development (cartographer, dev-banner, error overlay)