# 🎾 Diretoria Padel - Sistema de Gestão de Torneios

Sistema ultra-premium para gestão de torneios de Padel, focado em experiência do atleta e automação para o organizador.

## 🚀 Funcionalidades Principais
- **Landing Page de Inscrição:** Atletas se inscrevem, escolhem lado de preferência e veem o cardápio oficial.
- **WhatsApp Automatizado:** Chamada de atletas via Evolution API direto no celular.
- **Geração Inteligente de Chaves:** Sorteio de duplas e criação de chaves automático.
- **Painel de Quadras:** Gestão em tempo real do status das quadras (Chamando, Em Jogo, Finalizado).
- **Dashboard Público:** Placar ao vivo e chaves atualizadas para telões/TVs.
- **Acesso por Níveis:** Admin, Suporte e Atleta.

## 🛠️ Tecnologias
- **Frontend:** React + TailwindCSS + Vite
- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (Pronto para migração Supabase)
- **WhatsApp:** Integração Evolution API

## 📦 Como Rodar Localmente

### Backend
1. `cd backend`
2. `npm install`
3. Configure o arquivo `.env` com suas chaves de WhatsApp e Supabase.
4. `node server.js`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

---
*Desenvolvido para o Torneio da Diretoria - Abril 2026*
