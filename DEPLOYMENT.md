# 🚀 DEPLOYMENT GUIDE - Ranking Padel SRB 2026

**Status:** Preparado para Vercel + Supabase  
**Data:** 2026-04-08  
**Backend:** Node.js + Vercel Functions  
**Database:** Supabase PostgreSQL  
**Frontend:** React + Vite (deploiement via Vercel)

---

## 📋 Pré-requisitos Checklist

- [x] Supabase project criado (`kosifmqmajlowuxpcuga.supabase.co`)
- [x] Credenciais configuradas em `backend/.env`
- [x] Frontend buildado (`npm run build`)
- [x] Testes de usabilidade criados (E2E + Accessibility)
- [ ] **Vercel project conectado ao GitHub** (PRÓXIMO)
- [ ] Database schema importado no Supabase (PRÓXIMO)
- [ ] Environment variables configuradas no Vercel (PRÓXIMO)
- [ ] Deploy bem-sucedido (PRÓXIMO)

---

## ✅ PASSO 1: Importar Schema no Supabase

### 1.1 Acesse Supabase Dashboard
```
https://app.supabase.com/projects
```

### 1.2 Selecione seu projeto
```
Project: kosifmqmajlowuxpcuga
```

### 1.3 Vá para "SQL Editor"
- Clique em **SQL Editor** (sidebar esquerda)
- Clique em **+ New Query**

### 1.4 Copie e execute o schema SQL
Abra o arquivo local:
```
supabase_schema.sql
```

Copie TODO o conteúdo e cole no Supabase SQL Editor.

**Clique em "Run"** (ou Ctrl+Enter)

✅ Se não houver erros, o schema foi criado com sucesso!

### 1.5 Verifique as tabelas
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

Deve retornar:
- tournaments
- players
- doubles
- categories
- rounds
- matches
- courts
- groups
- groups_doubles
- profiles

---

## 🔗 PASSO 2: Conectar GitHub ao Vercel

### 2.1 Crie Vercel Project
```
https://vercel.com/new
```

### 2.2 Escolha repositório
```
GitHub: Seu repo (antigravity-Ranking-Padel-SRB-2026)
```

### 2.3 Configure Build
```
Framework Preset: Other
Root Directory: ./
Build Command: npm run build
Output Directory: frontend/dist
```

### 2.4 Configure Environment Variables
No painel Vercel, vá para **Settings → Environment Variables**

Adicione:

#### Backend (Supabase)
```
DB_TYPE=supabase
SUPABASE_URL=https://kosifmqmajlowuxpcuga.supabase.co
SUPABASE_ANON_KEY=sb_publishable_lP6KzUKKbWgG4oBznVtn0g_p_c6K9Rz
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2lmbXFtYWpsb3d1eHBjdWdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3NDU4MCwiZXhwIjoyMDkxMjUwNTgwfQ.gwZ6qMrttFs_6mDKlh7Hd8dP_WYQxR1e5SOVzqgV7Rk
```

#### Frontend
```
VITE_API_URL=https://seu-projeto.vercel.app/api
```
(Você atualizará isso após o primeiro deploy)

#### Stripe (Optional)
```
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
```

#### WhatsApp (Optional)
```
EVOLUTION_API_URL=(deixe vazio)
EVOLUTION_API_KEY=(deixe vazio)
EVOLUTION_INSTANCE=(deixe vazio)
```

---

## 🎯 PASSO 3: Deploy Automático

### 3.1 Pushe para main
```bash
cd /c/Users/aless/.antigravity/Ranking\ Padel\ SRB\ 2026
git commit -m "chore: configure Supabase and Vercel deployment"
git push origin main
```

**Vercel vai fazer deploy automaticamente!**

### 3.2 Monitor Deployment
```
https://vercel.com/dashboard
→ Seu projeto
→ Deployments
```

Aguarde até ver ✅ **Production: Ready**

### 3.3 Pegue a URL do Vercel
```
Seu projeto terá uma URL como:
https://ranking-padel-srb.vercel.app
```

---

## 🔄 PASSO 4: Atualizar VITE_API_URL

Após primeiro deploy bem-sucedido:

### 4.1 Atualize frontend/.env
```env
VITE_API_URL=https://ranking-padel-srb.vercel.app/api
```

### 4.2 Atualizar Vercel Environment Variable
- Dashboard Vercel
- Settings → Environment Variables
- Editar `VITE_API_URL`
- Salvar

### 4.3 Trigger novo deploy
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

---

## ✅ PASSO 5: Validar Deploy

### 5.1 Teste frontend
```
https://ranking-padel-srb.vercel.app
```

Deve exibir landing page com design vibrant.

### 5.2 Teste API backend
```bash
curl https://ranking-padel-srb.vercel.app/api/tournaments
```

Deve retornar JSON (array ou erro, mas não 404).

### 5.3 Teste Supabase connection
```bash
curl https://ranking-padel-srb.vercel.app/api/health
```

Se implementado, deve retornar status OK.

### 5.4 Rode testes E2E
```bash
cd frontend
npm run test:e2e
```

Testes devem passar contra URL de produção.

---

## 🔒 PASSO 6: Segurança (Pós-Deploy)

### 6.1 Regenere Supabase Keys
```
Supabase Dashboard
→ Settings → API
→ Rotate Service Role Key (se necessário)
```

### 6.2 Configure CORS no Backend
```javascript
// server.js
app.use(cors({
  origin: 'https://ranking-padel-srb.vercel.app',
  credentials: true
}));
```

### 6.3 Ative RLS (Row Level Security)
```sql
-- Supabase SQL Editor
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
-- etc para outras tabelas
```

---

## 📊 Checklist Final

- [ ] Schema SQL importado no Supabase
- [ ] Vercel project criado e conectado ao GitHub
- [ ] Environment variables configuradas
- [ ] Deploy bem-sucedido (Production: Ready)
- [ ] Frontend acessível em HTTPS
- [ ] API respondendo em `/api`
- [ ] Banco de dados conectado
- [ ] Testes E2E passando
- [ ] CI/CD workflows ativos (GitHub Actions)

---

## 🆘 Troubleshooting

### "Build failed on Vercel"
```
✓ Verifique se build command está correto
✓ Verifique se output directory é ./frontend/dist
✓ Veja logs em Vercel Dashboard → Deployments
```

### "API não responde"
```
✓ Verifique environment variables em Vercel
✓ Verifique credenciais Supabase
✓ Rode: curl https://seu-site.vercel.app/api/health
```

### "Frontend não carrega"
```
✓ Verifique VITE_API_URL está correto
✓ Verifique CORS no backend
✓ Abra DevTools (F12) → Console para erros
```

### "Supabase não conecta"
```
✓ Verifique SUPABASE_URL e keys
✓ Teste connection string local: 
   DB_TYPE=supabase npm start (backend)
✓ Verifique firewall/IP whitelist
```

---

## 📞 URLs Importantes

| Recurso | URL |
|---------|-----|
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **Supabase Dashboard** | https://app.supabase.com |
| **GitHub Repo** | https://github.com/seu-repo |
| **Seu Site** | https://ranking-padel-srb.vercel.app |
| **API Backend** | https://ranking-padel-srb.vercel.app/api |

---

## 🎓 Próximas Ações

1. ✅ **Agora:** Execute PASSO 1 (Supabase Schema)
2. ⏳ **Depois:** Execute PASSO 2-3 (Vercel + Deploy)
3. ✅ **Teste:** PASSO 5 (Validação)
4. 🔒 **Segurança:** PASSO 6 (RLS, CORS)

---

**Deploy realizado:** [Data/Hora será preenchida após conclusão]  
**Responsável:** Antigravity AI  
**Status:** 🟡 Em andamento

---

*Documento vivo — será atualizado após cada passo*
