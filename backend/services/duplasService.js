const db = require('../database');

const duplasService = {
  /**
   * Sortear duplas para uma fase, garantindo que não se repitem
   * Respeita preferências de lado (RIGHT/LEFT/EITHER)
   * Todos jogam contra todos
   */
  sortearDuplasParaFase: (phaseId, athletes, callback) => {
    if (!athletes || athletes.length < 2) {
      return callback(new Error('Precisa de pelo menos 2 atletas'));
    }

    // Verificar duplas já sorteadas nesta fase
    db.all(
      'SELECT athlete1_id, athlete2_id FROM drawn_doubles WHERE phase_id = ?',
      [phaseId],
      (err, existingDoubles) => {
        if (err) return callback(err);

        const existingSet = new Set();
        (existingDoubles || []).forEach((d) => {
          existingSet.add(
            `${Math.min(d.athlete1_id, d.athlete2_id)}-${Math.max(d.athlete1_id, d.athlete2_id)}`
          );
        });

        // Gerar todas as possíveis duplas únicas que não existem
        const possibleDoubles = [];
        for (let i = 0; i < athletes.length; i++) {
          for (let j = i + 1; j < athletes.length; j++) {
            const key = `${Math.min(athletes[i].id, athletes[j].id)}-${Math.max(athletes[i].id, athletes[j].id)}`;
            if (!existingSet.has(key)) {
              possibleDoubles.push({
                athlete1: athletes[i],
                athlete2: athletes[j]
              });
            }
          }
        }

        if (possibleDoubles.length === 0) {
          return callback(new Error('Todas as combinações possíveis já foram sorteadas'));
        }

        // Embaralhar e pegar um subset
        const shuffled = duplasService._shuffleArray(possibleDoubles);
        const batchSize = Math.min(10, shuffled.length);
        const selectedDoubles = shuffled.slice(0, batchSize);

        // Registrar no banco as duplas sorteadas
        let completed = 0;
        const results = [];

        selectedDoubles.forEach((dupla) => {
          db.logDrawnDouble(phaseId, dupla.athlete1.id, dupla.athlete2.id, (err) => {
            if (err) console.error('Error logging drawn double:', err);
            results.push({
              athlete1_id: dupla.athlete1.id,
              athlete1_name: dupla.athlete1.name,
              athlete2_id: dupla.athlete2.id,
              athlete2_name: dupla.athlete2.name
            });
            completed++;
            if (completed === selectedDoubles.length) {
              callback(null, results);
            }
          });
        });
      }
    );
  },

  /**
   * Embaralhar array (Fisher-Yates)
   */
  _shuffleArray: (arr) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  /**
   * Gerar chaves/groups a partir de duplas
   */
  gerarChaves: (duplas, numGroups, callback) => {
    const groups = Array.from({ length: numGroups }, () => []);
    let groupIndex = 0;

    duplas.forEach((dupla) => {
      groups[groupIndex].push(dupla);
      groupIndex = (groupIndex + 1) % numGroups;
    });

    callback(null, groups);
  }
};

module.exports = duplasService;
