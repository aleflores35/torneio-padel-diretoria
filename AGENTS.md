# AGENTS.md - Torneio de Padel

## Antes de qualquer tarefa

**SEMPRE** verifique `project_skills_index.json` para identificar skills relevantes antes de:
- Criar/modificar arquivos no backend
- Criar/modificar arquivos no frontend
- Implementar integrações (WhatsApp, Stripe, etc.)

## Estrutura do Projeto

```
Torneio de Padel/
├── backend/                  # Node.js (CommonJS) + Express 5 + SQLite
│   ├── services/
│   │   ├── authService.js
│   │   ├── chavesService.js
│   │   ├── duplasService.js
│   │   ├── notificationService.js   # Evolution API (WhatsApp)
│   │   ├── schedulerService.js
│   │   └── stripeService.js
│   ├── server.js             # API REST principal
│   ├── database.js           # SQLite setup
│   └── supabase.js           # Cliente Supabase
├── frontend/                 # React 19 + TypeScript + TailwindCSS 3 + Vite 8
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── api.ts            # Camada de chamadas à API
│       └── config.ts
├── supabase_schema.sql       # Schema SQL de referência
└── project_skills_index.json
```

## Gerenciadores de Pacotes

- **Backend:** `npm` (CommonJS, `package-lock.json`)
- **Frontend:** `npm` (ESM, `package-lock.json`)

## Comandos por Contexto

### Backend (`cd backend/`)

| Tarefa | Comando |
|--------|---------|
| Iniciar servidor | `npm start` (node server.js, porta 3001) |
| Instalar deps | `npm install` |

### Frontend (`cd frontend/`)

| Tarefa | Comando |
|--------|---------|
| Dev server | `npm run dev` (Vite, porta 5173) |
| Build | `npm run build` (tsc + vite) |
| Lint | `npm run lint` (eslint) |
| Deploy | `npm run deploy` (build + FTP) |

## Commit Attribution

AI commits DEVEM incluir:
`Co-Authored-By: Antigravity <antigravity@gemini.google.com>`

## Stack Técnica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Backend runtime | Node.js (CommonJS) | - |
| API framework | Express | ^5.2.1 |
| Banco de dados | SQLite3 | ^6.0.1 |
| Pagamentos | Stripe | ^20.4.1 |
| WhatsApp | Evolution API (axios) | - |
| BaaS futuro | Supabase JS | ^2.99.1 |
| Frontend framework | React | ^19.2.4 |
| Linguagem | TypeScript | ~5.9.3 |
| Bundler | Vite | ^8.0.0 |
| Estilização | TailwindCSS | ^3.4.19 |
| Roteamento | React Router DOM | ^7.13.1 |
| Ícones | Lucide React | ^0.577.0 |

## Skills Aplicáveis por Tipo de Tarefa

| Tipo de Tarefa | Skill |
|----------------|-------|
| Backend Node.js | `backend-dev-guidelines` |
| Frontend React/TS | `react-best-practices` |
| Estilização Tailwind | `tailwind-patterns` |
| WhatsApp/Notificações | `automate-whatsapp` |
| Pagamentos Stripe | `payment-integration` |

## Convenções

- Backend: padrões CommonJS (`require`/`module.exports`)
- Frontend: componentes funcionais TypeScript, sem `default export` em páginas
- Variáveis de ambiente: `.env` em `frontend/` e `.env` em `backend/` (ver `.env.example` na raiz)
- DB: SQLite local (`padel.db`) — schema de migração em `supabase_schema.sql`
