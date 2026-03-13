const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'padel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. TOURNAMENTS
  db.run(`CREATE TABLE IF NOT EXISTS tournaments (
    id_tournament INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT, -- tournament day
    end_date TEXT,   -- same as start_date, 1-day event
    location TEXT,
    entry_fee REAL,
    rules_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. COURTS
  db.run(`CREATE TABLE IF NOT EXISTS courts (
    id_court INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tournament INTEGER,
    name TEXT NOT NULL, -- e.g. "Court 1", "Central Court"
    order_index INTEGER, -- for UI ordering
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tournament) REFERENCES tournaments (id_tournament)
  )`);

  // 3. PLAYERS
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id_player INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tournament INTEGER,
    name TEXT NOT NULL,
    whatsapp TEXT,
    side TEXT CHECK(side IN ('RIGHT', 'LEFT', 'EITHER')), -- player's preferred side
    payment_status TEXT DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'PAID')),
    has_lunch BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tournament) REFERENCES tournaments (id_tournament)
  )`);

  // 4. DOUBLES
  db.run(`CREATE TABLE IF NOT EXISTS doubles (
    id_double INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tournament INTEGER,
    id_player1 INTEGER,
    id_player2 INTEGER,
    display_name TEXT, -- e.g. "Player A / Player B"
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tournament) REFERENCES tournaments (id_tournament),
    FOREIGN KEY (id_player1) REFERENCES players (id_player),
    FOREIGN KEY (id_player2) REFERENCES players (id_player)
  )`);

  // 5. GROUPS (POOLS)
  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id_group INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tournament INTEGER,
    name TEXT NOT NULL, -- e.g. 'A', 'B', 'C', ...
    order_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tournament) REFERENCES tournaments (id_tournament)
  )`);

  // 6. GROUPS_DOUBLES (many-to-many)
  db.run(`CREATE TABLE IF NOT EXISTS groups_doubles (
    id_group INTEGER,
    id_double INTEGER,
    PRIMARY KEY (id_group, id_double),
    FOREIGN KEY (id_group) REFERENCES groups (id_group),
    FOREIGN KEY (id_double) REFERENCES doubles (id_double)
  )`);

  // 7. MATCHES
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id_match INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tournament INTEGER,
    id_group INTEGER, -- nullable for knockout matches
    stage TEXT CHECK(stage IN ('GROUP', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL')),
    id_double_a INTEGER,
    id_double_b INTEGER,
    id_court INTEGER, -- nullable
    scheduled_at DATETIME, -- same tournament day
    planned_duration_min INTEGER DEFAULT 40, -- used for rest-time calculations
    games_double_a INTEGER DEFAULT 0,
    games_double_b INTEGER DEFAULT 0,
    status TEXT DEFAULT 'TO_PLAY' CHECK(status IN ('TO_PLAY', 'CALLING', 'IN_PROGRESS', 'FINISHED')),
    group_order INTEGER, -- position within its group schedule
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tournament) REFERENCES tournaments (id_tournament),
    FOREIGN KEY (id_group) REFERENCES groups (id_group),
    FOREIGN KEY (id_double_a) REFERENCES doubles (id_double),
    FOREIGN KEY (id_double_b) REFERENCES doubles (id_double),
    FOREIGN KEY (id_court) REFERENCES courts (id_court)
  )`);

  // 8. NOTIFICATIONS
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id_notification INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tournament INTEGER,
    id_match INTEGER, -- nullable for general announcements
    id_player INTEGER, -- nullable for broadcast
    type TEXT CHECK(type IN ('CALL_MATCH', 'REMIND_MATCH', 'MATCH_RESULT', 'GENERAL_ANNOUNCEMENT')),
    channel TEXT DEFAULT 'WHATSAPP',
    payload TEXT, -- JSON - template data like player name, court, time
    send_status TEXT DEFAULT 'PENDING' CHECK(send_status IN ('PENDING', 'SENT', 'ERROR')),
    error_message TEXT, -- nullable
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tournament) REFERENCES tournaments (id_tournament),
    FOREIGN KEY (id_match) REFERENCES matches (id_match),
    FOREIGN KEY (id_player) REFERENCES players (id_player)
  )`);
});

module.exports = db;
