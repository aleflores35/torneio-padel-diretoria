# Lógica de Sorteio, Agendamento e Ranking SRB

## 1. Geração de Rodadas (roundsService.js)

### Algoritmo Berger (Round-Robin)
Implementa **round-robin sem repetição de parceiros**:
- Para **N jogadores**, gera **N-1 rodadas** (ou N se ímpar)
- Em cada rodada, nenhuma dupla (A,B) aparece mais de 1 vez
- Cada jogador enfrenta cada outro jogador **exatamente 1 vez**
- Se N é ímpar, uma rodada tem um "bye" (sem jogar)

#### Exemplo com 10 jogadores (5 duplas por rodada):
```
Rodada 1: (1-10), (2-9), (3-8), (4-7), (5-6)
Rodada 2: (1-9), (2-8), (3-7), (4-6), (5-10)  ← posições rotacionadas
Rodada 3: (1-8), (2-7), (3-6), (4-5), (9-10)
...
Rodada 9: (1-2), (3-10), (4-9), (5-8), (6-7)
```

### Cronograma de Datas
- **Rodada 1**: DD/MM (quinta-feira) @ 18h-23h
- **Rodada 2**: DD/MM + 7 dias (próxima quinta) @ 18h-23h
- **Rodada N**: DD/MM + 7×(N-1) dias (última quinta)

**Total de semanas necessárias**: N-1 (para N jogadores)
- 10 jogadores = 9 rodadas = 9 semanas (2+ meses)
- 20 jogadores = 19 rodadas = 19 semanas (4+ meses)

---

## 2. Agendamento de Matches (schedulerService.js → agendarRodada)

### Constraint Crítico: 1 Jogo por Pessoa por Dia
**Regra**: Uma pessoa não pode ter mais de 1 jogo agendado na mesma quinta-feira.

#### Como Funciona
1. Para cada match da rodada, busca os 4 jogadores envolvidos (2 duplas)
2. Verifica se **NENHUM** dos 4 tem outro match agendado naquele dia
3. Se todos estão livres:
   - ✅ Agenda o match (18h, 19h, 20h, etc.)
   - Avança para próximo slot (55 min + 5 min buffer = 60 min)
4. Se algum está ocupado:
   - ⚠️ NÃO agenda
   - Mantém "pendente" para processamento manual ou próxima quinta

### Exemplo: 10 Jogadores, Rodada 1 @ Quinta 18h-23h

```
Slot 1 (18:00-18:55): Dupla A vs Dupla B
  → Verifica se esses 4 jogadores estão livres ✓ → AGENDA

Slot 2 (19:00-19:55): Dupla C vs Dupla D
  → Verifica se esses 4 jogadores estão livres ✓ → AGENDA

Slot 3 (20:00-20:55): Dupla E vs Dupla F (F tem um jogador em Slot 1!)
  → ✗ CONFLITO → NÃO AGENDA (adia para próxima quinta)

Slot 4 (21:00-21:55): Dupla G vs Dupla H
  → ✓ → AGENDA

Slot 5 (22:00-22:55): Dupla I vs Dupla J
  → ✓ → AGENDA
```

**Resultado**: 4 matches agendados quinta, 1 adiado (ou ignorado se fora da janela)

---

## 3. Workflow Completo

### Etapa 1: Inscrição de Atletas
- UI: `LandingPage` (formulário público)
- API: `POST /api/players`
- Dados: nome, categoria (1-5), lado (RIGHT/LEFT/EITHER)

### Etapa 2: Gerar Rodadas
- UI: `RondasPage` → botão "Gerar Rodadas" por categoria
- API: `POST /api/tournaments/:id/generate-rounds/:catId`
- Backend: 
  1. `roundsService.gerarRodas()` → cria rows em `rounds` + `doubles`
  2. Exemplo: 10 atletas → 9 rodadas, 9 quintas-feiras sequenciais

### Etapa 3: Agendar Matches
- UI: `RondasPage` → botão "Agendar" por rodada
- API: `POST /api/rounds/:id/schedule`
- Backend:
  1. `schedulerService.agendarRodada()` → cria `matches` com `scheduled_at`
  2. Valida constraint "1 jogo/pessoa/dia"
  3. Retorna: matches agendados + matches pendentes

### Etapa 4: Executar Matches
- UI: `JogosPage` → mostrar matches do dia
- Status: CALLING → IN_PROGRESS → FINISHED
- API: `POST /api/matches/:id/status` (atualiza placar + pontos)

### Etapa 5: Ranking Atualizado
- UI: `RankingPage` (público) → atualiza a cada 30s
- API: `GET /api/tournaments/:id/ranking/:catId`
- Backend:
  1. `rankingService.getStandings()` → calcula pontos por jogador
  2. Vitória: +3 pts | Derrota: +1 pt | Walkover: 0 pts

---

## 4. Estrutura de Dados

### Tabelas Relevantes

```sql
-- Rodadas (geradas uma vez por categoria)
rounds (
  id_round,
  id_tournament,
  id_category,
  round_number,         -- 1, 2, 3...
  scheduled_date,       -- YYYY-MM-DD (quinta)
  window_start,         -- "18:00"
  window_end,           -- "23:00"
  status,               -- PENDING | IN_PROGRESS | FINISHED
)

-- Duplas (geradas por rodada, respeitando Berger)
doubles (
  id_double,
  id_tournament,
  id_player1,
  id_player2,
  id_round,             -- FK → rounds (NEW!)
  display_name          -- "João / Maria"
)

-- Matches (criados ao agendar rodada)
matches (
  id_match,
  id_tournament,
  id_double_a,          -- FK → doubles
  id_double_b,          -- FK → doubles
  id_court,             -- sempre a mesma (vidro)
  scheduled_at,         -- "2026-04-16T18:00:00Z" (datetime)
  status,               -- TO_PLAY | CALLING | IN_PROGRESS | FINISHED
  games_a, games_b,     -- resultado (e.g., 2-1)
)

-- Players (inscritos)
players (
  id_player,
  id_tournament,
  name,
  email,
  side,                 -- RIGHT | LEFT | EITHER
  category_id,          -- FK → categories (NEW!)
  is_socio,             -- boolean
  payment_status        -- PENDING | PAID
)
```

---

## 5. Pontuação e Ranking

### Cálculo de Pontos (por match FINISHED)
```javascript
if (games_a > games_b) {
  // Dupla A venceu
  player1.points += 3;
  player2.points += 3;
  playerC.points += 1;
  playerD.points += 1;
} else if (games_b > games_a) {
  // Dupla B venceu
  playerC.points += 3;
  playerD.points += 3;
  player1.points += 1;
  player2.points += 1;
} else if (games_a === 0 && games_b === 0) {
  // Walkover → ninguém ganha pontos
  // (determinado por status="WO")
}
```

### Ranking Final
Ao fim de todas as N-1 rodadas:
1. **Standings por categoria**: TOP 10 jogadores ordenados por `points DESC, wins DESC`
2. **Separação por lado**: Líderes DIREITA vs ESQUERDA (para premiação)
3. **Critério de desempate**: Vitórias → Confronto direto → Placar geral

---

## 6. Cenários Comuns

### ✅ Caso Normal: 8 Jogadores, 1 Categoria
```
Inscritos: 8 atletas
  ↓ gerarRodas()
Rodadas geradas: 7 (Berger)
  ↓ semana 1 - agendar Rodada 1
  Quinta 16/04/2026: 4 matches (18h, 19h, 20h, 21h)
  ↓ semana 2 - agendar Rodada 2
  Quinta 23/04/2026: 4 matches
  ... (continua por 7 semanas)
Resultado: Ranking completo, sem repetição de parceiros
```

### ⚠️ Caso de Conflito: Jogador em 2 Duplas (Erro Lógico)
**NÃO DEVE ACONTECER** se o Berger está correto:
- Algoritmo garante cada jogador aparece uma vez por rodada
- UI deve impedir inscrição duplicada na mesma categoria

### 🚨 Caso de Overflow: Muitos Jogadores
Exemplo: 24 jogadores em 1 categoria
```
Rodadas: 23
Semanas: 23
Duração: 5+ meses
Matches/quinta: ~6 (considerando conflito "1 jogo/pessoa")
Ressalva: Alguns matches podem ser adiados se não cabem na janela
```

---

## 7. Endpoints da API

```
# Gerar rodadas (Berger)
POST /api/tournaments/:id/generate-rounds/:catId
Body: { start_date: "2026-04-16" }
Retorno: { status: "success", rounds_created: 9, doubles_created: 36 }

# Agendar matches de uma rodada
POST /api/rounds/:id/schedule
Retorno: {
  status: "scheduled",
  round_id: 3,
  matches_scheduled: 4,
  matches_unscheduled: 1  ← não couberam na janela
}

# Atualizar placar + pontos
POST /api/matches/:id/status
Body: { status: "FINISHED", games_a: 2, games_b: 1 }
Retorno: { points_updated: true, player_points: {...} }

# Ranking em tempo real
GET /api/tournaments/:id/ranking/:catId
Retorno: [
  { rank: 1, name: "João", side: "RIGHT", points: 24, wins: 8 },
  { rank: 2, name: "Maria", side: "RIGHT", points: 21, wins: 7 },
  ...
]
```

---

## 8. FAQ

**P: E se um jogador não puder jogar naquela quinta?**
A: Criar rota `POST /api/matches/:id/cancel` → marca como WO (walkover) para esse dia, pula para próxima.

**P: Posso agendار múltiplos matches por pessoa?**
A: Não. O agendarRodada() verifica e rejeita. Mantém como "pendente" se conflitar.

**P: Como garantir que o ranking está "completo"?**
A: Quando `rounds.status = 'FINISHED'` para toda rodada de uma categoria, o ranking está final.

**P: Posso reotemperar parceiros após gerar rodadas?**
A: Não recomendado (quebra garantia Berger). Criar nova categoria se necessário.

**P: Como lidar com desistências?**
A: Marcar jogador como `is_active = false` → não aparece em `getStandings()`.

---

**Última atualização**: 2026-04-07 | Versão: Ranking SRB v1.0
