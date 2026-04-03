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

module.exports = USE_SUPABASE ? dbAdapter : localDb;
