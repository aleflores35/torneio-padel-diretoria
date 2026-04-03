# PRD — Diretoria Padel
**Product Requirements Document**
**Versão:** 2.1.0-DEMO
**Data:** Abril 2026
**Status:** Em andamento

---

## 1. Visão Geral

### 1.1 O Produto

**Diretoria Padel** é uma plataforma web de gestão de torneios de padel voltada para diretores/organizadores. O sistema cobre todo o ciclo de vida de um torneio: da inscrição pública e pagamento, passando pelo sorteio de duplas e geração de chaves, até a operação em tempo real das quadras com chamadas automáticas via WhatsApp.

### 1.2 Problema que Resolve

Organizar torneios de padel com dezenas de atletas é operacionalmente complexo:
- Controle manual de inscrições e pagamentos gera erros e atrasos
- Sorteio de duplas e distribuição em chaves feito no papel ou planilhas
- Chamada de jogadores por quadra é manual e caótica
- Placar e progresso do torneio não são visíveis ao público em tempo real

### 1.3 Proposta de Valor

> Sistema profissional de gestão que transforma um torneio caótico em uma operação fluida, automatizada e premium — do checkout ao apito final.

---

## 2. Usuários

| Perfil | Descrição | Acesso |
|--------|-----------|--------|
| **Diretor/Organizador** | Gerencia todo o torneio | Área autenticada (`/admin`) |
| **Atleta** | Se inscreve, paga e acompanha | Landing page pública |
| **Público** | Acompanha placar e chaves | Página pública (`/publico`) |

---

## 3. Funcionalidades Implementadas

### 3.1 Landing Page Pública
- Hero com identidade visual "black & neon green" premium
- Badge "O Maior do Sul do Brasil"
- CTA "Garanta sua Vaga" → fluxo de inscrição
- CTA "Ver Ranking" → placar público
- Estatísticas em tempo real (live stats)

### 3.2 Fluxo de Inscrição + Pagamento
- Formulário: nome, WhatsApp, lado (Direita/Esquerda/Ambos), almoço
- Pagamento via **Stripe Checkout**
- `payment_status`: PENDING → CONFIRMED

### 3.3 Dashboard Administrativo
**Métricas em tempo real:**
- Total de atletas inscritos e confirmados
- Progresso dos jogos (ex: 2/48 — 4% concluído)
- Quadras ativas vs. capacidade
- Próxima rodada (horário) e tempo de torneio decorrido

**Pipeline de fases:**
```
INSCRIÇÕES ✓ → SORTEIO & CHAVES ✓ → FASE DE GRUPOS (atual) → MATA-MATA → FINAL & PREMIAÇÃO
```

### 3.4 Gestão de Atletas
- Listagem com busca por nome e filtro por lado
- Badges de status (Confirmado / Pendente)
- Contadores: Total, Confirmados, Pendentes, por lado
- Adição manual de atleta

### 3.5 Sorteio de Duplas
- Algoritmo automático: pareia jogadores de lados opostos
- Resultado: lista de duplas com `display_name`

### 3.6 Chaves & Grupos
- Geração automática de grupos
- Distribuição equilibrada de duplas por grupo

### 3.7 Cronograma de Jogos
- Exibição por rodadas e quadras
- Status: `PENDING` | `IN_PROGRESS` | `CALLING` | `FINALIZADO`
- Botão **"Notificar WhatsApp"** por jogo
- Ações: "Sugerir Próximos" e "Forçar Atualização"

### 3.8 Notificação via WhatsApp
- Integração com **Evolution API**
- Ao chamar: status → `CALLING` + mensagem enviada aos atletas

### 3.9 Gestão de Quadras
- Cadastro de quadras com nome e ordem
- Visão operacional "Quadras Live"

### 3.10 Quadro Público
- Acessível sem login
- Placar e status dos jogos para público/atletas

### 3.11 Autenticação
- Login com usuário/senha para área admin
- Script para criar usuário suporte

---

## 4. Arquitetura Técnica

### 4.1 Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Backend | Node.js CommonJS + Express | ^5.2.1 |
| Banco de Dados | SQLite3 | ^6.0.1 |
| Pagamentos | Stripe | ^20.4.1 |
| Notificações | Evolution API (WhatsApp) | — |
| BaaS (futuro) | Supabase | ^2.99.1 |
| Frontend | React | ^19.2.4 |
| Linguagem | TypeScript | ~5.9.3 |
| Bundler | Vite | ^8.0.0 |
| Estilização | TailwindCSS | ^3.4.19 |
| Roteamento | React Router DOM | ^7.13.1 |
| Ícones | Lucide React | ^0.577.0 |

### 4.2 Modelo de Dados (SQLite)

```
tournaments       → um torneio por instância
players           → atletas (name, whatsapp, side, payment_status, has_lunch)
doubles           → duplas formadas (display_name)
groups            → chaves/grupos
groups_doubles    → relação grupo ↔ dupla
courts            → quadras disponíveis
matches           → jogos (duplas, quadra, scheduled_at, status, placar)
```

### 4.3 Infraestrutura Atual

| Componente | Onde roda |
|-----------|-----------|
| Backend | Servidor local Node.js (porta 3001) |
| Frontend | Hospedado via FTP |
| Banco | SQLite local (`padel.db`) |
| Schema futuro | `supabase_schema.sql` |

---

## 5. Design System

**Identidade:** Black & Neon Green — estilo "performance premium esportivo"

| Token | Valor |
|-------|-------|
| Background | `#0a0a0a` |
| Accent primário | `#b5e900` / `#c8f000` |
| Tipografia | Bold, condensado, uppercase |
| Layout | Sidebar fixa + conteúdo principal |
| Componentes | Cards escuros, badges coloridos, botões com glow |

---

## 6. Roadmap

### Curto Prazo
- [ ] Auth enforced em todas as rotas do backend (middleware JWT)
- [ ] Registro de placar por jogo (games_double_a, games_double_b)
- [ ] Fase Mata-Mata automática após fase de grupos
- [ ] Final & Premiação com geração de DOCX

### Médio Prazo
- [ ] Migração SQLite → Supabase Postgres
- [ ] Placar público em tempo real (WebSocket / polling)
- [ ] Ranking histórico entre torneios
- [ ] WhatsApp automático ao registrar placar final

### Longo Prazo
- [ ] Multi-torneio simultâneo
- [ ] PWA / app mobile para árbitros nas quadras
- [ ] Integração Pix como alternativa ao Stripe

---

## 7. Requisitos Não-Funcionais

| Requisito | Critério |
|-----------|---------|
| Performance | Dashboard carrega em < 2s |
| Disponibilidade | 100% durante o dia do torneio |
| Segurança | Rotas admin protegidas; Stripe webhook validado |
| Responsividade | Funcional em tablets |
| Notificações | Latência < 5s do call ao envio do WhatsApp |

---

## 8. Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Taxa de confirmação de inscrições | > 90% |
| Tempo médio para chamar um jogo | < 30 segundos |
| Conflitos de quadra | 0 |
| Reclamações de "não recebi WhatsApp" | < 5% dos jogos |

---

## 9. Limitações Conhecidas

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| SQLite sem concorrência alta | Baixo (uso local) | Migrar para Supabase |
| Auth não enforced no backend | Alto | Adicionar middleware JWT |
| Deploy manual via FTP | Médio | Automatizar com CI/CD |
| Sem testes automatizados | Médio | Adicionar Jest no backend |
