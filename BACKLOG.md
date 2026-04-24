# BACKLOG — Ranking Padel SRB 2026

Execução tática.

**Legenda:** ⏸️ pendente · 🔄 em execução · ✅ concluído · 🅿️ parkeado · 🔍 investigação

---

## Entregue ✅

- ✅ Ranking em produção com regras SRB
- ✅ Export Excel (71 KB, 6 abas)
- ✅ Fix TOURNAMENT_ID=7
- ✅ Admin com gestão de partidas e ausências

---

## 🔥 Sprint atual

| # | Tarefa | Status | Critério de aceite |
|---|---|---|---|
| 1 | Levantar adequações solicitadas pela diretoria SRB | ⏸️ **Alessandro** | Lista de pedidos documentada |

## Sprint técnica

| # | Tarefa | Status | Critério de aceite |
|---|---|---|---|
| 2 | Botão "Snapshot desta rodada" no admin | ⏸️ | Admin clica → arquivo salvo com timestamp |
| 3 | Implementar adequações da SRB (quando chegarem) | ⏸️ | SRB valida mudanças |
| 4 | **Priorizar quadra de vidro pra jogos oficiais (vs amistosos)** — *específico SRB* | ⏸️ | Rodada oficial é alocada primeiro na quadra de vidro; amistosos vão pras outras quadras |
| 5 | **Botão "Ver como atleta" no admin** (pra admins que tb jogam — Marcio, futuro etc.) | ⏸️ | Dentro de `/rodadas` ou `/admin`, botão pula pra `/atleta` autenticado sem novo login |
| 6 | **Alert de reset de senha não mente sobre WhatsApp** | ⏸️ | Backend devolve `whatsapp_sent: true/false`; frontend mostra "Senha gerada — copie e envie manualmente" se WhatsApp falhar (Evolution API vazia hoje) |
| 7 | **Botão "Cancelar jogo (não ocorreu)" no admin** | ⏸️ | Admin consegue deletar match REGULAR via UI com confirmação forte. Hoje só aceita EXHIBITION via endpoint. Casos reais: jogo fantasma que ficou IN_PROGRESS (ex: 16/04 Mara/Nara vs Michele/Sabrina, deletado via script em 23/04). |

### Detalhe técnico item 5 — botão "ver como atleta"

**Pedido (23/04 noite):** Marcio é admin E atleta. Hoje as 2 áreas têm logins independentes (admin = email+senha hardcoded em `LoginPage.tsx:53-59`; atleta = telefone+senha cadastrada no banco). Causou confusão pro Alessandro testando.

**Workaround imediato (Alessandro vai fazer manualmente):** resetar a senha do atleta Marcio pelo admin, deixar igual à senha admin (220275). Aí as 2 senhas coincidem e ele consegue logar nas 2 áreas com a mesma. **Não resolve o problema estrutural — só evita pro Marcio.**

**Solução estrutural a implementar (~30 min dev):** botão "Minha visão de atleta" no menu admin. Quando admin clica, sistema:
1. Busca atleta com mesmo email do admin no banco
2. Se encontrou: faz login automático na área de atleta (cria `player_session` no localStorage)
3. Redireciona pra `/atleta`

**Arquivos envolvidos:** `frontend/src/components/Layout.tsx` (menu admin) + `frontend/src/pages/AtletaPage.tsx` (aceitar session já criada).

**Casos cobertos:** todo admin que tb é atleta (atual: Marcio; futuro: outros diretores).

### Detalhe técnico item 4 — priorização quadra de vidro

**Pedido (23/04):** jogos do ranking (REGULAR) devem ser alocados na quadra de vidro com prioridade; amistosos (EXHIBITION) vão pras outras.

⚠️ **Escopo restrito:** Alessandro confirmou (23/04 noite) que essa regra é **específica SRB**, NÃO entra no produto genérico Ranking Obralivre. Não mencionar em deck/mensagem de prospect (Trevisan, ginásios). Se virar venda pra outro clube com cenário parecido, migrar pra Abordagem B na hora.

**Estado atual:**
- `backend/services/schedulerService.js` aloca quadras na ordem `courts.order_index ASC`
- `backend/services/weeklyDrawService.js` cria rodadas REGULAR e EXHIBITION
- Sem campo "premium/vidro" na tabela `courts` — ordem é só sequencial
- Sem regra explícita de prioridade por tipo de rodada

**2 abordagens possíveis:**

| | Abordagem A (simples) | Abordagem B (robusto) |
|---|---|---|
| Dev | ~1h | ~2-3h + UI admin |
| Como | Ordenar matches por `round_type DESC` (REGULAR antes de EXHIBITION) — oficiais agendam primeiro, pegam quadras na ordem (vidro = order_index 1) | Adicionar campo `is_premium` em `courts` + lógica explícita de match-quadra por tipo de rodada |
| Pro | Simples, sem mudança de schema, sem UI nova | Escalável pra clubes com múltiplas quadras premium / múltiplos níveis |
| Contra | Acopla "primeira quadra = vidro" implícitamente | Mais código, mais teste |

**Recomendação:** Abordagem A pro SRB (apenas 1 vidro). Se o produto virar comercial pra outros clubes, migrar pra B na primeira venda externa.

## 🅿️ Parkeado

| # | Tarefa | Motivo |
|---|---|---|
| 4 | WhatsApp messaging (código existe em `backend/server.js:990`) | Aguardar decisão de provider (SaaS vs Meta Cloud vs Evolution) |
| 5 | Produto para outros clubes | Pós-validação com SRB |
