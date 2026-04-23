# CHANGELOG — Ranking Padel SRB 2026 · Sociedade Rio Branco

Registro de versões. Mais recente no topo.

---

## [v1.3] — 2026-04-19 · Migração para disco local + fixes

### Entregue
- **Migração**: código consolidado em `C:\obralivre\clientes\parcerias\sociedade-rio-branco\ranking-srb-2026\` (backup robocopy diário exclui `node_modules`)
- **Fix TOURNAMENT_ID=7**: id_tournament=7 é o único ativo no Supabase — alinhado
- **Export Excel funcional**: 71 KB, 6 abas
- **Renomear campo**: `walkovers` → `wos` no backend (alinhar com frontend)
- **Campos adicionados**: `games_for`, `games_against`, `games_balance` na API
- **Fix FK PostgREST**: `player_absences` ↔ `players` — cache schema reload via `NOTIFY pgrst`

### Regras de ranking confirmadas
- +3 vitória · +1 derrota · 0 WO
- Desempate: pontos → vitórias → saldo games → derrotas → WOs

---

## [v1.2] — 2026-04-17 → 2026-04-18 · Migração Drive → disco local

### Processo
- App em `.antigravity/Ranking Padel SRB 2026/` → Drive → `C:\projetos\ranking-srb-2026\` → `C:\obralivre\...`
- npm install travou no Drive → resolvido com move para disco local

---

## [v1.0] — 2026-04 · MVP em produção

### Entregue
- Frontend React (Vite) + Backend Node.js (Express) + Supabase
- Frontend público: https://obralivre.com.br/ranking-srb/
- Backend API: https://ranking-padel-srb-2026.vercel.app
- Basename único no React Router: `/ranking-srb/` (com subrota `/admin`)
- Admin: https://obralivre.com.br/ranking-srb/admin
- Banco: Supabase `kosifmqmajlowuxpcuga.supabase.co`

### Contexto histórico
- Pitch original "Torneio de Padel Diretoria" → SRB não comprou
- Alessandro evoluiu pra Ranking (regras diferentes) → SRB usa em produção
