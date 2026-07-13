// authBootstrap.ts
// ---------------------------------------------------------------------------
// Injeta o token de admin (localStorage 'admin_token') em TODAS as chamadas de
// API do app, globalmente — sem precisar tocar em cada tela.
//
// Dois patches:
//   1) Request interceptor do singleton global do axios (src/api.ts faz
//      `export default axios`, então basta patchar o axios importado aqui).
//   2) Wrapper em window.fetch para as telas que usam fetch() cru.
//
// Deve ser importado como PRIMEIRA linha de src/main.tsx (antes de App), para
// que os dois patches estejam ativos antes de qualquer request do app.
// ---------------------------------------------------------------------------

import axios from 'axios';
import API_URL from './config';

const TOKEN_KEY = 'admin_token';

// --- 1. Axios: request interceptor global -----------------------------------
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // config.headers sempre existe em axios 1.x (InternalAxiosRequestConfig).
      // Cast para any evita fricção de tipos entre AxiosHeaders e objeto simples.
      if (!config.headers) {
        (config as { headers: Record<string, unknown> }).headers = {};
      }
      (config.headers as Record<string, unknown>).Authorization = `Bearer ${token}`;
    }
  } catch {
    // Nunca deixa o interceptor derrubar a request.
  }
  return config;
});

// --- 2. window.fetch: wrapper global ----------------------------------------
const originalFetch = window.fetch.bind(window);

window.fetch = function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Descobre a URL da request, tratando os dois formatos de input.
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input instanceof Request) {
        url = input.url;
      }

      if (url && url.startsWith(API_URL)) {
        // Faz merge com os headers existentes (init tem prioridade; se não
        // houver init.headers e input for um Request, herda os dele) para não
        // quebrar Content-Type etc.
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        const newInit: RequestInit = { ...(init ?? {}), headers };
        return originalFetch(input, newInit);
      }
    }
  } catch {
    // Em qualquer falha, cai no comportamento original intacto.
  }
  return originalFetch(input, init);
};

export {};
