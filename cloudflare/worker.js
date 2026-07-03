/**
 * Cloudflare Worker — proxy transparente do Ranking SRB.
 *
 * Objetivo: fazer https://obralivre.com.br/ranking-srb/* servir o frontend que
 * está no deploy do Vercel (ranking-padel-srb-2026.vercel.app), SEM mudar a URL
 * na barra do navegador e SEM depender do FTP da Hostinger (que está quebrado).
 *
 * A API do app continua sendo chamada direto em ranking-padel-srb-2026.vercel.app/api/*
 * pelo próprio bundle (não passa por aqui) — então este worker só repassa o
 * HTML + assets do frontend.
 *
 * Route a configurar (no dashboard ou no wrangler.toml):
 *   obralivre.com.br/ranking-srb*
 * Como a route é específica desse prefixo, o restante do site obralivre.com.br
 * NÃO é afetado.
 */
const ORIGIN = 'https://ranking-padel-srb-2026.vercel.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Segurança extra: se por algum motivo o worker pegar algo fora de /ranking-srb,
    // deixa passar pro site normal (não interfere).
    if (!url.pathname.startsWith('/ranking-srb')) {
      return fetch(request);
    }

    // Mesma rota no Vercel (o app usa basename /ranking-srb e o vercel.json já trata).
    const target = new URL(url.pathname + url.search, ORIGIN);

    // Repassa método, headers e corpo. O host efetivo passa a ser o do Vercel.
    const proxied = new Request(target.toString(), request);
    const resp = await fetch(proxied);

    // Repassa a resposta como veio (HTML/JS/CSS/etc).
    return new Response(resp.body, resp);
  },
};
