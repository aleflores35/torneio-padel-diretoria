const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const supabase = require('./supabase');
require('dotenv').config();

const USE_SUPABASE = process.env.DB_TYPE === 'supabase';

const dbPath = path.resolve(__dirname, 'padel.db');
const localDb = new sqlite3.Database(dbPath);

// Initialize SQLite if needed
localDb.serialize(() => {
  localDb.run(`CREATE TABLE IF NOT EXISTS tournaments (
    id_tournament INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    location TEXT,
    entry_fee REAL,
    rules_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // ... other tables are already created or will be by the existing server logic
});

/**
 * Database Adapter - Harmonizes SQLite and Supabase calls
 * Uses simple SQL pattern matching to translate to Supabase JS client
 */
const dbAdapter = {
  all: (sql, params, callback) => {
    if (USE_SUPABASE) {
      return supabaseAdapter.all(sql, params, callback);
    }
    localDb.all(sql, params, callback);
  },

  get: (sql, params, callback) => {
    if (USE_SUPABASE) {
      return supabaseAdapter.get(sql, params, callback);
    }
    localDb.get(sql, params, callback);
  },

  run: (sql, params, callback) => {
    if (USE_SUPABASE) {
      return supabaseAdapter.run(sql, params, callback);
    }
    localDb.run(sql, params, function(err) {
      if (callback) callback.call(this, err);
    });
  },

  serialize: (fn) => localDb.serialize(fn)
};

/**
 * Supabase SQL-to-JS Translator
 * Maps common SQL patterns to Supabase client calls
 */
const supabaseAdapter = {
  all: (sql, params, callback) => {
    // SELECT * FROM table (with optional WHERE clauses)
    if (sql.includes('SELECT * FROM')) {
      const match = sql.match(/SELECT \* FROM (\w+)/);
      if (!match) return callback(new Error('Invalid SELECT statement'));

      const table = match[1];
      let query = supabase.from(table).select('*');

      // Parse WHERE conditions from SQL
      if (sql.includes('WHERE')) {
        const wherePart = sql.substring(sql.indexOf('WHERE') + 5);

        // Handle various WHERE patterns
        if (wherePart.includes('id_tournament = ?')) {
          query = query.eq('id_tournament', params[0]);
        }
        if (wherePart.includes('id_category = ?')) {
          const idx = sql.indexOf('id_category = ?');
          query = query.eq('id_category', params[params.length - 1]);
        }
        if (wherePart.includes('id_round = ?')) {
          query = query.eq('id_round', params[0]);
        }
        if (wherePart.includes('status = ?')) {
          query = query.eq('status', params[0]);
        }
        if (wherePart.includes('payment_status IN')) {
          query = query.in('payment_status', params[0]);
        }
      }

      // Handle ORDER BY
      if (sql.includes('ORDER BY')) {
        const orderMatch = sql.match(/ORDER BY (\w+)(?:\s+(ASC|DESC))?/i);
        if (orderMatch) {
          const dir = (orderMatch[2] || 'ASC').toLowerCase() === 'asc';
          query = query.order(orderMatch[1], { ascending: dir });
        }
      }

      query.then(({ data, error }) => {
        callback(error, data || []);
      }).catch(err => callback(err, null));
    } else {
      callback(new Error('Complex SQL not yet supported: ' + sql.substring(0, 50)));
    }
  },

  get: (sql, params, callback) => {
    // SELECT * FROM table WHERE id = ?
    if (sql.includes('SELECT') && sql.includes('WHERE')) {
      const match = sql.match(/SELECT \* FROM (\w+)/);
      if (!match) return callback(new Error('Invalid SELECT statement'));

      const table = match[1];
      let query = supabase.from(table).select('*');

      // Determine which field to filter by
      if (sql.includes('id_round = ?')) {
        query = query.eq('id_round', params[0]);
      } else if (sql.includes('id = ?')) {
        query = query.eq('id', params[0]);
      } else if (sql.includes('id_tournament = ?')) {
        query = query.eq('id_tournament', params[0]);
      } else if (sql.includes('id_category = ?')) {
        query = query.eq('id_category', params[0]);
      } else if (sql.includes('id_player = ?')) {
        query = query.eq('id_player', params[0]);
      } else {
        return callback(new Error('WHERE clause not recognized'));
      }

      query.then(({ data, error }) => {
        if (error) return callback(error, null);
        callback(null, data && data.length > 0 ? data[0] : null);
      }).catch(err => callback(err, null));
    } else {
      callback(new Error('GET query not supported: ' + sql));
    }
  },

  run: (sql, params, callback) => {
    // INSERT INTO table (col1, col2...) VALUES (?, ?, ...)
    if (sql.includes('INSERT INTO')) {
      const match = sql.match(/INSERT INTO (\w+)\s*\((.*?)\)\s*VALUES/i);
      if (!match) return callback(new Error('Invalid INSERT statement'));

      const table = match[1];
      const columns = match[2].split(',').map(c => c.trim());
      const data = {};

      columns.forEach((col, idx) => {
        data[col] = params[idx];
      });

      supabase.from(table).insert([data]).then(({ data: result, error }) => {
        if (error) return callback(error);
        // Simulate SQLite's this.lastID by returning the inserted data
        const mockThis = {
          lastID: result && result[0] ? result[0].id || result[0].id_round || result[0].id_match : null,
          changes: result ? result.length : 0
        };
        callback.call(mockThis, null);
      }).catch(err => callback(err));
    }
    // UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
    else if (sql.includes('UPDATE')) {
      const match = sql.match(/UPDATE (\w+)\s+SET\s+(.*?)\s+WHERE/i);
      if (!match) return callback(new Error('Invalid UPDATE statement'));

      const table = match[1];
      const setClause = match[2];
      const columns = setClause.split(',').map(s => {
        const col = s.trim().split('=')[0].trim();
        return col;
      });

      const data = {};
      columns.forEach((col, idx) => {
        data[col] = params[idx];
      });

      // Get the WHERE clause parameter (usually the last one)
      const whereParam = params[params.length - 1];

      // Determine which field to filter by
      let whereField = 'id';
      if (sql.includes('id_round = ?')) whereField = 'id_round';
      else if (sql.includes('id_tournament = ?')) whereField = 'id_tournament';
      else if (sql.includes('id_category = ?')) whereField = 'id_category';
      else if (sql.includes('id_match = ?')) whereField = 'id_match';
      else if (sql.includes('id_player = ?')) whereField = 'id_player';

      supabase.from(table).update(data).eq(whereField, whereParam).then(({ error }) => {
        if (error) return callback(error);
        callback.call({ changes: 1 }, null);
      }).catch(err => callback(err));
    }
    // DELETE FROM table WHERE id = ?
    else if (sql.includes('DELETE FROM')) {
      const match = sql.match(/DELETE FROM (\w+)/);
      if (!match) return callback(new Error('Invalid DELETE statement'));

      const table = match[1];
      const whereParam = params[0];

      supabase.from(table).delete().eq('id', whereParam).then(({ error }) => {
        if (error) return callback(error);
        callback.call({ changes: 1 }, null);
      }).catch(err => callback(err));
    } else {
      callback(new Error('RUN query type not recognized: ' + sql));
    }
  }
};

/**
 * Helper functions for new schema tables
 */
const dbHelpers = {
  /**
   * Get or create a tournament phase for a category
   */
  getOrCreatePhase: (categoryId, phaseName, deadline, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.get('SELECT id FROM tournament_phases WHERE category_id = ? AND phase_name = ?', [categoryId, phaseName], (err, row) => {
      if (err) {
        return callback(err, null);
      }
      if (row) {
        return callback(null, row.id);
      }
      // Create new phase
      db.run('INSERT INTO tournament_phases (category_id, phase_name, registration_deadline, status) VALUES (?, ?, ?, ?)', [categoryId, phaseName, deadline, 'OPEN'], function(err) {
        if (err) {
          return callback(err, null);
        }
        callback(null, this.lastID);
      });
    });
  },

  /**
   * Close registration for a phase
   */
  closeRegistration: (phaseId, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'UPDATE tournament_phases SET status = ? WHERE id = ?',
      ['CLOSED', phaseId],
      callback
    );
  },

  /**
   * Get all athletes enrolled in a phase
   */
  getPhaseAthletes: (phaseId, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all(
      'SELECT DISTINCT a.* FROM athletes a JOIN phase_registrations pr ON a.id = pr.athlete_id WHERE pr.phase_id = ? ORDER BY a.name',
      [phaseId],
      callback
    );
  },

  /**
   * Log a drawn double pair
   */
  logDrawnDouble: (phaseId, athlete1Id, athlete2Id, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'INSERT INTO drawn_doubles (phase_id, athlete1_id, athlete2_id) VALUES (?, ?, ?)',
      [phaseId, athlete1Id, athlete2Id],
      function(err) {
        if (err) {
          // Unique constraint violation is expected for already-drawn pairs
          if (err.message.includes('UNIQUE')) {
            return callback(null, { alreadyDrawn: true });
          }
          return callback(err);
        }
        callback(null, { id: this.lastID });
      }
    );
  },

  /**
   * Get pending match results (submitted but not yet moderated)
   */
  getPendingResults: (callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all(
      'SELECT * FROM matches WHERE submitted_at IS NOT NULL AND moderator_approved = 0 ORDER BY submitted_at DESC',
      callback
    );
  },

  /**
   * Update the status of a match result
   */
  updateResultStatus: (resultId, status, moderatorId, notes, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'UPDATE matches SET moderator_approved = ?, moderator_notes = ?, result_submitter_id = ? WHERE id_match = ?',
      [status === 'approved' ? 1 : 0, notes, moderatorId, resultId],
      callback
    );
  },

  /**
   * Get ranking for a category
   */
  getRankingByCategory: (categoryId, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all(
      'SELECT * FROM rankings WHERE category_id = ? ORDER BY points DESC, wins DESC',
      [categoryId],
      callback
    );
  },

  /**
   * Update ranking for an athlete in a category
   */
  updateRanking: (categoryId, athleteId, wins, losses, points, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'UPDATE rankings SET wins = ?, losses = ?, points = ? WHERE category_id = ? AND athlete_id = ?',
      [wins, losses, points, categoryId, athleteId],
      function(err) {
        if (err) {
          return callback(err);
        }
        // If no rows were updated, insert a new ranking
        if (this.changes === 0) {
          db.run(
            'INSERT INTO rankings (category_id, athlete_id, wins, losses, points) VALUES (?, ?, ?, ?, ?)',
            [categoryId, athleteId, wins, losses, points],
            callback
          );
        } else {
          callback(null);
        }
      }
    );
  },

  /**
   * Get all categories
   */
  getCategories: (callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all('SELECT * FROM categories ORDER BY name', [], callback);
  },

  /**
   * Get category by ID
   */
  getCategoryById: (categoryId, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.get('SELECT * FROM categories WHERE id = ?', [categoryId], callback);
  },

  /**
   * Create a new category
   */
  createCategory: (name, description, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description],
      function(err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID, name, description });
      }
    );
  },

  /**
   * Get tournament meta (status) for a category
   */
  getTournamentMeta: (categoryId, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.get(
      'SELECT * FROM tournament_meta WHERE category_id = ?',
      [categoryId],
      callback
    );
  },

  /**
   * Update tournament meta for a category
   */
  updateTournamentMeta: (categoryId, data, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    const fields = Object.keys(data);
    const values = Object.values(data);
    values.push(categoryId);

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const sql = `UPDATE tournament_meta SET ${setClause} WHERE category_id = ?`;

    db.run(sql, values, callback);
  },

  /**
   * Create a new round (Ranking SRB)
   */
  createRound: (id_tournament, id_category, round_number, scheduled_date, window_start, window_end, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'INSERT INTO rounds (id_tournament, id_category, round_number, scheduled_date, window_start, window_end, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id_tournament, id_category, round_number, scheduled_date, window_start || '18:00', window_end || '23:00', 'PENDING'],
      function(err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID, round_number });
      }
    );
  },

  /**
   * Get all rounds for a tournament
   */
  getRounds: (id_tournament, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all(
      'SELECT * FROM rounds WHERE id_tournament = ? ORDER BY round_number ASC',
      [id_tournament],
      callback
    );
  },

  /**
   * Get rounds for a specific category
   */
  getRoundsByCategory: (id_tournament, id_category, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all(
      'SELECT * FROM rounds WHERE id_tournament = ? AND id_category = ? ORDER BY round_number ASC',
      [id_tournament, id_category],
      callback
    );
  },

  /**
   * Get a specific round by ID
   */
  getRoundById: (id_round, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.get(
      'SELECT * FROM rounds WHERE id_round = ?',
      [id_round],
      callback
    );
  },

  /**
   * Update round status (PENDING, IN_PROGRESS, FINISHED)
   */
  updateRoundStatus: (id_round, status, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.run(
      'UPDATE rounds SET status = ? WHERE id_round = ?',
      [status, id_round],
      callback
    );
  },

  /**
   * Get doubles for a specific round
   */
  getDoublesByRound: (id_round, callback) => {
    const db = USE_SUPABASE ? dbAdapter : localDb;
    db.all(
      'SELECT d.*, p1.name as player1_name, p2.name as player2_name FROM doubles d LEFT JOIN players p1 ON d.id_player1 = p1.id_player LEFT JOIN players p2 ON d.id_player2 = p2.id_player WHERE d.id_round = ? ORDER BY d.id_double',
      [id_round],
      callback
    );
  }
};

// Attach helpers to the main db export
const mainDb = USE_SUPABASE ? dbAdapter : localDb;
Object.assign(mainDb, dbHelpers);

module.exports = mainDb;
module.exports.helpers = dbHelpers;
