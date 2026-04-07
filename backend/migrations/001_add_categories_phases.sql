-- Migration: Add categories, tournament_phases, drawn_doubles, and moderation columns
-- SQLite compatible version

-- Step 1: Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create tournament_phases table
CREATE TABLE IF NOT EXISTS tournament_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  phase_name TEXT,
  status TEXT DEFAULT 'REGISTRATION',
  registration_deadline DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Step 3: Add category_id to athletes table if not exists
-- SQLite doesn't support conditional ALTER TABLE, so we'll check in the script

-- Step 4: Create drawn_doubles table
CREATE TABLE IF NOT EXISTS drawn_doubles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phase_id INTEGER NOT NULL,
  athlete1_id INTEGER NOT NULL,
  athlete2_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phase_id, athlete1_id, athlete2_id),
  FOREIGN KEY (phase_id) REFERENCES tournament_phases(id),
  FOREIGN KEY (athlete1_id) REFERENCES athletes(id),
  FOREIGN KEY (athlete2_id) REFERENCES athletes(id)
);

-- Step 5: Add moderation columns to matches table if not exists
-- moderator_approved, moderator_notes, submitted_at, result_submitter_id
