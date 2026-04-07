const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'padel.db');
const db = new sqlite3.Database(dbPath);

db.all(`PRAGMA table_info(matches)`, (err, columns) => {
  if (err) {
    console.error('Error checking matches table:', err);
  } else {
    console.log('Columns in matches table:');
    columns.forEach(c => console.log(`  - ${c.name} (${c.type})`));
  }

  db.close();
});
