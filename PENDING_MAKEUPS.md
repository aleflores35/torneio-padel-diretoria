# Jogos pendentes de remarcação (Ranking SRB 2026)

> ⚠️ **Antes de sortear/criar uma rodada nova**, conferir esta lista. Se houver jogo da mesma categoria pendente, adicionar como match extra na rodada (em vez de só rodar o sorteio Berger normal).

## Em aberto

_(vazio)_

---

## Concluídos (histórico)

### ❌ Feminino — Catiane+Michele × Luana+Sabrina (descartado 2026-05-12)
- **Original cancelado:** Rodada 4 (id_round=398), 2026-05-07 20:40, match `id_match=1269` — falta de luz no clube
- **Decisão (12/05 noite):** Alessandro optou por **NÃO remarcar** — fazer re-sorteio livre Berger da rodada 5 feminina com TODAS as disponíveis (sem fixo).
- **Por que descartado:** primeira tentativa de criar makeup como fixo (`scripts/investigacao/refaz_feminino_401_com_fixo.js`) caiu com side incompatível (Nicole+Tanise ambas RIGHT). Em vez de só consertar, optou por sortear livre.
- **Resultado:** rodada 5 (id_round=401) tem 2 jogos novos sem o makeup:
  - match 1280 court 16: Luana+Daniela × Michele+Catiane
  - match 1281 court 17: Nicole+Francine × Tanise+Eduarda
- **Scripts usados:**
  - `scripts/investigacao/refaz_feminino_401_com_fixo.js` (tentativa 1, descartada)
  - `scripts/investigacao/resorteia_feminino_401_livre.js` (versão final, livre com side check + confirmRound)
  - `scripts/investigacao/shift_rodada_14_05_to_1830.js` (shift de horário, perene)

---

## Como usar este arquivo

1. Quando cancelar um jogo que será remarcado: adicionar entrada em **Em aberto**
2. Quando o jogo for efetivamente remarcado/criado na nova rodada: mover pra **Concluídos** com o novo `id_match`
3. Conferir este arquivo **antes** de criar/sortear toda nova rodada
