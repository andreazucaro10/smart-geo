# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Smart-Geo is a comprehensive management system for geometry offices built with React, TypeScript, and Supabase. It provides practice management, billing, scheduling, and contact management capabilities specifically tailored for Italian geometri (surveyors/land registry professionals).

## Common Development Commands

| Command | Description |
|---------|-------------|
| `npm install --legacy-peer-deps` | Install dependencies (use legacy-peer-deps flag due to dependency conflicts) |
| `npm run dev` | Start development server on http://localhost:5173 |
| `npm run build` | Build for production (TypeScript check + Vite build) |
| `npm run lint` | Run ESLint checks |
| `npm run preview` | Preview production build locally |

## Environment Setup

### Required Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

## High-Level Architecture

### Tech Stack

- **Frontend Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom theme configuration
- **State Management**: Zustand with persist middleware
- **Routing**: React Router v6
- **Forms & Validation**: React Hook Form + Zod
- **Backend**: Supabase (PostgreSQL, Auth, REST API, Realtime)
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Drag & Drop**: @dnd-kit/core and @dnd-kit/sortable

### Project Structure

```
smart-geo/
├── src/
│   ├── components/
│   │   └── layout/         # Layout components (AppLayout, Header, Sidebar, ProtectedRoute)
│   ├── pages/              # Page components for each route
│   │   ├── Dashboard.tsx   # Main dashboard with statistics
│   │   ├── ComuneCatasto.tsx # Municipality and cadastre practices
│   │   ├── Ape.tsx         # Energy performance certificates
│   │   ├── Varie.tsx       # Miscellaneous practices
│   │   ├── Contabilita.tsx # Accounting and invoicing
│   │   ├── Planner.tsx     # Weekly task planner with drag-drop
│   │   ├── Rubrica.tsx     # Contact management
│   │   └── Parametri.tsx   # System parameters
│   ├── services/
│   │   └── supabase.ts     # Supabase client configuration
│   ├── store/
│   │   ├── authStore.ts    # Authentication state with Zustand
│   │   └── themeStore.ts   # Theme management
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   └── App.tsx             # Main app component with routing
```

## Key Architectural Patterns

### Authentication Flow

- **Supabase Auth** with email/password authentication
- **Remember Me** functionality using localStorage flag (`smart-geo-remember-me`)
- **Zustand Auth Store** with persist middleware for session management
- **Profile Creation**: Automatic profile creation on first login using username from email

### Protected Routes

All routes except `/login` are wrapped in a `ProtectedRoute` component that:
1. Checks authentication state from Zustand store
2. Redirects to login if not authenticated
3. Renders children if authenticated

### Data Fetching Patterns

- **Direct Supabase queries** using the Supabase JS client
- **Parallel queries** with `Promise.all()` for dashboard statistics
- **Joined queries** for related data (e.g., `stato_info`, `tipo_incarico_info`)
- **Error handling** with toast notifications
- **Real-time subscriptions** configured in Supabase client

### Form Handling

- **React Hook Form** for form state management
- **Zod schemas** for validation
- **Toast notifications** for success/error feedback

## Database Schema

### Core Tables

#### Practice Management
- `comune_catasto` - Municipality and cadastre practices
- `ape` - Energy performance certificates (APE)
- `varie` - Miscellaneous practices

#### Accounting
- `fatture` - Invoices with automatic calculations
- `scadenze` - Payment deadlines and expenses
- `parametri_fatturazione` - Billing parameters by year

#### Contacts & Configuration
- `rubrica` - Contact directory
- `parametri_azienda` - Company parameters
- `profiles` - User profiles linked to auth.users

#### Planning
- `planner_tasks` - Weekly planner tasks
- `planner_categories` - Task categories

#### Reference Tables
- `stati_generali` - General status options
- `stati_ape` - APE-specific status options
- `stati_scadenze` - Deadline status options
- `tipi_incarico` - Assignment types
- `tipologia_contatti` - Contact types
- `tipologie_appartenenza` - Affiliation types

### Key Relationships

- All practice tables (`comune_catasto`, `ape`, `varie`) have foreign keys to status and type tables
- `planner_tasks` references `planner_categories` by slug
- `profiles` references `auth.users` with UUID

### Row Level Security (RLS)

All tables have RLS enabled. The main patterns are:
- User can only view/edit their own profile
- Additional policies are defined in SQL migration files (`fix_rls_policies.sql`, `fix_parametri_policies.sql`, `fix_planner_policies.sql`)

## Deployment

### Vercel Configuration

The project includes `vercel.json` with:
- SPA routing rewrites to index.html
- Proper Content-Type headers for JS/CSS assets

### Netlify Configuration

The project includes `netlify.toml` with:
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirects configured

### Environment Variables for Deployment

Both platforms require:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Database Setup

The complete database schema is in `database_setup.sql`. To set up:

1. Create a new Supabase project
2. Run the SQL script in Supabase SQL Editor
3. The script includes:
   - Table creation with proper relationships
   - RLS policies setup
   - Initial seed data for status and type tables

## Development Workflow

### Adding New Features

1. **Database Changes**: Add migrations in Supabase dashboard or SQL files
2. **Type Definitions**: Update `src/types/index.ts` 
3. **Components**: Create in appropriate directory (`pages/` for routes, `components/` for reusable)
4. **State Management**: Add Zustand slices if needed
5. **Routing**: Update `App.tsx` for new routes

### Working with Supabase

- **Local Development**: Uses remote Supabase project (no local setup required)
- **Realtime**: Configured with 10 events/second limit
- **Error Handling**: Use `handleSupabaseError` helper from `services/supabase.ts`

### Styling Guidelines

- **Tailwind Classes**: Use utility-first approach
- **Dark Mode**: Supported via `dark:` prefix classes
- **Custom Theme**: Extended colors defined in `tailwind.config.js`
- **Component Classes**: `.card` class defined globally for consistent card styling

## Important Considerations

### Italian Business Context

This system is specifically designed for Italian geometri offices with:
- Italian terminology in database and UI
- APE (Attestato di Prestazione Energetica) management specific to Italian regulations
- Municipality (Comune) and Cadastre (Catasto) practice types

### Performance Optimizations

- **Vite HMR**: Configured on port 443
- **Manual chunks**: Disabled in Vite config for simpler builds
- **Parallel data fetching**: Dashboard uses Promise.all for concurrent queries

### Security

- **Row Level Security**: Enabled on all database tables
- **JWT Authentication**: Handled by Supabase
- **Auto-refresh tokens**: Configured in Supabase client
- **Session persistence**: Controlled by "Remember Me" feature
