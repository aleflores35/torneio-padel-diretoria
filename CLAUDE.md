# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`cd backend/`)
```bash
npm install          # Install dependencies
npm start            # Start API server (node server.js) on port 3001
```

### Frontend (`cd frontend/`)
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server on port 5173
npm run build        # TypeScript check + Vite build (outputs to dist/)
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
npm run deploy       # Build + FTP deploy to production
```

## Architecture

### Stack Overview
| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Node.js (CommonJS) + Express 5 | Runs on port 3001 |
| Database | SQLite3 (`backend/padel.db`) | Optional Supabase swap via `DB_TYPE=supabase` |
| WhatsApp Integration | Evolution API via axios | Falls back to console.log if env vars missing |
| Payments | Stripe API | Full checkout flow implemented |
| Frontend | React 19 + TypeScript + Vite 8 | Runs on port 5173 |
| Styling | TailwindCSS 3 + PostCSS | Autoprefixer configured |
| Routing | React Router DOM 7 | Public routes + admin auth |
| Icons | Lucide React | 580+ icon library |

### Core Project Structure
```
Torneio de Padel/
├── backend/
│   ├── services/                    # Business logic
│   │   ├── authService.js          # JWT-based auth
│   │   ├── chavesService.js        # Bracket/group generation
│   │   ├── duplasService.js        # Doubles shuffling (respects side preference)
│   │   ├── notificationService.js  # Evolution API (WhatsApp)
│   │   ├── schedulerService.js     # Match-to-court scheduling
│   │   └── stripeService.js        # Stripe webhook + charge handling
│   ├── server.js                    # Express REST API
│   ├── database.js                  # DB adapter (SQLite / Supabase)
│   ├── seed.js                      # Seed test data
│   └── generate_docx.js            # DOCX export utility
├── frontend/
│   └── src/
│       ├── pages/                   # Route components (no default exports)
│       ├── components/              # Reusable UI components
│       ├── api.ts                   # HTTP layer with localStorage fallback
│       ├── config.ts                # App config & routes
│       └── App.tsx                  # Router setup
├── supabase_schema.sql              # Canonical DB schema
└── PRD.md                           # Product requirements

Key utilities: seed_v2.js, create_support_user.js
```

### Database Strategy
`backend/database.js` exports a **db adapter** pattern that abstracts the database layer:
- **Default:** SQLite3 at `backend/padel.db` (local development)
- **Optional:** Supabase via `@supabase/supabase-js` when `DB_TYPE=supabase` in `.env`

The Supabase path has partial SQL-to-JS mapping; the canonical schema lives in `supabase_schema.sql`. To swap databases, update `.env` and restart the server—no code changes needed.

### Frontend API Layer
`frontend/src/api.ts` implements an **offline-first fallback pattern**: when the backend is unreachable, API functions transparently use `localStorage` + seeded mock data. This allows frontend-only UI development without running the backend. `VITE_API_URL` env var controls the backend URL (defaults to `http://localhost:3001`).

### Route Map
**Public routes (no auth):**
- `/` — LandingPage (athlete registration + CTAs)
- `/publico` — PublicoPage (live scoreboard for TV/displays)

**Authenticated routes:**
- `/login` — LoginPage (credentials auth)
- `/checkout` — CheckoutPage (Stripe payment integration)
- `/admin` — DashboardPage (tournament metrics & phase pipeline)
- `/admin/atletas` — AtletasPage (player search, filters, manual add)
- `/duplas` — DuplasPage (doubles generation from player pool)
- `/chaves` — ChavesPage (bracket/group display)
- `/jogos` — JogosPage (match list by round/court with status tracking)
- `/quadras` — QuadrasPage (court status board, live operations)
- `/quadras/config` — ConfigQuadrasPage (court setup & ordering)

### Core Business Services

#### duplasService.js
Implements intelligent doubles shuffling:
- Pairs players of opposite side preferences (RIGHT ↔ LEFT)
- Respects EITHER-side players for flexibility
- Generates balanced, randomized duplicate pairs
- Output: array of doubles with display_name

#### chavesService.js
Generates tournament brackets from doubles:
- Creates groups from shuffled doubles
- Distributes evenly across groups
- Supports various bracket formats

#### schedulerService.js
Allocates matches to courts:
- Respects court availability & capacity
- Orders matches by round
- Returns scheduling timeline

#### notificationService.js
WhatsApp notifications via Evolution API:
- `POST /api/matches/:id/call` triggers notification
- Sets match status to CALLING
- Falls back to console.log if `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` are missing
- Idempotent (can be called multiple times safely)

#### stripeService.js
Handles payment processing:
- Creates checkout sessions
- Validates webhook signatures
- Updates payment_status on confirmation
- Handles refunds & cancellations

### Key API Endpoints
```
POST /api/tournaments/:id/generate-doubles    Sortear duplas
POST /api/tournaments/:id/generate-chaves     Gerar chaves
POST /api/tournaments/:id/schedule            Agendar jogos
POST /api/matches/:id/call                    Chamar jogo (WhatsApp + CALLING status)
POST /api/matches/:id/status                  Atualizar placar/status
```

Portuguese aliases at `/api/torneios/:id/*` redirect to English endpoints.

## Environment Variables

### Backend (`backend/.env`)
```env
# Database (omit DB_TYPE for SQLite)
DB_TYPE=supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Server & CORS
PORT=3001
CLIENT_URL=http://localhost:5173

# WhatsApp (Evolution API)
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

## Code Conventions

### Backend
- **Module system:** CommonJS (`require` / `module.exports`)
- **Database:** Callback-style SQLite queries; async/await for service orchestration
- **Error handling:** Express error middleware; graceful fallbacks (e.g., console.log for missing Evolution vars)
- **Service pattern:** Each service exports functions; no classes

### Frontend
- **Components:** Functional TypeScript, React 19 hooks
- **Page exports:** Named exports only (no default exports on pages)
- **HTTP:** Axios with offline fallback via `api.ts`
- **State:** React hooks + Context API (no Redux/Zustand)
- **Routing:** React Router DOM 7 with basename `/diretoria-padel`

### Shared Conventions
- **Language mix:** English for API endpoints & variable names; Portuguese for UI text & some service methods (`sortearDuplas`, `gerarChaves`, `agendarJogos`)
- **Enums:**
  - Match status: `TO_PLAY`, `CALLING`, `IN_PROGRESS`, `FINISHED`, `SCHEDULED`, `LIVE`
  - Player side: `RIGHT`, `LEFT`, `EITHER`
  - Payment status: `PENDING`, `PAID`, `CANCELLED`
- **Naming:** camelCase for vars/functions; snake_case for DB columns

## Commit Attribution

AI commits must include:
```
Co-Authored-By: Antigravity <antigravity@gemini.google.com>
```

## Important Files to Know

| File | Purpose |
|------|---------|
| `backend/database.js` | DB adapter; encapsulates SQLite/Supabase abstraction |
| `frontend/src/api.ts` | HTTP client with offline fallback logic |
| `supabase_schema.sql` | Authoritative DB schema (SQL DDL) |
| `PRD.md` | Product requirements & feature scope |
| `AGENTS.md` | Project skills index & multi-agent guidance |

## Development Notes

- **Local SQLite:** Default. Create `backend/.env` from `.env.example` and omit `DB_TYPE`.
- **Stripe testing:** Use test keys (sk_test_...) and test card numbers (4242...).
- **Offline frontend:** Backend is optional for UI development; localStorage + mock data kicks in automatically.
- **WhatsApp testing:** Ensure `EVOLUTION_API_*` vars are set in `.env` for real notifications; otherwise, check server logs for console fallback.
