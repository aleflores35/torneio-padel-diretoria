const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'padel.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables in database:');
    tables.forEach(t => console.log(`  - ${t.name}`));
  }

  // Check if players table has category_id
  db.all(`PRAGMA table_info(players)`, (err, columns) => {
    if (err) {
      console.error('Error checking players table:', err);
    } else {
      console.log('\nColumns in players table:');
      columns.forEach(c => console.log(`  - ${c.name} (${c.type})`));
    }

    db.close();
  });
});
