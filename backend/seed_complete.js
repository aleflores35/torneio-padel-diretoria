// seed_complete.js - SEED simples para Ranking SRB
const db = require('./database');

const TOURNAMENT_ID = 1;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seedComplete() {
  try {
    console.log('🌱 Iniciando SEED...\n');

    // 1. LIMPAR
    console.log('🗑️ Limpando dados antigos...');
    try {
      await run('DELETE FROM matches WHERE id_tournament = ?', [TOURNAMENT_ID]);
      await run('DELETE FROM doubles WHERE id_tournament = ?', [TOURNAMENT_ID]);
      await run('DELETE FROM rounds WHERE id_tournament = ?', [TOURNAMENT_ID]);
      await run('DELETE FROM courts WHERE id_tournament = ?', [TOURNAMENT_ID]);
      await run('DELETE FROM players WHERE id_tournament = ?', [TOURNAMENT_ID]);
      await run('DELETE FROM tournaments WHERE id_tournament = ?', [TOURNAMENT_ID]);
    } catch (e) {}
    console.log('✅ Banco limpo\n');

    // 2. CRIAR TORNEIO
    console.log('📅 Criando Torneio...');
    await run(
      `INSERT INTO tournaments (id_tournament, name, start_date, end_date, location) VALUES (?, ?, ?, ?, ?)`,
      [TOURNAMENT_ID, 'Ranking Padel SRB 2026', '2026-04-10', '2026-12-31', 'Rio Branco']
    );
    console.log('✅ Torneio criado\n');

    // 3. CRIAR QUADRA
    console.log('🏐 Criando Quadra...');
    await run(
      `INSERT INTO courts (id_tournament, name, order_index) VALUES (?, ?, ?)`,
      [TOURNAMENT_ID, 'Quadra Principal', 1]
    );
    console.log('✅ Quadra criada\n');

    // 4. CATEGORIAS
    const categories = [
      { id: 1, name: 'Masculino Iniciante', count: 10 },
      { id: 2, name: 'Masculino 4ª', count: 8 },
      { id: 3, name: 'Feminino Iniciante', count: 12 },
      { id: 4, name: 'Feminino 6ª', count: 6 },
      { id: 5, name: 'Feminino 4ª', count: 10 }
    ];

    console.log('📂 Criando Categorias...');
    for (const cat of categories) {
      try {
        await run(
          `INSERT INTO categories (id, name, description, active) VALUES (?, ?, ?, 1)`,
          [cat.id, cat.name, `Categoria ${cat.name}`]
        );
      } catch (e) {}
      console.log(`   ✅ ${cat.name}`);
    }
    console.log();

    // 5. CRIAR ATLETAS
    console.log('👥 Criando Atletas...');
    const firstNames = ['João', 'Lucas', 'Rafael', 'Marcelo', 'Fernando', 'Bruno', 'Diego', 'André', 'Carlos', 'Roberto', 'Rodrigo', 'Gustavo', 'Felipe', 'Matheus', 'Leonardo', 'Pedro', 'Maria', 'Ana', 'Paula', 'Carla'];
    const lastNames = ['Silva', 'Santos', 'Costa', 'Oliveira', 'Alves', 'Pereira', 'Rocha', 'Martins'];
    const sides = ['RIGHT', 'LEFT', 'EITHER'];
    let totalPlayers = 0;

    for (const cat of categories) {
      for (let i = 1; i <= cat.count; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const side = sides[Math.floor(Math.random() * sides.length)];
        const whatsapp = `(51) 99999-${String(totalPlayers + 1).padStart(4, '0')}`;

        await run(
          `INSERT INTO players (id_tournament, name, whatsapp, side, category_id, payment_status) VALUES (?, ?, ?, ?, ?, 'PAID')`,
          [TOURNAMENT_ID, `${firstName} ${lastName}`, whatsapp, side, cat.id]
        );
        totalPlayers++;
      }
      console.log(`   ✅ ${cat.name}: ${cat.count} atletas`);
    }
    console.log(`\n✨ Total: ${totalPlayers} atletas criados\n`);

    // 6. GERAR RODADAS SIMPLES (N-1 rodadas para N atletas)
    console.log('🎯 Gerando Rodadas...');
    let thursday = new Date('2026-04-16');

    for (const cat of categories) {
      // Para cada categoria, gera N-1 rodadas (N = cat.count atletas)
      const numRounds = cat.count - 1;

      for (let roundNum = 1; roundNum <= numRounds; roundNum++) {
        const roundDate = new Date(thursday);
        roundDate.setDate(roundDate.getDate() + (7 * (roundNum - 1))); // +7 dias por rodada

        await run(
          `INSERT INTO rounds (id_tournament, id_category, round_number, scheduled_date, window_start, window_end, status)
           VALUES (?, ?, ?, ?, '18:00', '23:00', 'PENDING')`,
          [TOURNAMENT_ID, cat.id, roundNum, roundDate.toISOString().split('T')[0]]
        );
      }
    }
    console.log('✅ Rodadas criadas (começando 16/04/2026)\n');

    console.log('='.repeat(70));
    console.log('✨ SEED COMPLETO!');
    console.log('='.repeat(70));
    console.log(`📊 ${totalPlayers} atletas em 5 categorias`);
    console.log(`📅 Rodadas agendadas em quintas-feiras`);
    console.log(`\n🚀 Próximo passo: npm start (inicie o backend)`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

seedComplete();
