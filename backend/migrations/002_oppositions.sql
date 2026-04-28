-- Migration 002: tabela oppositions
-- Espelha partnerships, mas pra adversários (quem-vs-quem) e duelo diagonal direto (mesmo lado).
-- Usada por weeklyDrawService.confirmRound pra minimizar repetição de adversários
-- entre rodadas, complementando partnerships (que minimiza repetição de parceiros).

CREATE TABLE IF NOT EXISTS oppositions (
  id_opposition  SERIAL PRIMARY KEY,
  id_tournament  INT NOT NULL,
  id_category    INT NOT NULL,
  id_player1     INT NOT NULL,        -- sempre min(p1, p2) — chave canônica
  id_player2     INT NOT NULL,        -- sempre max(p1, p2)
  times_opposed  INT NOT NULL DEFAULT 1,
  diagonal_count INT NOT NULL DEFAULT 0, -- vezes em duelo diagonal direto (LEFT-vs-LEFT ou RIGHT-vs-RIGHT)
  last_round_id  INT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT oppositions_unique_pair UNIQUE (id_tournament, id_category, id_player1, id_player2),
  CONSTRAINT oppositions_player_order CHECK (id_player1 < id_player2)
);

CREATE INDEX IF NOT EXISTS idx_oppositions_lookup ON oppositions(id_tournament, id_category);
CREATE INDEX IF NOT EXISTS idx_oppositions_round   ON oppositions(last_round_id);

-- Recarrega cache PostgREST pra a tabela ficar visível na API
NOTIFY pgrst, 'reload schema';
