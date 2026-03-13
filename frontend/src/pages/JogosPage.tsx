import { useState, useEffect } from 'react';

import axios from 'axios';

interface Match {
  id_match: number;
  id_tournament: number;
  id_group?: number;
  stage: string;
  id_double_a: number;
  id_double_b: number;
  id_court: number;
  scheduled_at: string;
  games_double_a: number;
  games_double_b: number;
  status: 'TO_PLAY' | 'CALLING' | 'IN_PROGRESS' | 'FINISHED';
  double_a_name: string;
  double_b_name: string;
  court_name: string;
}

const JogosPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = () => {
    setLoading(true);
    axios.get('http://localhost:3001/api/tournaments/1/matches')
      .then((res: any) => {
        setMatches(res.data);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleSchedule = () => {
    axios.post('http://localhost:3001/api/tournaments/1/schedule')
      .then(() => fetchMatches())
      .catch(err => alert(err.message));
  };

  const statusColors: any = {
    FINISHED: 'text-zinc-500',
    IN_PROGRESS: 'text-premium-accent font-bold',
    CALLING: 'text-amber-500 animate-pulse',
    TO_PLAY: 'text-zinc-400'
  };

  const translateStatus = (status: string) => {
    const map: any = { 
      FINISHED: 'Finalizado', 
      IN_PROGRESS: 'Em Andamento', 
      CALLING: 'Chamando', 
      TO_PLAY: 'A Jogar' 
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">Cronograma de Jogos</h2>
          <p className="text-zinc-500 text-sm mt-1">Algoritmo de agendamento com descanso de 30min ativo.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 transition-colors" onClick={handleSchedule}>
            Auto-Agendar
          </button>
          <button className="btn-primary">Novo Placar</button>
        </div>
      </div>

      <div className="premium-card overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Horário</th>
                <th className="px-6 py-4 font-semibold">Quadra</th>
                <th className="px-6 py-4 font-semibold">Dupla A</th>
                <th className="px-6 py-4 font-semibold text-center">Placar</th>
                <th className="px-6 py-4 font-semibold">Dupla B</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500">Buscando cronograma...</td></tr>
              ) : matches.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500">Nenhum jogo gerado ainda.</td></tr>
              ) : matches.map(m => (
                <tr key={m.id_match} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-zinc-400">
                    {m.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-200">{m.court_name || 'TBD'}</td>
                  <td className="px-6 py-4 text-zinc-200">{m.double_a_name}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex gap-2 bg-black/20 px-3 py-1 rounded-lg font-bold font-mono">
                      <span>{m.games_double_a}</span>
                      <span className="text-zinc-600">x</span>
                      <span>{m.games_double_b}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-200">{m.double_b_name}</td>
                  <td className={`px-6 py-4 text-[10px] font-black uppercase ${statusColors[m.status]}`}>
                    {translateStatus(m.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JogosPage;
