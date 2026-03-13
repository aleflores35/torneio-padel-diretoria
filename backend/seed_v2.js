const db = require('./database');

const seed = async () => {
  console.log("Iniciando Seed V2 (Versão Brasileira - Robusta)...");
  
  db.serialize(() => {
    // 0. Limpar dados antigos
    db.run("DELETE FROM notifications");
    db.run("DELETE FROM matches");
    db.run("DELETE FROM groups_doubles");
    db.run("DELETE FROM groups");
    db.run("DELETE FROM doubles");
    db.run("DELETE FROM players");
    db.run("DELETE FROM courts");
    db.run("DELETE FROM tournaments");

    // 1. Criar Torneio
    db.run(`INSERT INTO tournaments (id_tournament, name, start_date, end_date, location, entry_fee) 
           VALUES (1, 'Torneio Diretoria Padel', '2026-04-10', '2026-04-10', 'Premium Padel Club', 85.00)`);

    // 2. Criar Quadras
    const courts = ['Quadra Central', 'Quadra 1', 'Quadra 2', 'Quadra 3'];
    const stmtC = db.prepare(`INSERT INTO courts (id_tournament, name, order_index) VALUES (?, ?, ?)`);
    courts.forEach((name, i) => stmtC.run([1, name, i + 1]));
    stmtC.finalize();

    // 3. Criar 64 Atletas (nomes BR)
    const stmtP = db.prepare(`INSERT INTO players (id_tournament, name, whatsapp, side, payment_status, has_lunch) VALUES (?, ?, ?, ?, ?, ?)`);
    for (let i = 1; i <= 30; i++) stmtP.run([1, `Jogador Direita ${i}`, `5199990${i}`, 'RIGHT', 'PAID', 1]);
    for (let i = 1; i <= 30; i++) stmtP.run([1, `Jogador Esquerda ${i}`, `5188880${i}`, 'LEFT', 'PAID', 1]);
    for (let i = 1; i <= 4; i++) stmtP.run([1, `Jogador Indiferente ${i}`, `5177770${i}`, 'EITHER', 'PENDING', 0]);
    stmtP.finalize(() => {
        console.log("Seed V2 (PT-BR) Concluído com Sucesso!");
        process.exit(0);
    });
  });
};

setTimeout(seed, 1000);
