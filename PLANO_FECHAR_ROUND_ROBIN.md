# Plano para fechar o "todos contra todos" — Ranking SRB 2026

> Gerado em 17/06/2026. **Formato confirmado pelo Alessandro:** é UMA categoria, todos contra
> todos dentro dela, e o ranking é apenas APRESENTADO fatiado por posição. Na prática: cada jogador
> precisa enfrentar como adversário **todos os outros da SUA posição** (direita × direita,
> esquerda × esquerda — confronto de frente). É isso que decide o ranking de cada posição.
> **Não se divide a categoria em grupos.**

## 1. Onde estamos de verdade

O boletim mostra **85% concluído**, mas isso mede os jogos sobre as **rodadas já agendadas**
(10–11 rodadas geradas). Medindo a meta real (todos contra todos), a completude é **50%**.

| Categoria | Lados | Completude | Confrontos feitos / possíveis | Faltam |
|---|---|---|---|---|
| Masc. Iniciante | 13 dir × 14 esq ⚠️ | 45% | 76 / 169 | **93** |
| Masc. 4ª | 9 × 9 | 57% | 41 / 72 | **31** |
| Feminino | 7 × 7 | 60% | 25 / 42 | **17** |
| **Total** | | **50%** | 142 / 283 | **141** |

(Confronto = um par do mesmo lado que se enfrenta. Round-robin completo de N/lado = C(N,2) confrontos.)

## 2. O que falta jogar (estimativa)

Cada jogo cobre, no melhor caso, **2 confrontos** (1 par da direita + 1 par da esquerda).
Jogos restantes ≈ o maior dos dois lados (o lado menor tem alguns confrontos repetidos no fim).

| Categoria | Jogos a fazer | Capacidade/quinta* | Quintas (presença cheia) | Quintas (presença real ~atual) |
|---|---|---|---|---|
| Masc. Iniciante | **~52** | até 6 | ~9 | ~11–13 |
| Masc. 4ª | **~17** | até 4 | ~5 | ~6–8 |
| Feminino | **~9** | até 3 | ~3 | ~4–5 |
| **Total** | **~78 jogos** | | | |

\* Capacidade = floor(jogadores do lado menor ÷ 2) jogos por rodada, se todos comparecem.

**Realidade dura:** fechar o round-robin completo **praticamente dobra o torneio** (já foram 74 jogos,
faltam ~78). O gargalo é a Masc. Iniciante — sozinha precisa de ~52 jogos / ~3 meses de quintas.

## 3. Problema estrutural: Masc. Iniciante está desbalanceada (13 × 14)

Com o Marcio fora (desistência), a direita tem 13 e a esquerda 14. Um round-robin limpo pede
lados iguais. Com 13 × 14 dá pra completar, mas a direita terá **byes/descansos desiguais** e
alguns confrontos repetidos de direita no fim. Opções:

- **(a) Recrutar/retornar 1 jogador de direita** → 14 × 14, agenda limpa (13 rodadas, 7 jogos/rodada).
- **(b) Aceitar 13 × 14** → completável, mas a direita tem byes/descansos desiguais e alguns
  confrontos de direita repetidos no fim (a esquerda fecha em 91 jogos, a direita em 78).

## 4. Recomendação

1. Decidir o formato de fechamento (full all-play-all vs. grupos) — **principalmente p/ Masc. Iniciante**,
   por causa do custo de calendário.
2. Masc. 4ª e Feminino estão menores e balanceadas → fáceis de fechar (~5 e ~3 quintas).
3. Só depois de aprovado o calendário, **gerar as rodadas/jogos restantes** (extensão do Berger
   evitando repetir confrontos já realizados). Isso é escrita em produção — não foi feito ainda.

## 5. Correções de dados já aplicadas (17/06)

- ✅ **Match 1228** (rodada 1, Alex Severo + Cicero 9×0): estava travado "em andamento" → **FINISHED**.
  Placar e pontos intactos (já contavam).
- ✅ **Eduardo Horbach**: era coringa sem lado (`EITHER`) → fixado na **direita** (equilibra a Masc. 4ª em 9×9).
- ✅ **Marcio Ferreira**: confirmado fora (desistência após 21/05). Mantido inativo.

**Pendente:** regenerar o boletim (ainda mostra o Marcio e não mostra o Eduardo) via
`export_dados_relatorio.js` → `upload_boletim.js`.

---
Análises read-only reproduzíveis em `backend/scripts/investigacao/`:
`valida_ranking_completo.js`, `diag_completude_roundrobin.js`, `diag_rodadas_cat1.js`, `diag_bandeiras.js`.
