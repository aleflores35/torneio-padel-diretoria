# Regra de Cota Mensal de Ausência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limitar cada atleta a no máximo 1 ausência declarada por mês-calendário no Ranking SRB, com vigência a partir de 01/06/2026.

**Architecture:** A regra é enforced no servidor (guarda no `POST` de ausências), com a lógica de decisão isolada num módulo puro testável (`backend/lib/absenceQuota.js`). O frontend lê um endpoint de status de cota para desabilitar o botão "Não posso ir" e exibir um aviso contextual. O caso "saúde" **não tem código** — usa a exclusão manual já existente no modal de sorteio do admin (`/rodadas`), que não cria linha em `player_absences` e portanto não consome cota. Um banner global anuncia a regra.

**Tech Stack:** Node/Express (backend, cliente `@supabase/supabase-js`), React 19 + TypeScript + Vite (frontend), Supabase Postgres, deploy Vercel.

---

## Contexto que o engenheiro precisa saber

- **`player_absences`** (`id_tournament, id_player, absence_date`, UNIQUE nos três) é a tabela de ausências **auto-serviço do atleta**. É a ÚNICA coisa que o atleta controla e a única que a cota limita.
- Ausências feitas pelo admin (exclusão manual no sorteio, substituição) vivem em `round_attendance` com `status='DECLINED'` — **não** tocam `player_absences`, logo **nunca** contam pra cota. É por isso que o caso saúde não precisa de código.
- O atleta declara ausência em `/semana` ([frontend/src/pages/SemanaPage.tsx](../../../frontend/src/pages/SemanaPage.tsx)) → `POST /api/tournaments/:id/absences` ([backend/server.js:1013-1039](../../../backend/server.js#L1013)).
- O projeto **não tem harness de teste** (sem jest/mocha/vitest). O padrão de verificação do time são scripts node ad-hoc (`backend/scripts/investigacao/`). Por isso a lógica de decisão é extraída num módulo **puro** testável com `node` + `assert` nativo (sem dependência nova). O wiring dos endpoints e o frontend são verificados por review + smoke manual.
- Datas `YYYY-MM-DD` comparam corretamente como string (ordem lexical = ordem cronológica). Os ranges de mês usam isso.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `PRD.md` | Regra de negócio documentada | Modificar |
| `backend/lib/absenceQuota.js` | Lógica pura de cota (range de mês, decisão, status) | Criar |
| `backend/lib/absenceQuota.test.js` | Testes da lógica pura (node + assert) | Criar |
| `backend/server.js` | Guarda da cota no `POST /absences` + novo `GET` de status | Modificar |
| `frontend/src/pages/SemanaPage.tsx` | Botão bloqueado + aviso contextual de cota | Modificar |
| `frontend/src/components/TopBanner.tsx` | Banner global anunciando a regra | Criar |
| `frontend/src/App.tsx` | Renderizar o banner no topo | Modificar |

---

## Task 1: Documentar a regra no PRD

**Files:**
- Modify: `PRD.md:77`

- [ ] **Step 1: Adicionar a regra após a linha "Prazo de Ausência"**

Edição — `old_string`:

```markdown
- **Prazo de Ausência**: Atletas devem declarar ausência até segunda-feira às 18h para não serem escalados no sorteio da quinta.
```

`new_string`:

```markdown
- **Prazo de Ausência**: Atletas devem declarar ausência até segunda-feira às 18h para não serem escalados no sorteio da quinta.
- **Cota Mensal de Ausência** *(vigente a partir de 01/06/2026)*: Cada atleta tem direito a declarar **no máximo 1 ausência por mês-calendário**. Esgotada a cota, o app bloqueia novas declarações naquele mês.
  - **Exceção — saúde**: problema de saúde não consome a cota. O atleta avisa a administração em mensagem privada (PVT); a administração exclui o atleta manualmente do sorteio da semana (checkbox no modal de sorteio em `/rodadas`), sem criar declaração de ausência.
  - **Sem advertência**: quem está com a cota esgotada e mesmo assim não comparece recebe WO normal (0 pontos) — não há sistema de advertência ou suspensão.
  - **Reset**: a cota zera no dia 1º de cada mês. Ausências com data anterior a 01/06/2026 não entram na contagem.
```

- [ ] **Step 2: Commit**

```bash
git add PRD.md
git commit -m "docs: regra de cota mensal de ausência no PRD"
```

---

## Task 2: Módulo puro de cota + testes

Lógica de decisão isolada, sem I/O. Testável com `node` nativo — sem dependência nova.

**Files:**
- Create: `backend/lib/absenceQuota.js`
- Test: `backend/lib/absenceQuota.test.js`

- [ ] **Step 1: Escrever os testes (vão falhar — módulo não existe)**

Criar `backend/lib/absenceQuota.test.js`:

```js
// Testes da lógica pura de cota mensal de ausência. Rodar: node backend/lib/absenceQuota.test.js
const assert = require('assert');
const { monthRange, quotaCheck, quotaStatus } = require('./absenceQuota');

// monthRange — range do mês-calendário
let r = monthRange('2026-06-11');
assert.strictEqual(r.start, '2026-06-01', 'monthRange start');
assert.strictEqual(r.nextStart, '2026-07-01', 'monthRange nextStart');
assert.strictEqual(r.label, 'junho/2026', 'monthRange label');

r = monthRange('2026-12-31');
assert.strictEqual(r.nextStart, '2027-01-01', 'monthRange virada de ano');

// quotaCheck — primeira ausência do mês: permitido
assert.strictEqual(quotaCheck([], '2026-06-11').allowed, true, 'primeira ausência');

// quotaCheck — segunda ausência no mesmo mês: bloqueado
let q = quotaCheck(['2026-06-04'], '2026-06-11');
assert.strictEqual(q.allowed, false, 'segunda ausência bloqueada');
assert.strictEqual(q.reason, 'quota-esgotada', 'reason quota-esgotada');

// quotaCheck — re-declarar a MESMA data: idempotente, permitido
assert.strictEqual(quotaCheck(['2026-06-11'], '2026-06-11').allowed, true, 're-declarar mesma data');

// quotaCheck — ausência em outro mês não conta
assert.strictEqual(quotaCheck(['2026-05-28'], '2026-06-11').allowed, true, 'mês anterior não conta');
assert.strictEqual(quotaCheck(['2026-07-02'], '2026-06-11').allowed, true, 'mês seguinte não conta');

// quotaCheck — data antes da vigência: sempre permitido
let pre = quotaCheck(['2026-05-07'], '2026-05-14');
assert.strictEqual(pre.allowed, true, 'pré-vigência permitido');
assert.strictEqual(pre.reason, 'pre-vigencia', 'reason pre-vigencia');

// quotaStatus — atleta com 1 ausência no mês: cota esgotada
let s = quotaStatus(['2026-06-04'], '2026-06-11');
assert.strictEqual(s.used, 1, 'status used');
assert.strictEqual(s.remaining, 0, 'status remaining 0');
assert.strictEqual(s.month, 'junho/2026', 'status month');

// quotaStatus — atleta sem ausência: cota disponível
s = quotaStatus([], '2026-06-11');
assert.strictEqual(s.remaining, 1, 'status remaining 1');

console.log('✅ absenceQuota: todos os testes passaram');
```

- [ ] **Step 2: Rodar os testes pra confirmar que falham**

Run: `node backend/lib/absenceQuota.test.js`
Expected: FAIL — `Cannot find module './absenceQuota'`

- [ ] **Step 3: Implementar o módulo**

Criar `backend/lib/absenceQuota.js`:

```js
// Lógica pura de cota mensal de ausências — sem I/O, testável com `node`.
// Regra: cada atleta declara no máximo 1 ausência por mês-calendário.
// Vigência: 2026-06-01. Ausências com data anterior não entram na cota.

const QUOTA_VIGENCIA = '2026-06-01';
const QUOTA_LIMIT = 1;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// 'YYYY-MM-DD' -> { start, nextStart, label }
// start = primeiro dia do mês; nextStart = primeiro dia do mês seguinte (exclusivo).
function monthRange(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const nextStart = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { start, nextStart, label: `${MESES[m - 1]}/${y}` };
}

// existingDates: array de 'YYYY-MM-DD' já em player_absences (mesmo atleta+torneio).
// candidateDate: a quinta que o atleta quer declarar agora.
// -> { allowed, reason, used, label }
function quotaCheck(existingDates, candidateDate, vigencia = QUOTA_VIGENCIA) {
  const { start, nextStart, label } = monthRange(candidateDate);
  // Re-declarar a MESMA data é idempotente — não conta como nova ausência.
  const otherDatesInMonth = existingDates.filter(
    d => d >= start && d < nextStart && d !== candidateDate
  );
  const used = otherDatesInMonth.length;
  if (candidateDate < vigencia) {
    return { allowed: true, reason: 'pre-vigencia', used, label };
  }
  if (used >= QUOTA_LIMIT) {
    return { allowed: false, reason: 'quota-esgotada', used, label };
  }
  return { allowed: true, reason: 'ok', used, label };
}

// Status da cota no mês de refDate -> { month, limit, used, remaining, dates }
function quotaStatus(existingDates, refDate) {
  const { start, nextStart, label } = monthRange(refDate);
  const datesInMonth = existingDates.filter(d => d >= start && d < nextStart);
  const used = datesInMonth.length;
  return {
    month: label,
    limit: QUOTA_LIMIT,
    used,
    remaining: Math.max(0, QUOTA_LIMIT - used),
    dates: datesInMonth.sort(),
  };
}

module.exports = { monthRange, quotaCheck, quotaStatus, QUOTA_VIGENCIA, QUOTA_LIMIT };
```

- [ ] **Step 4: Rodar os testes pra confirmar que passam**

Run: `node backend/lib/absenceQuota.test.js`
Expected: PASS — `✅ absenceQuota: todos os testes passaram`

- [ ] **Step 5: Commit**

```bash
git add backend/lib/absenceQuota.js backend/lib/absenceQuota.test.js
git commit -m "feat: módulo puro de cota mensal de ausência + testes"
```

---

## Task 3: Guarda da cota no POST /absences

Servidor recusa a 2ª ausência do mês. Esta é a fonte de verdade — o bloqueio no frontend é só UX.

**Files:**
- Modify: `backend/server.js:1015-1039`

- [ ] **Step 1: Inserir a guarda de cota antes do `upsert`**

No handler `POST /api/tournaments/:id/absences`, entre a validação de prazo e o `upsert`.

`old_string`:

```js
    if (new Date() > deadline) {
      const dl = new Date(Date.UTC(y, m - 1, d - 3));
      const dlStr = `${String(dl.getUTCDate()).padStart(2,'0')}/${String(dl.getUTCMonth()+1).padStart(2,'0')}/${dl.getUTCFullYear()}`;
      return res.status(400).json({ error: `Prazo encerrado. O prazo era ${dlStr} às 18h.` });
    }

    const { error } = await supabase
      .from('player_absences')
      .upsert({ id_tournament: req.params.id, id_player, absence_date }, { onConflict: 'id_tournament,id_player,absence_date' });
```

`new_string`:

```js
    if (new Date() > deadline) {
      const dl = new Date(Date.UTC(y, m - 1, d - 3));
      const dlStr = `${String(dl.getUTCDate()).padStart(2,'0')}/${String(dl.getUTCMonth()+1).padStart(2,'0')}/${dl.getUTCFullYear()}`;
      return res.status(400).json({ error: `Prazo encerrado. O prazo era ${dlStr} às 18h.` });
    }

    // Cota mensal: cada atleta declara no máximo 1 ausência por mês-calendário
    // (vigência 01/06/2026). Caso saúde é tratado fora do app (exclusão manual pelo admin).
    const { quotaCheck, monthRange } = require('./lib/absenceQuota');
    const { start: monthStart, nextStart: monthNext } = monthRange(absence_date);
    const { data: monthAbsences, error: monthErr } = await supabase
      .from('player_absences')
      .select('absence_date')
      .eq('id_tournament', req.params.id)
      .eq('id_player', id_player)
      .gte('absence_date', monthStart)
      .lt('absence_date', monthNext);
    if (monthErr) throw new Error(monthErr.message);
    const check = quotaCheck((monthAbsences || []).map(a => a.absence_date), absence_date);
    if (!check.allowed) {
      return res.status(400).json({
        error: `Você já declarou sua ausência de ${check.label}. Cada atleta tem direito a 1 ausência declarada por mês. Em caso de problema de saúde, fale com a administração.`,
      });
    }

    const { error } = await supabase
      .from('player_absences')
      .upsert({ id_tournament: req.params.id, id_player, absence_date }, { onConflict: 'id_tournament,id_player,absence_date' });
```

- [ ] **Step 2: Confirmar que o servidor sobe sem erro de sintaxe**

Run: `node -c backend/server.js`
Expected: sem saída (exit 0) — sintaxe OK.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: guarda de cota mensal no POST de ausências"
```

---

## Task 4: Endpoint GET de status da cota

O frontend usa isto pra saber se deve bloquear o botão e qual aviso mostrar.

**Files:**
- Modify: `backend/server.js` (inserir após o handler `DELETE /api/tournaments/:id/absences/:playerId`, que termina por volta da linha 1067)

- [ ] **Step 1: Adicionar o endpoint**

Inserir logo após o fechamento do handler `DELETE` de absences (depois do `});` que fecha esse `app.delete(...)`):

```js
// GET /api/tournaments/:id/players/:playerId/absence-quota?ref_date=YYYY-MM-DD
// Status da cota mensal de ausências do atleta no mês de ref_date.
app.get('/api/tournaments/:id/players/:playerId/absence-quota', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { quotaStatus, monthRange } = require('./lib/absenceQuota');
    const refDate = req.query.ref_date;
    if (!refDate) return res.status(400).json({ error: 'ref_date obrigatório (YYYY-MM-DD)' });
    const { start, nextStart } = monthRange(refDate);
    const { data, error } = await supabase
      .from('player_absences')
      .select('absence_date')
      .eq('id_tournament', req.params.id)
      .eq('id_player', req.params.playerId)
      .gte('absence_date', start)
      .lt('absence_date', nextStart);
    if (error) throw new Error(error.message);
    res.json(quotaStatus((data || []).map(a => a.absence_date), refDate));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Confirmar sintaxe**

Run: `node -c backend/server.js`
Expected: sem saída (exit 0).

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: endpoint GET de status da cota de ausência"
```

---

## Task 5: SemanaPage — botão bloqueado + aviso contextual

Cobre o card do atleta logado (`/semana`). O caminho público (busca por nome) continua confiando na mensagem de erro do servidor da Task 3 — decisão de escopo deliberada para v1.

**Files:**
- Modify: `frontend/src/pages/SemanaPage.tsx`

- [ ] **Step 1: Adicionar estado de cota**

`old_string` (linha ~100):

```tsx
  const [feedback, setFeedback] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
```

`new_string`:

```tsx
  const [feedback, setFeedback] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const [quota, setQuota] = useState<{ month: string; used: number; remaining: number } | null>(null);
```

- [ ] **Step 2: Adicionar função `loadQuota` e chamá-la no load inicial**

`old_string` (handler de declarar, linha ~172):

```tsx
  const handleDeclareAbsence = async (player: Player) => {
```

`new_string`:

```tsx
  const loadQuota = async (playerId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/players/${playerId}/absence-quota?ref_date=${thuDate}`);
      if (res.ok) setQuota(await res.json());
    } catch { /* aviso de cota é best-effort */ }
  };

  const handleDeclareAbsence = async (player: Player) => {
```

`old_string` (dentro do `useEffect`, após `setLoading(false)` — final do bloco `load`):

```tsx
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [thuDate]);
```

`new_string`:

```tsx
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const s = localStorage.getItem('player_session');
    if (s) loadQuota(JSON.parse(s).id_player);
  }, [thuDate]);
```

- [ ] **Step 3: Recarregar a cota após declarar/cancelar**

No `handleDeclareAbsence`, `old_string`:

```tsx
      setAbsences(prev => [...prev, player.id_player]);
      setFeedback({ id: player.id_player, msg: 'Ausência registrada.', ok: true });
```

`new_string`:

```tsx
      setAbsences(prev => [...prev, player.id_player]);
      setFeedback({ id: player.id_player, msg: 'Ausência registrada.', ok: true });
      loadQuota(player.id_player);
```

No `handleCancelAbsence`, `old_string`:

```tsx
      setAbsences(prev => prev.filter(id => id !== player.id_player));
      setFeedback({ id: player.id_player, msg: 'Ausência cancelada. Você voltou para o sorteio.', ok: true });
```

`new_string`:

```tsx
      setAbsences(prev => prev.filter(id => id !== player.id_player));
      setFeedback({ id: player.id_player, msg: 'Ausência cancelada. Você voltou para o sorteio.', ok: true });
      loadQuota(player.id_player);
```

- [ ] **Step 4: Bloquear o botão "Não posso ir" e mostrar o aviso contextual**

`old_string` (botão de declarar no card do atleta logado, linha ~309):

```tsx
                      <button
                        onClick={() => sessionPlayer && handleDeclareAbsence(sessionPlayer)}
                        disabled={declaringAbsence === playerSession.id_player}
                        className="h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
                      >
                        {declaringAbsence === playerSession.id_player ? 'Registrando...' : 'Não posso ir'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
```

`new_string`:

```tsx
                      <button
                        onClick={() => sessionPlayer && handleDeclareAbsence(sessionPlayer)}
                        disabled={declaringAbsence === playerSession.id_player || (!!quota && quota.remaining <= 0)}
                        className="h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {declaringAbsence === playerSession.id_player ? 'Registrando...' : 'Não posso ir'}
                      </button>
                    </>
                  )}
                </div>
                {quota && !isAbsent && (
                  <p className={`text-[10px] font-bold leading-snug ${quota.remaining > 0 ? 'text-zinc-500' : 'text-amber-400'}`}>
                    {quota.remaining > 0
                      ? `Você tem 1 ausência disponível em ${quota.month}.`
                      : `Você já usou sua ausência de ${quota.month}. Problema de saúde? Fale com a administração.`}
                  </p>
                )}
              </div>
            );
```

- [ ] **Step 5: Confirmar que o build do frontend passa**

Run: `cd frontend && npm run build`
Expected: build conclui sem erro de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SemanaPage.tsx
git commit -m "feat: SemanaPage bloqueia botão e mostra aviso de cota de ausência"
```

---

## Task 6: Banner global anunciando a regra

**Files:**
- Create: `frontend/src/components/TopBanner.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Criar o componente do banner**

Criar `frontend/src/components/TopBanner.tsx`:

```tsx
// Banner global no topo do app — anuncia a regra de cota mensal de ausências.
// Antes de 01/06/2026: anuncia a regra futura. Depois: lembrete permanente curto.

const VIGENCIA = new Date('2026-06-01T00:00:00');

export default function TopBanner() {
  const preVigencia = new Date() < VIGENCIA;
  const msg = preVigencia
    ? '📢 Nova regra a partir de 01/06: cada atleta pode declarar no máximo 1 ausência por mês. Problema de saúde — fale com a administração.'
    : 'Lembrete: cada atleta tem direito a 1 ausência declarada por mês. Acima disso, fale com a administração.';
  return (
    <div className="w-full bg-amber-500 text-black text-center text-[11px] font-bold px-4 py-1.5 leading-snug">
      {msg}
    </div>
  );
}
```

- [ ] **Step 2: Renderizar o banner no topo do App**

Em `frontend/src/App.tsx`, `old_string`:

```tsx
import RondasPage from './pages/RondasPage';
import SemanaPage from './pages/SemanaPage';
```

`new_string`:

```tsx
import RondasPage from './pages/RondasPage';
import SemanaPage from './pages/SemanaPage';
import TopBanner from './components/TopBanner';
```

`old_string`:

```tsx
      <Router basename="/ranking-srb">
      <Routes>
```

`new_string`:

```tsx
      <Router basename="/ranking-srb">
      <TopBanner />
      <Routes>
```

- [ ] **Step 3: Confirmar que o build do frontend passa**

Run: `cd frontend && npm run build`
Expected: build conclui sem erro de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TopBanner.tsx frontend/src/App.tsx
git commit -m "feat: banner global anunciando a regra de cota de ausência"
```

---

## Task 7: Deploy e smoke manual

Verificação funcional final — feita pelo Alessandro na preview/produção (o projeto não tem harness automatizado).

**Files:** nenhum (deploy + verificação)

- [ ] **Step 1: Deploy**

Seguir `DEPLOYMENT.md` do projeto. Confirmar que backend e frontend subiram sem erro.

- [ ] **Step 2: Smoke — banner**

Abrir `/semana`. Expected: banner âmbar no topo com o texto "📢 Nova regra a partir de 01/06..." (antes de 01/06).

- [ ] **Step 3: Smoke — cota disponível**

Logar como um atleta SEM ausência declarada no mês corrente, abrir `/semana` com prazo aberto.
Expected: botão "Não posso ir" ativo + aviso "Você tem 1 ausência disponível em \<mês\>."

- [ ] **Step 4: Smoke — cota esgotada**

Com um atleta que JÁ tem 1 ausência de junho/2026 declarada, tentar declarar ausência para outra quinta de junho.
Expected: botão "Não posso ir" desabilitado + aviso âmbar "Você já usou sua ausência de junho/2026...". Se forçar o POST direto, servidor responde 400 com a mensagem de cota.

- [ ] **Step 5: Smoke — pré-vigência não bloqueia**

Declarar ausência para uma quinta de maio/2026.
Expected: aceito normalmente, sem bloqueio de cota (vigência só 01/06).

- [ ] **Step 6: Smoke — cancelar libera a cota**

Atleta com cota esgotada cancela a ausência declarada do mês. Expected: após cancelar, o botão "Não posso ir" volta a ficar ativo para outra quinta do mesmo mês.

---

## Self-Review

**Spec coverage:**
- 1 ausência/mês-calendário → Task 2 (`quotaCheck`) + Task 3 (enforce). ✓
- Dentro do prazo (seg 18h) → validação de prazo existente preservada na Task 3. ✓
- Esgotou → botão bloqueado → Task 5 Step 4. ✓
- Aviso contextual enquanto o botão está ativo → Task 5 Step 4 (dentro do bloco `deadlineOpen`). ✓
- Exceção saúde via PVT → Task 1 (doc); sem código — admin usa exclusão manual existente. ✓
- Banner no topo → Task 6. ✓
- Reset dia 1º → inerente à lógica de mês-calendário (Task 2). ✓
- Vigência 01/06, nada antes → Task 2 (`QUOTA_VIGENCIA` + reason `pre-vigencia`). ✓
- Contagem só de ausência auto-serviço → inerente: só `player_absences` é consultada; ações de admin vivem em `round_attendance`. ✓

**Placeholder scan:** nenhum TBD/TODO; todo passo de código tem código completo. ✓

**Type consistency:** `monthRange`/`quotaCheck`/`quotaStatus` têm assinatura idêntica entre definição (Task 2), uso no backend (Tasks 3-4) e formato consumido no frontend (`{ month, used, remaining }`, Task 5). ✓
