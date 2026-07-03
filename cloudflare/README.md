# Proxy Cloudflare — Ranking SRB (obralivre.com.br → Vercel)

**Problema que isso resolve:** os atletas acessam `obralivre.com.br/ranking-srb`, que hoje
é servido pela Hostinger (build **antigo**) e cujo FTP de atualização está **quebrado**.
O frontend novo está no Vercel (`ranking-padel-srb-2026.vercel.app`). Este worker faz
`obralivre.com.br/ranking-srb/*` servir do Vercel, **sem mudar a URL** e sem FTP.

> A API (`/api/*`) já é chamada direto no Vercel pelo próprio app — não passa por aqui.
> A route é restrita a `/ranking-srb*`, então **o site principal da agência não é afetado**.

---

## Como aplicar — escolha UM caminho

### Opção 1 — Eu deployo (você me passa um token)
Crie um **API Token** no Cloudflare (My Profile → API Tokens → Create Token → template
"Edit Cloudflare Workers"), com escopo na conta/zona `obralivre.com.br`, e me mande.
Eu rodo, daqui:

```bash
cd "C:/obralivre/clientes/parcerias/sociedade-rio-branco/ranking-srb-2026/cloudflare"
CLOUDFLARE_API_TOKEN=<token> wrangler deploy
```

### Opção 2 — Você faz pelo dashboard (≈3 min, sem token)
1. Cloudflare → **Workers & Pages** → **Create application** → **Create Worker** →
   nome `ranking-srb-proxy` → **Deploy**.
2. **Edit code** → cole o conteúdo de [`worker.js`](worker.js) → **Deploy**.
3. No worker → **Settings** → **Domains & Routes** → **Add route**:
   - Route: `obralivre.com.br/ranking-srb*`
   - Zone: `obralivre.com.br`
4. Salvar.

---

## Validar (depois de aplicar)
O bundle servido pelos dois tem que ficar **igual**:

```bash
curl -s "https://obralivre.com.br/ranking-srb/" | grep -oE 'assets/index-[A-Za-z0-9_]+\.js'
curl -s "https://ranking-padel-srb-2026.vercel.app/ranking-srb/" | grep -oE 'assets/index-[A-Za-z0-9_]+\.js'
```

Se os dois mostrarem o mesmo arquivo, o proxy está ativo e os atletas já veem o frontend novo.

---

## Alternativa mais isolada (se preferir não tocar na zona principal)
Criar um **subdomínio** `ranking.obralivre.com.br` apontando pro Vercel (CNAME no
Cloudflare + adicionar o domínio no projeto Vercel). Não mexe no site da agência, mas
**muda a URL** que os atletas usam (de `/ranking-srb` para `ranking.obralivre.com.br`).
