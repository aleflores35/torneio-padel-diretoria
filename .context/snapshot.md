# Context Snapshot — Torneio de Padel
**Capturado em:** 2026-04-02T23:36 (GMT-3)
**Para restaurar:** cole este arquivo numa nova conversa e diga "restaure o contexto"

---

## 🎯 O que é este projeto

Sistema de gestão de torneios de Padel para diretoria. Permite cadastro de atletas, sorteio de duplas, geração de chaves, agendamento de jogos, chamada via WhatsApp e pagamento via Stripe/Checkout.

---

## 🏗️ Arquitetura

```
backend/  → Node.js CommonJS + Express 5 + SQLite (porta 3001)
frontend/ → React 19 + TypeScript + TailwindCSS 3 + Vite 8 (porta 5173)
DB local: padel.db (SQLite)
```

### Backend — Rotas da API (`server.js`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/tournaments` | Lista torneios |
| POST | `/api/tournaments` | Cria torneio |
| GET | `/api/tournaments/:id/players` | Lista atletas do torneio |
| POST | `/api/players` | Cadastra atleta |
| GET | `/api/tournaments/:id/doubles` | Lista duplas |
| POST | `/api/tournaments/:id/generate-doubles` | Sorteia duplas |
| GET | `/api/tournaments/:id/chaves` | Lista chaves/grupos |
| POST | `/api/tournaments/:id/generate-chaves` | Gera chaves |
| GET | `/api/tournaments/:id/matches` | Lista jogos |
| POST | `/api/tournaments/:id/schedule` | Agenda jogos |
| POST | `/api/matches/:id/call` | Chama jogo (WhatsApp) |
| POST | `/api/matches/:id/status` | Atualiza placar/status |
| GET | `/api/tournaments/:id/courts` | Lista quadras |
| POST | `/api/courts` | Cria quadra |

### Backend — Services

| Arquivo | Responsabilidade |
|---------|-----------------|
| `authService.js` | Autenticação |
| `chavesService.js` | Geração de chaves/grupos |
| `duplasService.js` | Sorteio de duplas |
| `notificationService.js` | WhatsApp via Evolution API |
| `schedulerService.js` | Agendamento de jogos |
| `stripeService.js` | Pagamentos Stripe |

### Frontend — Pages

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `LandingPage.tsx` | `/` | Página pública de inscrição |
| `LoginPage.tsx` | `/login` | Login da diretoria |
| `DashboardPage.tsx` | `/dashboard` | Painel principal |
| `AtletasPage.tsx` | `/atletas` | Gestão de atletas |
| `DuplasPage.tsx` | `/duplas` | Gestão de duplas |
| `ChavesPage.tsx` | `/chaves` | Visualização de chaves |
| `JogosPage.tsx` | `/jogos` | Gestão de jogos |
| `QuadrasPage.tsx` | `/quadras` | Gestão de quadras |
| `ConfigQuadrasPage.tsx` | `/config-quadras` | Configuração de quadras |
| `PublicoPage.tsx` | `/publico` | Placar público |
| `CheckoutPage.tsx` | `/checkout` | Checkout de inscrição |

### Frontend — Components
- `Layout.tsx` — Layout com menu lateral da área autenticada

---

## 🔑 Variáveis de Ambiente

### Backend (`.env`)
```
PORT=3001
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:3001
```

---

## 📦 Stack Completa

| Camada | Tech | Versão |
|--------|------|--------|
| Backend | Node.js CommonJS + Express | ^5.2.1 |
| Banco | SQLite3 | ^6.0.1 |
| Pagamentos | Stripe | ^20.4.1 |
| WhatsApp | Evolution API (axios) | - |
| Frontend | React | ^19.2.4 |
| Linguagem | TypeScript | ~5.9.3 |
| Bundler | Vite | ^8.0.0 |
| CSS | TailwindCSS | ^3.4.19 |
| Roteamento | React Router DOM | ^7.13.1 |
| Ícones | Lucide React | ^0.577.0 |

---

## 🔧 Comandos

```bash
# Backend
cd backend && npm start          # porta 3001

# Frontend
cd frontend && npm run dev       # porta 5173
cd frontend && npm run build     # tsc + vite
cd frontend && npm run deploy    # build + FTP
```

---

## ⚠️ Decisões Arquiteturais Importantes

1. **API em inglês, aliases em PT** — rotas `/api/torneios/:id/*` são redirects para as rotas em inglês
2. **DB local SQLite** — `padel.db`, schema de referência em `supabase_schema.sql` (pronto para migrar)
3. **Auth planejado** — JWT via Supabase ainda não implementado (authService.js existe mas auth ainda não é enforced)
4. **LandingPage pública** — fluxo de inscrição + pagamento Stripe independente da área autenticada
5. **Frontend deploy via FTP** — script em `frontend/scripts/deploy.js`

---

## 📋 Estado Atual / Próximos Passos

*Preencher conforme a sessão avança*

- [ ] (adicionar tarefas em andamento aqui)
