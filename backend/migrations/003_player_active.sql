-- Migration 003: soft-delete de atletas
-- Adiciona flag `active` em players. Atletas inativos somem do ranking
-- e do pool de sorteios sem perder historico de jogos passados.
-- Caso disparador: Marcio Ferreira (id 657) saiu do campeonato em mai/2026.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_players_active ON players(active) WHERE active = FALSE;

-- Recarrega cache PostgREST pra a coluna ficar visivel na API
NOTIFY pgrst, 'reload schema';
