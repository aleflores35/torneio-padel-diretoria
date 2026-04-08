import { MOCK_PLAYERS } from './mockData';
import axios from 'axios';
import API_URL from './config';

// ==========================================
// TYPES
// ==========================================

export type Side = 'RIGHT' | 'LEFT' | 'EITHER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface Player {
  id_player: number;
  name: string;
  matricula?: string;
  data_nascimento?: string;
  cpf?: string;
  rg?: string;
  whatsapp: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  tamanho_camiseta?: string;
  atendido_por?: string;
  side: Side;
  payment_status: PaymentStatus;
  has_lunch?: boolean;
  id_tournament: number;
  category_id?: number;
}

export interface Match {
  id_match: number;
  id_group?: number;
  id_round?: number;
  stage?: string;
  double_a_name: string;
  double_b_name: string;
  court_id: number;
  court_name: string;
  games_double_a: number;
  games_double_b: number;
  status: 'TO_PLAY' | 'CALLING' | 'IN_PROGRESS' | 'FINISHED' | 'SCHEDULED' | 'LIVE';
  round?: number;
  scheduled_at?: string;
}

export interface Double {
  id_double: number;
  display_name: string;
}

export interface Chave {
  id_chave: number;
  nome: string;
  duplas: {
    id: number;
    nome_exibicao: string;
    v: number;
    d: number;
    saldo: number;
  }[];
}

export interface Court {
  id: number;
  name: string;
  status: 'BUSY' | 'AVAILABLE';
}

export interface NewPlayer {
  id_tournament: number;
  name: string;
  matricula?: string;
  data_nascimento?: string;
  cpf?: string;
  rg?: string;
  whatsapp: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  tamanho_camiseta?: string;
  atendido_por?: string;
  side: Side;
  category_id?: number;
  payment_status: PaymentStatus;
  has_lunch?: boolean;
  notes?: string;
}

// ==========================================
// MOCK DATA
// ==========================================

const INITIAL_MATCHES: Match[] = [
  { id_match: 1, double_a_name: 'Rodrigo (D) / João (E)', double_b_name: 'Pedro (D) / Lucas (E)', court_id: 1, court_name: 'Quadra 1', games_double_a: 6, games_double_b: 4, status: 'FINISHED', round: 1 },
  { id_match: 2, double_a_name: 'Marcelo (D) / Gustavo (E)', double_b_name: 'Felipe (D) / Thiago (E)', court_id: 2, court_name: 'Quadra 2', games_double_a: 5, games_double_b: 5, status: 'LIVE', round: 1 },
  { id_match: 3, double_a_name: 'Gabriel (D) / Vitor (E)', double_b_name: 'Caio (D) / Renan (E)', court_id: 3, court_name: 'Quadra 3', games_double_a: 0, games_double_b: 0, status: 'CALLING', round: 1 },
  { id_match: 4, double_a_name: 'Mateus (D) / André (E)', double_b_name: 'Bruno (D) / Caio (E)', court_id: 4, court_name: 'Quadra 4', games_double_a: 0, games_double_b: 0, status: 'SCHEDULED', round: 1 },
  { id_match: 5, double_a_name: 'Renato (D) / Hugo (E)', double_b_name: 'Tito (D) / Beto (E)', court_id: 1, court_name: 'Quadra 1', games_double_a: 0, games_double_b: 0, status: 'SCHEDULED', round: 2 },
  { id_match: 6, double_a_name: 'Lico (D) / Paco (E)', double_b_name: 'Dudu (D) / Bob (E)', court_id: 2, court_name: 'Quadra 2', games_double_a: 0, games_double_b: 0, status: 'SCHEDULED', round: 2 },
  { id_match: 7, double_a_name: 'Zeca (D) / Juca (E)', double_b_name: 'Guga (D) / Mel (E)', court_id: 3, court_name: 'Quadra 3', games_double_a: 0, games_double_b: 0, status: 'SCHEDULED', round: 2 },
  { id_match: 8, double_a_name: 'Nando (D) / Fred (E)', double_b_name: 'Beto (D) / Chico (E)', court_id: 4, court_name: 'Quadra 4', games_double_a: 0, games_double_b: 0, status: 'SCHEDULED', round: 2 },
];

const INITIAL_CHAVES: Chave[] = [
  { id_chave: 1, nome: 'Chave A', duplas: [
      { id: 1, nome_exibicao: 'Rodrigo (D) / João (E)', v: 1, d: 0, saldo: 2 },
      { id: 2, nome_exibicao: 'Pedro (D) / Lucas (E)', v: 0, d: 1, saldo: -2 },
      { id: 3, nome_exibicao: 'Gabriel (D) / Vitor (E)', v: 0, d: 0, saldo: 0 },
      { id: 4, nome_exibicao: 'Felipe (D) / Diego (E)', v: 0, d: 0, saldo: 0 }
    ] 
  },
  { id_chave: 2, nome: 'Chave B', duplas: [
      { id: 5, nome_exibicao: 'Marcelo (D) / Gustavo (E)', v: 0, d: 0, saldo: 0 },
      { id: 6, nome_exibicao: 'Felipe (D) / Thiago (E)', v: 0, d: 0, saldo: 0 },
      { id: 7, nome_exibicao: 'Caio (D) / Renan (E)', v: 0, d: 0, saldo: 0 },
      { id: 8, nome_exibicao: 'Beto (D) / Carlinhos (E)', v: 0, d: 0, saldo: 0 }
    ]
  },
  { id_chave: 3, nome: 'Chave C', duplas: [
      { id: 9, nome_exibicao: 'Xico (D) / Teco (E)', v: 0, d: 0, saldo: 0 },
      { id: 10, nome_exibicao: 'Paulo (D) / Ricardo (E)', v: 0, d: 0, saldo: 0 },
      { id: 11, nome_exibicao: 'Giba (D) / Zico (E)', v: 0, d: 0, saldo: 0 },
      { id: 12, nome_exibicao: 'Neymar (D) / Pelé (E)', v: 0, d: 0, saldo: 0 }
    ]
  },
  { id_chave: 4, nome: 'Chave D', duplas: [
      { id: 13, nome_exibicao: 'Mateus (D) / André (E)', v: 0, d: 0, saldo: 0 },
      { id: 14, nome_exibicao: 'Bruno (D) / Caio (E)', v: 0, d: 0, saldo: 0 },
      { id: 15, nome_exibicao: 'Vagner (D) / Luis (E)', v: 0, d: 0, saldo: 0 },
      { id: 16, nome_exibicao: 'Samir (D) / Jorge (E)', v: 0, d: 0, saldo: 0 }
    ]
  },
];

// ==========================================
// LOCAL STORAGE HELPERS
// ==========================================

const getLocal = <T>(key: string, defaultValue: T): T => {
  const val = localStorage.getItem(key);
  if (val) return JSON.parse(val) as T;
  localStorage.setItem(key, JSON.stringify(defaultValue));
  return defaultValue;
};

const saveLocal = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ==========================================
// API EXPORTS
// ==========================================

export const fetchPlayers = async (): Promise<Player[]> => {
  try {
    const res = await axios.get<Player[]>(`${API_URL}/api/players`);
    return res.data;
  } catch {
    return getLocal<Player[]>('local_players', MOCK_PLAYERS as Player[]);
  }
};

export const addPlayer = async (player: NewPlayer): Promise<{ id_player: number }> => {
  try {
    const res = await axios.post<{ id_player: number }>(`${API_URL}/api/players`, player);
    return res.data;
  } catch {
    const players = getLocal<Player[]>('local_players', MOCK_PLAYERS as Player[]);
    const newPlayer: Player = { ...player, id_player: players.length + 1, has_lunch: player.has_lunch ?? false };
    saveLocal('local_players', [...players, newPlayer]);
    return { id_player: newPlayer.id_player };
  }
};

export const fetchDoubles = async (tournamentId: number): Promise<Double[]> => {
  try {
    const res = await axios.get<Double[]>(`${API_URL}/api/tournaments/${tournamentId}/doubles`);
    return res.data;
  } catch {
    return getLocal<Double[]>('local_doubles', []);
  }
};

export const fetchMatches = async (tournamentId: number): Promise<Match[]> => {
  try {
    const res = await axios.get<Match[]>(`${API_URL}/api/tournaments/${tournamentId}/matches`);
    return res.data;
  } catch {
    return getLocal<Match[]>('local_matches', INITIAL_MATCHES);
  }
};

export const updateMatchStatus = async (
  matchId: number,
  status: string,
  scoreA?: number,
  scoreB?: number
): Promise<{ success: boolean }> => {
  try {
    await axios.post(`${API_URL}/api/matches/${matchId}/status`, {
      status,
      games_double_a: scoreA ?? 0,
      games_double_b: scoreB ?? 0,
    });
    return { success: true };
  } catch {
    const matches = getLocal<Match[]>('local_matches', INITIAL_MATCHES);
    const updated = matches.map((m) =>
      m.id_match === matchId
      ? { ...m, status: status as Match['status'], games_double_a: scoreA ?? m.games_double_a, games_double_b: scoreB ?? m.games_double_b }
      : m
    );
    saveLocal('local_matches', updated);
    return { success: true };
  }
};

export const callMatch = async (matchId: number): Promise<{ success: boolean }> => {
  try {
    await axios.post(`${API_URL}/api/matches/${matchId}/call`);
    return { success: true };
  } catch {
    console.warn(`[FALLBACK] callMatch ${matchId}: backend indisponível`);
    return { success: false };
  }
};

export const fetchChaves = async (tournamentId: number): Promise<Chave[]> => {
  try {
    const res = await axios.get<any[]>(`${API_URL}/api/tournaments/${tournamentId}/chaves`);
    return res.data.map(chave => ({
      ...chave,
      duplas: chave.duplas.map((d: any) => ({
        id: d.id_dupla,
        nome_exibicao: d.nome_exibicao,
        v: d.v ?? 0,
        d: d.d ?? 0,
        saldo: d.saldo ?? 0,
      })),
    }));
  } catch {
    return getLocal<Chave[]>('local_chaves', INITIAL_CHAVES);
  }
};

export const generateDoubles = async (tournamentId: number): Promise<{ success: boolean; message?: string }> => {
  try {
    await axios.post(`${API_URL}/api/tournaments/${tournamentId}/generate-doubles`);
    return { success: true };
  } catch {
    const players = getLocal<Player[]>('local_players', MOCK_PLAYERS as Player[]);
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const mockDoubles: Double[] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      mockDoubles.push({
        id_double: i + 1,
        display_name: `${p1.name} (D) / ${p2.name} (E)`
      });
    }
    saveLocal('local_doubles', mockDoubles);
    return { success: true, message: "Simulação: Duplas geradas com lados definidos." };
  }
};

export const generateChaves = async (tournamentId: number): Promise<{ success: boolean }> => {
  try {
    await axios.post(`${API_URL}/api/tournaments/${tournamentId}/generate-chaves`);
    return { success: true };
  } catch {
    saveLocal('local_chaves', INITIAL_CHAVES);
    return { success: true };
  }
};

export const scheduleMatches = async (tournamentId: number): Promise<{ success: boolean }> => {
  try {
    await axios.post(`${API_URL}/api/tournaments/${tournamentId}/schedule`);
    return { success: true };
  } catch {
    const matches = getLocal<Match[]>('local_matches', INITIAL_MATCHES);
    const updated = matches.map((m) => 
      m.status === 'SCHEDULED' ? { ...m, status: 'CALLING' as const, court_name: 'Quadra 3' } : m
    );
    saveLocal('local_matches', updated);
    return { success: true };
  }
};

export const fetchCourts = async (tournamentId = 1): Promise<Court[]> => {
  try {
    const res = await axios.get<any[]>(`${API_URL}/api/tournaments/${tournamentId}/courts`);
    return res.data.map(c => ({
      id: c.id_court,
      name: c.name,
      status: 'AVAILABLE' as const,
    }));
  } catch {
    return [
      { id: 1, name: 'Central', status: 'BUSY' },
      { id: 2, name: 'Quadra 1', status: 'BUSY' },
      { id: 3, name: 'Quadra 2', status: 'AVAILABLE' },
      { id: 4, name: 'Quadra 3', status: 'AVAILABLE' },
    ];
  }
};

export const createAthlete = (data: any) =>
  axios.post(`${API_URL}/api/athletes`, data);

// ==========================================
// RANKING SRB ENDPOINTS
// ==========================================

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface Round {
  id_round: number;
  id_tournament: number;
  id_category: number;
  round_number: number;
  scheduled_date: string;
  window_start: string;
  window_end: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED';
  notes?: string;
}

export interface PlayerStanding {
  id_player: number;
  name: string;
  side: Side;
  points: number;
  wins: number;
  losses: number;
  wos: number;
  matches_played: number;
}

export const fetchCategories = async (tournamentId: number): Promise<Category[]> => {
  try {
    const res = await axios.get<Category[]>(`${API_URL}/api/tournaments/${tournamentId}/categories`);
    return res.data;
  } catch {
    // Return default 5 Ranking SRB categories as fallback
    return [
      { id: 1, name: 'Masculino Iniciante' },
      { id: 2, name: 'Masculino 4ª' },
      { id: 3, name: 'Feminino Iniciante' },
      { id: 4, name: 'Feminino 6ª' },
      { id: 5, name: 'Feminino 4ª' }
    ];
  }
};

export const fetchRounds = async (tournamentId: number): Promise<Round[]> => {
  try {
    const res = await axios.get<Round[]>(`${API_URL}/api/tournaments/${tournamentId}/rounds`);
    return res.data;
  } catch {
    return getLocal<Round[]>('local_rounds', []);
  }
};

export const generateRounds = async (
  tournamentId: number,
  categoryId: number,
  startDate: string
): Promise<{ success: boolean; rounds_created?: number }> => {
  try {
    const res = await axios.post(
      `${API_URL}/api/tournaments/${tournamentId}/generate-rounds/${categoryId}`,
      { start_date: startDate }
    );
    return res.data;
  } catch {
    console.warn(`[FALLBACK] generateRounds: backend indisponível`);
    return { success: false };
  }
};

export const scheduleRound = async (roundId: number): Promise<{ success: boolean }> => {
  try {
    await axios.post(`${API_URL}/api/rounds/${roundId}/schedule`);
    return { success: true };
  } catch {
    console.warn(`[FALLBACK] scheduleRound ${roundId}: backend indisponível`);
    return { success: false };
  }
};

export const fetchRanking = async (
  tournamentId: number,
  categoryId: number
): Promise<PlayerStanding[]> => {
  try {
    const res = await axios.get<PlayerStanding[]>(
      `${API_URL}/api/tournaments/${tournamentId}/ranking/${categoryId}`
    );
    return res.data;
  } catch {
    return getLocal<PlayerStanding[]>('local_ranking', []);
  }
};

export const fetchAllRankings = async (
  tournamentId: number
): Promise<Record<number, PlayerStanding[]>> => {
  try {
    const res = await axios.get<Record<number, PlayerStanding[]>>(
      `${API_URL}/api/tournaments/${tournamentId}/ranking`
    );
    return res.data;
  } catch {
    return getLocal<Record<number, PlayerStanding[]>>('local_all_rankings', {});
  }
};
export default axios;
