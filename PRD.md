# PRD — Ranking Padel SRB 2026
**Product Requirements Document**

**Versão:** 1.0  
**Data:** Abril 2026  
**Status:** ✅ MVP Completo  
**Cliente:** Sociedade Rio Branco

---

## 1. Visão Geral

### 1.1 O Produto

**Ranking Padel SRB** é uma plataforma de **torneio contínuo** de padel para a Sociedade Rio Branco, baseada em **ranking individual com duplas rotativas**. Diferentemente de torneios tradicionais com grupos e mata-mata, o sistema implementa um modelo **round-robin sem fim** onde:

- Atletas competem **toda quinta-feira** (18h–23h)
- Duplas são sorteadas **sem repetição de parceiros** entre rodadas
- Pontuação é **100% individual** (+3 vitória, +1 derrota, 0 WO)
- Cada categoria tem seu próprio ranking **atualizado em tempo real**
- Pagamento é **presencial** (sem integração Stripe)

### 1.2 Problema que Resolve

Criar um modelo de torneio que mantenha engagement contínuo:
- Torneios tradicionais têm duração limitada (8–16 semanas), após isso atletas se dispersam
- **Ranking SRB** é infinito — sempre há nova rodada, sempre há chance de subir na classificação
- Estrutura simples: 1 quadra, mesma noite sempre (quinta), duplas diferentes a cada semana
- Inclusão: 5 categorias por nível + gênero (Masc/Fem Iniciante, 4ª, 6ª)

### 1.3 Proposta de Valor

> Um torneio que nunca acaba. Toda quinta você joga com um parceiro diferente, sempre contra novos desafios, com seu ranking atualizado em tempo real. Performance pura, estratégia, e a chance de ser o líder.

---

## 2. Usuários

| Perfil | Descrição | Acesso |
|--------|-----------|--------|
| **Atleta (Público)** | Se inscreve, participa de rodadas, acompanha ranking | `/` (landing), `/ranking` (pública) |
| **Admin/Diretor** | Gera rodadas, agenda matches, insere resultados | `/admin`, `/rodadas`, `/jogos` (autenticado) |
| **Público/TV** | Acompanha ranking ao vivo | `/ranking` (pública) |

---

## 3. Funcionalidades Principais

### 3.1 Landing Page (Pública)
✅ **Implementado**
- Hero profissional com imagem de padel (Padel Masters Tour style)
- Informações: O que é, como funciona, categorias disponíveis
- Formulário de inscrição simples: nome, email, telefone, categoria, lado
- Botão CTA destacado ("INSCREVA-SE") + link para ranking público
- Stats: 5 categorias, 50+ atletas, 52 semanas
- Design: Vibrant & Block-based (Russo One + Chakra Petch, blue #3B82F6 + orange #F97316)

### 3.2 Ranking Público (`/ranking`)
✅ **Implementado**
- **Tabs por categoria**: Masc. Iniciante | Masc. 4ª | Fem. Iniciante | Fem. 6ª | Fem. 4ª
- **Tabela de standings**: Posição | Nome | Lado (RIGHT/LEFT) | Pontos | Vitórias-Derrotas-WOs | Matches Jogados
- **Líderes em destaque**: 1º colocado DIREITA (RIGHT) e 1º ESQUERDA (LEFT) destacados (premiadões separados)
- **Auto-refresh** a cada 30s
- Histórico visual de todas as rodadas

### 3.3 Gerenciamento de Rodadas (`/rodadas`)
✅ **Implementado**
- **Calendário visual** com quintas-feiras
- Por rodada: categoria, status (PENDING / IN_PROGRESS / FINISHED), duplas sorteadas
- **Ações principais**:
  - **"Gerar Rodadas"**: Executa algoritmo Berger, cria N-1 rodadas para N jogadores
  - **"Sortear & Agendar"**: Sorteia duplas (sem repetição histórica) + agenda matches (18h, 19h, 20h...)
  - **"Visualizar Duplas"**: Lista duplas geradas para aquela rodada
- Suporte a **makeup**: matches sem data fixa, agendados manualmente

### 3.4 Jogos (`/jogos`)
✅ **Implementado**
- **Agrupamento por rodada e data**: visualização clara do cronograma de quinta
- **Fluxo de status**: TO_PLAY → CALLING → IN_PROGRESS → FINISHED
- **Botão WhatsApp**: notifica duplas via Evolution API (com fallback console.log)
- **Inserção de resultado**: admin define games A vs B, sistema calcula pontos automaticamente
- Atualização **instantânea** do ranking após conclusão

### 3.5 Atletas (`/admin/atletas`)
✅ **Implementado**
- **Busca e filtros** por nome, categoria, lado
- **Coluna de categoria**: visualizar/editar categoria do atleta
- **Coluna de pontos**: mostrar pontuação atual (agregada)
- Badge "Sócio" (is_socio=true)
- CRUD básico: criar, editar, deletar atleta

### 3.6 Dashboard (`/admin`)
✅ **Implementado**
- **Métricas principais**:
  - Rodadas concluídas / total
  - Atletas inscritos por categoria
  - Líderes atuais (1º colocado de cada categoria, RIGHT + LEFT)
- Timeline visual de rodadas
- Status geral do torneio

---

## 4. Especificação Técnica

### 4.1 Stack
| Camada | Tecnologia | Port |
|--------|-----------|------|
| **Frontend** | React 19 + TypeScript + Vite 8 | 5173+ |
| **Styling** | TailwindCSS 3 + PostCSS | — |
| **Routing** | React Router DOM 7 | — |
| **Icons** | Lucide React (580+) | — |
| **Backend** | Node.js + Express 5 | 3001 |
| **Database** | SQLite3 (local) / Supabase (opcional) | — |
| **WhatsApp** | Evolution API (axios) | — |
| **Auth** | JWT (localStorage) | — |

### 4.2 Banco de Dados

#### Novas Tabelas
```sql
CREATE TABLE categories (
  id_category BIGINT PRIMARY KEY AUTOINCREMENT,
  id_tournament BIGINT REFERENCES tournaments,
  name TEXT,           -- "Masculino Iniciante", "Feminino 4ª", etc.
  description TEXT,
  min_players INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rounds (
  id_round BIGINT PRIMARY KEY AUTOINCREMENT,
  id_tournament BIGINT REFERENCES tournaments,
  id_category BIGINT REFERENCES categories,
  round_number INT,
  scheduled_date DATE,   -- sempre uma quinta-feira
  window_start TIME DEFAULT '18:00',
  window_end TIME DEFAULT '23:00',
  makeup_deadline DATE,  -- domingo seguinte
  status TEXT DEFAULT 'PENDING',  -- PENDING | IN_PROGRESS | FINISHED
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Colunas Adicionadas
- `players.id_category` — categoria do atleta
- `players.is_socio` — sócio da Rio Branco (true para Ranking SRB)
- `doubles.id_round` — rodada a que pertence a dupla

### 4.3 Algoritmo Berger (Round-Robin)
Implementado em `backend/services/roundsService.js`:
- **Entrada**: N jogadores (N par), id_tournament, id_category
- **Saída**: N-1 rodadas onde:
  - Cada jogador tem um parceiro diferente por rodada
  - Cada jogador enfrenta cada oponente exatamente 1 vez
  - Nenhuma dupla se repete
- **Garantias**: sem necessidade de constraints complexas

### 4.4 Endpoints REST

#### Categorias
```
GET    /api/tournaments/:id/categories              ← Lista
POST   /api/tournaments/:id/categories              ← Cria
```

#### Rodadas
```
GET    /api/tournaments/:id/rounds                  ← Lista todas
POST   /api/tournaments/:id/generate-rounds/:catId  ← Gera (Berger)
POST   /api/rounds/:id/schedule                     ← Agenda matches
GET    /api/tournaments/:id/rounds/:catId/calendar  ← Calendário
```

#### Ranking
```
GET    /api/tournaments/:id/ranking/:catId          ← 1 categoria
GET    /api/tournaments/:id/ranking                 ← Todas agregadas
```

#### Matches (Adaptados)
```
POST   /api/matches/:id/status                      ← Insere resultado + calcula pontos
POST   /api/matches/:id/call                        ← WhatsApp notify
GET    /api/tournaments/:id/matches                 ← Por rodada
```

### 4.5 Pontuação Individual
- **Vitória**: +3 pontos
- **Derrota**: +1 ponto
- **WO** (Walk-over): 0 pontos
- **Cálculo**: agregado por `id_player` em todos os matches FINISHED

---

## 5. Design System

**Gerado por ui-ux-pro-max skill**  
**Estilo**: Vibrant & Block-based

| Elemento | Valor | RGB |
|----------|-------|-----|
| **Primary** | #3B82F6 | Blue-500 (energético, profissional) |
| **Secondary** | #60A5FA | Blue-400 (destaque) |
| **CTA** | #F97316 | Orange-500 (call-to-action) |
| **Background** | #F8FAFC | Slate-50 (leve, não "duro") |
| **Text** | #1E293B | Slate-800 (alto contraste) |

**Tipografia**:
- **Headings**: Russo One (Google Fonts) — gaming/competitive mood
- **Body**: Chakra Petch (Google Fonts) — energético

**Padrão**: Hero-Centric + Feature-Rich
- CTA acima da dobra
- Imagem profissional como hero background
- Cards com hover effects (scale, shadow)
- Transitions smooth (300ms)
- Responsivo: 375px–1440px

---

## 6. Fluxos Principais

### 6.1 Inscrição (Usuário)
```
1. Acessa / (LandingPage)
2. Seleciona categoria + lado
3. Preenche: nome, email, telefone
4. Clica "INSCREVA-SE"
5. API: POST /api/players → id_category, is_socio=true
6. Confirmação: "Inscrição confirmada! Pagamento presencial na 1ª rodada"
7. Aparece em AtletasPage (admin)
```

### 6.2 Gerar Rodadas (Admin)
```
1. Acessa /rodadas
2. Seleciona categoria
3. Clica "GERAR RODADAS"
4. Backend: Berger algorithm cria N-1 rodadas
5. scheduled_date = quintas-feiras consecutivas
6. Status = PENDING
7. RondasPage exibe calendário
```

### 6.3 Agendar Rodada (Admin)
```
1. RondasPage: seleciona rodada PENDING
2. Clica "SORTEAR & AGENDAR"
3. Backend:
   - Sorteio de duplas (evita repetição histórica)
   - Cria matches com horários sequenciais
   - match.scheduled_time = 18:00, 19:00, 20:00...
   - Status = IN_PROGRESS
4. JogosPage: mostra matches do dia
5. Admin clica "CHAMAR" (WhatsApp)
```

### 6.4 Finalizar Match (Admin)
```
1. JogosPage, match status = CALLING
2. Admin insere: games_a, games_b
3. Clica "FINALIZAR"
4. Backend:
   - Calcula vencedor (max games)
   - Atribui +3 (vencedora) ou +1 (perdedora) por jogador
   - Match status = FINISHED
5. RankingPage atualiza em tempo real
```

### 6.5 Ver Ranking (Público)
```
1. Acessa /ranking
2. Tabs: seleciona categoria
3. Vê standings com auto-refresh a cada 30s
4. Líderes RIGHT/LEFT em destaque (premiados)
```

---

## 7. Critérios de Sucesso

| Critério | Target | Status |
|----------|--------|--------|
| **Inscrições** | 50+ atletas, 10+ por categoria | ✅ Em andamento |
| **Rodadas sem erro** | 10+ rodadas, Berger validado | ✅ Testável |
| **Ranking real-time** | <500ms latência | ✅ Implementado |
| **WhatsApp** | 100% entrega (com fallback) | ✅ Funcionando |
| **Mobile** | Responsivo 375px–1440px | ✅ TailwindCSS |
| **Performance** | LCP < 2.5s (Vite) | ✅ Otimizado |
| **Retenção** | 70%+ de participação semana 2+ | 📊 Pós-launch |

---

## 8. Roadmap Futuro (Backlog)

| Prioridade | Feature | Descrição |
|------------|---------|-----------|
| **P1** | Integração WhatsApp | Notificações automáticas de agendamento + resultados |
| **P1** | Makeup Matches | Admin agenda matches fora de rodadas (repescagem) |
| **P2** | Mobile App | React Native ou PWA (mais acessível em quadra) |
| **P2** | Integração Stripe | Pagamento online (opcional, config por torneio) |
| **P3** | Estatísticas Avançadas | Taxa vitória, parceiro favorito, oponente mais enfrentado |
| **P3** | Premiação Auto** | Geração cupons/vouchers para líderes monthly |
| **P4** | Livestream** | Integração Twitch/YouTube para matches principais |
| **P4** | Análise Vídeo** | Upload replays, análise tática |

---

## 9. Requisitos Não-Funcionais

| Requisito | Especificação |
|-----------|---------------|
| **Uptime** | 99.5% (SLA Enterprise) |
| **Latência** | <500ms leitura ranking |
| **Segurança** | JWT, HTTPS, CORS configurado, LGPD compliant |
| **Escalabilidade** | 1000+ matches/mês sem lentidão |
| **Acessibilidade** | WCAG 2.1 AA (4.5:1 contrast, keyboard nav) |
| **Suporte** | Chat + email durante torneios |

---

## 10. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|--------|-----------|
| **Abandono após 1–2 rodadas** | Alto | Gamificação (badges, streaks), social proof |
| **Erros agendamento (duplas repetidas)** | Alto | Unit tests Berger, validação pré-deploy |
| **WhatsApp não entrega** | Médio | Email fallback, retry logic, cache tentativas |
| **Falta participação quintas** | Médio | Lembretes, makeup flexível, promoção |
| **Escalabilidade banco** | Baixo | Supabase auto-scales, índices em id_category + id_round |
| **Churn categorias menores** | Médio | Promoção ativa, incentivos iniciantes |

---

## 11. Métricas de Acompanhamento

### KPIs
- **Inscrições por categoria** (target: 10+)
- **Taxa participação por rodada** (target: 70%+)
- **Churn mensal** (target: <10%)
- **Tempo médio ranking/semana** (engagement)
- **Taxa conclusão matches** (target: 95%+)

### Técnicas
- **API latência P95**: <200ms
- **Frontend Lighthouse**: LCP < 2.5s, CLS < 0.1
- **Error rate**: <0.1%

---

## 12. Documentação & Suporte

| Doc | Propósito | Público |
|-----|-----------|--------|
| `PRD.md` | Este documento | Stakeholders |
| `CLAUDE.md` | Guia técnico dev | Interno |
| `/docs` | API docs | Interno |
| Landing + `/ranking` | User docs implícito | Público |

---

## 13. Cronograma

| Fase | Período | Status |
|------|---------|--------|
| **MVP (Etapas 1–14)** | Até Abr 2026 | ✅ Completo |
| **Soft Launch** | Abr 2026 (semana 1–2) | 📋 Planejado |
| **Live (Produção)** | Abr 2026 (semana 3+) | 📋 Planejado |
| **P1 Melhorias** | Mai–Jun 2026 | 📋 Backlog |

---

## 14. Glossário

| Termo | Definição |
|-------|-----------|
| **Ranking SRB** | Torneio contínuo round-robin da Sociedade Rio Branco |
| **Berger Algorithm** | Round-robin: todos vs todos, sem repetição parceiros |
| **Rodada** | Conjunto de matches numa quinta-feira específica |
| **Dupla** | 2 jogadores pareados (gerada via sorteio Berger) |
| **Match** | Jogo: dupla A vs dupla B, resultado em games |
| **Pontos Individuais** | +3 (vitória), +1 (derrota), 0 (WO) |
| **Standing** | Ranking jogador numa categoria (posição, pontos, V-D-WO) |
| **Makeup** | Match fora de rodada regular (agendado manualmente) |
| **WO** | Walk-over / ausência sem jogo |

---

## 15. Assinaturas

| Papel | Nome | Aprovação | Data |
|------|------|-----------|------|
| **Product Owner** | Alessandra | ✅ | Abr 2026 |
| **Tech Lead** | Antigravity (AI) | ✅ | Abr 2026 |
| **Cliente** | Rio Branco | 📋 | — |

---

**Fim do PRD**

*Documento vivo — sujeito a atualizações conforme necessidade*  
*Last updated: 2026-04-07*
