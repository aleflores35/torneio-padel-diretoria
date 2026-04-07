const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'padel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Applying migrations...\n');

  // Step 1: Create categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating categories table:', err);
    else console.log('✓ Created/verified categories table');
  });

  // Step 2: Create tournament_phases table
  db.run(`CREATE TABLE IF NOT EXISTS tournament_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    phase_name TEXT,
    status TEXT DEFAULT 'REGISTRATION',
    registration_deadline DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`, (err) => {
    if (err) console.error('Error creating tournament_phases table:', err);
    else console.log('✓ Created/verified tournament_phases table');
  });

  // Step 3: Add category_id to athletes table (if not exists)
  db.run(`PRAGMA table_info(athletes)`, (err, rows) => {
    if (err) {
      console.error('Error checking athletes table:', err);
      return;
    }

    // Check if category_id column exists
    db.all(`PRAGMA table_info(athletes)`, (err, columns) => {
      const hasCategory = columns.some(col => col.name === 'category_id');
      if (!hasCategory) {
        db.run(`ALTER TABLE athletes ADD COLUMN category_id INTEGER REFERENCES categories(id)`, (err) => {
          if (err) console.error('Error adding category_id to athletes:', err);
          else console.log('✓ Added category_id column to athletes table');
        });
      } else {
        console.log('✓ category_id column already exists in athletes table');
      }
    });
  });

  // Step 4: Create drawn_doubles table
  db.run(`CREATE TABLE IF NOT EXISTS drawn_doubles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_id INTEGER NOT NULL,
    athlete1_id INTEGER NOT NULL,
    athlete2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phase_id, athlete1_id, athlete2_id),
    FOREIGN KEY (phase_id) REFERENCES tournament_phases(id),
    FOREIGN KEY (athlete1_id) REFERENCES athletes(id),
    FOREIGN KEY (athlete2_id) REFERENCES athletes(id)
  )`, (err) => {
    if (err) console.error('Error creating drawn_doubles table:', err);
    else console.log('✓ Created/verified drawn_doubles table');
  });

  // Step 5: Add moderation columns to matches table (if not exist)
  db.all(`PRAGMA table_info(matches)`, (err, columns) => {
    if (err) {
      console.error('Error checking matches table:', err);
      return;
    }

    const columnsToAdd = [
      { name: 'moderator_approved', sql: `ALTER TABLE matches ADD COLUMN moderator_approved INTEGER DEFAULT 0` },
      { name: 'moderator_notes', sql: `ALTER TABLE matches ADD COLUMN moderator_notes TEXT` },
      { name: 'submitted_at', sql: `ALTER TABLE matches ADD COLUMN submitted_at DATETIME` },
      { name: 'result_submitter_id', sql: `ALTER TABLE matches ADD COLUMN result_submitter_id INTEGER` }
    ];

    columnsToAdd.forEach(col => {
      const exists = columns.some(c => c.name === col.name);
      if (!exists) {
        db.run(col.sql, (err) => {
          if (err) console.error(`Error adding ${col.name}:`, err);
          else console.log(`✓ Added ${col.name} column to matches table`);
        });
      } else {
        console.log(`✓ ${col.name} column already exists in matches table`);
      }
    });
  });

  // Close connection after a delay to ensure all operations complete
  setTimeout(() => {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('\n✓ Migrations completed successfully!');
      process.exit(0);
    });
  }, 2000);
});
