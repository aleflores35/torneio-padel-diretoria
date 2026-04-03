const db = require('../database');

const sortearDuplas = (id_tournament) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM players WHERE id_tournament = ?', [id_tournament], (err, players) => {
      if (err) return reject(err);

      // Separar por lado
      const rights = players.filter(p => p.side === 'RIGHT').sort(() => Math.random() - 0.5);
      const lefts = players.filter(p => p.side === 'LEFT').sort(() => Math.random() - 0.5);
      const eithers = players.filter(p => p.side === 'EITHER').sort(() => Math.random() - 0.5);

      const doubles = [];
      
      // 1. Tentar casar RIGHT x LEFT
      while (rights.length > 0 && lefts.length > 0) {
        doubles.push([rights.pop(), lefts.pop()]);
      }

      // 2. Usar EITHER para completar lacunas
      const remainingNeedPartner = [...rights, ...lefts];
      while (eithers.length > 0) {
        if (remainingNeedPartner.length > 0) {
          doubles.push([remainingNeedPartner.pop(), eithers.pop()]);
        } else if (eithers.length >= 2) {
          doubles.push([eithers.pop(), eithers.pop()]);
        } else {
          break; // Sobrou um EITHER sozinho
        }
      }

      // Se ainda sobrarem jogadores (casos ímpares ou falta de combinatória)
      // O sistema pode deixar para um sorteio manual ou ignorar por enquanto
      
      // Salvar no banco
      db.serialize(() => {
        db.run('DELETE FROM doubles WHERE id_tournament = ?', [id_tournament]);
        const stmt = db.prepare('INSERT INTO doubles (id_tournament, id_player1, id_player2, display_name) VALUES (?, ?, ?, ?)');
        doubles.forEach(pair => {
          stmt.run([id_tournament, pair[0].id_player, pair[1].id_player, `${pair[0].name} (D) / ${pair[1].name} (E)`]);
        });
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve({ status: 'success', created: doubles.length });
        });
      });
    });
  });
};

module.exports = { sortearDuplas };
