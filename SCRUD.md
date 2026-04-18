# SCRUD - Ranking Padel SRB 2026

Este documento detalha as operações de **S**earch (Busca), **C**reate (Criação), **R**ead (Leitura), **U**pdate (Atualização) e **D**elete (Exclusão) das principais entidades do sistema.

---

## 1. Atletas (Players)

Operações fundamentais para gestão de inscritos e perfis.

| OP | Descrição | Endpoint / Ação |
|:---|:---|:---|
| **S**earch | Busca por nome ou filtragem por categoria e lado (Direito/Esquerdo). | `GET /api/tournaments/:id/players?category=X` |
| **C**reate | Cadastro inicial via Landing Page ou painel administrativo. | `POST /api/players` |
| **R**ead | Listagem de todos os atletas ou detalhes de um perfil específico. | `GET /api/players` |
| **U**pdate | Alteração de categoria, lado de jogo, status de pagamento ou senha. | `PATCH /api/players/:id` |
| **D**elete | Remoção de um atleta do sistema (Geralmente inativação em produção). | `DELETE /api/players/:id` |

---

## 2. Rodadas (Rounds)

Gestão do ciclo de vida das semanas de torneio.

| OP | Descrição | Endpoint / Ação |
|:---|:---|:---|
| **S**earch | Filtragem de rodadas por torneio e categoria. | `GET /api/tournaments/:id/rounds` |
| **C**reate | Geração de rodadas via Algoritmo Berger (Round-robin). | `POST /api/tournaments/:id/generate-rounds/:catId` |
| **R**ead | Visualização do calendário de rodadas e histórico. | `GET /api/tournaments/:id/rounds/:catId/calendar` |
| **U**pdate | Mudança de status da rodada (PENDING → IN_PROGRESS → FINISHED). | `POST /api/rounds/:id/confirm` |
| **D**elete | Cancelamento ou limpeza de rodadas geradas incorretamente. | `N/A (Lógica de destruição no backend)` |

---

## 3. Jogos (Matches)

Coração da operação semanal na quinta-feira.

| OP | Descrição | Endpoint / Ação |
|:---|:---|:---|
| **S**earch | Busca de jogos por data específica ou rodada. | `GET /api/tournaments/:id/matches` |
| **C**reate | Criação automática ao agendar uma rodada ou makeup manual. | `POST /api/rounds/:id/schedule` |
| **R**ead | Placar ao vivo para TV/Telão e lista de jogos do dia. | `GET /api/rounds/:id/matches` |
| **U**pdate | Atualização do status (CALLING/LIVE) e inserção de placar. | `POST /api/matches/:id/status` |
| **D**elete | Remoção de agendamento por desistência mútua ou erro. | `N/A (Update status para CANCELLED)` |

---

## 4. Ausências (Absences)

Controle de quem não jogará em uma data específica.

| OP | Descrição | Endpoint / Ação |
|:---|:---|:---|
| **S**earch | Lista de quem declarou ausência para a próxima quinta-feira. | `GET /api/tournaments/:id/absences` |
| **C**reate | Registro de ausência (feita pelo atleta com prazo limite). | `POST /api/tournaments/:id/absences` |
| **R**ead | Consulta de ausências por categoria para o sorteio semanal. | `GET /api/tournaments/:id/absences?date=X` |
| **U**pdate | Alteração de justificativa (se aplicável). | `N/A` |
| **D**elete | Cancelamento da ausência (se dentro do prazo). | `DELETE /api/tournaments/:id/absences/:playerId` |

---

## 5. Ranking (Standings)

Agregado de performance para as tabelas de classificação.

| OP | Descrição | Endpoint / Ação |
|:---|:---|:---|
| **S**earch | Visão filtrada por categoria e destaque por "Melhor Lado". | `GET /api/tournaments/:id/ranking/:catId` |
| **C**reate | Calculado em tempo real pelo sistema após cada jogo finalizado. | `Calculated Field` |
| **R**ead | Leitura pública da classificação geral. | `GET /api/tournaments/:id/ranking` |
| **U**pdate | Recálculo forçado de pontos em caso de correção de placar. | `Automatic on Match Update` |
| **D**elete | Reset de pontos de uma categoria/torneio. | `N/A` |

---

## Observações Técnicas
- **Auth**: Operações de Criação/Edição/Deleção em Atletas e Jogos exigem nível `ADMIN`.
- **Validação de Sorteio**: O sistema impede a criação de Jogos para atletas que tenham ausência marcada para a respectiva data.
- **Pontuação**: 
  - **Vitória**: 3 pontos
  - **Derrota**: 1 ponto
  - **WO**: 0 pontos
