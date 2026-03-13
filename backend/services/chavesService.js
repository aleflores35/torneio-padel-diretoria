const db = require('../database');

const gerarChaves = (id_tournament) => {
  return new Promise((resolve, reject) => {
    // Buscar todas as duplas
    db.all('SELECT * FROM doubles WHERE id_tournament = ?', [id_tournament], (err, doubles) => {
      if (err) return reject(err);
      
      if (doubles.length < 2) return reject(new Error('Necessário pelo menos 2 duplas'));

      // 32 duplas / 4 = 8 grupos. Se tiver menos, divide proporcionalmente.
      const numGroups = Math.max(1, Math.ceil(doubles.length / 4));
      const groups = [];
      for (let i = 0; i < numGroups; i++) {
        groups.push({ name: String.fromCharCode(65 + i), order: i + 1 });
      }

      db.serialize(() => {
        // Limpar dados anteriores
        db.run('DELETE FROM matches WHERE id_tournament = ? AND stage = "GROUP"', [id_tournament]);
        db.run('DELETE FROM groups_doubles WHERE id_group IN (SELECT id_group FROM groups WHERE id_tournament = ?)', [id_tournament]);
        db.run('DELETE FROM groups WHERE id_tournament = ?', [id_tournament]);

        // 1. Inserir Groups
        const groupsCreated = [];
        const stmtG = db.prepare('INSERT INTO groups (id_tournament, name, order_index) VALUES (?, ?, ?)');
        groups.forEach(g => {
          stmtG.run([id_tournament, g.name, g.order], function(err) {
            if (!err) groupsCreated.push({ id_group: this.lastID, name: g.name });
          });
        });
        
        stmtG.finalize(() => {
          if (groupsCreated.length === 0) return reject(new Error('Falha ao criar grupos'));

          // 2. Distribuir Duplas nos Grupos
          const stmtGD = db.prepare('INSERT INTO groups_doubles (id_group, id_double) VALUES (?, ?)');
          const stmtM = db.prepare(`INSERT INTO matches (id_tournament, id_group, stage, id_double_a, id_double_b, status) 
                                   VALUES (?, ?, 'GROUP', ?, ?, 'TO_PLAY')`);
          
          const doublesPerGroup = {}; // { groupID: [doubles] }
          
          doubles.forEach((d, i) => {
             const g = groupsCreated[i % groupsCreated.length];
             stmtGD.run([g.id_group, d.id_double]);
             if (!doublesPerGroup[g.id_group]) doublesPerGroup[g.id_group] = [];
             doublesPerGroup[g.id_group].push(d);
          });

          stmtGD.finalize(() => {
            // 3. Gerar Jogos do Grupo (Round Robin)
            Object.keys(doublesPerGroup).forEach(groupId => {
              const groupDoubles = doublesPerGroup[groupId];
              for (let i = 0; i < groupDoubles.length; i++) {
                for (let j = i + 1; j < groupDoubles.length; j++) {
                  stmtM.run([id_tournament, groupId, groupDoubles[i].id_double, groupDoubles[j].id_double]);
                }
              }
            });

            stmtM.finalize((err) => {
              if (err) reject(err);
              else resolve({ status: 'success', groups: groupsCreated.length });
            });
          });
        });
      });
    });
  });
};

module.exports = { gerarChaves };
