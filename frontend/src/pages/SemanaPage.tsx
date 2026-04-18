import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API_URL, { TOURNAMENT_ID } from '../config';
import { Calendar, Trophy, Search, X, AlertTriangle, Clock, CheckCircle, User } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

interface MatchItem {
  id_match: number;
  id_category: number | null;
  id_round?: number | null;
  double_a_name: string;
  double_b_name: string;
  court_name: string;
  scheduled_at: string | null;
  scheduled_date: string | null;
  status: string;
  score_a: number | null;
  score_b: number | null;
}

interface Round {
  id_round: number;
  id_category: number;
  scheduled_date: string;
  status: string;
  round_number: number;
}

interface Player {
  id_player: number;
  name: string;
  category_id: number;
}

// Próxima quinta-feira como YYYY-MM-DD (data local, sem bug de timezone)
const nextThursday = (): string => {
  const d = new Date();
  const day = d.getDay(); // 0=Dom, 1=Seg, ..., 4=Qui
  const diff = day <= 4 ? 4 - day : 11 - day;
  const thu = new Date(d);
  thu.setDate(d.getDate() + diff);
  return `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}-${String(thu.getDate()).padStart(2, '0')}`;
};

// Extrai hora de ISO: "2026-04-17T18:40:00" → "18h40"
const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  const t = iso.includes('T') ? iso.split('T')[1].substring(0, 5) : '';
  return t ? t.replace(':', 'h') : '';
};

// Window: opens Friday 00:01 of the week before (-6 days), closes Monday 18h of game week (-3 days)
const absenceDeadline = (gameDate: string): Date => {
  const d = new Date(gameDate + 'T12:00:00');
  d.setDate(d.getDate() - 3);
  d.setHours(18, 0, 0, 0);
  return d;
};
const absenceWindowOpen = (gameDate: string): Date => {
  const d = new Date(gameDate + 'T12:00:00');
  d.setDate(d.getDate() - 6);
  d.setHours(0, 1, 0, 0);
  return d;
};
const isDeadlineOpen = (gameDate: string): boolean => {
  const now = new Date();
  return now >= absenceWindowOpen(gameDate) && now < absenceDeadline(gameDate);
};

interface PlayerSession {
  id_player: number;
  name: string;
  side: string;
  category_id?: number;
}

export const SemanaPage = () => {
  const thuDate = nextThursday();

  // Detect logged-in athlete from /atleta session
  const [playerSession] = useState<PlayerSession | null>(() => {
    const s = localStorage.getItem('player_session');
    return s ? JSON.parse(s) : null;
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [roundsForWeek, setRoundsForWeek] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [absences, setAbsences] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [declaringAbsence, setDeclaringAbsence] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ id: number; msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, roundsRes, absRes, playersRes] = await Promise.all([
          fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories`),
          fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/rounds`),
          fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences?date=${thuDate}`),
          fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/players`),
        ]);

        const cats: Category[] = catRes.ok ? await catRes.json() : [];
        setCategories(cats);

        if (absRes.ok) {
          const absData = await absRes.json();
          setAbsences(absData.map((a: any) => a.id_player));
        }

        if (playersRes.ok) setPlayers(await playersRes.json());

        if (roundsRes.ok) {
          const allRounds: Round[] = await roundsRes.json();
          // Filtra rodadas desta quinta
          const thuRounds = allRounds.filter(r => r.scheduled_date === thuDate);
          setRoundsForWeek(thuRounds);

          // Busca matches das rodadas confirmadas via endpoint Supabase-aware
          const confirmedRounds = thuRounds.filter(r =>
            r.status === 'CONFIRMED' || r.status === 'FINISHED'
          );
          if (confirmedRounds.length > 0) {
            const matchResults = await Promise.all(
              confirmedRounds.map(r =>
                fetch(`${API_URL}/api/rounds/${r.id_round}/matches`)
                  .then(res => res.ok ? res.json() : [])
                  .then((items: any[]) => items.map(m => ({
                    ...m,
                    id_category: r.id_category,
                    id_round: r.id_round,
                    scheduled_date: thuDate,
                  })))
              )
            );
            setMatches(matchResults.flat());
          }
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [thuDate]);

  const deadlineOpen = isDeadlineOpen(thuDate);
  const searchLower = search.toLowerCase().trim();

  const catMap: Record<number, string> = {};
  categories.forEach(c => { catMap[c.id] = c.name; });

  const matchesByCat = categories.map(cat => ({
    cat,
    items: matches
      .filter(m => m.id_category === cat.id)
      .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
  })).filter(g => g.items.length > 0);

  const handleDeclareAbsence = async (player: Player) => {
    setDeclaringAbsence(player.id_player);
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_player: player.id_player, absence_date: thuDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAbsences(prev => [...prev, player.id_player]);
      setFeedback({ id: player.id_player, msg: 'Ausência registrada.', ok: true });
    } catch (err: any) {
      setFeedback({ id: player.id_player, msg: err.message, ok: false });
    } finally {
      setDeclaringAbsence(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleCancelAbsence = async (player: Player) => {
    setDeclaringAbsence(player.id_player);
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences/${player.id_player}?date=${thuDate}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAbsences(prev => prev.filter(id => id !== player.id_player));
      setFeedback({ id: player.id_player, msg: 'Ausência cancelada. Você voltou para o sorteio.', ok: true });
    } catch (err: any) {
      setFeedback({ id: player.id_player, msg: err.message, ok: false });
    } finally {
      setDeclaringAbsence(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const thuFormatted = new Date(thuDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/40 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-400 rounded-xl flex items-center justify-center text-black shrink-0">
              <Trophy size={16} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white leading-none">Ranking SRB</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Programação da semana</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {playerSession && (
              <Link to="/atleta" className="flex items-center gap-1.5 text-[10px] font-black text-green-400 hover:text-green-300 transition-colors border border-green-400/20 hover:border-green-400/40 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                <User size={10} /> {playerSession.name.split(' ')[0]}
              </Link>
            )}
            <Link to="/ranking" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-green-400 transition-colors flex items-center gap-1">
              <Trophy size={11} /> Ranking
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Título + data */}
        <div className="space-y-1">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
            Jogos da<br /><span className="text-green-400">Semana</span>
          </h1>
          <p className="text-zinc-400 text-sm capitalize">{thuFormatted}</p>
          <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">
            18h às 21h · Quadra de Vidro e Quadra de Parede
          </p>
        </div>

        {/* Regra rápida */}
        <div className="flex items-start gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400 font-bold">
            Não apareceu sem aviso = <span className="text-red-400">WO</span> (0 pontos, adversário +3).{' '}
            Se não puder jogar, declare sua ausência abaixo <span className="text-white">antes de segunda às 18h</span>.
          </p>
        </div>

        {/* Declaração de ausência — só se prazo aberto */}
        {deadlineOpen && (() => {
          // Logged-in athlete: show pre-filled card
          if (playerSession) {
            const sessionPlayer = players.find(p => p.id_player === playerSession.id_player);
            const isAbsent = absences.includes(playerSession.id_player);
            return (
              <div className={`rounded-2xl p-4 border space-y-3 transition-all ${isAbsent ? 'bg-amber-950/50 border-amber-500/25' : 'bg-amber-950/30 border-amber-500/20'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                  <Clock size={11} /> Sua presença esta semana
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-white">{playerSession.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      {sessionPlayer ? catMap[sessionPlayer.category_id] : ''}
                    </p>
                  </div>
                  {isAbsent
                    ? <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-[9px] font-black uppercase border border-red-500/30">Ausente</span>
                    : <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-[9px] font-black uppercase border border-green-500/30">No sorteio</span>
                  }
                </div>
                {feedback?.id === playerSession.id_player && (
                  <p className={`text-xs font-bold ${feedback.ok ? 'text-green-400' : 'text-red-400'}`}>{feedback.msg}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {isAbsent ? (
                    <>
                      <div className="h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center cursor-default">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-wide">Ausência declarada</span>
                      </div>
                      <button
                        onClick={() => sessionPlayer && handleCancelAbsence(sessionPlayer)}
                        disabled={declaringAbsence === playerSession.id_player}
                        className="h-10 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all disabled:opacity-50"
                      >
                        {declaringAbsence === playerSession.id_player ? 'Cancelando...' : 'Cancelar — vou jogar'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-10 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center gap-1.5 cursor-default">
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-[10px] font-black text-green-400 uppercase tracking-wide">Vou jogar</span>
                      </div>
                      <button
                        onClick={() => sessionPlayer && handleDeclareAbsence(sessionPlayer)}
                        disabled={declaringAbsence === playerSession.id_player}
                        className="h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
                      >
                        {declaringAbsence === playerSession.id_player ? 'Registrando...' : 'Não posso ir'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          }

          // Public: search by name
          return (
            <div className="space-y-3 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 flex items-center gap-2">
                <Clock size={11} /> Vai faltar? Declare antes de segunda 18h
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Busque seu nome..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 text-sm font-bold text-white placeholder-zinc-600 focus:border-yellow-400 outline-none transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>

              {searchLower && (() => {
                const found = players.find(p => p.name.toLowerCase().includes(searchLower));
                if (!found) return <p className="text-xs text-zinc-600 px-1">Nenhum atleta encontrado.</p>;
                const isAbsent = absences.includes(found.id_player);
                return (
                  <div className={`rounded-xl p-4 border space-y-3 ${isAbsent ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-green-400/30 bg-green-500/10'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">{found.name}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{catMap[found.category_id]}</p>
                      </div>
                      {isAbsent
                        ? <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-[9px] font-black uppercase border border-yellow-500/30">Ausência declarada</span>
                        : <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-[9px] font-black uppercase border border-green-500/30">No sorteio</span>
                      }
                    </div>
                    {feedback?.id === found.id_player && (
                      <p className={`text-xs font-bold ${feedback.ok ? 'text-green-400' : 'text-red-400'}`}>{feedback.msg}</p>
                    )}
                    {isAbsent ? (
                      <button
                        onClick={() => handleCancelAbsence(found)}
                        disabled={declaringAbsence === found.id_player}
                        className="w-full h-10 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all disabled:opacity-50"
                      >
                        {declaringAbsence === found.id_player ? 'Cancelando...' : '↩ Cancelar ausência — vou jogar'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeclareAbsence(found)}
                        disabled={declaringAbsence === found.id_player}
                        className="w-full h-10 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-yellow-500/30 transition-all disabled:opacity-50"
                      >
                        {declaringAbsence === found.id_player ? 'Registrando...' : 'Não vou poder jogar esta semana'}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Programação dos jogos */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-4">
            <Calendar size={11} /> Programação dos jogos
          </p>

          {loading ? (
            <div className="py-12 text-center text-zinc-500 font-black uppercase tracking-widest text-xs animate-pulse">Carregando...</div>
          ) : matchesByCat.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Calendar size={28} className="mx-auto text-zinc-700" />
              {roundsForWeek.length === 0 ? (
                <>
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Sorteio ainda não realizado</p>
                  <p className="text-zinc-600 text-xs">O admin ainda não realizou o sorteio desta semana.</p>
                </>
              ) : (
                <>
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Sorteio em andamento</p>
                  <p className="text-zinc-600 text-xs">O sorteio foi realizado mas ainda aguarda confirmação do admin para liberar os horários.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {matchesByCat.map(({ cat, items }) => (
                <div key={cat.id} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">{cat.name}</h2>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>

                  {items.map(match => {
                    const time = formatTime(match.scheduled_at);
                    const myName = playerSession?.name.toLowerCase() || '';
                    // Usa primeiro + último nome para evitar falsos positivos (ex: "Alessandro Flores" ≠ "Alessandro Bianchi")
                    const myFirst = myName.split(' ')[0] || '';
                    const myLast = myName.split(' ').slice(-1)[0] || '';
                    const matchesDouble = (doubleName: string) => {
                      const d = doubleName.toLowerCase();
                      return myFirst && myLast && d.includes(myFirst) && d.includes(myLast);
                    };
                    const isMyMatch = myName && (matchesDouble(match.double_a_name) || matchesDouble(match.double_b_name));
                    const highlighted = isMyMatch || (searchLower && (
                      match.double_a_name.toLowerCase().includes(searchLower) ||
                      match.double_b_name.toLowerCase().includes(searchLower)
                    ));
                    const isFinished = match.status === 'FINISHED';
                    const isWo = match.status === 'WO';

                    return (
                      <div
                        key={match.id_match}
                        className={`rounded-2xl p-4 border transition-all ${
                          isMyMatch
                            ? 'border-green-400/40 bg-green-500/[0.08] ring-1 ring-green-400/20'
                            : highlighted
                            ? 'border-green-400/30 bg-green-500/[0.05]'
                            : 'border-white/5 bg-white/[0.03]'
                        }`}
                      >
                        {/* Meta: horário + quadra + status */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {time && (
                              <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                {time}
                              </span>
                            )}
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                              {match.court_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMyMatch && (
                              <span className="text-[9px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 uppercase tracking-widest">
                                Seu jogo
                              </span>
                            )}
                            {isFinished && match.score_a != null && (
                              <span className="text-sm font-black text-white">
                                {match.score_a} <span className="text-zinc-600">×</span> {match.score_b}
                              </span>
                            )}
                            {isWo && (
                              <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                                WO
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Duplas — empilhadas no mobile, lado a lado no desktop */}
                        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2">
                          <span className={`text-sm font-bold leading-snug ${
                            matchesDouble(match.double_a_name) || (searchLower && match.double_a_name.toLowerCase().includes(searchLower))
                              ? 'text-green-400'
                              : 'text-white'
                          }`}>
                            {match.double_a_name}
                          </span>
                          <span className="text-[9px] font-black text-zinc-700 sm:text-center py-0.5">VS</span>
                          <span className={`text-sm font-bold leading-snug sm:text-right ${
                            matchesDouble(match.double_b_name) || (searchLower && match.double_b_name.toLowerCase().includes(searchLower))
                              ? 'text-green-400'
                              : 'text-white'
                          }`}>
                            {match.double_b_name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 text-center">
          <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">RANKING PADEL SRB © 2026</p>
        </div>
      </div>
    </div>
  );
};

export default SemanaPage;
