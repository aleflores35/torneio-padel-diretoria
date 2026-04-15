const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const db = require('./database');
const duplasService = require('./services/duplasService');
const chavesService = require('./services/chavesService');
const schedulerService = require('./services/schedulerService');
const notificationService = require('./services/notificationService');
const categoriesService = require('./services/categoriesService');
const weeklyDrawService = require('./services/weeklyDrawService');

// Garante que a coluna password_hash existe na tabela players (migração segura)
db.run('ALTER TABLE players ADD COLUMN password_hash TEXT', [], () => {});  // ignora erro se já existe

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// --- ROUTES ---

// TOURNAMENTS
app.get('/api/tournaments', (req, res) => {
  db.all('SELECT * FROM tournaments', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tournaments', (req, res) => {
  const { name, start_date, end_date, location, entry_fee, rules_notes } = req.body;
  const sql = `INSERT INTO tournaments (name, start_date, end_date, location, entry_fee, rules_notes) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, start_date, end_date, location, entry_fee, rules_notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id_tournament: this.lastID });
  });
});

// DOUBLES (DUPLAS)
app.get('/api/tournaments/:id/doubles', (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM doubles WHERE id_tournament = ? ORDER BY id_double ASC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PLAYERS
app.get('/api/players', (req, res) => {
  // Retorna todos os jogadores (ou do torneio 1 por padrão)
  db.all('SELECT * FROM players ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/tournaments/:id/players', (req, res) => {
  const { id } = req.params;
  const { category } = req.query;

  let sql = 'SELECT * FROM players WHERE id_tournament = ?';
  const params = [id];

  if (category) {
    sql += ' AND category_id = ?';
    params.push(category);
  }

  sql += ' ORDER BY name ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/players', (req, res) => {
  const {
    id_tournament, name, email, whatsapp,
    side, category_id, payment_status,
    // campos opcionais legados
    matricula, data_nascimento, cpf, rg,
    endereco, numero, complemento, cep, tamanho_camiseta, atendido_por,
    has_lunch, notes
  } = req.body;

  const sql = `INSERT INTO players (
    id_tournament, name, email, whatsapp,
    side, category_id, payment_status,
    matricula, data_nascimento, cpf, rg,
    endereco, numero, complemento, cep, tamanho_camiseta, atendido_por,
    has_lunch, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [
    id_tournament, name, email || null, whatsapp || null,
    side || 'EITHER', category_id || null, payment_status || 'PENDING',
    matricula || null, data_nascimento || null, cpf || null, rg || null,
    endereco || null, numero || null, complemento || null, cep || null,
    tamanho_camiseta || null, atendido_por || null,
    has_lunch || 0, notes || null
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id_player: this.lastID });
  });
});

// DELETE player
app.delete('/api/players/:id', (req, res) => {
  db.run('DELETE FROM players WHERE id_player = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Atleta não encontrado' });
    res.json({ deleted: true });
  });
});

// PATCH player (update payment_status or other fields, including password)
app.patch('/api/players/:id', async (req, res) => {
  const { payment_status, side, category_id, email, whatsapp, password } = req.body;
  const fields = [];
  const params = [];
  if (payment_status !== undefined) { fields.push('payment_status = ?'); params.push(payment_status); }
  if (side !== undefined)           { fields.push('side = ?');           params.push(side); }
  if (category_id !== undefined)    { fields.push('category_id = ?');    params.push(category_id); }
  if (email !== undefined)          { fields.push('email = ?');          params.push(email); }
  if (whatsapp !== undefined)       { fields.push('whatsapp = ?');       params.push(whatsapp); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    fields.push('password_hash = ?');
    params.push(hash);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  params.push(req.params.id);
  db.run(`UPDATE players SET ${fields.join(', ')} WHERE id_player = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: true });
  });
});

// POST athlete login
app.post('/api/auth/athlete/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  db.get(
    'SELECT id_player, name, email, category_id, side, password_hash FROM players WHERE LOWER(email) = LOWER(?)',
    [email.trim()],
    async (err, player) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!player || !player.password_hash) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }
      const match = await bcrypt.compare(password, player.password_hash);
      if (!match) return res.status(401).json({ error: 'Email ou senha incorretos' });

      res.json({
        role: 'ATHLETE',
        id_player: player.id_player,
        name: player.name,
        category_id: player.category_id,
        side: player.side
      });
    }
  );
});

// POST notify player (WhatsApp fallback)
app.post('/api/players/:id/notify', (req, res) => {
  db.get('SELECT * FROM players WHERE id_player = ?', [req.params.id], (err, player) => {
    if (err || !player) return res.status(404).json({ error: 'Atleta não encontrado' });
    const notificationService = require('./services/notificationService');
    const msg = `Olá ${player.name}! Sua inscrição no Ranking Padel SRB 2026 foi confirmada. Aguarde o cronograma de jogos. 🏓`;
    notificationService.sendMessage(player.whatsapp, msg, (err) => {
      if (err) {
        console.log(`[WhatsApp fallback] Para ${player.name} (${player.whatsapp}): ${msg}`);
        return res.json({ sent: true, mode: 'console' });
      }
      res.json({ sent: true, mode: 'whatsapp' });
    });
  });
});

// COURTS
app.get('/api/tournaments/:id/courts', (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM courts WHERE id_tournament = ? ORDER BY order_index ASC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/courts', (req, res) => {
  const { id_tournament, name, order_index } = req.body;
  db.run('INSERT INTO courts (id_tournament, name, order_index) VALUES (?, ?, ?)', [id_tournament, name, order_index], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id_court: this.lastID });
  });
});

// MATCHES (JOGOS) - decomposed queries for supabaseAdapter compatibility
app.get('/api/tournaments/:id/matches', async (req, res) => {
  const { id } = req.params;
  const dbAll = (sql, params) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
  );
  try {
    const [matches, doubles, courts, rounds] = await Promise.all([
      dbAll('SELECT * FROM matches WHERE id_tournament = ? ORDER BY scheduled_at', [id]),
      dbAll('SELECT * FROM doubles WHERE id_tournament = ?', [id]),
      dbAll('SELECT * FROM courts WHERE id_tournament = ?', [id]),
      dbAll('SELECT * FROM rounds WHERE id_tournament = ?', [id]),
    ]);
    const doublesMap = {};
    doubles.forEach(d => { doublesMap[d.id_double] = d; });
    const courtsMap = {};
    courts.forEach(c => { courtsMap[c.id_court] = c; });
    const roundsMap = {};
    rounds.forEach(r => { roundsMap[r.id_round] = r; });

    const enriched = matches.map(m => {
      const roundId = doublesMap[m.id_double_a]?.id_round || null;
      const round = roundsMap[roundId] || {};
      return {
        ...m,
        court_name: courtsMap[m.id_court]?.name || 'Quadra',
        double_a_name: doublesMap[m.id_double_a]?.display_name || 'Dupla A',
        double_b_name: doublesMap[m.id_double_b]?.display_name || 'Dupla B',
        id_round: roundId,
        round_number: round.round_number || null,
        scheduled_date: round.scheduled_date || null,
        id_category: round.id_category || null,
      };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/matches/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, games_double_a, games_double_b } = req.body;
  
  const sql = `UPDATE matches SET status = ?, games_double_a = ?, games_double_b = ? WHERE id_match = ?`;
  db.run(sql, [status, games_double_a || 0, games_double_b || 0, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

app.post('/api/matches/:id/call', async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Atualiza status para CALLING
    await new Promise((resolve, reject) => {
      db.run('UPDATE matches SET status = "CALLING" WHERE id_match = ?', [id], (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // 2. Dispara notificação
    const notifyResult = await notificationService.sendNotification(id, 'CALL_MATCH');
    
    res.json({ status: 'calling', notification: notifyResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GROUPS/CHAVES
app.get('/api/tournaments/:id/chaves', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT c.id_group as id_chave, c.name, 
           d.id_double, d.display_name as nome_exibicao
    FROM groups c
    LEFT JOIN groups_doubles gd ON c.id_group = gd.id_group
    LEFT JOIN doubles d ON gd.id_double = d.id_double
    WHERE c.id_tournament = ?
    ORDER BY c.order_index ASC
  `;
  db.all(query, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Agrupar duplas por chave
    const chaves = rows.reduce((acc, row) => {
      let chave = acc.find(c => c.id_chave === row.id_chave);
      if (!chave) {
        chave = { id_chave: row.id_chave, nome: row.name, duplas: [] };
        acc.push(chave);
      }
      if (row.id_double) {
        chave.duplas.push({ id_dupla: row.id_double, nome_exibicao: row.nome_exibicao });
      }
      return acc;
    }, []);
    
    res.json(chaves);
  });
});

// LOGIC ACTIONS
app.post('/api/tournaments/:id/generate-doubles', async (req, res) => {
  try {
    const result = await duplasService.sortearDuplas(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tournaments/:id/generate-chaves', async (req, res) => {
  try {
    const result = await chavesService.gerarChaves(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tournaments/:id/schedule', async (req, res) => {
  try {
    const result = await schedulerService.agendarJogos(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ALIASES EM PORTUGUÊS PARA COMPATIBILIDADE E REDIRECTS
app.get('/api/torneios/:id/chaves', (req, res) => res.redirect(307, `/api/tournaments/${req.params.id}/chaves`));
app.get('/api/torneios/:id/jogos', (req, res) => res.redirect(307, `/api/tournaments/${req.params.id}/matches`));
app.post('/api/torneios/:id/generate-chaves', (req, res) => res.redirect(307, `/api/tournaments/${req.params.id}/generate-chaves`));
app.post('/api/torneios/:id/schedule', (req, res) => res.redirect(307, `/api/tournaments/${req.params.id}/schedule`));
app.post('/api/torneios/:id/generate-doubles', (req, res) => res.redirect(307, `/api/tournaments/${req.params.id}/generate-doubles`));

// ============ MIDDLEWARE HELPERS ============

// Middleware to authenticate token (basic implementation)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  // For now, basic validation. In production, verify JWT
  req.user = { athleteId: req.body.athleteId || null };
  next();
};

// Middleware to authorize admin (basic implementation)
const authorizeAdmin = (req, res, next) => {
  // For now, basic check. In production, verify user role from token
  const isAdmin = req.headers['x-admin'] === 'true' || req.user?.role === 'admin';
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ============ CATEGORIES & PHASES ============

app.get('/api/categories', (req, res) => {
  categoriesService.getAllCategories((err, categories) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(categories);
  });
});

app.post('/api/categories/:categoryId/athlete', authenticateToken, (req, res) => {
  const { categoryId } = req.params;
  const athleteId = req.user.athleteId || req.body.athleteId;

  if (!athleteId) return res.status(400).json({ error: 'athleteId required' });

  db.run(
    'UPDATE athletes SET category_id = ? WHERE id = ?',
    [categoryId, athleteId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Athlete registered to category', categoryId, athleteId });
    }
  );
});

app.get('/api/categories/:phaseId/status', (req, res) => {
  const { phaseId } = req.params;
  categoriesService.getPhaseStatus(phaseId, (err, phase) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!phase) return res.status(404).json({ error: 'Phase not found' });
    res.json(phase);
  });
});

app.post('/api/phases/:phaseId/close-registration', authenticateToken, authorizeAdmin, (req, res) => {
  const { phaseId } = req.params;
  categoriesService.closeRegistration(phaseId, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Registration closed for phase', phaseId });
  });
});

// ============ RANKING SRB ENDPOINTS ============

// GET categories for a tournament (decomposed: fetch players, extract distinct category IDs, fetch categories)
app.get('/api/tournaments/:id/categories', async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch all players to find which categories are used in this tournament
    const players = await new Promise((resolve, reject) =>
      db.all('SELECT * FROM players WHERE id_tournament = ?', [id], (err, rows) => err ? reject(err) : resolve(rows || []))
    );
    const catIds = [...new Set(players.map(p => p.category_id).filter(Boolean))];
    if (!catIds.length) return res.json([]);

    // Fetch all categories and filter to those present
    const allCats = await new Promise((resolve, reject) =>
      db.all('SELECT * FROM categories ORDER BY id', [], (err, rows) => err ? reject(err) : resolve(rows || []))
    );
    const cats = allCats.filter(c => catIds.includes(c.id));
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a category
app.post('/api/categories', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, description });
  });
});

// GET all rounds for a tournament
app.get('/api/tournaments/:id/rounds', (req, res) => {
  const { id } = req.params;
  db.getRounds(id, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// POST generate rounds using Berger algorithm
app.post('/api/tournaments/:id/generate-rounds/:catId', async (req, res) => {
  const { id, catId } = req.params;
  const { start_date } = req.body;

  if (!start_date) return res.status(400).json({ error: 'start_date required' });

  try {
    const roundsService = require('./services/roundsService');
    const result = await roundsService.gerarRodas(parseInt(id), parseInt(catId), new Date(start_date));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST schedule a specific round
app.post('/api/rounds/:id/schedule', async (req, res) => {
  const { id } = req.params;
  try {
    const { agendarRodada } = require('./services/schedulerService');
    const result = await agendarRodada(parseInt(id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ranking/standings for a category
app.get('/api/tournaments/:id/ranking/:catId', async (req, res) => {
  const { id, catId } = req.params;
  try {
    const rankingService = require('./services/rankingService');
    const standings = await rankingService.getStandings(parseInt(id), parseInt(catId));
    res.json(standings || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ranking for all categories in a tournament
app.get('/api/tournaments/:id/ranking', async (req, res) => {
  const { id } = req.params;
  try {
    const rankingService = require('./services/rankingService');
    const standings = await rankingService.getAllCategoryStandings(parseInt(id));
    res.json(standings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET calendar of rounds for a category
app.get('/api/tournaments/:id/rounds/:catId/calendar', async (req, res) => {
  const { id, catId } = req.params;
  try {
    const roundsService = require('./services/roundsService');
    const calendario = await roundsService.getCalendario(parseInt(id), parseInt(catId));
    res.json(calendario || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET próximas rodadas
app.get('/api/tournaments/:id/rounds/next', async (req, res) => {
  const { id } = req.params;
  try {
    const roundsService = require('./services/roundsService');
    const rounds = await roundsService.getProximasRodadas(parseInt(id));
    res.json(rounds || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// ─── SORTEIO SEMANAL ────────────────────────────────────────────────────────

// POST /api/tournaments/:id/categories/:catId/draw-week
// Sorteia uma rodada semanal para a categoria
app.post('/api/tournaments/:id/categories/:catId/draw-week', async (req, res) => {
  try {
    const { scheduled_date, excluded_player_ids = [] } = req.body;
    if (!scheduled_date) return res.status(400).json({ error: 'scheduled_date obrigatório (YYYY-MM-DD)' });
    const result = await weeklyDrawService.drawWeeklyRound(
      Number(req.params.id),
      Number(req.params.catId),
      scheduled_date,
      excluded_player_ids
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rounds/:id/redraw
// Refaz sorteio (só DRAFT ou AWAITING_CONFIRMATION)
app.post('/api/rounds/:id/redraw', async (req, res) => {
  try {
    const { excluded_player_ids = [] } = req.body;
    const result = await weeklyDrawService.redrawRound(Number(req.params.id), excluded_player_ids);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rounds/:id/send-confirmations
// Muda status para AWAITING_CONFIRMATION
app.post('/api/rounds/:id/send-confirmations', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { error } = await supabase
      .from('rounds')
      .update({ status: 'AWAITING_CONFIRMATION' })
      .eq('id_round', req.params.id)
      .in('status', ['DRAFT']);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rounds/:id/matches — jogos de uma rodada específica
app.get('/api/rounds/:id/matches', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const id_round = Number(req.params.id);

    // 1. Busca duplas da rodada
    const { data: doubles, error: dErr } = await supabase
      .from('doubles')
      .select('id_double, id_player1, id_player2, display_name')
      .eq('id_round', id_round);
    if (dErr) throw new Error(dErr.message);
    if (!doubles || doubles.length === 0) return res.json([]);

    const doubleIds = doubles.map(d => d.id_double);
    const doubleMap = {};
    doubles.forEach(d => { doubleMap[d.id_double] = d; });

    // 2. Busca matches onde id_double_a está entre as duplas da rodada
    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('*')
      .in('id_double_a', doubleIds)
      .order('scheduled_at');
    if (mErr) throw new Error(mErr.message);
    if (!matches || matches.length === 0) return res.json([]);

    // 3. Busca quadras
    const courtIds = [...new Set(matches.map(m => m.id_court).filter(Boolean))];
    let courtMap = {};
    if (courtIds.length > 0) {
      const { data: courts } = await supabase.from('courts').select('id_court, name').in('id_court', courtIds);
      (courts || []).forEach(c => { courtMap[c.id_court] = c.name; });
    }

    const enriched = matches.map(m => ({
      id_match: m.id_match,
      id_round,
      double_a_name: doubleMap[m.id_double_a]?.display_name || 'Dupla A',
      double_b_name: doubleMap[m.id_double_b]?.display_name || 'Dupla B',
      court_name: courtMap[m.id_court] || 'Quadra',
      scheduled_at: m.scheduled_at,
      status: m.status,
      score_a: m.score_a,
      score_b: m.score_b,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rounds/:id/confirm
// Confirma rodada e gera matches
app.post('/api/rounds/:id/confirm', async (req, res) => {
  try {
    const result = await weeklyDrawService.confirmRound(Number(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rounds/:id/close
// Fecha rodada: aplica WO em matches não realizados
app.post('/api/rounds/:id/close', async (req, res) => {
  try {
    const result = await weeklyDrawService.closeRound(Number(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rounds/:id/attendance
// Lista presença da rodada
app.get('/api/rounds/:id/attendance', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { data, error } = await supabase
      .from('round_attendance')
      .select('*')
      .eq('id_round', req.params.id);
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rounds/:id/attendance
// Admin define status de presença de um atleta
app.post('/api/rounds/:id/attendance', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { id_player, status, notes } = req.body;
    const { error } = await supabase
      .from('round_attendance')
      .upsert({
        id_round: Number(req.params.id),
        id_player,
        status,
        notes,
        responded_at: new Date().toISOString(),
        responded_by: 'ADMIN'
      }, { onConflict: 'id_round,id_player' });
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/:id/categories/:catId/player-stats
// Retorna estatísticas por atleta da categoria
app.get('/api/tournaments/:id/categories/:catId/player-stats', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { data: stats, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('id_tournament', req.params.id)
      .eq('id_category', req.params.catId);
    if (error) throw new Error(error.message);

    const { data: players } = await supabase
      .from('players')
      .select('id_player, name, side')
      .eq('id_tournament', req.params.id)
      .eq('category_id', req.params.catId);

    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id_player] = p; });

    const result = (stats || []).map(s => ({
      ...s,
      name: playerMap[s.id_player]?.name || '',
      side: playerMap[s.id_player]?.side || ''
    })).sort((a, b) => b.games_played - a.games_played);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AUSÊNCIAS DE ATLETAS ──────────────────────────────────────────────────────

// GET /api/tournaments/:id/absences?date=YYYY-MM-DD&category=1
// Retorna ausências declaradas para uma quinta-feira
app.get('/api/tournaments/:id/absences', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { date, category } = req.query;
    let query = supabase
      .from('player_absences')
      .select('*, players(id_player, name, category_id, side)')
      .eq('id_tournament', req.params.id);
    if (date) query = query.eq('absence_date', date);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    // filtra por categoria se pedido
    const result = (data || []).filter(a =>
      !category || String(a.players?.category_id) === String(category)
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/absences
// Atleta declara ausência para uma quinta-feira (prazo: segunda 18h)
app.post('/api/tournaments/:id/absences', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { id_player, absence_date } = req.body;
    if (!id_player || !absence_date) return res.status(400).json({ error: 'id_player e absence_date obrigatórios' });

    // Valida prazo: segunda-feira às 18h da semana do jogo
    const gameDate = new Date(absence_date + 'T12:00:00');
    const deadline = new Date(gameDate);
    deadline.setDate(gameDate.getDate() - 3); // quinta - 3 = segunda
    deadline.setHours(18, 0, 0, 0);
    if (new Date() > deadline) {
      return res.status(400).json({ error: `Prazo encerrado. O prazo era ${deadline.toLocaleDateString('pt-BR')} às 18h.` });
    }

    const { error } = await supabase
      .from('player_absences')
      .upsert({ id_tournament: req.params.id, id_player, absence_date }, { onConflict: 'id_tournament,id_player,absence_date' });
    if (error) throw new Error(error.message);
    res.json({ ok: true, message: 'Ausência registrada com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tournaments/:id/absences/:playerId?date=YYYY-MM-DD
// Atleta cancela ausência (dentro do prazo)
app.delete('/api/tournaments/:id/absences/:playerId', async (req, res) => {
  try {
    const supabase = require('./supabase');
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date obrigatório' });

    const gameDate = new Date(date + 'T12:00:00');
    const deadline = new Date(gameDate);
    deadline.setDate(gameDate.getDate() - 3);
    deadline.setHours(18, 0, 0, 0);
    if (new Date() > deadline) {
      return res.status(400).json({ error: 'Prazo encerrado para cancelar ausência.' });
    }

    const { error } = await supabase
      .from('player_absences')
      .delete()
      .eq('id_tournament', req.params.id)
      .eq('id_player', req.params.playerId)
      .eq('absence_date', date);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MIGRATE: corrige datas de rodadas (executa 1x se datas estão erradas) ────
// POST /api/admin/fix-round-dates  →  subtrai 1 dia de todas as rounds do torneio
app.post('/api/admin/fix-round-dates', async (req, res) => {
  const { id_tournament } = req.body;
  if (!id_tournament) return res.status(400).json({ error: 'id_tournament required' });
  try {
    const supabase = require('./supabase');
    // Busca todas as rodadas do torneio
    const { data: rounds, error: fetchErr } = await supabase
      .from('rounds')
      .select('id_round, scheduled_date, window_end')
      .eq('id_tournament', id_tournament);
    if (fetchErr) throw new Error(fetchErr.message);
    let updated = 0;
    for (const r of rounds) {
      // Subtrai 1 dia da data agendada e corrige window_end para 21:00
      const d = new Date(r.scheduled_date + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      const newDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const { error: updErr } = await supabase
        .from('rounds')
        .update({ scheduled_date: newDate, window_end: '21:00' })
        .eq('id_round', r.id_round);
      if (!updErr) updated++;
    }
    return res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ZERAR RODADAS (apaga rounds + doubles + matches do torneio) ──────────────
app.delete('/api/tournaments/:id/rounds', async (req, res) => {
  const supabase = require('./supabase');
  const { id } = req.params;
  try {
    // Delete in FK-safe order: matches → doubles → rounds
    await supabase.from('matches').delete().eq('id_tournament', id);
    await supabase.from('doubles').delete().eq('id_tournament', id);
    await supabase.from('rounds').delete().eq('id_tournament', id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ATHLETE PORTAL ──────────────────────────────────────────────────────────

// Player lookup by WhatsApp phone
app.get('/api/players/lookup', async (req, res) => {
  const supabase = require('./supabase');
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' });
  const digits = String(phone).replace(/\D/g, '');
  const suffix = digits.slice(-9); // last 9 digits, flexible on country code
  const { data, error } = await supabase
    .from('players')
    .select('id_player, name, side, category_id, whatsapp')
    .ilike('whatsapp', `%${suffix}`);
  if (error || !data?.length) return res.status(404).json({ error: 'Atleta não encontrado com esse número' });
  if (data.length === 1) return res.json(data[0]);
  res.json(data); // multiple matches — frontend shows picker
});

// Player match history
app.get('/api/players/:id/history', async (req, res) => {
  const supabase = require('./supabase');
  const id_player = Number(req.params.id);

  const { data: myDoubles } = await supabase
    .from('doubles')
    .select('id_double, id_player1, id_player2, display_name')
    .or(`id_player1.eq.${id_player},id_player2.eq.${id_player}`);

  if (!myDoubles?.length) return res.json([]);
  const myDoubleIds = myDoubles.map(d => d.id_double);

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .or(`id_double_a.in.(${myDoubleIds.join(',')}),id_double_b.in.(${myDoubleIds.join(',')})`)
    .order('scheduled_at', { ascending: false });

  if (!matches?.length) return res.json([]);

  // Enrich with double + player names
  const allDoubleIds = [...new Set([...matches.map(m => m.id_double_a), ...matches.map(m => m.id_double_b)])].filter(Boolean);
  const { data: allDoubles } = await supabase.from('doubles').select('id_double, id_player1, id_player2, display_name').in('id_double', allDoubleIds);
  const doubleMap = {};
  (allDoubles || []).forEach(d => { doubleMap[d.id_double] = d; });

  const allPlayerIds = [...new Set((allDoubles || []).flatMap(d => [d.id_player1, d.id_player2]).filter(Boolean))];
  const { data: allPlayers } = await supabase.from('players').select('id_player, name').in('id_player', allPlayerIds);
  const playerMap = {};
  (allPlayers || []).forEach(p => { playerMap[p.id_player] = p.name; });

  // Enrich with round dates
  const roundIds = [...new Set(myDoubles.map(d => d.id_round).filter(Boolean))];
  let roundMap = {};
  if (roundIds.length) {
    const { data: rounds } = await supabase.from('rounds').select('id_round, scheduled_date').in('id_round', roundIds);
    (rounds || []).forEach(r => { roundMap[r.id_round] = r.scheduled_date; });
  }

  const enriched = matches.map(m => {
    const amDoubleA = myDoubleIds.includes(m.id_double_a);
    const myDouble = doubleMap[amDoubleA ? m.id_double_a : m.id_double_b];
    const oppDouble = doubleMap[amDoubleA ? m.id_double_b : m.id_double_a];
    const partnerId = myDouble ? (myDouble.id_player1 === id_player ? myDouble.id_player2 : myDouble.id_player1) : null;
    const myScore = amDoubleA ? (m.score_a ?? m.games_double_a ?? null) : (m.score_b ?? m.games_double_b ?? null);
    const oppScore = amDoubleA ? (m.score_b ?? m.games_double_b ?? null) : (m.score_a ?? m.games_double_a ?? null);
    const scheduledDate = m.scheduled_date || (myDouble?.id_round ? roundMap[myDouble.id_round] : null);
    return {
      id_match: m.id_match,
      scheduled_at: m.scheduled_at,
      scheduled_date: scheduledDate,
      court_name: m.court_name,
      status: m.status,
      partner_name: partnerId ? playerMap[partnerId] : null,
      opponent_names: oppDouble
        ? `${playerMap[oppDouble.id_player1] || '?'} / ${playerMap[oppDouble.id_player2] || '?'}`
        : null,
      my_score: myScore,
      opp_score: oppScore,
      won: m.status === 'FINISHED' && myScore != null && oppScore != null && myScore > oppScore,
      player_score_a: m.player_score_a ?? null,
      player_score_b: m.player_score_b ?? null,
      player_score_submitted_by: m.player_score_submitted_by ?? null,
    };
  });

  res.json(enriched);
});

// Submit score by player (with duplicate check)
app.post('/api/matches/:id/submit-score', async (req, res) => {
  const supabase = require('./supabase');
  const id_match = Number(req.params.id);
  const { id_player, score_a, score_b } = req.body;
  if (!id_player || score_a == null || score_b == null) {
    return res.status(400).json({ error: 'id_player, score_a e score_b são obrigatórios' });
  }

  const { data: match } = await supabase.from('matches').select('*').eq('id_match', id_match).single();
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado' });
  if (match.status === 'FINISHED' || match.status === 'WO') {
    return res.status(409).json({ error: 'Jogo já encerrado' });
  }

  // Verify player is in this match
  const { data: myDoubles } = await supabase
    .from('doubles').select('id_double')
    .or(`id_player1.eq.${id_player},id_player2.eq.${id_player}`);
  const myDoubleIds = (myDoubles || []).map(d => d.id_double);
  if (!myDoubleIds.includes(match.id_double_a) && !myDoubleIds.includes(match.id_double_b)) {
    return res.status(403).json({ error: 'Você não está neste jogo' });
  }

  // Duplicate check: already submitted by a different player?
  if (match.player_score_submitted_by && match.player_score_submitted_by !== id_player) {
    const { data: sub } = await supabase.from('players').select('name').eq('id_player', match.player_score_submitted_by).single();
    return res.status(409).json({
      already_submitted: true,
      submitted_by: sub?.name || 'outro atleta',
      player_score_a: match.player_score_a,
      player_score_b: match.player_score_b,
    });
  }

  await supabase.from('matches').update({
    player_score_a: score_a,
    player_score_b: score_b,
    player_score_submitted_by: id_player,
    player_score_submitted_at: new Date().toISOString(),
  }).eq('id_match', id_match);

  res.json({ ok: true });
});

// ─── EXPORTAR PLANILHA EXCEL ──────────────────────────────────────────────────
// GET /api/tournaments/:id/export
// Gera e retorna um arquivo Excel com abas: Atletas, Rodadas, Duplas, Jogos, Ranking, Conciliador
app.get('/api/tournaments/:id/export', async (req, res) => {
  const supabase = require('./supabase');
  const XLSX = require('xlsx');
  const id = Number(req.params.id);

  const CATEGORIES = [
    { id: 1, name: 'Masculino Iniciante' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' },
  ];

  try {
    // --- 1. Fetch raw data ---
    const [{ data: players }, { data: rounds }, { data: doubles }, { data: matches }] = await Promise.all([
      supabase.from('players').select('*').eq('id_tournament', id).order('name'),
      supabase.from('rounds').select('*').eq('id_tournament', id).order('round_number'),
      supabase.from('doubles').select('*').eq('id_tournament', id),
      supabase.from('matches').select('*').eq('id_tournament', id).order('scheduled_at'),
    ]);

    // Helper maps
    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id_player] = p; });
    const doubleMap = {};
    (doubles || []).forEach(d => { doubleMap[d.id_double] = d; });
    const roundMap = {};
    (rounds || []).forEach(r => { roundMap[r.id_round] = r; });
    const catName = (id) => CATEGORIES.find(c => c.id === id)?.name || String(id);

    const wb = XLSX.utils.book_new();

    // --- ABA: Atletas ---
    const atletasData = (players || []).map(p => ({
      ID: p.id_player,
      Nome: p.name,
      Categoria: catName(p.category_id),
      Lado: p.side,
      WhatsApp: p.whatsapp || '',
      Sócio: p.is_socio ? 'Sim' : 'Não',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(atletasData), 'Atletas');

    // --- ABA: Rodadas ---
    const roundsData = (rounds || []).map(r => ({
      ID: r.id_round,
      Rodada: r.round_number,
      Categoria: catName(r.id_category),
      Data: r.scheduled_date,
      Status: r.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roundsData), 'Rodadas');

    // --- ABA: Duplas ---
    const duplasData = (doubles || []).map(d => {
      const r = roundMap[d.id_round] || {};
      const p1 = playerMap[d.id_player1];
      const p2 = playerMap[d.id_player2];
      return {
        ID: d.id_double,
        Rodada: r.round_number || '',
        Data: r.scheduled_date || '',
        Categoria: catName(r.id_category || p1?.category_id),
        'Jogador 1': p1?.name || d.id_player1,
        'Lado 1': p1?.side || '',
        'Jogador 2': p2?.name || d.id_player2,
        'Lado 2': p2?.side || '',
        Dupla: d.display_name || '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(duplasData), 'Duplas');

    // --- ABA: Jogos ---
    const jogosData = (matches || []).map(m => {
      const da = doubleMap[m.id_double_a] || {};
      const db = doubleMap[m.id_double_b] || {};
      const r = roundMap[da.id_round] || {};
      const p1a = playerMap[da.id_player1];
      const p2a = playerMap[da.id_player2];
      const p1b = playerMap[db.id_player1];
      const p2b = playerMap[db.id_player2];
      return {
        ID: m.id_match,
        Rodada: r.round_number || '',
        Data: m.scheduled_date || r.scheduled_date || '',
        'Dupla A': da.display_name || `${p1a?.name || '?'} / ${p2a?.name || '?'}`,
        'Dupla B': db.display_name || `${p1b?.name || '?'} / ${p2b?.name || '?'}`,
        'Placar A': m.score_a ?? m.games_double_a ?? '',
        'Placar B': m.score_b ?? m.games_double_b ?? '',
        Status: m.status,
        'Placar Atleta A': m.player_score_a ?? '',
        'Placar Atleta B': m.player_score_b ?? '',
        'Submetido por': m.player_score_submitted_by ? (playerMap[m.player_score_submitted_by]?.name || m.player_score_submitted_by) : '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jogosData), 'Jogos');

    // --- ABA: Ranking (por categoria, lado a lado) ---
    const rankingService = require('./services/rankingService');
    const allStandings = await rankingService.getAllCategoryStandings(id);
    const rankingRows = [];
    for (const cat of CATEGORIES) {
      const standings = allStandings[cat.id] || [];
      if (!standings.length) continue;
      // Blank separator row then category header
      if (rankingRows.length) rankingRows.push({});
      rankingRows.push({ Categoria: cat.name });
      standings.forEach((p, idx) => {
        rankingRows.push({
          '#': idx + 1,
          Nome: p.name,
          Lado: p.side,
          Pontos: p.points,
          Vitórias: p.wins,
          Derrotas: p.losses,
          'WOs': p.wo_count ?? 0,
          Categoria: cat.name,
        });
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankingRows), 'Ranking');

    // --- ABA: Conciliador (pivot: atleta × rodada → pontos acumulados) ---
    // For each player: row per player, col per round
    // Points: win=3, loss=1, absent(WO)=0
    const finishedRounds = (rounds || []).filter(r => r.status === 'FINISHED' || r.status === 'CONFIRMED').sort((a,b) => a.round_number - b.round_number);
    const roundCols = finishedRounds.map(r => `R${r.round_number} (${r.scheduled_date || ''})`);

    // Build player→round→points map
    const ptMap = {}; // ptMap[id_player][id_round] = points
    for (const m of (matches || [])) {
      if (m.status !== 'FINISHED') continue;
      const da = doubleMap[m.id_double_a];
      const db = doubleMap[m.id_double_b];
      const scoreA = m.score_a ?? m.games_double_a ?? null;
      const scoreB = m.score_b ?? m.games_double_b ?? null;
      if (scoreA == null || scoreB == null) continue;
      const wonA = scoreA > scoreB;

      const applyPoints = (doubleObj, won) => {
        if (!doubleObj) return;
        const r = roundMap[doubleObj.id_round];
        if (!r) return;
        for (const pid of [doubleObj.id_player1, doubleObj.id_player2]) {
          if (!pid) continue;
          if (!ptMap[pid]) ptMap[pid] = {};
          ptMap[pid][r.id_round] = (ptMap[pid][r.id_round] || 0) + (won ? 3 : 1);
        }
      };
      applyPoints(da, wonA);
      applyPoints(db, !wonA);
    }

    const conciliadorRows = [];
    for (const cat of CATEGORIES) {
      const catPlayers = (players || []).filter(p => p.category_id === cat.id);
      if (!catPlayers.length) continue;
      if (conciliadorRows.length) conciliadorRows.push({});
      conciliadorRows.push({ Nome: `── ${cat.name} ──` });
      const header = { Nome: 'Atleta', Lado: 'Lado', ...Object.fromEntries(roundCols.map(c => [c, ''])), Total: 'Total' };
      conciliadorRows.push(header);
      for (const p of catPlayers) {
        const row = { Nome: p.name, Lado: p.side };
        let total = 0;
        for (const r of finishedRounds) {
          const pts = ptMap[p.id_player]?.[r.id_round] ?? 0;
          row[`R${r.round_number} (${r.scheduled_date || ''})`] = pts;
          total += pts;
        }
        row.Total = total;
        conciliadorRows.push(row);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conciliadorRows), 'Conciliador');

    // --- Send file ---
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const today = new Date();
    const filename = `ranking-srb-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

