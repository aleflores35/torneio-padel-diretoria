# Spec — Regra dura "zero repetição de adversário" no motor de sorteio

**Data:** 2026-06-22 · **Projeto:** ranking-srb-2026 · **Autor:** Alessandro (regra) + Claude (design)

## 1. Problema

No SRB o ranking é **por posição** (direita×direita, esquerda×esquerda — o confronto "de frente"
da quadra). Repetir um adversário da mesma posição distorce a premiação por lado.

Regra definida pelo Alessandro (22/06), **ratificada** em 2 níveis:
- **Regra 1 (INVIOLÁVEL):** no ranking, direita×direita e esquerda×esquerda **NUNCA** repetem
  (adversário de mesma posição sempre inédito).
- **Regra 2 (PREFERENCIAL, flexível):** as duplas (parceria direita+esquerda) também
  preferencialmente inéditas — **mas** pode repetir parceria se for necessário pra fechar um jogo
  de ranking que respeite a Regra 1. Ou seja, parceria é desempate, nunca bloqueia a Regra 1.

Quando não há adversário inédito disponível (porque os que faltam estão impedidos/ausentes naquela
quinta), o motor **não deve criar o jogo de ranking** — em vez disso **avisa** quem ficou sem
adversário inédito e **sugere amistoso** (que o admin cria, se quiser, pelo botão já existente).

Hoje o motor (`confirmRound` → `pairDoublesGreedy`) apenas **minimiza** repetição (via
`SAME_POSITION_REPEAT_COST`), mas **cria o jogo mesmo repetido**. Precisamos passar de
"minimizar" para "zero-ou-não-joga-ranking".

## 2. Insight que simplifica o algoritmo

Os confrontos de mesma posição **não dependem** de qual direita joga com qual esquerda dentro da
dupla (isso só afeta *parceria*, regra menor). Dependem só de:
- como as **direitas** presentes se dividem em pares (cada par = 1 confronto direita×direita);
- como as **esquerdas** se dividem em pares;
- e de quais pares-direita casam com quais pares-esquerda num mesmo jogo.

Logo: **maximizar jogos de ranking válidos = casar par-direita inédito com par-esquerda inédito**,
concentrando as repetições no que sobra (que vira aviso/amistoso, não ranking).

"Inédito" = `oppositions.diagonal_count == 0` entre os dois jogadores do mesmo lado, **antes** deste
sorteio. No `confirmRound` o valor lido já é o pré-jogo (o carimbo só acontece depois, no passo de
contadores — e re-confirmação é tratada por `revertCountersForRound`).

## 3. Componentes

### 3.1 `planRankingGames(rights, lefts, diag)` — função PURA (núcleo, TDD)
- **Entrada:** `rights` e `lefts` = listas de jogadores presentes por lado (`{id_player, name}`);
  `diag(aId, bId)` = histórico de confronto mesma-posição pré-jogo (0 = inédito).
- **Saída:**
  ```
  {
    rankingGames: [ { right: [r1,r2], left: [l1,l2] } ],   // jogos 100% inéditos
    leftover:     { rights: [...], lefts: [...] }           // sem adversário inédito → aviso
  }
  ```
- **Algoritmo:**
  1. `maxIneditPairs(rights, diag)` → maior conjunto de pares com `diag==0` (maximum matching;
     nº pequeno ⇒ busca/backtracking). O que não casa = leftover daquele lado.
  2. Idem para `lefts`.
  3. `nJogos = min(#paresInéditosDir, #paresInéditosEsq)`; casa um-a-um (qualquer par-dir inédito
     com qualquer par-esq inédito). Pares inéditos excedentes do lado maior → leftover.
  4. Retorna os `nJogos` como `rankingGames`; junta todos os não-usados em `leftover`.
- **Determinismo p/ teste:** ordenação estável; aleatoriedade (se houver empate) injetável.
- Sem I/O, sem Supabase. Testável com `node`/jest puro.

### 3.2 Formação de duplas dentro de cada jogo de ranking
Dado um jogo `{right:[r1,r2], left:[l1,l2]}`, as duplas são `(r1+lX) vs (r2+lY)`. Escolher a
combinação que **minimiza parceria repetida** (`partnerships.times_paired`) — regra menor, desempate.

### 3.3 Integração no `confirmRound`
- Coleta os jogadores das duplas do round, separa por lado.
- Lê `oppositions` (= diag pré-jogo) e monta `diag(a,b)`.
- Chama `planRankingGames`.
- (Re)compõe as duplas do round conforme `rankingGames` (o Alessandro autorizou mudar quem joga
  com quem; parceria é só desempate).
- Cria matches **REGULAR** só para `rankingGames`; atribui slots (reusa a lógica de slots/priоridade
  e `PLAYER_MIN_TIME` da Nara — inalterada).
- `leftover` → **não cria match de ranking**; entra no retorno como `warnings`/`needsFriendly` com os
  nomes. Attendance dessas pessoas fica fora do jogo de ranking (status a definir no plano: manter
  `NO_RESPONSE` sem match, ou `ROTATED`).
- Carimba `partnerships`/`oppositions` **apenas dos jogos de ranking** (amistoso nunca carimba).

### 3.4 Retorno e tela (admin)
- `confirmRound` retorna, além do schedule, `friendly_suggestions: [{ name, side }]` (quem ficou sem
  adversário inédito).
- `RondasPage` mostra um aviso após confirmar: "N atleta(s) sem adversário inédito esta semana:
  … — sugira amistoso" com atalho pro botão **"Completar Noite · Amistosos"** que já existe
  (`addExhibitionMatches`). **Não cria amistoso automático.**

## 4. Edge cases (preservar comportamento atual)
- Número ímpar por lado / desbalanceamento R×L → o excedente vira leftover (hoje vira BYE/ROTATED).
- Overflow de slots (mais jogos que horários) → mantém o tratamento atual de overflow.
- Quórum < 4 → erro como hoje.
- EXHIBITION → continua shuffle puro, sem regra (amistoso não tem ranking).
- Re-confirmação da mesma rodada → `revertCountersForRound` antes de recarimbar (já existe).

## 5. Testes (TDD — escrever ANTES)
Núcleo `planRankingGames` (puro):
- todos inéditos → todos viram ranking, leftover vazio;
- ninguém inédito (caso Feminino 25/06 saturado) → leftover = todos, rankingGames vazio;
- parcial (caso real: só 1 par-dir inédito) → 1 jogo de ranking + leftover correto;
- concentra repetição: dado 2 inéditos + 1 repetido por lado, devolve 2 jogos (não 3 com repetição);
- ímpar / desbalanceado → leftover do lado maior.
Integração `confirmRound` (com Supabase de teste/local): cria REGULAR só dos inéditos; carimba só
ranking; retorna `friendly_suggestions`. Regressão: suíte existente do `weeklyDrawService` verde.

## 6. Deploy
- Backend → Vercel (`vercel --prod --yes`). Frontend (aviso) → Hostinger (`npm run deploy`).
- Versionar como de praxe; smoke pós-deploy com um sorteio de teste.

## 7. Aplicação imediata (jogos de 25/06)
Com o núcleo pronto, rodar um script local (mesma função `planRankingGames`) para **re-sortear
Masc Iniciante (418) e Masc 4ª (419)** sob a regra: jogos inéditos viram ranking, o resto sai do
ranking (aviso) — pode trazer quem ficou de fora (ex.: Elder/Nicolas no Masc Inic), conforme
autorizado. Feminino (420) já foi resolvido manualmente em 22/06 e serve de caso de validação.

## 8. Fora de escopo (YAGNI)
- Não auto-criar amistoso (decisão: só avisar/sugerir).
- Não reescrever a seleção/rotação do `drawWeeklyRound` (Abordagem B descartada).
- Não mexer no `substitutionService` agora (gap conhecido, fica para depois).
