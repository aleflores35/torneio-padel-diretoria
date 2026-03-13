const db = require('./database');

const seed = async () => {
  console.log("Iniciando Seed...");
  
  // 1. Criar Torneio
  db.run(`INSERT INTO torneios (id_torneio, nome, data_inicio, data_fim) VALUES (1, 'Torneio Diretoria Padel', '2026-04-10', '2026-04-10')`, (err) => {
    if (err) console.log("Torneio já existe ou erro:", err.message);

    // 2. Criar Quadras
    const quadras = ['Central', 'Quadra 1', 'Quadra 2', 'Quadra 3'];
    db.serialize(() => {
        const stmtQ = db.prepare(`INSERT INTO quadras (id_torneio, nome, ordem) VALUES (?, ?, ?)`);
        quadras.forEach((nome, i) => stmtQ.run([1, nome, i + 1]));
        stmtQ.finalize();

        // 3. Atletas (30 D, 30 E, 4 I)
        const stmtA = db.prepare(`INSERT INTO atletas (id_torneio, nome, whatsapp, lado, pagamento_status, tem_almoco) VALUES (?, ?, ?, ?, ?, ?)`);
        for (let i = 1; i <= 30; i++) stmtA.run([1, `Direita ${i}`, `5199990${i}`, 'DIREITA', 'PAGO', 1]);
        for (let i = 1; i <= 30; i++) stmtA.run([1, `Esquerda ${i}`, `5188880${i}`, 'ESQUERDA', 'PAGO', 1]);
        for (let i = 1; i <= 4; i++) stmtA.run([1, `Indiferente ${i}`, `5177770${i}`, 'INDIFERENTE', 'PENDENTE', 0]);
        stmtA.finalize(() => {
            console.log("Seed Concluído!");
            process.exit(0);
        });
    });
  });
};

// Esperar um pouco para as tabelas serem criadas pelo database.js
setTimeout(seed, 1000);
