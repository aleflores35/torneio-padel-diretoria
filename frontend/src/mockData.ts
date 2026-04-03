export interface Player {
  id_player: number;
  name: string;
  whatsapp: string;
  side: 'RIGHT' | 'LEFT' | 'EITHER';
  payment_status: 'PAID' | 'PENDING';
}

const names = [
  'Rodrigo "Marcola" Silva', 'João Carlos Padelist', 'Pedro Henrique', 'Lucas Bertoli', 'Marcelo Oliveira',
  'Gustavo Martins', 'Felipe Santos', 'Thiago Almeida', 'Gabriel Souza', 'Vitor Hugo',
  'Rafael Lima', 'Bruno Costa', 'André Rocha', 'Mateus Silveira', 'Diego Ferreira',
  'Leonardo Gomes', 'Murilo Santos', 'Eduardo Lopes', 'Caio Ribeiro', 'Igor Nascimento',
  'Samuel Alves', 'Renan Garcia', 'Otávio Melo', 'Hugo Cardoso', 'Danilo Fernandes',
  'Douglas Vieira', 'Alexandre Machado', 'Patrick Barbosa', 'Cristiano Ramos', 'Fabiano Teixeira',
  'Jorge Luiz', 'Ricardo Smash', 'Fernando Volley', 'Julio Drive', 'Roberto Backhand',
  'Paulo Lob', 'Sérgio Bandeja', 'Marcelo Parado', 'Adriano Cruzado', 'Márcio Paralelo',
  'Sandro Gancho', 'Wellington Vibora', 'Claudio Smash', 'Everson Set', 'Jean Game',
  'Alan Match', 'Valter Pro', 'Norberto Master', 'Humberto Open', 'Gerson Cup',
  'Nivaldo Final', 'Osvaldo Semis', 'Djalma Quartas', 'Emerson Oitavas', 'Gilmar Grupo',
  'Helder Chave', 'Ivan Dupla', 'Joel Ponto', 'Kleber Saque', 'Laerte Devolução',
  'Moacir Rede', 'Osmar Vidro', 'Plinio Grade'
];

export const MOCK_PLAYERS: Player[] = names.map((name, i) => ({
  id_player: i + 1,
  name: name,
  whatsapp: `(51) 9${Math.floor(Math.random() * 90000000 + 10000000)}`,
  side: i % 3 === 0 ? 'RIGHT' : i % 3 === 1 ? 'LEFT' : 'EITHER',
  payment_status: i % 10 === 0 ? 'PENDING' : 'PAID'
}));
