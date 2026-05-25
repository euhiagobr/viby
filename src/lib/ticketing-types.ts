export type SectorType = 'livre' | 'assentos' | 'mesas';
export type SeatStatus = 'disponivel' | 'reservado' | 'vendido' | 'bloqueado';
export type SeatCategory = 'comum' | 'pcd' | 'pcd_acompanhante' | 'obeso';

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
  posicaoGrade: number;
  larguraGrade: number;
  fileiras?: number;
  assentosPorFileira?: number;
  quantidadeMesas?: number;
  lugaresPorMesa?: number;
  formatoMesa?: 'circular' | 'quadrada';
  ticketLinkId?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  criadoEm?: any;
}

export interface Seat {
  id: string;
  codigo: string;
  fileira?: string;
  numero: number;
  categoria: SeatCategory;
  status: SeatStatus;
  reservadoPor?: string;
  reservadoAte?: any;
  ingressoId?: string;
  setorId: string;
  eventoId: string;
  posX: number;
  posY: number;
}
