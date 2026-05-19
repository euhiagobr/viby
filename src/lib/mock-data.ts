export interface EventBatch {
  id: string;
  name: string;
  price: number;
  available: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  city: string;
  type: 'Público' | 'Privado' | 'Governo';
  batches: EventBatch[];
  status: 'A fazer' | 'Em progresso' | 'Concluído';
  image: string;
}

export const MOCK_EVENTS: Event[] = [
  {
    id: '1',
    title: 'Festival de Inverno Viby',
    description: 'Um festival de música e arte no coração da cidade.',
    date: new Date(),
    location: 'Praça Central',
    city: 'São Paulo',
    type: 'Público',
    status: 'Em progresso',
    image: 'https://picsum.photos/seed/event1/600/400',
    batches: [
      { id: 'b1', name: 'Primeiro Lote', price: 50, available: 100 },
      { id: 'b2', name: 'Segundo Lote', price: 80, available: 200 },
    ],
  },
  {
    id: '2',
    title: 'Tech Summit 2024',
    description: 'A maior conferência de tecnologia da América Latina.',
    date: new Date(Date.now() + 86400000),
    location: 'Expo Center',
    city: 'Curitiba',
    type: 'Privado',
    status: 'A fazer',
    image: 'https://picsum.photos/seed/event2/600/400',
    batches: [
      { id: 'b3', name: 'VIP', price: 500, available: 50 },
      { id: 'b4', name: 'Geral', price: 250, available: 500 },
    ],
  },
  {
    id: '3',
    title: 'Inauguração Parque Sustentável',
    description: 'Evento oficial do governo para abertura do novo espaço verde.',
    date: new Date(Date.now() + 86400000 * 2),
    location: 'Parque das Águas',
    city: 'Rio de Janeiro',
    type: 'Governo',
    status: 'Concluído',
    image: 'https://picsum.photos/seed/event3/600/400',
    batches: [
      { id: 'b5', name: 'Gratuito', price: 0, available: 1000 },
    ],
  },
];

export const MOCK_STATS = {
  conversasHoje: 12,
  tokensUtilizados: '45.2K',
  satisfacao: '94%',
  streaks: 15,
};
