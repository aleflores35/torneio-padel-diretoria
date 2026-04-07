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
│   │   ├── stripeService.js        # Stripe webhook + charge handling
│   │   ├── rankingService.js       # Individual ranking calculation (NEW - Ranking SRB)
│   │   └── roundsService.js        # Round management + Berger algorithm (NEW - Ranking SRB)
│   ├── server.js                    # Express REST API
│   ├── database.js                  # DB adapter (SQLite / Supabase)
│   ├── seed.js                      # Seed test data
│   └── generate_docx.js            # DOCX export utility
├── frontend/
│   └── src/
│       ├── pages/                   # Route components (no default exports)
│       │   ├── RankingPage.tsx      # Public individual standings (NEW - Ranking SRB)
│       │   └── RondasPage.tsx       # Admin round management (NEW - Ranking SRB)
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
- `/ranking` — RankingPage (individual standings by category - NEW)

**Authenticated routes:**
- `/login` — LoginPage (credentials auth)
- `/checkout` — CheckoutPage (Stripe payment integration)
- `/admin` — DashboardPage (tournament metrics & phase pipeline)
- `/admin/atletas` — AtletasPage (player search, filters, manual add)
- `/duplas` — DuplasPage (doubles generation from player pool)
- `/chaves` — ChavesPage (bracket/group display) - *[DEPRECATED for Ranking SRB]*
- `/rodadas` — RondasPage (round management - NEW)
- `/jogos` — JogosPage (match list by round/court with status tracking)
- `/quadras` — QuadrasPage (court status board, live operations)
- `/quadras/config` — ConfigQuadrasPage (court setup & ordering)

### Core Business Services

#### rankingService.js (NEW - Ranking SRB)
Individual scoring system:
- Calculates player points from match results
- Win: +3 points | Loss: +1 point | Walkover: 0 points
- Generates standings per category (separate by RIGHT/LEFT for awards)
- Orders by points DESC, then wins DESC

#### roundsService.js (NEW - Ranking SRB)
Round-robin scheduling without partner repetition:
- Implements **Berger Tables algorithm** for round-robin scheduling
- Guarantees: no two players are partners more than once
- Generates N-1 rounds for N players (all vs all)
- Respects Thursday dates (18h-23h windows)

#### duplasService.js
Implements intelligent doubles shuffling:
- Pairs players of opposite side preferences (RIGHT ↔ LEFT)
- Respects EITHER-side players for flexibility
- Generates balanced, randomized duplicate pairs
- Output: array of doubles with display_name
- **Modified for Ranking SRB:** `sortearDuplasRodada()` for per-round shuffling

#### chavesService.js
Generates tournament brackets from doubles:
- Creates groups from shuffled doubles
- Distributes evenly across groups
- Supports various bracket formats
- *[Not used in Ranking SRB]*

#### schedulerService.js
Allocates matches to courts:
- Respects court availability & capacity
- Orders matches by round
- Returns scheduling timeline
- **Modified for Ranking SRB:** `agendarRodada()` for single court + Thursday windows (18h-23h)

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
- *[Not used in Ranking SRB - payment is presential]*

### Key API Endpoints
```
# Ranking SRB (NEW)
GET  /api/tournaments/:id/categories              List categories
POST /api/tournaments/:id/categories              Create category
GET  /api/tournaments/:id/ranking/:catId          Individual standings per category
GET  /api/tournaments/:id/rounds                  List all rounds with dates/status
POST /api/tournaments/:id/generate-rounds/:catId  Generate all rounds (Berger algorithm)
POST /api/rounds/:id/schedule                     Schedule matches for a round

# Existing (adapted for Ranking SRB)
POST /api/matches/:id/status                      Update match result + individual points
POST /api/matches/:id/call                        WhatsApp notification
GET  /api/tournaments/:id/matches                 List matches by round
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

## Ranking SRB Implementation Plan (14 Etapas)

### Fase 1: Database + Backend Core
1. Criar tabelas `categories` + `rounds` no DB
2. Adicionar colunas em `players` + `doubles`
3. Criar `rankingService.js`
4. Criar `roundsService.js` (algoritmo Berger)
5. Adaptar `schedulerService.js` (1 quadra + quinta 18h-23h)
6. Adaptar `duplasService.js` (sortearDuplasRodada)
7. Atualizar `database.js` com novos métodos
8. Adicionar endpoints REST no `server.js`

### Fase 2: Frontend Admin
9. Adaptar `JogosPage.tsx` para rodadas
10. Adaptar `AtletasPage.tsx` para categorias
11. Adaptar `DashboardPage.tsx` para novas métricas
12. Criar `RondasPage.tsx` (nova)

### Fase 3: Frontend Público
13. Criar `RankingPage.tsx` (nova)

### Fase 4: Integração Final
14. Atualizar rotas + `api.ts` + docs + `CLAUDE.md`

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
- **Ranking SRB specifics:** No Stripe checkout (presential payment), 1 court, individual scoring, Thursday-only matches, 5 categories.

## Ranking SRB Implementation Status

### ✅ COMPLETED (14/14 Etapas)

**Fase 1: Database + Backend Core** ✓
- [x] Tabelas `categories` + `rounds` criadas em `supabase_schema.sql`
- [x] Colunas `id_category` + `is_socio` em `players`; `id_round` em `doubles`
- [x] `backend/services/rankingService.js` — individual scoring with point aggregation
- [x] `backend/services/roundsService.js` — Berger algorithm, non-repeating partnerships
- [x] `backend/services/schedulerService.js` — `agendarRodada()` for 1 court, 18h-23h window
- [x] `backend/services/duplasService.js` — `sortearDuplasRodada()` for round-specific pairing
- [x] `backend/database.js` — 6 new helper methods (createRound, getRounds, updateRoundStatus, etc.)
- [x] `backend/server.js` — 8 new REST endpoints for categories, rounds, ranking

**Fase 2: Frontend Admin** ✓
- [x] `frontend/src/pages/JogosPage.tsx` — refactored for round-based grouping (id_round)
- [x] `frontend/src/pages/AtletasPage.tsx` — category column, hardcoded 5 Ranking SRB categories
- [x] `frontend/src/pages/DashboardPage.tsx` — new metrics (rodadas concluídas, líderes por categoria)
- [x] `frontend/src/pages/RondasPage.tsx` — new admin page for round management & scheduling

**Fase 3: Frontend Público** ✓
- [x] `frontend/src/pages/RankingPage.tsx` — public standings by category with scoring rules

**Fase 4: Integração Final** ✓
- [x] `frontend/src/App.tsx` — routes added: `/ranking` (public), `/rodadas` (admin)
- [x] `frontend/src/api.ts` — new functions: `fetchCategories`, `fetchRounds`, `generateRounds`, `scheduleRound`, `fetchRanking`, `fetchAllRankings`
- [x] `CLAUDE.md` — documentation complete

### Key Additions Summary

**Pages:**
- `RankingPage.tsx` — category tabs, standings table (RIGHT/LEFT leaders), scoring rules explanation
- `RondasPage.tsx` — round grid by category, generate button, schedule button, status tracking

**Services:**
- `rankingService.js` — `getStandings()`, `getLeadersByHand()`, `getAllCategoryStandings()`
- `roundsService.js` — `gerarRodas()` (Berger), `getCalendario()`, `getProximasRodadas()`

**API Endpoints (8 new):**
- `GET /api/tournaments/:id/categories`
- `POST /api/tournaments/:id/categories`
- `GET /api/tournaments/:id/rounds`
- `POST /api/tournaments/:id/generate-rounds/:catId`
- `POST /api/rounds/:id/schedule`
- `GET /api/tournaments/:id/ranking/:catId`
- `GET /api/tournaments/:id/ranking`
- `GET /api/tournaments/:id/rounds/:catId/calendar`

**Database Schema:**
- `rounds` table (id_round PK, id_tournament, id_category, round_number, scheduled_date, window_start/end, status)
- `categories` table (id_category PK, id_tournament, name, description)
- Column additions: `players.id_category`, `players.is_socio`, `doubles.id_round`

**Frontend Routes:**
- `/ranking` — public page (no auth required)
- `/rodadas` — admin page (requires auth)

All 14 implementation stages are complete. The system is ready for testing and deployment.
