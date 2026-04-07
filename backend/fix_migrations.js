const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'padel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Fixing migrations...\n');

  // Add category_id to players table (correct table name)
  db.all(`PRAGMA table_info(players)`, (err, columns) => {
    if (err) {
      console.error('Error checking players table:', err);
      return;
    }

    const hasCategory = columns.some(col => col.name === 'category_id');
    if (!hasCategory) {
      db.run(`ALTER TABLE players ADD COLUMN category_id INTEGER REFERENCES categories(id)`, (err) => {
        if (err) console.error('Error adding category_id to players:', err);
        else console.log('✓ Added category_id column to players table');
      });
    } else {
      console.log('✓ category_id column already exists in players table');
    }

    // Close after a small delay
    setTimeout(() => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('\n✓ Migration fix completed!');
        process.exit(0);
      });
    }, 500);
  });
});
