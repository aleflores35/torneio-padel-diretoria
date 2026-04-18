# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`cd backend/`)
```bash
npm install       # Install dependencies
npm start         # Start API server (node server.js) on port 3001
```

### Frontend (`cd frontend/`)
```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server on port 5173
npm run build     # TypeScript check + Vite build (outputs to dist/)
npm run lint      # Run ESLint
npm run deploy    # Build + FTP deploy to Hostinger production
```

### Deploy to production
```bash
# Backend (Vercel) — run from repo root
vercel --prod --yes

# Frontend (Hostinger FTP) — run from frontend/
npm run deploy
```

### Seed database (local SQLite)
```bash
cd backend
node clean_db.js       # Wipe all tables
node seed_complete.js  # Full seed: tournament, 5 categories, athletes, rounds, matches
```

## Architecture

### Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Node.js (CommonJS) + Express 5 | Port 3001; deployed to Vercel |
| Database | SQLite3 (`backend/padel.db`) or Supabase | Swap via `DB_TYPE=supabase` |
| Frontend | React 19 + TypeScript + Vite 8 | Port 5173; deployed to Hostinger |
| Styling | TailwindCSS 3 | `premium-card`, `premium-accent` are custom classes |
| Routing | React Router DOM 7 | Two basenames: `/diretoria-padel` (admin) and `/ranking-srb` (public) |

### Critical: SQLite vs Supabase split

**Some endpoints use raw SQLite; the newer weekly-draw services write directly to Supabase.** This means certain GET endpoints won't return data created by newer services when running in production (Vercel/Supabase).

- `GET /api/tournaments/:id/matches` — uses `db.all()` raw SQL (SQLite adapter). On Vercel these are the *old* matches. New matches from `weeklyDrawService.confirmRound` are in Supabase.
- `GET /api/rounds/:id/matches` — uses Supabase directly. **Use this for new confirmed matches.**
- `GET /api/tournaments/:id/rounds` — uses `db.getRounds()` adapter (Supabase-aware).

**Rule:** When fetching data for pages that need to show confirmed weekly rounds, use the round-first approach: fetch rounds → filter by date → for CONFIRMED rounds, fetch matches via `/api/rounds/:id/matches`.

### Weekly draw flow (production)

The weekly draw is a 4-step admin flow managed by `backend/services/weeklyDrawService.js`:

1. **Draw** — `POST /api/tournaments/:id/categories/:catId/draw-week`  
   Creates a `DRAFT` round + doubles + attendance records. **No matches yet.**
2. **Send confirmations** — `POST /api/rounds/:id/send-confirmations`  
   Changes round status to `AWAITING_CONFIRMATION`.
3. **Confirm** — `POST /api/rounds/:id/confirm`  
   Creates matches with court/time slots. Round becomes `CONFIRMED`.
4. **Close** — `POST /api/rounds/:id/close`  
   Applies WO to unplayed matches. Round becomes `FINISHED`.

Also: `POST /api/rounds/:id/redraw` — re-draw while still in DRAFT/AWAITING.

### Round attendance statuses
Stored in `round_attendance` table, set during draw:
- `NO_RESPONSE` — selected for this week, hasn't responded
- `BYE` — had an odd-player bye this round
- `DECLINED` — excluded by admin (declared absent)
- `ROTATED` — not selected this week (rotation system)

### Services overview

| Service | Purpose |
|---------|---------|
| `weeklyDrawService.js` | **Primary draw service.** Weekly rotation, greedy partner pairing, court slot assignment, WO closing |
| `rankingService.js` | Points calculation: Win +3, Loss +1, WO 0. Standings per category |
| `roundsService.js` | Berger algorithm (all-vs-all). Used for initial full schedule generation |
| `duplasService.js` | Side-aware doubles shuffling (RIGHT ↔ LEFT, EITHER flexible) |
| `schedulerService.js` | `agendarRodada()` for single-court, Thursday 18h-23h scheduling |
| `authService.js` | JWT auth for admin routes |

`weeklyDrawService.js` uses **Supabase tables**: `rounds`, `doubles`, `matches`, `round_attendance`, `partnerships`, `player_stats`, `courts`.

### Route map

**Public (no auth, basename `/ranking-srb`):**
- `/` or `/semana` — `SemanaPage` — weekly schedule for athletes; absence declaration
- `/ranking` — `RankingPage` — individual standings by category
- `/atleta` — `AtletaPage` — athlete personal dashboard (match history, ranking position, absence toggle)
- `/perfil/:id` — athlete public profile

**Admin (requires auth, basename `/diretoria-padel`):**
- `/admin` — `DashboardPage` — real-time stats, "Esta Quinta" card, category leaders
- `/admin/atletas` — `AtletasPage` — player search/add, category column
- `/rodadas` — `RondasPage` — round management, draw, confirm, expand doubles + absence/BYE display
- `/jogos` — `JogosPage` — match cards with score form, category badge, timezone-safe time display
- `/ranking` — admin ranking view
- `/login` — `LoginPage`

### Key frontend patterns

**Time display:** Always extract time from ISO strings directly — never use `new Date(scheduled_at)` for display because it applies timezone conversion. Pattern used in `JogosPage.tsx`:
```tsx
const extractTime = (scheduledAt?: string): string => {
  if (!scheduledAt) return '';
  if (scheduledAt.includes('T')) return scheduledAt.split('T')[1]?.substring(0, 5).replace(':', 'h') ?? '';
  return '';
};
```

**Player name matching:** Use first + last name together to avoid false positives (e.g., "Alessandro Flores" vs "Alessandro Bianchi"):
```tsx
const myFirst = name.split(' ')[0];
const myLast = name.split(' ').slice(-1)[0];
const matches = (doubleName: string) => doubleName.toLowerCase().includes(myFirst) && doubleName.toLowerCase().includes(myLast);
```

**Category name:** Category id:1 is `'Masculino Iniciante / 6ª'` (merged). Used in `CATEGORIES` arrays throughout frontend pages (RondasPage, DashboardPage, AtletasPage, RankingPage).

**SemanaPage data flow:** Fetches rounds first → filters by `scheduled_date === nextThursday()` → for CONFIRMED/FINISHED rounds, fetches matches via `/api/rounds/:id/matches` (Supabase-aware).

### Key API endpoints

```
# Weekly draw (new)
POST /api/tournaments/:id/categories/:catId/draw-week   Draw week (creates DRAFT round + doubles)
POST /api/rounds/:id/redraw                             Re-draw (DRAFT or AWAITING only)
POST /api/rounds/:id/send-confirmations                 Advance to AWAITING_CONFIRMATION
POST /api/rounds/:id/confirm                            Create matches + CONFIRMED status
POST /api/rounds/:id/close                              Apply WO + FINISHED status
GET  /api/rounds/:id/matches                            Matches for a round (Supabase-aware)
GET  /api/rounds/:id/attendance                         Attendance records for a round
POST /api/rounds/:id/attendance                         Set player attendance status

# Rankings & categories
GET  /api/tournaments/:id/categories
GET  /api/tournaments/:id/ranking                       All categories combined
GET  /api/tournaments/:id/ranking/:catId                Single category standings

# Rounds
GET  /api/tournaments/:id/rounds                        All rounds (adapter-aware)

# Export
GET  /api/tournaments/:id/export                        Download .xlsx with 6 sheets

# Matches (SQLite-based — use /api/rounds/:id/matches for new data)
GET  /api/tournaments/:id/matches
POST /api/matches/:id/status                            Update score/status
```

### Google Sheets integration
`google_apps_script_sync.js` — paste into Google Apps Script for live sync from the API. Functions: `syncAll()`, `syncAtletas()`, `syncRodadas()`, `syncJogos()`, `syncRanking()`, `syncConciliador()`.

## Environment Variables

### Backend (`backend/.env`)
```env
DB_TYPE=supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3001
CLIENT_URL=http://localhost:5173
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

## Code conventions

- **Backend:** CommonJS (`require`/`module.exports`). New services (`weeklyDrawService`) use Supabase directly via `require('./supabase')`.
- **Frontend pages:** Named exports only (no `export default` on pages).
- **Enums — Match status:** `TO_PLAY`, `CALLING`, `IN_PROGRESS`, `FINISHED`, `LIVE`, `WO`
- **Enums — Round status:** `DRAFT`, `AWAITING_CONFIRMATION`, `CONFIRMED`, `FINISHED`
- **Enums — Attendance:** `NO_RESPONSE`, `BYE`, `DECLINED`, `ROTATED`
- **Enums — Player side:** `RIGHT`, `LEFT`, `EITHER`
- **Language:** English for API/variables; Portuguese for UI text and some service methods.
- **DB columns:** snake_case. JS vars: camelCase.

## Commit attribution

AI commits must include:
```
Co-Authored-By: Antigravity <antigravity@gemini.google.com>
```
