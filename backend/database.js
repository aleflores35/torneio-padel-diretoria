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
 * Database Adapter
 * Harmonizes SQLite and Supabase calls
 */
const dbAdapter = {
  all: (sql, params, callback) => {
    if (USE_SUPABASE) {
      // Very simple translation for this specific app's needs
      // Note: Full SQL to Supabase JS translation is complex,
      // but we can map the most common ones used in server.js
      console.log('[DB] Supabase call:', sql);
      
      // Example mapping for tournaments
      if (sql.includes('SELECT * FROM tournaments')) {
        supabase.from('tournaments').select('*').then(({ data, error }) => {
          callback(error, data);
        });
      } else if (sql.includes('SELECT * FROM players')) {
          let query = supabase.from('players').select('*');
          if (params.length > 0) query = query.eq('id_tournament', params[0]);
          query.order('name', { ascending: true }).then(({ data, error }) => {
            callback(error, data);
          });
      } else {
        // Fallback or error if SQL not yet mapped
        callback(new Error('SQL mapping for Supabase not implemented for: ' + sql));
      }
    } else {
      localDb.all(sql, params, callback);
    }
  },

  get: (sql, params, callback) => {
    if (USE_SUPABASE) {
      // Mapping for specific queries
      callback(new Error('Supabase get mapping not yet fully implemented'));
    } else {
      localDb.get(sql, params, callback);
    }
  },

  run: (sql, params, callback) => {
    if (USE_SUPABASE) {
      // Mapping for INSERT/UPDATE
      callback(new Error('Supabase run mapping not yet fully implemented'));
    } else {
      localDb.run(sql, params, function(err) {
        if (callback) callback.call(this, err);
      });
    }
  },

  serialize: (fn) => localDb.serialize(fn) // Keep for local init
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
  }
};

module.exports = USE_SUPABASE ? dbAdapter : localDb;
module.exports.helpers = dbHelpers;
