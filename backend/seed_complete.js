// seed_complete.js
// Script COMPLETO para popular DB com torneio, atletas, rodadas e matches agendados
// Execute: node seed_complete.js

const db = require('./database');

const TOURNAMENT_ID = 1;
const FIRST_THURSDAY = new Date('2026-04-16'); // Primeira quinta-feira

// Diferentes quantidades de atletas por categoria
const categories = [
  { id: 1, name: 'Masculino Iniciante', count: 10 },
  { id: 2, name: 'Masculino 4ª', count: 8 },
  { id: 3, name: 'Feminino Iniciante', count: 12 },
  { id: 4, name: 'Feminino 6ª', count: 6 },
  { id: 5, name: 'Feminino 4ª', count: 10 }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Gera nomes fake por categoria
function generatePlayersForCategory(categoryName, count) {
  const firstNames = [
    'João', 'Lucas', 'Rafael', 'Marcelo', 'Fernando', 'Bruno', 'Diego', 'André', 'Carlos', 'Roberto',
    'Rodrigo', 'Gustavo', 'Felipe', 'Matheus', 'Leonardo', 'Pedro', 'Tiago', 'Víctor',
    'Maria', 'Ana', 'Paula', 'Carla', 'Juliana', 'Beatriz', 'Fernanda', 'Leticia', 'Gabriela', 'Isabella',
    'Mariana', 'Camila', 'Luísa', 'Bruna', 'Nicole', 'Sofia', 'Vitória', 'Rafaela',
    'Cristina', 'Daniela', 'Elizangela', 'Franciele', 'Gisele', 'Helena', 'Iara', 'Joana', 'Karina', 'Lorena'
  ];

  const lastNames = [
    'Silva', 'Santos', 'Costa', 'Oliveira', 'Alves', 'Pereira', 'Rocha', 'Martins',
    'Mendes', 'Dias', 'Souza', 'Lima', 'Ferreira', 'Gomes', 'Ribeiro', 'Cardoso'
  ];

  const sides = ['RIGHT', 'LEFT', 'EITHER'];
  const players = [];

  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const whatsapp = `(51) 99999-${String(i).padStart(4, '0')}`;

    players.push({
      name: `${firstName} ${lastName}`,
      whatsapp,
      side
    });
  }

  return players;
}

// Calcula próxima quinta-feira
function getNextThursday(fromDate = new Date()) {
  const date = new Date(fromDate);
  const day = date.getDay();
  const daysUntilThursday = (4 - day + 7) % 7;
  date.setDate(date.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
  return date;
}

// Berger algorithm para gerar rodadas
function generateBergerRounds(playerCount) {
  const rounds = [];

  if (playerCount < 2) {
    console.log('⚠️ Precisa de pelo menos 2 atletas para gerar rodadas');
    return rounds;
  }

  // Para número ímpar, adiciona um bye
  const isOdd = playerCount % 2 === 1;
  const n = isOdd ? playerCount : playerCount - 1;
  const totalRounds = playerCount - 1;

  for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
    const roundMatches = [];

    for (let i = 0; i < n / 2; i++) {
      let player1 = i;
      let player2 = n - 1 - i;

      // Rotaciona conforme rodada
      if (roundNum > 1) {
        player1 = (player1 + roundNum - 1) % n;
        player2 = (player2 + roundNum - 1) % n;
      }

      if (player1 < playerCount && player2 < playerCount) {
        roundMatches.push({
          player1_index: player1,
          player2_index: player2
        });
      }
    }

    rounds.push({
      round_number: roundNum,
      matches: roundMatches
    });
  }

  return rounds;
}

async function seedComplete() {
  try {
    console.log('🌱 Iniciando SEED COMPLETO...\n');

    // 1. CRIAR TORNEIO
    console.log('📅 Criando Torneio...');
    await run(
      `INSERT OR REPLACE INTO tournaments (id_tournament, name, start_date, end_date, location, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [TOURNAMENT_ID, 'Ranking Padel SRB 2026', '2026-04-10', '2026-12-31', 'Rio Branco']
    );
    console.log('✅ Torneio criado: Ranking Padel SRB 2026\n');

    // 2. CRIAR QUADRA
    console.log('🏐 Criando Quadra...');
    await run(
      `INSERT OR REPLACE INTO courts (id_court, id_tournament, name, order_index, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [1, TOURNAMENT_ID, 'Quadra Principal', 1]
    );
    console.log('✅ Quadra criada: Quadra Principal\n');

    // 3. CRIAR CATEGORIAS
    console.log('📂 Criando Categorias...');
    for (const cat of categories) {
      await run(
        `INSERT OR IGNORE INTO categories (id, name, description, active, created_at)
         VALUES (?, ?, ?, 1, datetime('now'))`,
        [cat.id, cat.name, `Categoria ${cat.name}`]
      );
      console.log(`✅ Categoria: ${cat.name}`);
    }
    console.log();

    // 4. CRIAR ATLETAS
    console.log('👥 Criando Atletas...');
    let totalPlayers = 0;
    const categoryPlayers = {}; // Armazenar IDs dos atletas por categoria

    for (const cat of categories) {
      const players = generatePlayersForCategory(cat.name, cat.count);
      categoryPlayers[cat.id] = [];

      for (const player of players) {
        const result = await run(
          `INSERT INTO players (id_tournament, name, whatsapp, side, category_id, payment_status, created_at)
           VALUES (?, ?, ?, ?, ?, 'PAID', datetime('now'))`,
          [TOURNAMENT_ID, player.name, player.whatsapp, player.side, cat.id]
        );
        categoryPlayers[cat.id].push(result.lastID);
        totalPlayers++;
      }

      console.log(`✅ ${cat.name}: ${cat.count} atletas criados`);
    }
    console.log(`\n✨ Total: ${totalPlayers} atletas\n`);

    // 5. GERAR RODADAS E AGENDAR MATCHES
    console.log('🎯 Gerando Rodadas e Agendando Matches...\n');
    let totalMatches = 0;
    let currentThursday = new Date(FIRST_THURSDAY);

    for (const cat of categories) {
      const playerIds = categoryPlayers[cat.id];
      const playerCount = playerIds.length;

      console.log(`📌 ${cat.name} (${playerCount} atletas):`);

      // Gera rodadas via Berger
      const rounds = generateBergerRounds(playerCount);

      for (const roundData of rounds) {
        // Cria registro de rodada
        const roundResult = await run(
          `INSERT INTO rounds (id_tournament, id_category, round_number, scheduled_date, window_start, window_end, status, created_at)
           VALUES (?, ?, ?, ?, '18:00', '23:00', 'PENDING', datetime('now'))`,
          [TOURNAMENT_ID, cat.id, roundData.round_number, currentThursday.toISOString().split('T')[0]]
        );

        const roundId = roundResult.lastID;
        const roundDateStr = currentThursday.toLocaleDateString('pt-BR');

        // Agenda matches para esta rodada
        for (const match of roundData.matches) {
          const player1Id = playerIds[match.player1_index];
          const player2Id = playerIds[match.player2_index];

          // Cria dupla 1 (player1 sozinho)
          const double1Result = await run(
            `INSERT INTO doubles (id_tournament, id_player1, id_player2, display_name, id_round, created_at)
             VALUES (?, ?, NULL, ?, ?, datetime('now'))`,
            [TOURNAMENT_ID, player1Id, `Player ${match.player1_index + 1}`, roundId]
          );

          // Cria dupla 2 (player2 sozinho)
          const double2Result = await run(
            `INSERT INTO doubles (id_tournament, id_player1, id_player2, display_name, id_round, created_at)
             VALUES (?, ?, NULL, ?, ?, datetime('now'))`,
            [TOURNAMENT_ID, player2Id, `Player ${match.player2_index + 1}`, roundId]
          );

          // Agenda match
          const matchTime = `${currentThursday.toISOString().split('T')[0]}T19:00:00Z`;
          await run(
            `INSERT INTO matches (id_tournament, id_group, stage, id_double_a, id_double_b, id_court, scheduled_at, status, created_at)
             VALUES (?, NULL, 'ROUND_ROBIN', ?, ?, ?, ?, 'SCHEDULED', datetime('now'))`,
            [TOURNAMENT_ID, double1Result.lastID, double2Result.lastID, 1, matchTime]
          );

          totalMatches++;
        }

        console.log(`   Rodada ${roundData.round_number}: ${roundData.matches.length} matches - ${roundDateStr}`);

        // Avança para próxima quinta-feira
        currentThursday = getNextThursday(new Date(currentThursday.getTime() + 1000 * 60 * 60 * 24));
      }

      console.log(`   ✅ ${rounds.length} rodadas geradas\n`);
    }

    console.log('='.repeat(70));
    console.log('✨ SEED COMPLETO FINALIZADO!');
    console.log('='.repeat(70));
    console.log(`\n📊 Resumo:`);
    console.log(`   • Torneio: Ranking Padel SRB 2026`);
    console.log(`   • Categorias: ${categories.length}`);
    console.log(`   • Atletas: ${totalPlayers}`);
    console.log(`   • Matches Agendados: ${totalMatches}`);
    console.log(`   • Primeiras Quinta: ${FIRST_THURSDAY.toLocaleDateString('pt-BR')}`);
    console.log(`\n🎯 Próximos Passos:`);
    console.log(`   1. npm start (inicie o backend na porta 3001)`);
    console.log(`   2. npm run dev (inicie o frontend na porta 5173)`);
    console.log(`   3. Acesse http://localhost:5173/admin`);
    console.log(`   4. Vá em /rodadas para ver rodadas agendadas`);
    console.log(`   5. Vá em /jogos para ver todos os matches`);
    console.log(`   6. Acesse /ranking para ver o ranking ao vivo`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

// Executar
seedComplete();
