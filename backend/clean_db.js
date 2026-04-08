const db = require('./database');

const cleanup = () => {
  db.serialize(() => {
    db.run('DELETE FROM players');
    db.run('DELETE FROM doubles');
    db.run('DELETE FROM rounds');
    db.run('DELETE FROM categories');

    db.all('SELECT COUNT(*) as count FROM players', (err, rows) => {
      if (err) console.error(err);
      else console.log('Players remaining:', rows[0].count);
      process.exit(0);
    });
  });
};

cleanup();
