// backend/services/resultService.js
const db = require('../database');

const resultService = {
  // Atleta submete resultado de um match
  submitResult: (matchId, athleteId, scoreTeam1, scoreTeam2, callback) => {
    // Validar que scores são números
    if (typeof scoreTeam1 !== 'number' || typeof scoreTeam2 !== 'number') {
      return callback(new Error('Scores must be numbers'));
    }

    // Criar resultado pendente de moderação
    db.createPendingResult(matchId, athleteId, scoreTeam1, scoreTeam2, callback);
  },

  // Admin obtém resultados pendentes de moderação
  getPendingResults: (callback) => {
    db.getPendingResults(callback);
  },

  // Admin aprova resultado
  approveResult: (resultId, moderatorId, callback) => {
    db.get(
      'SELECT * FROM results_pending WHERE id = ?',
      [resultId],
      (err, result) => {
        if (err) return callback(err);
        if (!result) return callback(new Error('Result not found'));

        // Atualizar status do match
        db.run(
          'UPDATE matches SET status = ?, confirmed_score1 = ?, confirmed_score2 = ? WHERE id_match = ?',
          ['FINISHED', result.score_team1, result.score_team2, result.match_id],
          (err) => {
            if (err) return callback(err);

            // Marcar como aprovado
            db.updateResultStatus(resultId, 'APPROVED', moderatorId, null, (err2) => {
              callback(err2, result);
            });
          }
        );
      }
    );
  },

  // Admin rejeita resultado
  rejectResult: (resultId, moderatorId, notes, callback) => {
    db.updateResultStatus(resultId, 'REJECTED', moderatorId, notes, callback);
  }
};

module.exports = resultService;
