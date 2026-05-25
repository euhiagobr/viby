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
  endDate?: Date;
  location: string;
  city: string;
  latitude?: number;
  longitude?: number;
  type: 'Público' | 'Privado' | 'Governo';
  categoryName?: string;
  categoryId?: string;
  batches: EventBatch[];
  status: 'Ativo' | 'Pendente' | 'Excluído';
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
    endDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
    location: 'Praça Central',
    city: 'São Paulo',
    latitude: -23.55052,
    longitude: -46.633308,
    type: 'Público',
    categoryName: 'Música',
    categoryId: 'musica',
    status: 'Ativo',
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
    endDate: new Date(Date.now() + 86400000 + 8 * 60 * 60 * 1000),
    location: 'Expo Center',
    city: 'Curitiba',
    latitude: -25.4296,
    longitude: -49.2719,
    type: 'Privado',
    categoryName: 'Tecnologia',
    categoryId: 'tech',
    status: 'Ativo',
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
    latitude: -22.9068,
    longitude: -43.1729,
    type: 'Governo',
    categoryName: 'Meio Ambiente',
    status: 'Ativo',
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