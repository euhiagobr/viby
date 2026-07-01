
/**
 * @fileOverview Catálogo mestre de atributos, regras e itens para experiências.
 * Permite que o banco armazene apenas IDs, enquanto a UI provê ícones e traduções.
 */

import { 
  Wifi, 
  Accessibility, 
  Dog, 
  Car, 
  Wind, 
  Sun, 
  Umbrella, 
  Users, 
  Heart, 
  Baby, 
  Ban, 
  Beer, 
  Camera, 
  Video, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Coffee,
  Utensils,
  Bus,
  ShieldCheck,
  Gift,
  Zap,
  MapPin,
  Mountain
} from "lucide-react";

export interface CatalogItem {
  id: string;
  label: string;
  icon: any;
  category?: string;
}

export const EXPERIENCE_CHARACTERISTICS: CatalogItem[] = [
  { id: 'wifi', label: 'Wi-Fi Grátis', icon: Wifi },
  { id: 'accessible', label: 'Acessível', icon: Accessibility },
  { id: 'pet_friendly', label: 'Pet Friendly', icon: Dog },
  { id: 'parking', label: 'Estacionamento', icon: Car },
  { id: 'air_conditioned', label: 'Ar Condicionado', icon: Wind },
  { id: 'outdoor', label: 'Ao Ar Livre', icon: Sun },
  { id: 'indoor', label: 'Espaço Coberto', icon: Umbrella },
  { id: 'family_friendly', label: 'Ideal para Famílias', icon: Users },
  { id: 'couple_friendly', label: 'Ideal para Casais', icon: Heart },
  { id: 'kids_welcome', label: 'Crianças Bem-vindas', icon: Baby },
  { id: 'nature', label: 'Contato com a Natureza', icon: Mountain },
];

export const EXPERIENCE_RULES: CatalogItem[] = [
  { id: 'no_smoking', label: 'Proibido Fumar', icon: Ban },
  { id: 'alcohol_allowed', label: 'Consumo de Álcool', icon: Beer },
  { id: 'photos_allowed', label: 'Fotos Permitidas', icon: Camera },
  { id: 'video_allowed', label: 'Vídeos Permitidos', icon: Video },
  { id: 'arrive_early', label: 'Chegar com Antecedência', icon: Clock },
  { id: 'no_pets', label: 'Não aceita Pets', icon: XCircle },
  { id: 'dress_code', label: 'Traje Específico', icon: Zap },
];

export const EXPERIENCE_INCLUSIONS: CatalogItem[] = [
  { id: 'guide', label: 'Guia Especializado', icon: UserCircle },
  { id: 'food', label: 'Alimentação', icon: Utensils },
  { id: 'drinks', label: 'Bebidas', icon: Coffee },
  { id: 'transport', label: 'Transporte', icon: Bus },
  { id: 'insurance', label: 'Seguro Viagem', icon: ShieldCheck },
  { id: 'gift', label: 'Brinde / Kit', icon: Gift },
  { id: 'equipment', label: 'Equipamentos', icon: Zap },
];

function UserCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </svg>
  )
}
