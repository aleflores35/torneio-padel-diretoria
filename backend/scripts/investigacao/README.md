# Scripts de investigação ad-hoc

Pasta de scripts one-shot usados para diagnosticar bugs específicos. **Não são scripts operacionais** (não rodar sem ler primeiro o que cada um faz). Servem como exemplos / templates pra investigações futuras com problema parecido.

## Inventário

### Caso Francisco × Anderson — round 393 (28/04/2026)

Reclamação no WhatsApp: "vou jogar novamente com o mesmo esquerda da semana passada". Após investigação, descobriu-se que o sorteio não repetiu **parceiro** (o motor cuidava disso via tabela `partnerships`), mas repetiu **adversário diagonal direta** (Anderson Dalmolin, mesmo lado da quadra que o Francisco). Origem: `confirmRound` em `weeklyDrawService.js` fazia pareamento dupla-vs-dupla com `shuffle` puro.

| Script | O que faz |
|---|---|
| `investigate_francisco.js`   | Acha Francisco + Flavio, lista duplas históricas dele, conta partnerships da categoria. Versão 1 — incompleta |
| `investigate_francisco_2.js` | Tenta dump de matches por OR.in() — falhou (Supabase não aceita esse formato) |
| `investigate_francisco_3.js` | Versão final: dump completo de duplas+matches+adversários da round 377 e 393 com identificação visual do encontro do Francisco. **Use este como template** pra investigações de "quem caiu contra quem" em qualquer rodada |
| `inspect_partnerships_schema.js` | Lista 1 row de `partnerships` pra ver schema + checa se `oppositions` existe. Genérico, usar pra checar qualquer schema novo |

Fix shipado no commit `be11acf`: tabela `oppositions` + `pairDoublesGreedy` em `weeklyDrawService.js`.

### Caso Tanise + Duda — round 401 (14/05/2026)

Reclamação no WhatsApp: Tanise jogou 2 vezes e ficou de fora 2 seguidas; Duda Brownie jogou 1 vez e ficou de fora 4 seguidas. Investigação mostrou que o re-sorteio manual via `resorteia_feminino_401_livre.js` fazia **shuffle puro** dos rights/lefts e ignorava `games_played` — quebrava a regra de rotação por menos-jogos que o sorteio oficial (`selectPlayersForWeek` em `weeklyDrawService.js`) respeita.

| Script | O que faz |
|---|---|
| `check_tanise_duda.js`        | Cruza últimas rodadas × attendance × games_played pra duas jogadoras. Template pra diagnóstico "por que fulana não jogou" |
| `check_duda_eduarda.js`       | Versão multi-id do mesmo template |
| `find_duda.js`                | Lookup fuzzy de nome (Duda → Eduarda) — útil quando atleta é referenciada por apelido no chat |

Fix em `resorteia_feminino_401_livre.js`: adicionado `pickFairByGames()` que agrupa por `games_played` e shuffle dentro do tier. Resultado da DRY pós-fix: Duda (1j) e Tanise (2j) entram nos tiers respectivos.

**⚠️ Lição operacional:** sempre que precisar refazer um sorteio:
- **Caminho oficial (preferido):** UI da admin → `redrawRound()` do `weeklyDrawService.js`. Já respeita `selectPlayersForWeek`.
- **Caminho ad-hoc (script):** copiar `resorteia_feminino_401_livre.js` como template, atualizar IDs hardcoded (TOURNAMENT, CATEGORY, ROUND, MATCHES_TO_DELETE, DOUBLES_TO_DELETE) e rodar DRY antes (`CONFIRM_EXECUTE=yes` só pra valer). **Nunca** usar shuffle puro em re-sorteio sem games_played.

### Caso Nara — horário mínimo 20:30 (15/06/2026)

Reclamação no WhatsApp: o sorteio (commit `c3b1746`, femininas no 18:30) marcou o jogo da Nara Nunes (id 701) pras 18:30, mas ela só joga após 20:30. Decisão do Alessandro: **regra permanente** — todo jogo com a Nara é após 20:30.

| Script | O que faz |
|---|---|
| `diag_jogos_2026-06-15.js` | Diagnóstico read-only: schedule completo da noite (grade hora×quadra), acha slots livres. Template pra "remanejar jogo X de horário" |
| `move_nara_1323_pos_2030.js` | (1ª etapa) moveu match 1323 18:30→21:50 com checagem de colisão |
| `swap_nara_2110_1329_2150.js` | (final) Nara→21:10 (acompanhada), match 1329→21:50; valida sem colisão na noite |

Fix permanente (código, não script): `PLAYER_MIN_TIME = { 701: '20:30' }` + `matchMinTime` + `assignSlotsByCategoryPriority` guloso em `services/weeklyDrawService.js`. Testes 7/8/9 em `services/slotPriority.test.js`.

## Regra pra adicionar novos scripts

1. Coloca aqui (não no root do `backend/`)
2. Adiciona linha nesta tabela com data + caso + referência pro commit do fix
3. Header do script: 1 frase explicando contexto + comando pra rodar
