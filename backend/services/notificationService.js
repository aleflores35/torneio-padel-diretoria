const db = require('../database');
const axios = require('axios');
require('dotenv').config();

/**
 * Serviço responsável por gerenciar notificações via Evolution API
 */
const sendNotification = async (matchId, type) => {
  const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } = process.env;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    console.warn('[NOTIFICATION] Evolution API não configurada no .env. Ignorando envio real.');
  }

  return new Promise((resolve, reject) => {
    const query = `
      SELECT m.*, 
             c.name as court_name,
             p1.name as p1_name, p1.whatsapp as p1_phone,
             p2.name as p2_name, p2.whatsapp as p2_phone,
             p3.name as p3_name, p3.whatsapp as p3_phone,
             p4.name as p4_name, p4.whatsapp as p4_phone
      FROM matches m
      LEFT JOIN courts c ON m.id_court = c.id_court
      LEFT JOIN doubles d1 ON m.id_double_a = d1.id_double
      LEFT JOIN doubles d2 ON m.id_double_b = d2.id_double
      LEFT JOIN players p1 ON d1.id_player1 = p1.id_player
      LEFT JOIN players p2 ON d1.id_player2 = p2.id_player
      LEFT JOIN players p3 ON d2.id_player1 = p3.id_player
      LEFT JOIN players p4 ON d2.id_player2 = p4.id_player
      WHERE m.id_match = ?
    `;

    db.get(query, [matchId], async (err, match) => {
      if (err) return reject(err);
      if (!match) return reject(new Error('Match not found'));

      const players = [
        { name: match.p1_name, phone: match.p1_phone },
        { name: match.p2_name, phone: match.p2_phone },
        { name: match.p3_name, phone: match.p3_phone },
        { name: match.p4_name, phone: match.p4_phone }
      ].filter(p => p.phone);

      const sentLogs = [];

      for (const player of players) {
        let msg = '';
        if (type === 'CALL_MATCH') {
          msg = `🎾 *CHAMADA DE JOGO* 🎾\n\nOlá ${player.name}!\n\nSeu jogo está prestes a começar na *${match.court_name}*.\nFavor se apresentar ao organizador.\n\nBom jogo!`;
        }

        // Limpeza básica do número para padrão Evolution (apenas números)
        const cleanNumber = player.phone.replace(/\D/g, '');
        // Se não tiver DDI, assume Brasil
        const finalNumber = cleanNumber.length <= 11 ? `55${cleanNumber}` : cleanNumber;

        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          try {
            await axios.post(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
              number: finalNumber,
              text: msg,
              delay: 500,
              linkPreview: false
            }, {
              headers: { 'apikey': EVOLUTION_API_KEY }
            });
            console.log(`[EVOLUTION] Mensagem enviada para ${player.name} (${finalNumber})`);
          } catch (apiErr) {
            console.error(`[EVOLUTION ERROR] Falha ao enviar para ${finalNumber}:`, apiErr.response?.data || apiErr.message);
          }
        } else {
          console.log(`[SIMULATOR] ${player.name}: ${msg.split('\n')[0]}`);
        }

        sentLogs.push({
          id_tournament: match.id_tournament,
          id_match: match.id_match,
          player_name: player.name,
          phone: finalNumber,
          message: msg,
          type: type
        });
      }

      // Registrar histórico no banco
      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT INTO notifications (id_tournament, id_match, type, payload, send_status)
          VALUES (?, ?, ?, ?, ?)
        `);

        sentLogs.forEach(m => {
          stmt.run([m.id_tournament, m.id_match, m.type, JSON.stringify(m), 'SENT']);
        });

        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve({ sent: sentLogs.length });
        });
      });
    });
  });
};

module.exports = { sendNotification };
