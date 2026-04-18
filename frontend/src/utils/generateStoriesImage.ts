/**
 * Generates a 1080×1920 Instagram Stories card for the athlete's profile.
 * Returns a PNG blob ready for navigator.share() or download.
 *
 * Design: Premium sports card — dark cinematic + giant SRB watermark +
 * dominant ranking number with colored light bloom.
 */

export interface StoriesData {
  name: string;
  categoryName: string;
  side?: string;
  rankingPos: number | null;
  rankingTotal: number;
  rankingPoints: number;
  wins: number;
  losses: number;
  lastMatch: {
    won: boolean;
    my_score: number | null;
    opp_score: number | null;
    partner_name: string | null;
    opponent_names: string | null;
  } | null;
}

const W = 1080;
const H = 1920;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function loadFonts(): Promise<void> {
  return new Promise(resolve => {
    // Check if fonts already loaded
    if (document.querySelector('link[data-stories-fonts]')) {
      setTimeout(resolve, 100);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('data-stories-fonts', '1');
    link.href = 'https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@400;600;700&display=swap';
    link.onload = () => setTimeout(resolve, 300);
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

// Rank accent color: gold for #1, electric blue for top 3, bright white otherwise
function rankColor(pos: number | null): string {
  if (pos === null) return '#ffffff';
  if (pos === 1)    return '#FFB800';  // Gold
  if (pos <= 3)     return '#38BDFF';  // Electric blue
  return '#ffffff';
}

// Glow RGB for radial bloom
function rankGlowRGB(pos: number | null): string {
  if (pos === null) return '255,255,255';
  if (pos === 1)    return '255,184,0';
  if (pos <= 3)     return '56,189,255';
  return '74,222,128';
}

export async function generateStoriesImage(data: StoriesData): Promise<Blob> {
  await loadFonts();

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── 1. BASE BACKGROUND ────────────────────────────────────────────────────────
  // Deep cinematic dark — not flat black, slightly warm
  const baseBg = ctx.createLinearGradient(0, 0, W, H);
  baseBg.addColorStop(0,   '#07080f');
  baseBg.addColorStop(0.45, '#0b0f1c');
  baseBg.addColorStop(1,   '#040609');
  ctx.fillStyle = baseBg;
  ctx.fillRect(0, 0, W, H);

  // Subtle diagonal texture stripes (speed lines)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.018)';
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 55) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H * 0.6, H);
    ctx.stroke();
  }
  ctx.restore();

  // ── 2. GIANT "SRB" WATERMARK ─────────────────────────────────────────────────
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  ctx.rotate(-0.10);  // slight tilt for dynamism
  ctx.font = '900 680px "Russo One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  ctx.fillText('SRB', 0, 0);
  ctx.restore();

  // ── 3. RANK BLOOM (light behind the number) ───────────────────────────────────
  const glowRGB  = rankGlowRGB(data.rankingPos);
  const bloomY   = H * 0.52;

  // Outer large bloom
  const bloom1 = ctx.createRadialGradient(W / 2, bloomY, 0, W / 2, bloomY, 560);
  bloom1.addColorStop(0,   `rgba(${glowRGB},0.13)`);
  bloom1.addColorStop(0.5, `rgba(${glowRGB},0.05)`);
  bloom1.addColorStop(1,   `rgba(${glowRGB},0)`);
  ctx.fillStyle = bloom1;
  ctx.fillRect(0, 0, W, H);

  // Inner tight bloom
  const bloom2 = ctx.createRadialGradient(W / 2, bloomY, 0, W / 2, bloomY, 220);
  bloom2.addColorStop(0,   `rgba(${glowRGB},0.22)`);
  bloom2.addColorStop(1,   `rgba(${glowRGB},0)`);
  ctx.fillStyle = bloom2;
  ctx.fillRect(0, 0, W, H);

  // ── 4. TOP BAR ───────────────────────────────────────────────────────────────
  // Green accent line at top
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0,   '#4ade80');
  accentGrad.addColorStop(0.5, '#22d3ee');
  accentGrad.addColorStop(1,   '#4ade80');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 6);

  // Top bar glass
  const topBarGrad = ctx.createLinearGradient(0, 6, 0, 140);
  topBarGrad.addColorStop(0,   'rgba(255,255,255,0.05)');
  topBarGrad.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 6, W, 134);

  // "RANKING PADEL" label
  ctx.save();
  ctx.textBaseline = 'middle';

  // Left: green circle dot
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(76, 73, 14, 0, Math.PI * 2);
  ctx.fill();

  // "RANKING PADEL"
  ctx.font = 'bold 32px "Chakra Petch", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'left';
  ctx.fillText('RANKING PADEL', 110, 62);

  // "SRB 2026" in green
  ctx.font = '700 32px "Chakra Petch", sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.fillText('SRB 2026', 110, 96);

  // Right: category pill
  const catText = data.categoryName.toUpperCase();
  ctx.font = 'bold 26px "Chakra Petch", sans-serif';
  const catW = ctx.measureText(catText).width + 44;
  roundRect(ctx, W - catW - 48, 46, catW, 54, 27);
  ctx.fillStyle = 'rgba(74,222,128,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74,222,128,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#4ade80';
  ctx.textAlign = 'center';
  ctx.fillText(catText, W - catW / 2 - 48, 73);

  ctx.restore();

  // ── 5. ATHLETE NAME ───────────────────────────────────────────────────────────
  const nameParts = data.name.toUpperCase().split(' ');
  const firstName = nameParts[0];
  const lastName  = nameParts.slice(1).join(' ');

  // Horizontal accent line before name
  const nameLineGrad = ctx.createLinearGradient(60, 0, 500, 0);
  nameLineGrad.addColorStop(0,   '#4ade80');
  nameLineGrad.addColorStop(1,   'rgba(74,222,128,0)');
  ctx.fillStyle = nameLineGrad;
  ctx.fillRect(60, 188, 420, 3);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // First name — massive white
  ctx.font = '900 170px "Russo One", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(firstName, 60, 380);

  // Last name — dimmer, slightly smaller
  if (lastName) {
    ctx.font = '900 96px "Russo One", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.fillText(lastName, 64, 490);
  }

  ctx.restore();

  // ── 6. SIDE PILL ─────────────────────────────────────────────────────────────
  if (data.side) {
    const sideLabel: Record<string, string> = { RIGHT: 'DIREITA', LEFT: 'ESQUERDA', EITHER: 'AMBOS' };
    const sideText = sideLabel[data.side] || data.side;
    ctx.save();
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    const sw = ctx.measureText(sideText).width + 40;
    const sy = lastName ? 530 : 460;
    roundRect(ctx, 64, sy, sw, 50, 25);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(sideText, 84, sy + 25);
    ctx.restore();
  }

  // ── 7. DOMINANT RANKING NUMBER ────────────────────────────────────────────────
  const posColor = rankColor(data.rankingPos);
  const posText  = data.rankingPos != null ? `#${data.rankingPos}` : '—';

  // Shadow/glow under the number
  ctx.save();
  ctx.font = '900 420px "Russo One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Outer glow pass (blur-like by drawing multiple semi-transparent layers)
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = posColor;
  for (let r = 20; r >= 2; r -= 4) {
    ctx.save();
    ctx.shadowColor = posColor;
    ctx.shadowBlur = r * 20;
    ctx.fillText(posText, W / 2, bloomY + 160);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Main number
  ctx.fillStyle = posColor;
  ctx.shadowColor = posColor;
  ctx.shadowBlur = 60;
  ctx.fillText(posText, W / 2, bloomY + 160);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── 8. "de X atletas" + "X pts" row ──────────────────────────────────────────
  const metaY = bloomY + 200;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Separator dots
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(W / 2, metaY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W / 2 - 220, metaY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W / 2 + 220, metaY, 4, 0, Math.PI * 2); ctx.fill();

  // "de X atletas"
  ctx.font = 'bold 36px "Chakra Petch", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(`DE ${data.rankingTotal} ATLETAS`, W / 2 - 150, metaY);

  // Points in accent
  ctx.font = '700 36px "Chakra Petch", sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.textAlign = 'right';
  ctx.fillText(`${data.rankingPoints} PTS`, W - 64, metaY);

  ctx.textAlign = 'left';
  ctx.restore();

  // ── 9. STATS GLASS CARD ───────────────────────────────────────────────────────
  const statsY    = metaY + 60;
  const statsH    = 165;
  const statsX    = 60;
  const statsW    = W - 120;
  const winRate   = data.wins + data.losses > 0
    ? Math.round((data.wins / (data.wins + data.losses)) * 100)
    : 0;

  // Glass card bg
  ctx.save();
  roundRect(ctx, statsX, statsY, statsW, statsH, 32);
  const statsGlassFill = ctx.createLinearGradient(statsX, statsY, statsX, statsY + statsH);
  statsGlassFill.addColorStop(0,   'rgba(255,255,255,0.055)');
  statsGlassFill.addColorStop(1,   'rgba(255,255,255,0.02)');
  ctx.fillStyle = statsGlassFill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Three stat columns
  const colW = statsW / 3;
  const stats = [
    { value: String(data.wins),   label: 'VITÓRIAS',  color: '#4ade80' },
    { value: String(data.losses), label: 'DERROTAS',  color: '#f87171' },
    { value: `${winRate}%`,       label: 'APROVEIT.', color: '#60a5fa' },
  ];

  stats.forEach((s, i) => {
    const cx = statsX + colW * i + colW / 2;
    const cy = statsY + statsH / 2;

    // Vertical separator
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(statsX + colW * i, statsY + 28);
      ctx.lineTo(statsX + colW * i, statsY + statsH - 28);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = '900 72px "Russo One", sans-serif';
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, cx, cy + 22);

    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(s.label, cx, cy + 60);

    ctx.restore();
  });

  // ── 10. LAST MATCH CARD ───────────────────────────────────────────────────────
  if (data.lastMatch) {
    const lmY = statsY + statsH + 36;
    const lmH = data.lastMatch.partner_name || data.lastMatch.opponent_names ? 240 : 195;
    const { won, my_score, opp_score, partner_name, opponent_names } = data.lastMatch;
    const lmColor = won ? '74,222,128' : '248,113,113';

    ctx.save();
    roundRect(ctx, statsX, lmY, statsW, lmH, 28);
    const lmFill = ctx.createLinearGradient(statsX, lmY, statsX, lmY + lmH);
    lmFill.addColorStop(0,   `rgba(${lmColor},0.09)`);
    lmFill.addColorStop(1,   `rgba(${lmColor},0.03)`);
    ctx.fillStyle = lmFill;
    ctx.fill();
    ctx.strokeStyle = `rgba(${lmColor},0.22)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Left accent bar
    ctx.save();
    const barGrad = ctx.createLinearGradient(statsX, lmY, statsX, lmY + lmH);
    barGrad.addColorStop(0,   `rgba(${lmColor},0.8)`);
    barGrad.addColorStop(1,   `rgba(${lmColor},0.1)`);
    ctx.fillStyle = barGrad;
    roundRect(ctx, statsX, lmY, 6, lmH, 3);
    ctx.fill();
    ctx.restore();

    // "ÚLTIMA PARTIDA" label
    ctx.save();
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('ÚLTIMA PARTIDA', statsX + 44, lmY + 50);

    // Result badge (right-aligned)
    const badgeText  = won ? 'VITÓRIA' : 'DERROTA';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 36;
    roundRect(ctx, statsX + statsW - badgeW - 32, lmY + 24, badgeW, 44, 22);
    ctx.fillStyle = `rgba(${lmColor},0.18)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${lmColor},0.35)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = won ? '#4ade80' : '#f87171';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, statsX + statsW - 50, lmY + 46);

    ctx.restore();

    // Score — large & central
    if (my_score != null && opp_score != null) {
      ctx.save();
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const scoreBaseX = statsX + 44;
      const scoreBaseY = lmY + 168;

      ctx.font = '900 100px "Russo One", sans-serif';
      ctx.fillStyle = won ? '#4ade80' : 'rgba(255,255,255,0.5)';
      ctx.fillText(`${my_score}`, scoreBaseX, scoreBaseY);

      ctx.font = '900 60px "Russo One", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('×', scoreBaseX + 130, scoreBaseY - 12);

      ctx.font = '900 100px "Russo One", sans-serif';
      ctx.fillStyle = won ? 'rgba(255,255,255,0.35)' : '#f87171';
      ctx.fillText(`${opp_score}`, scoreBaseX + 190, scoreBaseY);

      ctx.restore();
    }

    // Partner / opponents
    ctx.save();
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    let nameLineY = lmY + lmH - 44;
    if (opponent_names) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const oppText = `VS ${opponent_names.toUpperCase()}`;
      ctx.fillText(oppText.length > 34 ? oppText.slice(0, 34) + '…' : oppText, statsX + 44, nameLineY);
      nameLineY -= 34;
    }
    if (partner_name) {
      ctx.fillStyle = 'rgba(74,222,128,0.65)';
      ctx.fillText(`COM ${partner_name.toUpperCase().split(' ')[0]}`, statsX + 44, nameLineY);
    }
    ctx.restore();
  }

  // ── 11. BOTTOM BRANDING BAR ───────────────────────────────────────────────────
  // Glass footer
  ctx.save();
  const footerY = H - 148;
  const footerGrad = ctx.createLinearGradient(0, footerY, 0, H);
  footerGrad.addColorStop(0,   'rgba(255,255,255,0.0)');
  footerGrad.addColorStop(0.3, 'rgba(255,255,255,0.035)');
  footerGrad.addColorStop(1,   'rgba(255,255,255,0.06)');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, footerY, W, 148);

  // Green accent line above footer
  const footerLine = ctx.createLinearGradient(0, 0, W, 0);
  footerLine.addColorStop(0,   'rgba(74,222,128,0)');
  footerLine.addColorStop(0.15, '#4ade80');
  footerLine.addColorStop(0.85, '#4ade80');
  footerLine.addColorStop(1,   'rgba(74,222,128,0)');
  ctx.fillStyle = footerLine;
  ctx.fillRect(0, footerY, W, 2);

  // Branding text
  ctx.font = '900 36px "Russo One", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('RANKING PADEL SRB 2026', W / 2, footerY + 52);

  ctx.font = 'bold 28px "Chakra Petch", sans-serif';
  ctx.fillStyle = 'rgba(74,222,128,0.55)';
  ctx.fillText('obralivre.com.br/ranking-srb', W / 2, footerY + 102);

  ctx.restore();

  // ── 12. VIGNETTE (cinematic darkening at edges) ────────────────────────────────
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  vignette.addColorStop(0,   'rgba(0,0,0,0)');
  vignette.addColorStop(1,   'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}
