# Workflow: Sorteio & Agendamento de Matches

## 📋 Visão Geral (3 Passos)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CICLO DE UMA CATEGORIA                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PASSO 1: GERAR RODADAS (Berger Algorithm)                         │
│  ───────────────────────────────────────────                        │
│  • Cria N-1 rodadas (para N atletas)                               │
│  • Cada rodada tem data fixa (quinta-feira)                        │
│  • Garante: nenhuma dupla aparece 2x na mesma rodada              │
│  • Status: todas começam como PENDING                              │
│  • Resultado: 9 quintas-feiras (9 rodadas) para ~10 atletas       │
│                                                                     │
│  PASSO 2: SORTEAR DUPLAS (sortearDuplasRodada)                    │
│  ────────────────────────────────────                              │
│  • Para cada rodada, cria duplas vs duplas                         │
│  • Respeita preferência de lado (RIGHT/LEFT/EITHER)               │
│  • Balanceia desafios entre duplas                                 │
│  • Resultado: N matches prontos para aquela rodada                 │
│                                                                     │
│  PASSO 3: AGENDAR MATCHES (agendarRodada)                         │
│  ──────────────────────                                            │
│  • Aloca matches para quinta-feira 18h-23h                         │
│  • ⚠️ CONSTRAINT CRÍTICO:                                          │
│     → Máximo 1 jogo por jogador na mesma quinta                    │
│  • Valida: nenhum dos 4 atletas (2 duplas) joga 2x                │
│  • Resultado: matches scheduled_at = "2026-04-16T18:00:00Z"       │
│             (com status SCHEDULED, pronto para CALLING/LIVE)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Exemplo Passo-a-Passo (8 Atletas)

### PASSO 1: Gerar 7 Rodadas (Berger)

```javascript
Inscritos: João, Maria, Paulo, Ana, Pedro, Sofia, Lucas, Clara (8 pessoas)
  ↓
Berger Algorithm gera:
  Rodada 1 (16/04/2026, quinta): Duplas A-B vs C-D, E-F vs G-H, + bye
  Rodada 2 (23/04/2026, quinta): Duplas rotacionadas (novo sorteio)
  Rodada 3 (30/04/2026, quinta): ...
  ...
  Rodada 7 (28/05/2026, quinta): ...

Status de todas: PENDING
```

### PASSO 2: Sortear Duplas para Rodada 1

```javascript
RondasPage: clica "Gerar Duplas" na Rodada 1
  ↓
sortearDuplasRodada(rodada_1):
  • Busca os 8 atletas da categoria
  • Pareias respeitando lado:
    - João (RIGHT) + Maria (LEFT) = Dupla A
    - Paulo (EITHER) + Ana (EITHER) = Dupla B
    - Pedro (RIGHT) + Sofia (LEFT) = Dupla C
    - Lucas (EITHER) + Clara (EITHER) = Dupla D
  ↓
Cria 4 matches de DUPLA vs DUPLA:
  • Match 1: Dupla A vs Dupla B
  • Match 2: Dupla C vs Dupla D
  • (pode haver rotations/byes se número ímpar)

Status: PENDING → aguardando agendamento
```

### PASSO 3: Agendar Matches para Quinta 16/04

```javascript
RondasPage: clica "Agendar" na Rodada 1
  ↓
agendarRodada(rodada_1):

  Slot 1 (18:00-18:55):
    Match 1 (Dupla A vs B) → 4 atletas: João, Maria, Paulo, Ana
    ✓ Todos livres → SCHEDULED "2026-04-16T18:00:00Z"

  Slot 2 (19:00-19:55):
    Match 2 (Dupla C vs D) → 4 atletas: Pedro, Sofia, Lucas, Clara
    ✓ Todos livres → SCHEDULED "2026-04-16T19:00:00Z"

Resultado:
  ✅ 2 matches agendados
  Status: PENDING → SCHEDULED (pronto para CALLING)
```

---

## 🎯 Estados das Rodadas & Matches

### Estados de uma Rodada
```
PENDING        → Nenhum match foi agendado ainda
  ↓ (após agendar)
SCHEDULED      → Matches foram colocados na quinta-feira
  ↓ (quando primeiro match começa)
IN_PROGRESS    → Algum match está sendo jogado
  ↓ (quando todos os matches terminam)
FINISHED       → Todos os matches tiveram resultado
```

### Estados de um Match
```
TO_PLAY        → Criado, aguardando agendamento
  ↓ (após agendar rodada)
SCHEDULED      → Data/hora marcada (ex: 16/04 18h)
  ↓ (quando clica "chamar")
CALLING        → Notificação enviada (WhatsApp)
  ↓ (quando duplas chegam/começam)
IN_PROGRESS    → Jogo em andamento na quadra
  ↓ (quando insere placar)
FINISHED       → Resultado salvo + pontos calculados
```

---

## 🔐 CONSTRAINT CRÍTICO: 1 Jogo/Pessoa/Dia

### Exemplo de Conflito Evitado

```javascript
Quinta 16/04/2026 - Rodada 1

Match 1 (18:00): João vs Paulo, Maria vs Ana
  Atletas envolvidos: João, Paulo, Maria, Ana
  ↓ Agendado ✓

Match 2 (19:00): João vs Sofia, Lucas vs Clara
              ↑ PROBLEMA: João já está em Match 1!
  ✗ CONFLITO DETECTADO → NÃO AGENDA
  Status permanece PENDING → atrasa para próxima quinta
```

### Como o Backend Valida

```javascript
// schedulerService.agendarRodada()
Para cada match da rodada:
  1. Busca 4 atletas: A, B (dupla 1) + C, D (dupla 2)
  2. Verifica na tabela de matches:
     SELECT COUNT(*) FROM matches 
     WHERE (player in [A,B,C,D]) 
       AND scheduled_date = "2026-04-16"
       AND status IN ['SCHEDULED', 'CALLING', 'IN_PROGRESS']
  
  3. Se COUNT > 0 → ✗ Não agenda (pendente)
     Se COUNT = 0 → ✓ Agenda (status = SCHEDULED)
```

---

## 🎮 Interface do Usuário (RondasPage)

### Visão por Categoria

```
╔════════════════════════════════════════════════════════╗
║ MASCULINO INICIANTE (10 atletas)                      ║
║ [Gerar Rodadas] ← PASSO 1                             ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║ Rodada 1 ─ Quinta 16/04/2026 ─ 18h-23h  [PENDING]    ║
│ [Gerar Duplas] [Agendar]  ← PASSOS 2-3               ║
║                                                        ║
║ Rodada 2 ─ Quinta 23/04/2026 ─ 18h-23h  [PENDING]    ║
│ [Gerar Duplas] [Agendar]                              ║
║                                                        ║
│ ...                                                    ║
║                                                        ║
└════════════════════════════════════════════════════════┘
```

**Botão "Gerar Rodadas"**:
- Disponível quando: nenhuma rodada foi gerada ainda
- Ação: `POST /api/tournaments/1/generate-rounds/:catId`
- Resultado: cria 7-9 rodadas com datas progressivas

**Botão "Gerar Duplas" (por rodada)**:
- Disponível quando: rodada tem status PENDING
- Ação: `POST /api/rounds/:id/draw-doubles` (ou embutido em agendarRodada)
- Resultado: cria os 4-5 matches da rodada

**Botão "Agendar" (por rodada)**:
- Disponível quando: status é PENDING e há matches
- Ação: `POST /api/rounds/:id/schedule`
- Resultado: scheduled_at preenchido, status → SCHEDULED

---

## 📊 Cronograma Típico (Categoria com 10 Atletas)

```
Semana 1:  Quinta 16/04 → Rodada 1 executada
Semana 2:  Quinta 23/04 → Rodada 2 executada
Semana 3:  Quinta 30/04 → Rodada 3 executada
Semana 4:  Quinta 07/05 → Rodada 4 executada
Semana 5:  Quinta 14/05 → Rodada 5 executada
Semana 6:  Quinta 21/05 → Rodada 6 executada
Semana 7:  Quinta 28/05 → Rodada 7 executada
Semana 8:  Quinta 04/06 → Rodada 8 executada
Semana 9:  Quinta 11/06 → Rodada 9 executada

RESULTADO: Ranking final com 9 rodadas, cada atleta jogou 9 vezes contra adversários diferentes.
```

---

## ✅ Checklist de Funcionamento

- [ ] **RondasPage carrega rodadas do backend** (GET /api/tournaments/1/rounds)
- [ ] **Botão "Gerar Rodadas" funciona** (POST generate-rounds)
- [ ] **Rodadas aparecem com datas corretas** (quinta-feira, +7 dias)
- [ ] **Botão "Agendar" funciona** (POST /api/rounds/:id/schedule)
- [ ] **Matches aparecem em JogosPage** com horários alocados
- [ ] **Constraint "1 jogo/pessoa/dia" é respeitado** (logs no console)
- [ ] **Ranking atualiza após matches FINISHED** (RankingPage)
- [ ] **Nenhuma dupla se repete em uma mesma rodada** (Berger funciona)

---

**Última atualização**: 2026-04-08 | Pronto para testes de sorteio & agendamento
