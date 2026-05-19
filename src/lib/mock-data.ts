export interface EventBatch {
  id: string;
  name: string;
  price: number;
  available: number;
}

export interface Organizer {
  name: string;
  avatar: string;
  username: string;
  isVerified: boolean;
  totalEvents: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  date: Date;
  location: string;
  city: string;
  type: 'Público' | 'Privado' | 'Governo';
  categoryName?: string;
  batches: EventBatch[];
  status: 'A fazer' | 'Em progresso' | 'Concluído';
  image: string;
  organizer: Organizer;
  isFree?: boolean;
}

export const MOCK_EVENTS: Event[] = [
  {
    id: '1',
    title: 'Festival de Inverno Viby',
    description: 'Um festival de música e arte no coração da cidade.',
    shortDescription: 'O maior festival da temporada.',
    date: new Date(),
    location: 'Praça Central',
    city: 'São Paulo',
    type: 'Público',
    categoryName: 'Música',
    status: 'Em progresso',
    image: 'https://picsum.photos/seed/event1/600/400',
    batches: [
      { id: 'b1', name: 'Primeiro Lote', price: 50, available: 100 },
      { id: 'b2', name: 'Segundo Lote', price: 80, available: 200 },
    ],
    organizer: {
      name: 'Viby Entretenimento',
      username: 'vibyent',
      avatar: 'https://picsum.photos/seed/org1/100/100',
      isVerified: true,
      totalEvents: 42,
    }
  },
  {
    id: '2',
    title: 'Tech Summit 2024',
    description: 'A maior conferência de tecnologia da América Latina.',
    shortDescription: 'Conectando mentes brilhantes.',
    date: new Date(Date.now() + 86400000),
    location: 'Expo Center',
    city: 'Curitiba',
    type: 'Privado',
    categoryName: 'Tecnologia',
    status: 'A fazer',
    image: 'https://picsum.photos/seed/event2/600/400',
    batches: [
      { id: 'b3', name: 'VIP', price: 500, available: 50 },
      { id: 'b4', name: 'Geral', price: 250, available: 500 },
    ],
    organizer: {
      name: 'Global Tech Events',
      username: 'globaltech',
      avatar: 'https://picsum.photos/seed/org2/100/100',
      isVerified: true,
      totalEvents: 128,
    }
  },
  {
    id: '3',
    title: 'Inauguração Parque Sustentável',
    description: 'Evento oficial do governo para abertura do novo espaço verde.',
    shortDescription: 'Sustentabilidade para todos.',
    date: new Date(Date.now() + 86400000 * 2),
    location: 'Parque das Águas',
    city: 'Rio de Janeiro',
    type: 'Governo',
    categoryName: 'Meio Ambiente',
    status: 'Concluído',
    isFree: true,
    image: 'https://picsum.photos/seed/event3/600/400',
    batches: [
      { id: 'b5', name: 'Gratuito', price: 0, available: 1000 },
    ],
    organizer: {
      name: 'Prefeitura do Rio',
      username: 'prefeiturario',
      avatar: 'https://picsum.photos/seed/org3/100/100',
      isVerified: false,
      totalEvents: 15,
    }
  },
];

export const MOCK_STATS = {
  conversasHoje: 12,
  tokensUtilizados: '45.2K',
  satisfacao: '94%',
  streaks: 15,
};