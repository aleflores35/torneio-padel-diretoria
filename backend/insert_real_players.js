// insert_real_players.js — Insere dados reais do Ranking Padel SRB 2026
const supabase = require('./supabase');

async function insert() {
  console.log('🎾 Inserindo dados reais do Ranking Padel SRB 2026...\n');

  // 1. TORNEIO
  console.log('📅 Criando torneio...');
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({ name: 'Ranking Padel SRB 2026', start_date: '2026-04-17', end_date: '2026-12-31', location: 'SRB' })
    .select()
    .single();
  if (tErr) throw new Error('Torneio: ' + tErr.message);
  const TOURNAMENT_ID = tournament.id_tournament;
  console.log(`✅ Torneio criado (id=${TOURNAMENT_ID})\n`);

  // 2. QUADRA
  console.log('🏐 Criando quadra...');
  const { error: cErr } = await supabase
    .from('courts')
    .insert({ id_tournament: TOURNAMENT_ID, name: 'Quadra Principal', order_index: 1 });
  if (cErr) throw new Error('Quadra: ' + cErr.message);
  console.log('✅ Quadra criada\n');

  // 3. CATEGORIAS
  console.log('📂 Criando categorias...');
  const categoriesData = [
    { name: 'Masculino 6ª',       description: 'Masculino 6ª Categoria' },
    { name: 'Masculino 4ª',       description: 'Masculino 4ª Categoria' },
    { name: 'Feminino Iniciante', description: 'Feminino Iniciante' },
  ];
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .insert(categoriesData)
    .select();
  if (catErr) throw new Error('Categorias: ' + catErr.message);

  const catMap = {};
  for (const c of categories) catMap[c.name] = c.id;
  console.log('✅ Categorias criadas:', Object.keys(catMap).join(', '), '\n');

  // 4. ATLETAS
  const players = [

    // ── MASCULINO INICIANTE ──────────────────────────────────────────
    // DIREITA
    { name: 'Douglas Peil',           side: 'RIGHT' },
    { name: 'Alex Severo',            side: 'RIGHT' },
    { name: 'Diego Pohlmann',         side: 'RIGHT' },
    { name: 'Lucas Jardim',           side: 'RIGHT' },
    { name: 'William Ellwanger',      side: 'RIGHT' },
    { name: 'Deivit Trindade',        side: 'RIGHT' },
    { name: 'Hilton De Francheschi',  side: 'RIGHT' },
    { name: 'Andre Hoppe',            side: 'RIGHT' },
    { name: 'Cristiano Severo',       side: 'RIGHT' },
    { name: 'Bernardo Goulart',       side: 'RIGHT' },
    { name: 'Elder Rossi',            side: 'RIGHT' },
    { name: 'Alexandre Gonzaga',      side: 'RIGHT' },
    { name: 'Marcio Ferreira',        side: 'RIGHT' },
    { name: 'Flavio Justo',           side: 'RIGHT' },
    // ESQUERDA
    { name: 'Rodrigo Keller',         side: 'LEFT' },
    { name: 'Gustavo Bock',           side: 'LEFT' },
    { name: 'Cicero Kommers',         side: 'LEFT' },
    { name: 'Guilherme Santos',       side: 'LEFT' },
    { name: 'Francisco Neto',         side: 'LEFT' },
    { name: 'Alessandro Bianchi',     side: 'LEFT' },
    { name: 'Sérgio Coelho',          side: 'LEFT' },
    { name: 'Jean Marques',           side: 'LEFT' },
    { name: 'Anderson Dalmolin',      side: 'LEFT' },
    { name: 'Diego Schutz',           side: 'LEFT' },
    { name: 'Luis Herzog',            side: 'LEFT' },
    { name: 'Alisson Boyink',         side: 'LEFT' },
    { name: 'Nicolas Garcia',         side: 'LEFT' },
    { name: 'Rafael Pessolano',       side: 'LEFT' },

    // ── MASCULINO 4ª ────────────────────────────────────────────────
    // DIREITA
    { name: 'Pablo Severo',           side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Marcos Ribeiro Ferreira',side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Marcio Delia',           side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Daniel Souza Staevie',   side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Cassius Zanenga',        side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Dinho Schiefelbein',     side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Eduardo Horbach',        side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Gabriel Steindorf Dias', side: 'RIGHT', cat: 'Masculino 4ª' },
    { name: 'Nelson Paiva',           side: 'RIGHT', cat: 'Masculino 4ª' },
    // ESQUERDA
    { name: 'João Felipe Pereira',    side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Cláudio Dias',           side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Denilson Magalhães',     side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Ivan Bartmann',          side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Pablo Mallmann',         side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Daniel Teixeira',        side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Hélisson Borges',        side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Helio Garcia',           side: 'LEFT',  cat: 'Masculino 4ª' },
    { name: 'Alessandro Flores',      side: 'LEFT',  cat: 'Masculino 4ª' },

    // ── FEMININO INICIANTE ──────────────────────────────────────────
    // DIREITA
    { name: 'Maria Luísa',            side: 'RIGHT', cat: 'Feminino Iniciante' },
    { name: 'Paola Brendler',         side: 'RIGHT', cat: 'Feminino Iniciante' },
    { name: 'Michele Fontoura',       side: 'RIGHT', cat: 'Feminino Iniciante' },
    { name: 'Tanise Cezimbra',        side: 'RIGHT', cat: 'Feminino Iniciante' },
    { name: 'Mara Loreto',            side: 'RIGHT', cat: 'Feminino Iniciante' },
    { name: 'Bruna Trindade',         side: 'RIGHT', cat: 'Feminino Iniciante' },
    { name: 'Luana Bock',             side: 'RIGHT', cat: 'Feminino Iniciante' },
    // ESQUERDA
    { name: 'Sabrina Schutz',         side: 'LEFT',  cat: 'Feminino Iniciante' },
    { name: 'Amanda Oestreich',       side: 'LEFT',  cat: 'Feminino Iniciante' },
    { name: 'Eduarda Lemos',          side: 'LEFT',  cat: 'Feminino Iniciante' },
    { name: 'Nara Nunes',             side: 'LEFT',  cat: 'Feminino Iniciante' },
    { name: 'Francine Rossi',         side: 'LEFT',  cat: 'Feminino Iniciante' },
    { name: 'Daniela Herzog',         side: 'LEFT',  cat: 'Feminino Iniciante' },
    { name: 'Catiane',                side: 'LEFT',  cat: 'Feminino Iniciante' },
  ];

  // Mapeia categoria default (Masculino 6ª) para quem não tem .cat
  const rows = players.map(p => ({
    id_tournament: TOURNAMENT_ID,
    name: p.name,
    side: p.side,
    category_id: catMap[p.cat || 'Masculino 6ª'],
    payment_status: 'PAID',
    is_socio: true,
  }));

  console.log(`👥 Inserindo ${rows.length} atletas...`);
  const { error: pErr } = await supabase.from('players').insert(rows);
  if (pErr) throw new Error('Players: ' + pErr.message);
  console.log(`✅ ${rows.length} atletas inseridos\n`);

  // RESUMO
  console.log('═══════════════════════════════════');
  console.log('✅ INSERÇÃO CONCLUÍDA');
  console.log('═══════════════════════════════════');
  console.log(`Torneio ID : ${TOURNAMENT_ID}`);
  console.log('Categorias : Masculino 6ª (28), Masculino 4ª (18), Feminino Iniciante (14)');
  console.log('Total      : 60 atletas');
  console.log('\nPróximo passo: acesse /rodadas e clique em "Gerar Rodadas" para cada categoria.');
}

insert().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  process.exit(1);
});
