
export type SectorType = 'livre' | 'assentos' | 'mesas';
export type SeatStatus = 'disponivel' | 'reservado' | 'vendido' | 'bloqueado';

export interface Sector {
  id: string;
  nome: string;
  tipo: SectorType;
  preco: number;
  capacidade: number;
  descricao?: string;
  cor: string;
  ativo: boolean;
  ordem: number;
  fileiras?: number;
  assentosPorFileira?: number;
  quantidadeMesas?: number;
  lugaresPorMesa?: number;
  formatoMesa?: 'circular' | 'quadrada';
  criadoEm?: any;
}

export interface Seat {
  id: string;
  codigo: string;
  fileira?: string;
  numero: number;
  status: SeatStatus;
  reservadoPor?: string;
  reservadoAte?: any;
  ingressoId?: string;
  setorId: string;
  eventoId: string;
}
