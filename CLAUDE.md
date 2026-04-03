# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`cd backend/`)
```bash
npm install          # Install dependencies
node server.js       # Start API server on port 3001
npm start            # Same as above
```

### Frontend (`cd frontend/`)
```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 5173 (Vite)
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run deploy       # Build + FTP deploy
```

## Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js (CommonJS) + Express 5 on port 3001 |
| Database | SQLite3 (`backend/padel.db`) with optional Supabase swap |
| WhatsApp | Evolution API via axios (`notificationService.js`) |
| Payments | Stripe |
| Frontend | React 19 + TypeScript + TailwindCSS 3 + Vite |
| Routing | React Router DOM 7 (basename `/diretoria-padel`) |

### Database Strategy
`backend/database.js` exports a **db adapter** that either uses SQLite3 locally or Supabase depending on `DB_TYPE=supabase` in `.env`. Default is SQLite (`backend/padel.db`). The Supabase path only has partial SQL-to-JS mapping implemented. The canonical schema is in `supabase_schema.sql`.

### API Layer (`frontend/src/api.ts`)
Every API call has an **offline/localStorage fallback**: when the backend is unreachable, functions transparently use `localStorage` with seed mock data. This means the frontend is fully functional without a running backend for UI development. `VITE_API_URL` controls the backend URL (defaults to `http://localhost:3001`).

### Route Map
- `/` — LandingPage (public athlete registration)
- `/login` — LoginPage
- `/checkout` — CheckoutPage (Stripe)
- `/publico` — PublicoPage (live scoreboard for TV/displays, no auth)
- `/admin` — DashboardPage
- `/admin/atletas` — AtletasPage (player management)
- `/duplas` — DuplasPage (doubles management)
- `/chaves` — ChavesPage (bracket/groups)
- `/jogos` — JogosPage (match management)
- `/quadras` — QuadrasPage (court status board)
- `/quadras/config` — ConfigQuadrasPage

### Backend Services
- `duplasService.js` — Shuffles players into doubles (respects LEFT/RIGHT/EITHER side preference)
- `chavesService.js` — Generates bracket groups from doubles
- `schedulerService.js` — Schedules matches to courts
- `notificationService.js` — Sends WhatsApp messages via Evolution API; falls back to console log if env vars missing
- `authService.js` — Authentication
- `stripeService.js` — Payment processing

### Key API Endpoints
- `POST /api/tournaments/:id/generate-doubles` — Sortear duplas
- `POST /api/tournaments/:id/generate-chaves` — Generate brackets
- `POST /api/tournaments/:id/schedule` — Schedule matches to courts
- `POST /api/matches/:id/call` — Set match to CALLING + send WhatsApp notification
- `POST /api/matches/:id/status` — Update score/status

Portuguese aliases exist at `/api/torneios/:id/*` and redirect to the English endpoints.

## Environment Variables

Copy `.env.example` to `backend/.env`:
```
SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
PORT=3001
CLIENT_URL=http://localhost:5173
EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE
DB_TYPE=supabase   # omit for SQLite (default)
```

Frontend: `frontend/.env` with `VITE_API_URL=http://localhost:3001`

## Conventions

- **Backend**: CommonJS (`require`/`module.exports`), callback-style SQLite, async/await for service orchestration
- **Frontend**: Functional TypeScript components, named exports (no default exports on pages), axios for HTTP
- **Mixed language**: codebase uses English for API endpoints and variable names, Portuguese for UI text and some service method names (e.g. `sortearDuplas`, `gerarChaves`, `agendarJogos`)
- Match status values: `TO_PLAY`, `CALLING`, `IN_PROGRESS`, `FINISHED`, `SCHEDULED`, `LIVE`
- Player side values: `RIGHT`, `LEFT`, `EITHER`
- Payment status values: `PENDING`, `PAID`, `CANCELLED`

## Commit Attribution

AI commits must include:
```
Co-Authored-By: Antigravity <antigravity@gemini.google.com>
```
