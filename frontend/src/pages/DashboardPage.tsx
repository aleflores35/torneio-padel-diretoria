import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Users, Calendar, Zap, Activity,
  RefreshCw, Download, ArrowRight, Clock, Star, ClipboardCheck
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { id: 1, name: 'Masculino Iniciante / 6ª', short: 'Masc. Ini./6ª' },
  { id: 2, name: 'Masculino 4ª', short: 'Masc. 4ª' },
  { id: 3, name: 'Feminino Iniciante', short: 'Fem. Ini.' },
  { id: 4, name: 'Feminino 6ª', short: 'Fem. 6ª' },
  { id: 5, name: 'Feminino 4ª', short: 'Fem. 4ª' },
];

function thisThursday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 4 ? 0 : (4 - day + 7) % 7;
  const thu = new Date(today);
  thu.setDate(today.getDate() + diff);
  return `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}-${String(thu.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  DRAFT:                  { label: 'Rascunho',               dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  AWAITING_CONFIRMATION:  { label: 'Aguard. confirmação',    dot: 'bg-blue-400',    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  CONFIRMED:              { label: 'Confirmado',              dot: 'bg-green-400',   badge: 'bg-green-400/10 text-green-400 border-green-400/20' },
  FINISHED:               { label: 'Encerrado',               dot: 'bg-zinc-600',    badge: 'bg-zinc-800 text-zinc-500 border-zinc-700' },
  NO_ROUND:               { label: 'Sem sorteio esta semana', dot: 'bg-zinc-800',    badge: 'bg-white/[0.03] text-zinc-600 border-white/5' },
};

interface CategoryData {
  id: number;
  name: string;
  short: string;
  playerCount: number;
  roundsFinished: number;
  roundsTotal: number;
  thisWeekRound: any | null;
  leaderRight: { name: string; points: number } | null;
  leaderLeft: { name: string; points: number } | null;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [finishedMatches, setFinishedMatches] = useState(0);
  const [pendingValidations, setPendingValidations] = useState(0);
  const thuDate = thisThursday();

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [playersRes, roundsRes, matchesRes] = await Promise.all([
        fetch(`${BASE}/api/players`),
        fetch(`${BASE}/api/tournaments/1/rounds`),
        fetch(`${BASE}/api/tournaments/1/matches`),
      ]);
      const players: any[] = playersRes.ok ? await playersRes.json() : [];
      const rounds: any[] = roundsRes.ok ? await roundsRes.json() : [];
      const matches: any[] = matchesRes.ok ? await matchesRes.json() : [];

      setTotalPlayers(players.length);
      setTotalMatches(matches.length);
      setFinishedMatches(matches.filter(m => m.status === 'FINISHED').length);
      setPendingValidations(matches.filter(m => m.player_score_submitted_by && m.status !== 'FINISHED' && m.status !== 'WO').length);

      const catData: CategoryData[] = await Promise.all(
        CATEGORIES.map(async (cat) => {
          const catRounds = rounds.filter(r => r.id_category === cat.id);
          const thisWeekRound = catRounds.find(r => r.scheduled_date === thuDate) || null;
          const roundsFinished = catRounds.filter(r => r.status === 'FINISHED').length;
          const roundsTotal = catRounds.length;

          let leaderRight: { name: string; points: number } | null = null;
          let leaderLeft: { name: string; points: number } | null = null;
          try {
            const rankRes = await fetch(`${BASE}/api/tournaments/1/ranking/${cat.id}`);
            if (rankRes.ok) {
              const standings: any[] = await rankRes.json();
              const r = standings.filter(p => p.side === 'RIGHT' || p.side === 'EITHER').sort((a, b) => b.points - a.points)[0];
              const l = standings.filter(p => p.side === 'LEFT' || p.side === 'EITHER').sort((a, b) => b.points - a.points)[0];
              if (r) leaderRight = { name: r.name, points: r.points };
              if (l) leaderLeft = { name: l.name, points: l.points };
            }
          } catch (_) {}

          return {
            ...cat,
            playerCount: players.filter((p: any) => p.category_id === cat.id).length,
            roundsFinished,
            roundsTotal,
            thisWeekRound,
            leaderRight,
            leaderLeft,
          };
        })
      );

      setCategories(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const iv = setInterval(() => loadData(true), 30000);
    return () => clearInterval(iv);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${BASE}/api/tournaments/1/export`);
      if (!res.ok) throw new Error('Falha ao gerar planilha');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'ranking-srb.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao exportar: ' + (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="py-32 text-center text-zinc-600 font-black uppercase tracking-widest text-xs animate-pulse">
      Carregando painel...
    </div>
  );

  // Só mostrar categorias que têm atletas ou rodadas registradas
  const activeCategories = categories.filter(c => c.playerCount > 0 || c.roundsTotal > 0);

  const totalRoundsFinished = activeCategories.reduce((s, c) => s + c.roundsFinished, 0);
  const totalRoundsAll = activeCategories.reduce((s, c) => s + c.roundsTotal, 0);
  const matchPct = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-premium-accent/60 uppercase tracking-[0.4em] mb-2">Ranking SRB 2026</p>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
            Painel <span className="text-premium-accent">Admin</span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-3 bg-green-400/10 hover:bg-green-400/15 border border-green-400/30 text-green-400 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-40"
          >
            <Download size={14} />
            {exporting ? 'Gerando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={() => loadData(true)}
            className={`p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition-all ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ─── Esta Quinta ──────────────────────────────────────────────── */}
      <div className="premium-card bg-white/[0.02] border-white/5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-premium-accent/10 border border-premium-accent/20 flex items-center justify-center">
              <Calendar size={18} className="text-premium-accent" />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Esta Quinta-Feira</p>
              <p className="text-lg font-black text-white">{formatDate(thuDate)}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/rodadas')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-premium-accent text-black text-[11px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-all"
          >
            Gerenciar Rodadas <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activeCategories.map(cat => {
            const r = cat.thisWeekRound;
            const statusKey = r ? r.status : 'NO_ROUND';
            const cfg = STATUS_CFG[statusKey] || STATUS_CFG.NO_ROUND;
            return (
              <div key={cat.id} className={`rounded-xl p-4 border flex flex-col gap-2 ${cfg.badge}`}>
                <p className="text-[10px] font-black uppercase tracking-wide opacity-80">{cat.short}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <p className="text-[10px] font-bold leading-tight">{cfg.label}</p>
                </div>
                {r && (
                  <p className="text-[9px] opacity-60 font-bold uppercase tracking-widest">Rodada {r.round_number}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Stats Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat
          icon={<Users size={16} className="text-blue-400" />}
          label="Atletas"
          value={totalPlayers}
          sub={`em ${activeCategories.length} categorias`}
        />
        <MiniStat
          icon={<Zap size={16} className="text-amber-400" />}
          label="Rodadas encerradas"
          value={`${totalRoundsFinished}/${totalRoundsAll}`}
          sub={totalRoundsAll > 0 ? `${Math.round((totalRoundsFinished / totalRoundsAll) * 100)}% concluído` : 'Sem rodadas'}
          progress={totalRoundsAll > 0 ? (totalRoundsFinished / totalRoundsAll) * 100 : 0}
        />
        <MiniStat
          icon={<Activity size={16} className="text-premium-accent" />}
          label="Jogos realizados"
          value={`${finishedMatches}/${totalMatches}`}
          sub={`${matchPct}% concluído`}
          progress={matchPct}
        />
        <MiniStat
          icon={<ClipboardCheck size={16} className="text-orange-400" />}
          label="Placar aguardando validação"
          value={pendingValidations}
          sub={pendingValidations > 0 ? 'validar em Jogos' : 'tudo em dia'}
          highlight={pendingValidations > 0}
          onClick={() => navigate('/jogos')}
        />
      </div>

      {/* ─── Categorias + Líderes ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
            <Trophy size={18} className="text-premium-accent" />
            Status por Categoria
          </h3>
          <button
            onClick={() => navigate('/ranking')}
            className="text-[10px] font-black uppercase tracking-widest text-premium-accent hover:brightness-125 flex items-center gap-1"
          >
            Ver ranking completo <ArrowRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeCategories.map(cat => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>
      </div>

    </div>
  );
};

// ─── CategoryCard ───────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryData }) {
  const pct = cat.roundsTotal > 0 ? (cat.roundsFinished / cat.roundsTotal) * 100 : 0;
  const hasLeaders = cat.leaderRight || cat.leaderLeft;

  return (
    <div className="premium-card bg-white/[0.02] border-white/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-wider text-white">{cat.name}</h4>
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{cat.playerCount} atletas</span>
      </div>

      {/* Round progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Rodadas</p>
          <p className="text-[10px] font-black text-zinc-400">{cat.roundsFinished} / {cat.roundsTotal || '—'}</p>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-premium-accent rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Leaders */}
      {hasLeaders ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[
            { label: 'Direita', leader: cat.leaderRight },
            { label: 'Esquerda', leader: cat.leaderLeft },
          ].map(({ label, leader }) => (
            <div key={label} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Star size={8} /> {label}
              </p>
              {leader ? (
                <>
                  <p className="text-xs font-black text-white truncate leading-none">{leader.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-premium-accent font-black mt-1">{leader.points} pts</p>
                </>
              ) : (
                <p className="text-xs text-zinc-700 font-bold">—</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-zinc-700 py-1">
          <Clock size={13} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Aguardando resultados</p>
        </div>
      )}
    </div>
  );
}

// ─── MiniStat ────────────────────────────────────────────────────────────────

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  progress?: number;
  highlight?: boolean;
  onClick?: () => void;
}

function MiniStat({ icon, label, value, sub, progress, highlight, onClick }: MiniStatProps) {
  return (
    <div
      className={`premium-card p-5 space-y-3 transition-all ${
        highlight
          ? 'bg-orange-400/5 border-orange-400/20 cursor-pointer hover:border-orange-400/40'
          : 'bg-white/[0.01] border-white/5'
      }`}
      onClick={onClick}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${highlight ? 'bg-orange-400/10' : 'bg-white/5'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`text-2xl font-black italic tracking-tight leading-none ${highlight ? 'text-orange-400' : 'text-white'}`}>
          {value}
        </p>
        <p className="text-[9px] font-bold text-zinc-600 mt-1 uppercase tracking-wide">{sub}</p>
      </div>
      {progress !== undefined && (
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-premium-accent rounded-full"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
