const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const db = require('./database');
const duplasService = require('./services/duplasService');
const chavesService = require('./services/chavesService');
const schedulerService = require('./services/schedulerService');
const notificationService = require('./services/notificationService');
const categoriesService = require('./services/categoriesService');

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
    id_tournament, name, matricula, data_nascimento, cpf, rg, whatsapp,
    endereco, numero, complemento, cep, tamanho_camiseta, atendido_por,
    side, category_id, payment_status, has_lunch, notes
  } = req.body;

  const sql = `INSERT INTO players (
    id_tournament, name, matricula, data_nascimento, cpf, rg, whatsapp,
    endereco, numero, complemento, cep, tamanho_camiseta, atendido_por,
    side, payment_status, has_lunch, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [
    id_tournament, name, matricula || null, data_nascimento || null, cpf || null,
    rg || null, whatsapp, endereco || null, numero || null, complemento || null,
    cep || null, tamanho_camiseta || null, atendido_por || null,
    side, payment_status || 'PENDING', has_lunch || 0, notes || null
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

// PATCH player (update payment_status or other fields)
app.patch('/api/players/:id', (req, res) => {
  const { payment_status, side, category_id } = req.body;
  const fields = [];
  const params = [];
  if (payment_status !== undefined) { fields.push('payment_status = ?'); params.push(payment_status); }
  if (side !== undefined) { fields.push('side = ?'); params.push(side); }
  if (category_id !== undefined) { fields.push('category_id = ?'); params.push(category_id); }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  params.push(req.params.id);
  db.run(`UPDATE players SET ${fields.join(', ')} WHERE id_player = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: true });
  });
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

// MATCHES (JOGOS)
app.get('/api/tournaments/:id/matches', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT m.*, 
           c.name as court_name,
           d1.display_name as double_a_name,
           d2.display_name as double_b_name
    FROM matches m
    LEFT JOIN courts c ON m.id_court = c.id_court
    LEFT JOIN doubles d1 ON m.id_double_a = d1.id_double
    LEFT JOIN doubles d2 ON m.id_double_b = d2.id_double
    WHERE m.id_tournament = ?
    ORDER BY m.scheduled_at ASC, m.id_match ASC
  `;
  db.all(query, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
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

module.exports = app;

