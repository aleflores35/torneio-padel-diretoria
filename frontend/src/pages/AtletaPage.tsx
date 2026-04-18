import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL, { TOURNAMENT_ID } from '../config';
import {
  Phone, Trophy, ArrowLeft, ChevronRight, CheckCircle,
  Clock, X, History, Calendar, AlertTriangle, TrendingUp, Star, Share2, ExternalLink, Lock,
} from 'lucide-react';
import { generateStoriesImage } from '../utils/generateStoriesImage';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@400;600;700&display=swap');`;

const MOTIVATIONAL = [
  'A VITÓRIA COMEÇA NA PREPARAÇÃO',
  'CADA JOGO CONTA NO RANKING',
  'VOCÊ ESTÁ NO CAMINHO CERTO',
  'JOGUE COM TUDO, DEIXE TUDO NA QUADRA',
  'O CAMPEONATO SE DECIDE NOS DETALHES',
  'FOCO, DETERMINAÇÃO E MUITA RAÇA',
];

// ── helpers ───────────────────────────────────────────────────────────────────

const thisThursday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = day <= 4 ? 4 - day : 11 - day;
  const thu = new Date(d);
  thu.setDate(d.getDate() + diff);
  return `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}-${String(thu.getDate()).padStart(2, '0')}`;
};

const absenceDeadline = (gameDate: string): Date => {
  const d = new Date(gameDate + 'T12:00:00');
  d.setDate(d.getDate() - 3);
  d.setHours(18, 0, 0, 0);
  return d;
};

// Window to declare absence opens the Friday BEFORE the game (game is Thursday → Friday -6 days 00:01)
const absenceWindowOpen = (gameDate: string): Date => {
  const d = new Date(gameDate + 'T12:00:00');
  d.setDate(d.getDate() - 6);
  d.setHours(0, 1, 0, 0);
  return d;
};

// Round closes Sunday 23:59 of the game week (Thursday game → Sunday +3 days 23:59)
const roundCloseDeadline = (gameDate: string): Date => {
  const d = new Date(gameDate + 'T12:00:00');
  d.setDate(d.getDate() + 3);
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  return iso.includes('T') ? iso.split('T')[1].substring(0, 5).replace(':', 'h') : '';
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
};

const SIDE_LABEL: Record<string, string> = { RIGHT: 'Direita', LEFT: 'Esquerda', EITHER: 'Ambos' };

// ── types ─────────────────────────────────────────────────────────────────────

interface PlayerSession {
  id_player: number;
  name: string;
  side: string;
  category_id?: number;
  whatsapp?: string;
  has_password?: boolean;
}

interface MatchHistory {
  id_match: number;
  scheduled_at: string | null;
  scheduled_date: string | null;
  court_name: string;
  status: string;
  partner_name: string | null;
  opponent_names: string | null;
  my_score: number | null;
  opp_score: number | null;
  won: boolean;
  player_score_a: number | null;
  player_score_b: number | null;
  player_score_submitted_by: number | null;
}

// ── component ─────────────────────────────────────────────────────────────────

const AtletaPage = () => {
  const navigate = useNavigate();
  const isAdmin = !!localStorage.getItem('userRole');
  const [motto] = useState(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);

  // Session
  const [session, setSession] = useState<PlayerSession | null>(() => {
    const s = localStorage.getItem('player_session');
    return s ? JSON.parse(s) : null;
  });

  // Login
  const [phone, setPhone] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [ambiguous, setAmbiguous] = useState<PlayerSession[]>([]);
  const [pendingPlayer, setPendingPlayer] = useState<PlayerSession | null>(null);
  const [password, setPassword] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  // Forgot-password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  // Main data
  const [tab, setTab] = useState<'semana' | 'historico'>('semana');
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Ranking
  const [rankingPos, setRankingPos] = useState<number | null>(null);
  const [rankingPoints, setRankingPoints] = useState<number>(0);
  const [rankingTotal, setRankingTotal] = useState<number>(0);
  const [categoryName, setCategoryName] = useState('');

  // Absence
  const [absenceStatus, setAbsenceStatus] = useState<'loading' | 'present' | 'absent'>('loading');
  const [declaringAbsence, setDeclaringAbsence] = useState(false);
  const [absenceFeedback, setAbsenceFeedback] = useState('');

  // Share / Stories
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<'success' | 'error' | null>(null);

  // Score forms
  const [scoreForm, setScoreForm] = useState<Record<number, { a: number; b: number; open: boolean }>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<Record<number, { ok?: boolean; error?: string }>>({});

  // Derived
  const thu = thisThursday();
  const thuDeadline = absenceDeadline(thu);
  const thuWindowOpen = absenceWindowOpen(thu);
  const now = new Date();
  const windowOpen = now >= thuWindowOpen && now < thuDeadline;
  const beforeWindow = now < thuWindowOpen;
  const thuFormatted = new Date(thu + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
  const thisWeekMatches = history.filter(m => m.scheduled_date === thu);
  const pastMatches = history
    .filter(m => m.scheduled_date && m.scheduled_date < thu)
    .sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''));
  const nextMatch = thisWeekMatches[0] || null;

  // ── data loaders ──────────────────────────────────────────────────────────────

  const loadAll = async (player: PlayerSession) => {
    setLoadingHistory(true);
    setAbsenceStatus('loading');

    await Promise.all([
      fetch(`${API_URL}/api/players/${player.id_player}/history`)
        .then(r => r.ok ? r.json() : [])
        .then((data: MatchHistory[]) => setHistory(data))
        .catch(() => {}),

      player.category_id
        ? fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/ranking/${player.category_id}`)
            .then(r => r.ok ? r.json() : [])
            .then((standings: Array<{ id_player: number; points: number }>) => {
              const idx = standings.findIndex(s => s.id_player === player.id_player);
              if (idx >= 0) {
                setRankingPos(idx + 1);
                setRankingPoints(standings[idx].points);
              }
              setRankingTotal(standings.length);
            })
            .catch(() => {})
        : Promise.resolve(),

      player.category_id
        ? fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/categories`)
            .then(r => r.ok ? r.json() : [])
            .then((cats: Array<{ id: number; name: string }>) => {
              const cat = cats.find(c => c.id === player.category_id);
              if (cat) setCategoryName(cat.name);
            })
            .catch(() => {})
        : Promise.resolve(),

      fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences?date=${thu}`)
        .then(r => r.ok ? r.json() : [])
        .then((absences: Array<{ id_player: number }>) => {
          setAbsenceStatus(absences.some(a => a.id_player === player.id_player) ? 'absent' : 'present');
        })
        .catch(() => setAbsenceStatus('present')),
    ]);

    setLoadingHistory(false);
  };

  useEffect(() => { if (session) loadAll(session); }, []);

  // ── login handlers ────────────────────────────────────────────────────────────

  const handleLookup = async () => {
    setLookupError(''); setAmbiguous([]); setAuthError(''); setPassword('');
    const input = phone.trim();
    if (!input) return;
    setLooking(true);
    try {
      const isEmail = input.includes('@');
      const url = isEmail
        ? `${API_URL}/api/players/lookup?email=${encodeURIComponent(input)}`
        : `${API_URL}/api/players/lookup?phone=${encodeURIComponent(input)}`;
      const res = await fetch(url);
      if (!res.ok) { setLookupError((await res.json()).error || 'Não encontrado'); return; }
      const data = await res.json();
      Array.isArray(data) ? setAmbiguous(data) : setPendingPlayer(data);
    } catch { setLookupError('Erro de conexão. Tente novamente.'); }
    finally { setLooking(false); }
  };

  const selectPlayer = (p: PlayerSession) => {
    setAmbiguous([]);
    setPendingPlayer(p);
    setPassword('');
    setAuthError('');
  };

  const handleAuthenticate = async () => {
    if (!pendingPlayer) return;
    setAuthError('');
    if (!password.trim()) { setAuthError('Informe sua senha'); return; }
    setAuthenticating(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/athlete/login-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_player: pendingPlayer.id_player, password }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Erro ao autenticar'); return; }
      const full: PlayerSession = {
        id_player: data.id_player,
        name: data.name,
        side: data.side,
        category_id: data.category_id,
        whatsapp: data.whatsapp,
      };
      setSession(full);
      localStorage.setItem('player_session', JSON.stringify(full));
      setPendingPlayer(null);
      setPassword('');
      loadAll(full);
    } catch { setAuthError('Erro de conexão. Tente novamente.'); }
    finally { setAuthenticating(false); }
  };

  const handleForgotPassword = async () => {
    setForgotMsg(null);
    if (!forgotEmail.includes('@')) { setForgotMsg({ ok: false, text: 'Informe um email válido.' }); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/athlete/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) setForgotMsg({ ok: true, text: `Nova senha enviada pelo WhatsApp ${data.whatsapp_masked}` });
      else setForgotMsg({ ok: false, text: data.error || 'Não foi possível resetar a senha.' });
    } catch { setForgotMsg({ ok: false, text: 'Erro de conexão.' }); }
    finally { setForgotLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('player_session');
    setSession(null);
    setHistory([]);
    setRankingPos(null);
    setAbsenceStatus('loading');
    setPendingPlayer(null);
    setPassword('');
    setPhone('');
  };

  // ── absence handlers ──────────────────────────────────────────────────────────

  const handleDeclareAbsence = async () => {
    if (!session) return;
    setDeclaringAbsence(true);
    try {
      const res = await fetch(`${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_player: session.id_player, absence_date: thu }),
      });
      if (res.ok) { setAbsenceStatus('absent'); setAbsenceFeedback('Ausência registrada com sucesso.'); }
      else { const d = await res.json(); setAbsenceFeedback(d.error || 'Erro ao registrar.'); }
    } catch { setAbsenceFeedback('Erro de conexão.'); }
    finally { setDeclaringAbsence(false); setTimeout(() => setAbsenceFeedback(''), 4000); }
  };

  const handleCancelAbsence = async () => {
    if (!session) return;
    setDeclaringAbsence(true);
    try {
      const res = await fetch(
        `${API_URL}/api/tournaments/${TOURNAMENT_ID}/absences/${session.id_player}?date=${thu}`,
        { method: 'DELETE' }
      );
      if (res.ok) { setAbsenceStatus('present'); setAbsenceFeedback('Você voltou para o sorteio!'); }
      else { const d = await res.json(); setAbsenceFeedback(d.error || 'Erro ao cancelar.'); }
    } catch { setAbsenceFeedback('Erro de conexão.'); }
    finally { setDeclaringAbsence(false); setTimeout(() => setAbsenceFeedback(''), 4000); }
  };

  // ── share handler ─────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!session) return;
    setSharing(true);
    setShareResult(null);
    const lastFinished = pastMatches.find(m => m.status === 'FINISHED') || null;
    try {
      const blob = await generateStoriesImage({
        name: session.name,
        categoryName,
        side: session.side,
        rankingPos,
        rankingTotal,
        rankingPoints,
        wins: pastMatches.filter(m => m.won && m.status === 'FINISHED').length,
        losses: pastMatches.filter(m => !m.won && m.status === 'FINISHED').length,
        lastMatch: lastFinished ? {
          won: lastFinished.won,
          my_score: lastFinished.my_score,
          opp_score: lastFinished.opp_score,
          partner_name: lastFinished.partner_name,
          opponent_names: lastFinished.opponent_names,
        } : null,
      });
      const file = new File([blob], 'ranking-srb-profile.png', { type: 'image/png' });
      const canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] });
      if (canShare) {
        await navigator.share({ files: [file], title: `${session.name} — Ranking Padel SRB 2026` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ranking-srb-stories.png'; a.click();
        URL.revokeObjectURL(url);
      }
      setShareResult('success');
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.name !== 'AbortError') setShareResult('error');
    } finally {
      setSharing(false);
      setTimeout(() => setShareResult(null), 4000);
    }
  };

  // ── score handler ─────────────────────────────────────────────────────────────

  const submitScore = async (match: MatchHistory) => {
    if (!session) return;
    const form = scoreForm[match.id_match];
    if (!form) return;
    setSubmitting(match.id_match);
    try {
      const res = await fetch(`${API_URL}/api/matches/${match.id_match}/submit-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_player: session.id_player, score_a: form.a, score_b: form.b }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitResult(prev => ({ ...prev, [match.id_match]: { ok: true } }));
        setScoreForm(prev => ({ ...prev, [match.id_match]: { ...prev[match.id_match], open: false } }));
        await loadAll(session);
      } else {
        setSubmitResult(prev => ({ ...prev, [match.id_match]: { error: data.error || 'Erro ao enviar' } }));
      }
    } catch {
      setSubmitResult(prev => ({ ...prev, [match.id_match]: { error: 'Erro de conexão' } }));
    } finally { setSubmitting(null); }
  };

  // ── sub-render: match card ────────────────────────────────────────────────────

  const renderMatchCard = (m: MatchHistory, compact = false) => {
    const time = formatTime(m.scheduled_at);
    const form = scoreForm[m.id_match];
    const result = submitResult[m.id_match];
    const submittedByMe = m.player_score_submitted_by === session!.id_player;
    const hasSubmission = m.player_score_a != null && m.player_score_b != null;
    const isFinished = m.status === 'FINISHED';
    const isWo = m.status === 'WO';
    const roundOpen = m.scheduled_date ? new Date() <= roundCloseDeadline(m.scheduled_date) : true;
    // Athletes can edit score from Thursday to Sunday — even after FINISHED by another player
    const canSubmit = !isWo && roundOpen;
    // A score counts for ranking when FINISHED or IN_PROGRESS with valid non-tie score
    const hasCountingScore = (isFinished || m.status === 'IN_PROGRESS')
      && m.my_score != null && m.opp_score != null
      && m.my_score !== m.opp_score;
    const earnedPts = isWo ? 0 : hasCountingScore ? (m.won ? 3 : 1) : null;

    if (compact) {
      return (
        <div key={m.id_match} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black text-zinc-500">{formatDate(m.scheduled_date)}</span>
            <div className="flex items-center gap-1.5">
              {hasCountingScore && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${m.won ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  {m.won ? '✓ VITÓRIA' : 'DERROTA'}
                </span>
              )}
              {earnedPts != null && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${earnedPts === 3 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : earnedPts === 1 ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                  {earnedPts > 0 ? `+${earnedPts}` : '0'} pts
                </span>
              )}
              {isWo && <span className="text-[9px] font-black text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">WO</span>}
            </div>
          </div>
          <p className="text-xs font-black text-white uppercase">{session!.name} / {m.partner_name || '—'}</p>
          <p className="text-[10px] text-zinc-500 uppercase">vs {m.opponent_names || '—'}</p>
          {hasCountingScore && (
            <p className={`text-2xl font-black ${m.won ? 'text-green-400' : 'text-white/50'}`}>
              {m.my_score} <span className="text-zinc-700">×</span> {m.opp_score}
            </p>
          )}
        </div>
      );
    }

    return (
      <div key={m.id_match} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {time && <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 shrink-0">{time}</span>}
            <span className="text-[10px] font-black text-zinc-500 uppercase truncate">{m.court_name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasCountingScore && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${m.won ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                {m.won ? '✓ VITÓRIA' : 'DERROTA'}
              </span>
            )}
            {earnedPts != null && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${earnedPts === 3 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : earnedPts === 1 ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                {earnedPts > 0 ? `+${earnedPts}` : '0'} pts
              </span>
            )}
            {isWo && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">WO</span>}
          </div>
        </div>

        <div className="space-y-1">
          <div>
            <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Sua dupla</p>
            <p className="font-black text-white text-sm uppercase leading-tight">{session!.name} / {m.partner_name || '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Adversários</p>
            <p className="font-bold text-zinc-400 text-sm uppercase leading-tight">{m.opponent_names || '—'}</p>
          </div>
        </div>

        {hasCountingScore && (
          <div className="flex items-center gap-3 pt-1">
            <span className={`text-3xl font-black ${m.won ? 'text-green-400' : 'text-white/60'}`}>{m.my_score}</span>
            <span className="text-zinc-600 font-black">×</span>
            <span className={`text-3xl font-black ${!m.won && m.opp_score! > m.my_score! ? 'text-green-400' : 'text-white/60'}`}>{m.opp_score}</span>
          </div>
        )}

        {canSubmit && hasSubmission && !form?.open && (
          <div className={`rounded-xl px-3 py-2 space-y-1 border ${submittedByMe ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle size={12} className={submittedByMe ? 'text-green-400' : 'text-amber-400'} />
              <p className={`text-[10px] font-black ${submittedByMe ? 'text-green-400' : 'text-amber-400'}`}>
                {submittedByMe ? 'Você enviou' : 'Placar enviado por outro atleta'}
              </p>
            </div>
            <p className="text-base font-black text-white">
              {m.player_score_a} × {m.player_score_b}
            </p>
            <p className="text-[10px] text-zinc-500">Aguardando validação do admin · editável até domingo 23:59</p>
          </div>
        )}

        {result?.ok && !form?.open && (
          <div className="flex items-center gap-2 text-[10px] font-black text-green-400">
            <CheckCircle size={12} /> Placar enviado! Aguardando validação.
          </div>
        )}

        {!canSubmit && !roundOpen && !isFinished && !isWo && hasSubmission && (
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 space-y-1">
            <p className="text-[10px] font-black text-zinc-400">Rodada encerrada</p>
            <p className="text-base font-black text-white">{m.player_score_a} × {m.player_score_b}</p>
            <p className="text-[10px] text-zinc-500">Alterações somente via admin</p>
          </div>
        )}

        {canSubmit && !result?.ok && (
          <>
            {!form?.open ? (
              <button
                onClick={() => setScoreForm(prev => ({ ...prev, [m.id_match]: { a: m.player_score_a ?? 0, b: m.player_score_b ?? 0, open: true } }))}
                className="w-full py-2.5 bg-green-400/10 hover:bg-green-400/20 text-green-400 border border-green-400/30 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                {hasSubmission ? 'Alterar Placar' : 'Enviar Placar'}
              </button>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-end gap-3 justify-center">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-1">Sua dupla</p>
                    <input
                      type="number" min="0" max="9" value={form.a}
                      onChange={e => setScoreForm(prev => ({ ...prev, [m.id_match]: { ...prev[m.id_match], a: Math.max(0, Math.min(9, +e.target.value || 0)) } }))}
                      className="w-16 h-14 bg-white/10 border-2 border-green-400/50 rounded-xl text-center text-2xl font-black text-white focus:border-green-400 outline-none"
                    />
                  </div>
                  <span className="text-zinc-600 font-black text-2xl pb-1">×</span>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Adversários</p>
                    <input
                      type="number" min="0" max="9" value={form.b}
                      onChange={e => setScoreForm(prev => ({ ...prev, [m.id_match]: { ...prev[m.id_match], b: Math.max(0, Math.min(9, +e.target.value || 0)) } }))}
                      className="w-16 h-14 bg-white/10 border-2 border-white/20 rounded-xl text-center text-2xl font-black text-white focus:border-white/40 outline-none"
                    />
                  </div>
                </div>
                {result?.error && <p className="text-red-400 text-xs font-bold text-center">{result.error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setScoreForm(prev => ({ ...prev, [m.id_match]: { ...prev[m.id_match], open: false } }))}
                    className="flex-1 py-2.5 bg-white/5 text-zinc-500 rounded-xl text-xs font-black uppercase border border-white/10 flex items-center justify-center gap-1"
                  >
                    <X size={11} /> Cancelar
                  </button>
                  <button
                    onClick={() => submitScore(m)} disabled={submitting === m.id_match}
                    className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 text-black rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 transition-all"
                  >
                    {submitting === m.id_match ? 'Enviando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ── sub-render: absence card ──────────────────────────────────────────────────

  const renderAbsenceCard = () => {
    const isLoading = absenceStatus === 'loading';
    const isAbsent = absenceStatus === 'absent';

    // Antes da janela (antes de sexta 00:01) — readonly informativo
    if (beforeWindow) {
      return (
        <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
              <Clock size={16} className="text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Declaração abre sexta 00h01</p>
              <p className="text-sm font-black text-white capitalize truncate">{thuFormatted}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Até lá, você entra automaticamente no sorteio</p>
            </div>
          </div>
        </div>
      );
    }

    // Prazo encerrado (após segunda 18h) — readonly
    if (!windowOpen) {
      return (
        <div className={`rounded-3xl p-5 border ${isAbsent ? 'bg-zinc-900 border-red-500/20' : 'bg-slate-900/60 border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isAbsent ? 'bg-red-500/10' : 'bg-white/5'}`}>
              <Clock size={16} className={isAbsent ? 'text-red-400' : 'text-zinc-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black uppercase tracking-widest ${isAbsent ? 'text-red-400' : 'text-zinc-500'}`}>
                {isAbsent ? 'Ausência declarada' : 'Prazo encerrado'}
              </p>
              <p className="text-sm font-black text-white capitalize truncate">{thuFormatted}</p>
              {isAbsent && <p className="text-[10px] text-zinc-500 mt-0.5">Você não está no sorteio desta semana</p>}
            </div>
            <span className={`shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full border ${isAbsent ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
              {isAbsent ? 'FORA' : 'NO SORTEIO'}
            </span>
          </div>
        </div>
      );
    }

    // Ausência já declarada — pode cancelar
    if (isAbsent) {
      return (
        <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-500/15 rounded-2xl flex items-center justify-center shrink-0">
              <X size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-xs font-black text-red-400 uppercase tracking-widest">Ausência declarada</p>
              <p className="text-sm font-black text-white capitalize">{thuFormatted}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Você não entrará no sorteio desta semana</p>
            </div>
          </div>
          {absenceFeedback && <p className="text-xs font-bold text-green-400">{absenceFeedback}</p>}
          <button
            onClick={handleCancelAbsence} disabled={declaringAbsence}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all disabled:opacity-50"
          >
            {declaringAbsence ? 'Processando...' : 'Afinal vou jogar — cancelar ausência'}
          </button>
        </div>
      );
    }

    // Presente (ou carregando) + prazo aberto — estado principal
    return (
      <div className={`rounded-3xl p-5 space-y-4 border transition-all ${isLoading ? 'bg-white/[0.03] border-white/5' : 'bg-amber-950/50 border-amber-500/25'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isLoading ? 'bg-white/5' : 'bg-amber-500/20'}`}>
            <AlertTriangle size={16} className={isLoading ? 'text-zinc-600 animate-pulse' : 'text-amber-400'} />
          </div>
          <div className="flex-1">
            <p className={`text-xs font-black uppercase tracking-widest ${isLoading ? 'text-zinc-600' : 'text-amber-400'}`}>
              {isLoading ? 'Verificando status...' : 'Confirme sua presença'}
            </p>
            <p className="text-sm font-black text-white capitalize">{thuFormatted}</p>
            {!isLoading && (
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Declare ausência até <span className="text-white font-black">segunda 18h</span> para não levar WO
              </p>
            )}
          </div>
        </div>

        {!isLoading && (
          <>
            {absenceFeedback && <p className="text-xs font-bold text-green-400">{absenceFeedback}</p>}
            <div className="grid grid-cols-2 gap-3">
              {/* Present — static indicator (already assumed present) */}
              <div className="h-14 bg-green-500/10 border-2 border-green-500/30 rounded-2xl flex items-center justify-center gap-2 cursor-default">
                <CheckCircle size={15} className="text-green-400" />
                <span className="text-xs font-black text-green-400 uppercase tracking-wide">Vou jogar</span>
              </div>
              {/* Absent — action button */}
              <button
                onClick={handleDeclareAbsence} disabled={declaringAbsence}
                className="h-14 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/20 hover:border-red-500/40 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <X size={15} className="text-red-400" />
                <span className="text-xs font-black text-red-400 uppercase tracking-wide">
                  {declaringAbsence ? 'Registrando...' : 'Não posso ir'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── login screen ──────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col" style={{ fontFamily: 'Chakra Petch, sans-serif' }}>
        <style>{FONTS}</style>

        <div className="relative flex-1 flex flex-col items-center justify-center p-6 gap-8 overflow-hidden">
          {/* Court grid background */}
          <div className="absolute inset-0 opacity-[0.035]" style={{
            backgroundImage: `linear-gradient(rgba(74,222,128,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(74,222,128,1) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-72 rounded-full border border-green-400/[0.06]" />
            <div className="absolute w-36 h-36 rounded-full border border-green-400/[0.06]" />
          </div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-400/[0.06]" />

          {/* Brand */}
          <div className="relative text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-400/10 border border-green-400/20 rounded-3xl mb-4">
              <Trophy size={28} className="text-green-400" />
            </div>
            <h1
              className="text-4xl font-black uppercase tracking-tight text-white"
              style={{ fontFamily: 'Russo One, sans-serif' }}
            >
              RANKING PADEL
            </h1>
            <div
              className="inline-block bg-green-400 text-black font-black text-sm px-4 py-1 rounded-full uppercase tracking-widest"
              style={{ fontFamily: 'Russo One, sans-serif' }}
            >
              SRB 2026
            </div>
            <p className="text-zinc-500 text-sm mt-3">Área do Atleta</p>
          </div>

          {/* Login card */}
          <div className="relative w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-3xl p-8 space-y-6 backdrop-blur-sm">
            {pendingPlayer ? (
              <>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">Sua senha</h2>
                  <p className="text-green-400 text-xs mt-1 font-bold">Olá, {pendingPlayer.name.split(' ')[0]}</p>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="password" placeholder="Senha cadastrada"
                      autoFocus
                      value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAuthenticate()}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-zinc-600 focus:border-green-400/60 focus:bg-white/[0.07] focus:outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  {authError && <p className="text-red-400 text-xs font-bold">{authError}</p>}
                  <button
                    onClick={handleAuthenticate} disabled={authenticating}
                    className="w-full bg-green-400 hover:bg-green-300 active:scale-95 text-black font-black uppercase tracking-widest rounded-2xl py-4 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {authenticating ? 'Entrando...' : <><span>Entrar</span><ChevronRight size={16} /></>}
                  </button>
                  <button
                    onClick={() => { setPendingPlayer(null); setPassword(''); setAuthError(''); }}
                    className="w-full text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    ← Trocar número
                  </button>
                </div>
              </>
            ) : ambiguous.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Selecione seu nome:</p>
                {ambiguous.map(p => (
                  <button
                    key={p.id_player} onClick={() => selectPlayer(p)}
                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-green-400/30 transition-all group"
                  >
                    <p className="font-black text-white text-sm group-hover:text-green-400 transition-colors">{p.name}</p>
                    <p className="text-xs text-zinc-500">{SIDE_LABEL[p.side] || p.side}</p>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">Área do Atleta</h2>
                  <p className="text-zinc-500 text-xs mt-1">Informe seu e-mail ou WhatsApp cadastrado</p>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="text" placeholder="email@exemplo.com ou (51) 9 9999-9999"
                      inputMode="text" autoComplete="username"
                      value={phone} onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-zinc-600 focus:border-green-400/60 focus:bg-white/[0.07] focus:outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  {lookupError && <p className="text-red-400 text-xs font-bold">{lookupError}</p>}
                  <button
                    onClick={handleLookup} disabled={looking}
                    className="w-full bg-green-400 hover:bg-green-300 active:scale-95 text-black font-black uppercase tracking-widest rounded-2xl py-4 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {looking ? 'Buscando...' : <><span>Entrar</span><ChevronRight size={16} /></>}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setForgotOpen(o => !o); setForgotMsg(null); }}
                    className="w-full text-zinc-500 hover:text-green-400 text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Esqueci minha senha
                  </button>

                  {forgotOpen && (
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <input
                        type="email" placeholder="Email cadastrado"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:border-green-400/60 focus:outline-none text-sm font-bold"
                      />
                      <button
                        onClick={handleForgotPassword} disabled={forgotLoading}
                        className="w-full bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest rounded-xl py-3 text-[11px] disabled:opacity-50"
                      >
                        {forgotLoading ? 'Enviando...' : 'Enviar nova senha por WhatsApp'}
                      </button>
                      {forgotMsg && (
                        <p className={`text-xs font-bold ${forgotMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                          {forgotMsg.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={() => navigate('/jogos')}
              className="relative flex items-center gap-2 text-zinc-600 hover:text-white text-xs font-black uppercase tracking-widest transition-all"
            >
              <ArrowLeft size={14} /> Painel Admin
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── dashboard ─────────────────────────────────────────────────────────────────

  const wins = pastMatches.filter(m => m.won && m.status === 'FINISHED').length;
  const losses = pastMatches.filter(m => !m.won && m.status === 'FINISHED').length;
  const firstName = session.name.split(' ')[0];
  const lastName = session.name.split(' ').slice(1).join(' ');

  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: 'Chakra Petch, sans-serif' }}>
      <style>{FONTS}</style>

      {/* ── Sticky top bar ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-black/70 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-green-400" />
          <span className="font-black text-sm uppercase tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
            RANKING PADEL <span className="text-green-400">SRB</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate('/jogos')}
              className="flex items-center gap-1.5 text-[10px] font-black text-zinc-500 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-xl transition-all uppercase"
            >
              <ArrowLeft size={10} /> Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-[10px] font-black text-zinc-600 hover:text-red-400 uppercase tracking-widest transition-all"
          >
            Sair
          </button>
        </div>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: '272px' }}>
        {/* Real padel photo — same as landing page */}
        <img
          src={`${import.meta.env.BASE_URL}padel_action_hero_premium_1775612634488.png`}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
          style={{ opacity: 0.18 }}
        />
        {/* Dark overlay to keep text readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/30" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(74,222,128,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
        {/* Bottom fade to bg */}
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-slate-950 to-transparent" />
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/40 to-transparent" />

        {/* Athlete name content */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-5 bg-green-400" />
            <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.22em]">{motto}</p>
          </div>
          <h1
            className="text-[42px] font-black uppercase leading-none tracking-tight text-white"
            style={{ fontFamily: 'Russo One, sans-serif' }}
          >
            {firstName}
          </h1>
          {lastName && (
            <p
              className="text-xl font-black text-white/60 uppercase tracking-wider -mt-1"
              style={{ fontFamily: 'Russo One, sans-serif' }}
            >
              {lastName}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            {categoryName && (
              <span className="text-[10px] font-black bg-white/10 text-zinc-300 px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-widest">
                {categoryName}
              </span>
            )}
            <span className="text-[10px] font-black bg-green-400/10 text-green-400 px-2.5 py-1 rounded-full border border-green-400/20 uppercase tracking-widest">
              {SIDE_LABEL[session.side] || session.side}
            </span>
          </div>
        </div>

        {/* Win/loss badges — top right */}
        {(wins + losses) > 0 && (
          <div className="absolute top-4 right-4 flex gap-2">
            <div className="bg-green-500/15 border border-green-500/25 rounded-2xl px-3 py-2 text-center">
              <p className="text-xl font-black text-green-400 leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>{wins}</p>
              <p className="text-[8px] font-black text-green-600 uppercase tracking-widest">vitórias</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/15 rounded-2xl px-3 py-2 text-center">
              <p className="text-xl font-black text-red-400/70 leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>{losses}</p>
              <p className="text-[8px] font-black text-red-600/60 uppercase tracking-widest">derrotas</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-24 space-y-4 max-w-lg mx-auto">

        {/* Presence card */}
        {renderAbsenceCard()}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Ranking */}
          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 flex flex-col gap-1" style={{ minHeight: '130px' }}>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-orange-400" />
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ranking</p>
            </div>
            {rankingPos != null ? (
              <>
                <p
                  className="text-5xl font-black leading-tight mt-1"
                  style={{
                    fontFamily: 'Russo One, sans-serif',
                    color: rankingPos === 1 ? '#F97316' : rankingPos <= 3 ? '#60A5FA' : '#ffffff',
                  }}
                >
                  #{rankingPos}
                </p>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">de {rankingTotal} atletas</p>
                <p className="text-sm font-black text-green-400 mt-auto">
                  {rankingPoints} <span className="text-[10px] text-zinc-600 font-bold">pts</span>
                </p>
              </>
            ) : loadingHistory ? (
              <p className="text-zinc-700 font-black text-xs uppercase tracking-widest animate-pulse mt-2">Carregando</p>
            ) : (
              <>
                <p className="text-4xl font-black text-zinc-700 mt-1" style={{ fontFamily: 'Russo One, sans-serif' }}>—</p>
                <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">Sem jogos ainda</p>
              </>
            )}
          </div>

          {/* This week's game */}
          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 flex flex-col gap-1" style={{ minHeight: '130px' }}>
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-blue-400" />
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Esta quinta</p>
            </div>
            {nextMatch ? (
              <>
                <p
                  className="text-4xl font-black text-blue-400 leading-tight mt-1"
                  style={{ fontFamily: 'Russo One, sans-serif' }}
                >
                  {formatTime(nextMatch.scheduled_at) || '?h'}
                </p>
                {nextMatch.partner_name && (
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-wider">
                    com {nextMatch.partner_name.split(' ')[0]}
                  </p>
                )}
                {nextMatch.opponent_names && (
                  <p className="text-[9px] font-black text-zinc-500 uppercase leading-tight mt-auto">
                    vs {nextMatch.opponent_names.replace(' / ', '/').split('/').map(n => n.trim().split(' ')[0]).join(' / ')}
                  </p>
                )}
              </>
            ) : loadingHistory ? (
              <p className="text-zinc-700 font-black text-xs uppercase tracking-widest animate-pulse mt-2">Carregando</p>
            ) : (
              <>
                <p className="text-4xl font-black text-zinc-700 mt-1" style={{ fontFamily: 'Russo One, sans-serif' }}>—</p>
                <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">Sem jogo</p>
              </>
            )}
          </div>
        </div>

        {/* Share row */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="h-12 bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-green-300 text-black font-black uppercase tracking-wider rounded-2xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
          >
            {sharing ? (
              <span className="animate-pulse text-[10px]">Gerando...</span>
            ) : shareResult === 'success' ? (
              <><CheckCircle size={14} /> Compartilhado!</>
            ) : (
              <><Share2 size={14} /> Stories</>
            )}
          </button>
          <a
            href={`/ranking-srb/perfil/${session.id_player}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-zinc-300 font-black uppercase tracking-wider rounded-2xl text-xs transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} /> Meu perfil
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 -mx-4 px-4 gap-1">
          <button
            onClick={() => setTab('semana')}
            className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${tab === 'semana' ? 'text-green-400 border-green-400' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}
          >
            Esta Quinta {thisWeekMatches.length > 0 && `(${thisWeekMatches.length})`}
          </button>
          <button
            onClick={() => setTab('historico')}
            className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-1.5 ${tab === 'historico' ? 'text-green-400 border-green-400' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}
          >
            <History size={11} /> Histórico {pastMatches.length > 0 && `(${pastMatches.length})`}
          </button>
        </div>

        {/* Tab content */}
        <div className="space-y-3">
          {loadingHistory ? (
            <div className="py-12 text-center text-zinc-600 font-black uppercase tracking-widest text-xs animate-pulse">Carregando...</div>
          ) : tab === 'semana' ? (
            thisWeekMatches.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-white/[0.03] border border-white/5 rounded-3xl mx-auto flex items-center justify-center">
                  <Clock size={22} className="text-zinc-700" />
                </div>
                <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">Nenhum jogo para esta quinta</p>
                <p className="text-zinc-700 text-[10px]">Sorteio acontece no início da semana</p>
              </div>
            ) : (
              thisWeekMatches.map(m => renderMatchCard(m))
            )
          ) : (
            pastMatches.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-white/[0.03] border border-white/5 rounded-3xl mx-auto flex items-center justify-center">
                  <Star size={20} className="text-zinc-700" />
                </div>
                <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">Histórico vazio</p>
                <p className="text-zinc-700 text-[10px] mt-0.5">Seus jogos passados aparecem aqui</p>
              </div>
            ) : (
              pastMatches.map(m => renderMatchCard(m, true))
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default AtletaPage;
