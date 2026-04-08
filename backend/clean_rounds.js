const db = require('./database');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function clean() {
  try {
    console.log('🗑️  Deletando rodadas antigas...');
    await run('DELETE FROM rounds WHERE id_tournament = 1');
    console.log('✅ Rodadas deletadas\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

clean();
