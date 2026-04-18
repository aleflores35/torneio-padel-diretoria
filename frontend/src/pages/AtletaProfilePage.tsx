import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Share2, Download, CheckCircle, X, ExternalLink } from 'lucide-react';
import API_URL from '../config';
import { generateStoriesImage } from '../utils/generateStoriesImage';

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@400;600;700&display=swap');
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
@keyframes slideRight {
  from { transform: scaleX(0); } to { transform: scaleX(1); }
}
.anim-up-1 { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
.anim-up-2 { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
.anim-up-3 { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
.anim-up-4 { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s both; }
.anim-up-5 { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.45s both; }
.anim-fade  { animation: fadeIn  0.8s ease 0.1s both; }
.glass {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.08);
}
.glass-green {
  background: rgba(74,222,128,0.07);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(74,222,128,0.18);
}
`;

const SIDE_LABEL: Record<string, string> = { RIGHT: 'Direita', LEFT: 'Esquerda', EITHER: 'Ambos' };

interface Profile {
  id_player: number;
  name: string;
  side: string;
  category_name: string;
  ranking_pos: number | null;
  ranking_points: number;
  ranking_total: number;
  wins: number;
  losses: number;
  last_match: {
    won: boolean;
    my_score: number | null;
    opp_score: number | null;
    partner_name: string | null;
    opponent_names: string | null;
    scheduled_date: string | null;
  } | null;
}

export const AtletaProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    fetch(`${API_URL}/api/players/${id}/profile`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async (download = false) => {
    if (!profile) return;
    setSharing(true); setShareResult(null);
    try {
      const blob = await generateStoriesImage({
        name: profile.name, categoryName: profile.category_name, side: profile.side,
        rankingPos: profile.ranking_pos, rankingTotal: profile.ranking_total,
        rankingPoints: profile.ranking_points, wins: profile.wins, losses: profile.losses,
        lastMatch: profile.last_match,
      });
      const file = new File([blob], 'ranking-srb.png', { type: 'image/png' });
      if (!download && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${profile.name} — Ranking Padel SRB 2026` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `ranking-srb-${profile.name.replace(/\s+/g,'-').toLowerCase()}.png`;
        a.click(); URL.revokeObjectURL(url);
      }
      setShareResult('success');
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.name !== 'AbortError') setShareResult('error');
    } finally {
      setSharing(false);
      setTimeout(() => setShareResult(null), 3500);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050d18] flex items-center justify-center">
      <style>{FONTS}</style>
      <div className="space-y-3 text-center">
        <div className="w-10 h-10 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mx-auto" />
        <p className="text-zinc-600 font-black uppercase tracking-widest text-[10px]">Carregando perfil</p>
      </div>
    </div>
  );

  if (notFound || !profile) return (
    <div className="min-h-screen bg-[#050d18] flex flex-col items-center justify-center gap-5 p-8 text-center">
      <style>{FONTS}</style>
      <p className="text-white font-black text-2xl uppercase" style={{ fontFamily: 'Russo One, sans-serif' }}>Atleta não encontrado</p>
      <Link to="/ranking" className="text-xs font-black text-green-400 uppercase tracking-widest">Ver Ranking →</Link>
    </div>
  );

  const { name, side, category_name, ranking_pos, ranking_points, ranking_total, wins, losses, last_match } = profile;
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ');
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : null;
  const rankColor = ranking_pos === 1 ? '#f97316' : ranking_pos != null && ranking_pos <= 3 ? '#60a5fa' : '#ffffff';

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#050d18', fontFamily: 'Chakra Petch, sans-serif' }}>
      <style>{FONTS}</style>

      {/* ── Sticky nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(5,13,24,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-green-400" />
          <span className="font-black text-sm uppercase tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
            RANKING PADEL <span className="text-green-400">SRB</span>
          </span>
        </div>
        <Link to="/ranking" className="text-[10px] font-black text-zinc-500 hover:text-green-400 uppercase tracking-widest transition-colors">
          Ranking →
        </Link>
      </nav>

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ minHeight: '100svh' }}>

        {/* Background image */}
        <img src={`${import.meta.env.BASE_URL}padel_action_hero_premium_1775612634488.png`}
          alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
          style={{ opacity: 0.12 }} />

        {/* Layered overlays for depth */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(5,13,24,0.98) 0%, rgba(5,13,24,0.85) 40%, rgba(5,13,24,0.6) 70%, rgba(5,13,24,0.4) 100%)',
        }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-48"
          style={{ background: 'linear-gradient(to top, #050d18, transparent)' }} />

        {/* Court grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(74,222,128,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.04) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />

        {/* "SRB" giant watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="anim-fade font-black text-white/[0.025]"
            style={{ fontFamily: 'Russo One, sans-serif', fontSize: 'clamp(200px, 50vw, 520px)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            SRB
          </span>
        </div>

        {/* Glow top-right */}
        <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

        {/* Content */}
        <div className="relative flex flex-col justify-end px-6 pb-10 pt-28" style={{ minHeight: '100svh' }}>

          {/* Category + side pills */}
          <div className="anim-up-1 flex items-center gap-2 mb-5">
            <div className="h-px w-6" style={{ background: '#4ade80' }} />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-green-400">Perfil do Atleta</span>
          </div>

          {/* Name */}
          <h1 className="anim-up-2 font-black uppercase leading-none tracking-tight"
            style={{ fontFamily: 'Russo One, sans-serif', fontSize: 'clamp(52px, 14vw, 96px)', lineHeight: 0.92 }}>
            {firstName}
          </h1>
          {lastName && (
            <p className="anim-up-3 font-black uppercase tracking-wide mt-1"
              style={{ fontFamily: 'Russo One, sans-serif', fontSize: 'clamp(26px, 6vw, 48px)', color: 'rgba(255,255,255,0.45)' }}>
              {lastName}
            </p>
          )}

          {/* Tags */}
          <div className="anim-up-3 flex flex-wrap items-center gap-2 mt-4">
            {category_name && (
              <span className="glass text-[10px] font-black px-3 py-1.5 rounded-full text-zinc-300 uppercase tracking-widest">
                {category_name}
              </span>
            )}
            <span className="glass-green text-[10px] font-black px-3 py-1.5 rounded-full text-green-400 uppercase tracking-widest">
              {SIDE_LABEL[side] || side}
            </span>
          </div>

          {/* ── RANKING POSITION — dominant stat ── */}
          <div className="anim-up-4 mt-10">
            <div className="glass rounded-3xl p-6 relative overflow-hidden max-w-sm"
              style={{ boxShadow: `0 0 60px rgba(74,222,128,0.06), 0 20px 40px rgba(0,0,0,0.4)` }}>
              {/* Glow bleed behind number */}
              <div className="absolute -top-10 -left-10 w-56 h-56 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${rankColor}18 0%, transparent 65%)` }} />

              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Posição no ranking</p>
              <div className="flex items-end gap-4">
                <span className="font-black leading-none"
                  style={{ fontFamily: 'Russo One, sans-serif', fontSize: 'clamp(72px, 20vw, 120px)', color: rankColor,
                    textShadow: `0 0 40px ${rankColor}50` }}>
                  {ranking_pos != null ? `#${ranking_pos}` : '—'}
                </span>
                <div className="pb-3 space-y-0.5">
                  <p className="font-black text-green-400" style={{ fontFamily: 'Russo One, sans-serif', fontSize: 28 }}>
                    {ranking_points} <span className="text-[12px] text-zinc-600 font-bold">pts</span>
                  </p>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">de {ranking_total} atletas</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="anim-up-5 flex gap-3 mt-4">
            <div className="glass rounded-2xl px-5 py-4 flex-1 text-center" style={{ boxShadow: '0 8px 32px rgba(74,222,128,0.06)' }}>
              <p className="font-black text-green-400" style={{ fontFamily: 'Russo One, sans-serif', fontSize: 36 }}>{wins}</p>
              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mt-0.5">Vitórias</p>
            </div>
            <div className="glass rounded-2xl px-5 py-4 flex-1 text-center">
              <p className="font-black text-red-400/70" style={{ fontFamily: 'Russo One, sans-serif', fontSize: 36 }}>{losses}</p>
              <p className="text-[9px] font-black text-red-700 uppercase tracking-widest mt-0.5">Derrotas</p>
            </div>
            {winRate != null && (
              <div className="glass rounded-2xl px-5 py-4 flex-1 text-center">
                <p className="font-black text-white" style={{ fontFamily: 'Russo One, sans-serif', fontSize: 36 }}>{winRate}%</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">Aproveit.</p>
              </div>
            )}
          </div>

          {/* ── Last match ── */}
          {last_match && (
            <div className="anim-up-5 mt-3">
              <div className={`rounded-2xl p-4 border ${last_match.won
                ? 'border-green-500/20 bg-green-500/[0.06]'
                : 'border-red-500/15 bg-red-500/[0.04]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Última partida</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${last_match.won
                    ? 'text-green-400 border-green-500/30 bg-green-500/15'
                    : 'text-red-400 border-red-500/20 bg-red-500/10'}`}>
                    {last_match.won ? 'VITÓRIA' : 'DERROTA'}
                  </span>
                </div>
                {last_match.my_score != null && (
                  <p className="font-black leading-none mb-2"
                    style={{ fontFamily: 'Russo One, sans-serif', fontSize: 40,
                      color: last_match.won ? '#4ade80' : 'rgba(255,255,255,0.45)' }}>
                    {last_match.my_score}
                    <span className="text-zinc-700 mx-2" style={{ fontSize: 24 }}>×</span>
                    {last_match.opp_score}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {last_match.partner_name && (
                    <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">
                      com {last_match.partner_name}
                    </p>
                  )}
                  {last_match.opponent_names && (
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      vs {last_match.opponent_names}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Share CTA ── */}
          <div className="anim-up-5 mt-5 space-y-2.5">
            <button onClick={() => handleShare(false)} disabled={sharing}
              className="relative w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm text-black overflow-hidden transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
                boxShadow: '0 0 40px rgba(74,222,128,0.3), 0 8px 24px rgba(0,0,0,0.4)' }}>
              {/* Shimmer */}
              <span className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)',
                  animation: 'slideRight 2.5s ease-in-out infinite', transformOrigin: 'left' }} />
              <span className="relative flex items-center justify-center gap-2">
                {sharing ? <span className="animate-pulse">Gerando card...</span>
                  : shareResult === 'success' ? <><CheckCircle size={16} /> Compartilhado!</>
                  : shareResult === 'error' ? <><X size={16} /> Erro — tente novamente</>
                  : <><Share2 size={16} /> Compartilhar no Stories</>}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); }}
                className="h-11 glass rounded-xl text-[10px] font-black text-zinc-400 uppercase tracking-widest transition-all hover:border-white/20 flex items-center justify-center gap-1.5">
                <ExternalLink size={12} /> Copiar link
              </button>
              <button onClick={() => handleShare(true)}
                className="h-11 glass rounded-xl text-[10px] font-black text-zinc-500 uppercase tracking-widest transition-all hover:border-white/20 flex items-center justify-center gap-1.5">
                <Download size={12} /> Baixar PNG
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center space-y-1">
            <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">RANKING PADEL SRB © 2026</p>
            <Link to="/" className="text-[10px] text-zinc-700 hover:text-green-400 font-black uppercase tracking-widest transition-colors">
              Quero participar →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AtletaProfilePage;
