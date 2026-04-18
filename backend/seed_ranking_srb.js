// seed_ranking_srb.js
// Script para popular banco com atletas fake para testes do Ranking SRB
// Execute: node seed_ranking_srb.js

const db = require('./database');

const TOURNAMENT_ID = 1;

const categories = [
  { id: 1, name: 'Masculino 6ª' },
  { id: 2, name: 'Masculino 4ª' },
  { id: 3, name: 'Feminino Iniciante' }
];

// Nomes fake por categoria (números DIFERENTES para testar flexibilidade)
const playersByCategory = {
  'Masculino 6ª': [
    { name: 'João Silva', whatsapp: '(51) 99999-0001', side: 'RIGHT' },
    { name: 'Lucas Santos', whatsapp: '(51) 99999-0002', side: 'LEFT' },
    { name: 'Rafael Costa', whatsapp: '(51) 99999-0003', side: 'RIGHT' },
    { name: 'Marcelo Oliveira', whatsapp: '(51) 99999-0004', side: 'LEFT' },
    { name: 'Fernando Alves', whatsapp: '(51) 99999-0005', side: 'EITHER' },
    { name: 'Bruno Pereira', whatsapp: '(51) 99999-0006', side: 'RIGHT' },
    { name: 'Diego Rocha', whatsapp: '(51) 99999-0007', side: 'LEFT' },
    { name: 'André Martins', whatsapp: '(51) 99999-0008', side: 'EITHER' },
    { name: 'Carlos Mendes', whatsapp: '(51) 99999-0009', side: 'RIGHT' },
    { name: 'Roberto Dias', whatsapp: '(51) 99999-0010', side: 'LEFT' }
  ],
  'Masculino 4ª': [
    { name: 'Rodrigo Silva', whatsapp: '(51) 99999-0101', side: 'RIGHT' },
    { name: 'Gustavo Santos', whatsapp: '(51) 99999-0102', side: 'LEFT' },
    { name: 'Felipe Costa', whatsapp: '(51) 99999-0103', side: 'RIGHT' },
    { name: 'Matheus Oliveira', whatsapp: '(51) 99999-0104', side: 'LEFT' },
    { name: 'Leonardo Alves', whatsapp: '(51) 99999-0105', side: 'EITHER' },
    { name: 'Pedro Pereira', whatsapp: '(51) 99999-0106', side: 'RIGHT' },
    { name: 'Tiago Rocha', whatsapp: '(51) 99999-0107', side: 'LEFT' },
    { name: 'Víctor Martins', whatsapp: '(51) 99999-0108', side: 'EITHER' }
  ],
  'Feminino Iniciante': [
    { name: 'Maria Santos', whatsapp: '(51) 99999-0201', side: 'RIGHT' },
    { name: 'Ana Costa', whatsapp: '(51) 99999-0202', side: 'LEFT' },
    { name: 'Paula Oliveira', whatsapp: '(51) 99999-0203', side: 'RIGHT' },
    { name: 'Carla Alves', whatsapp: '(51) 99999-0204', side: 'LEFT' },
    { name: 'Juliana Pereira', whatsapp: '(51) 99999-0205', side: 'EITHER' },
    { name: 'Beatriz Rocha', whatsapp: '(51) 99999-0206', side: 'RIGHT' },
    { name: 'Fernanda Martins', whatsapp: '(51) 99999-0207', side: 'LEFT' },
    { name: 'Leticia Mendes', whatsapp: '(51) 99999-0208', side: 'EITHER' },
    { name: 'Gabriela Dias', whatsapp: '(51) 99999-0209', side: 'RIGHT' },
    { name: 'Isabella Souza', whatsapp: '(51) 99999-0210', side: 'LEFT' },
    { name: 'Mariana Lima', whatsapp: '(51) 99999-0211', side: 'RIGHT' },
    { name: 'Camila Silva', whatsapp: '(51) 99999-0212', side: 'LEFT' }
  ],
};

function seedDatabase() {
  return new Promise((resolve, reject) => {
    let playersAdded = 0;
    let categoriesAdded = 0;

    // 1. Tenta adicionar coluna category_id se não existir
    db.run(`ALTER TABLE players ADD COLUMN category_id INTEGER`, (err) => {
      // Ignora erro se coluna já existe
    });

    // 2. Insere categorias
    categories.forEach(cat => {
      db.run(
        `INSERT OR IGNORE INTO categories (id, name, description, active, created_at)
         VALUES (?, ?, ?, 1, datetime('now'))`,
        [cat.id, cat.name, `Categoria ${cat.name}`],
        function(err) {
          if (!err) {
            categoriesAdded++;
            console.log(`✅ Categoria criada: ${cat.name}`);
          } else if (!err.message.includes('UNIQUE')) {
            console.log(`⚠️  Categoria "${cat.name}" pode já existir`);
          }
        }
      );
    });

    // 3. Insere atletas após 1 segundo
    setTimeout(() => {
      let totalToInsert = 0;
      let insertCount = 0;

      categories.forEach(cat => {
        const athletes = playersByCategory[cat.name];
        athletes.forEach(athlete => {
          totalToInsert++;

          // Tenta inserir sem is_socio
          db.run(
            `INSERT INTO players (id_tournament, name, whatsapp, side, payment_status, category_id, created_at)
             VALUES (?, ?, ?, ?, 'PAID', ?, datetime('now'))`,
            [TOURNAMENT_ID, athlete.name, athlete.whatsapp, athlete.side, cat.id],
            function(err) {
              if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                  console.log(`⚠️  Atleta já existe: ${athlete.name}`);
                } else {
                  console.error(`❌ Erro ao inserir ${athlete.name}:`, err.message);
                }
              } else {
                playersAdded++;
                console.log(`✅ Atleta criado: ${athlete.name} (${cat.name})`);
              }

              insertCount++;

              // Quando terminar todos
              if (insertCount === totalToInsert) {
                setTimeout(() => {
                  console.log('\n' + '='.repeat(70));
                  console.log(`✨ SEED COMPLETO!`);
                  console.log('='.repeat(70));
                  console.log(`📊 ${playersAdded} atletas criados`);
                  console.log(`📂 ${categories.length} categorias (números variados)`);
                  console.log(`\n👥 Distribuição por categoria:`);
                  Object.entries(playersByCategory).forEach(([cat, players]) => {
                    console.log(`   • ${cat}: ${players.length} atletas`);
                  });
                  console.log(`\n🎯 Total geral: ${playersAdded} atletas`);
                  console.log('\n📌 Próximos passos:');
                  console.log('  1. ✅ Acesse http://localhost:5180/admin/atletas');
                  console.log('  2. ✅ Veja todos os atletas carregados com categorias');
                  console.log('  3. ✅ Filtre por categoria no menu esquerdo');
                  console.log('  4. ✅ Acesse http://localhost:5180/rodadas');
                  console.log('  5. ✅ Clique "Gerar Rodadas" para cada categoria');
                  console.log('  6. ✅ Clique "Agendar" para agendar matches');
                  console.log('  7. ✅ Vá em /jogos para ver matches agendados');
                  console.log('  8. ✅ Clique "Chamar" para simular WhatsApp');
                  console.log('  9. ✅ Insira resultado (games A vs B)');
                  console.log(' 10. ✅ Veja ranking atualizar em tempo real (/ranking)');
                  console.log('='.repeat(70) + '\n');
                  resolve({ playersAdded, categoriesAdded });
                }, 1000);
              }
            }
          );
        });
      });
    }, 1500);
  });
}

// Executar
console.log('🌱 Iniciando seed com atletas fake...\n');
seedDatabase()
  .then(() => {
    console.log('✅ Seed executado com sucesso!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro durante seed:', err);
    process.exit(1);
  });
