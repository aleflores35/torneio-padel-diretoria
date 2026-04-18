# PRD — Ranking Padel SRB 2026
**Documento de Requisitos de Produto**

**Versão:** 1.1  
**Data:** Abril 2026  
**Status:** ✅ MVP Operacional  
**Cliente:** Sociedade Rio Branco

---

## 1. Visão Geral

### 1.1 O Produto
O **Ranking Padel SRB** é uma plataforma de gestão de torneio contínuo para a Sociedade Rio Branco. Baseado em um modelo de **ranking individual e duplas rotativas**, o sistema foge do formato tradicional de chaves eliminatórias para oferecer uma experiência competitiva constante.

- **Frequência**: Jogos toda quinta-feira (18h às 23h).
- **Sem Repetição**: O algoritmo garante que jogadores parceiros não se repitam frequentemente.
- **Meritocracia**: Pontuação 100% individual vinculada à performance em quadra.
- **Engajamento**: Ranking atualizado em tempo real disponível para TV e Web.

### 1.2 Problema que Resolve
Torneios convencionais duram poucas semanas e geram dispersão dos atletas após a final. O Ranking SRB cria uma motivação semanal eterna: sempre há uma nova rodada e uma nova chance de subir na tabela.

### 1.3 Proposta de Valor
> "Um torneio que não termina. Toda quinta um novo parceiro, novos desafios e seu nome subindo na classificação em tempo real."

---

## 2. Perfis de Usuários

| Perfil | Responsabilidades | Acessos |
|:---|:---|:---|
| **Atleta** | Se inscreve, declara ausência, confere ranking e parceiro. | `/`, `/ranking`, `/semana` |
| **Diretor (Admin)** | Gera rodadas, lança placares, gerencia atletas. | `/admin`, `/rodadas`, `/jogos` |
| **Público/TV** | Acompanha placar e classificação ao vivo. | `/ranking` |

---

## 3. Funcionalidades Principais

### 3.1 Inscrição e Landing Page
- Apresentação profissional do torneio.
- Formulário de cadastro capturando Nome, WhatsApp, Lado Preferencial (Direito/Esquerdo/Ambos) e Categoria.
- Confirmação automática via WhatsApp (Evolution API).

### 3.2 Ranking em Tempo Real
- Divisão por Abas (Categorias): Masc. Iniciante, Masc. 4ª, Fem. 6ª, etc.
- Destaque para os líderes de cada Lado (Premiados independentes).
- Histórico visual de vitórias, derrotas e WOs.

### 3.3 Gerenciamento de Rodadas (Algoritmo Berger)
- Geração automática de N-1 rodadas para N jogadores.
- Lógica de agendamento que impede que um jogador tenha 2 jogos na mesma noite (Quinta).
- Suporte para "Makeup Matches" (jogos recuperados fora da data oficial).

### 3.4 Controle de Jogos (Quinta-feira)
- Lista de jogos do dia com status dinâmicos.
- Botão "Chamar Jogadores" que notifica a dupla via WhatsApp.
- Interface simplificada para lançamento de placar com atualização instantânea do ranking.

### 3.5 Gestão de Atletas
- Painel administrativo para edição de dados e controle de pagamento.
- Filtros rápidos por categoria e saldo de pontos.

---

## 4. Regras de Negócio e Pontuação

- **Pontuação Individual**:
  - **Vitória**: +3 pontos.
  - **Derrota**: +1 ponto.
  - **WO (Ausência não justificada)**: 0 pontos.
- **Desempate**:
  1. Maior número de vitórias.
  2. Saldo de games.
  3. Confronto direto (quando aplicável).
- **Prazo de Ausência**: Atletas devem declarar ausência até segunda-feira às 18h para não serem escalados no sorteio da quinta.

---

## 5. Especificação Técnica

- **Backend**: Node.js v5+ com Express.
- **Frontend**: React 19 + Vite + TailwindCSS 3.
- **Banco de Dados**: SQLite (Local) / Supabase (Produção).
- **Integração**: Evolution API para envio de mensagens WhatsApp.
- **Hospedagem**: Vercel.

---

## 6. Roadmap e Futuro

- **P1**: Notificações automáticas de agendamento (Confirm/Reject).
- **P2**: Aplicativo Mobile dedicado (PWA ou Nativo).
- **P3**: Sistema de estatísticas avançadas (parceiro favorito, % de vitória por lado).
- **P4**: Integração com sistemas de pagamento online (Stripe/Asaas).

---

**Última Atualização**: 14 de Abril de 2026  
**Responsável**: Antigravity (IA)  
**Status para Cliente**: Pronto para Homologação.
