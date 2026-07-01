'use client';

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
  Mountain,
  UserCheck
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
  { id: 'guide', label: 'Guia Especializado', icon: UserCheck },
  { id: 'food', label: 'Alimentação', icon: Utensils },
  { id: 'drinks', label: 'Bebidas', icon: Coffee },
  { id: 'transport', label: 'Transporte', icon: Bus },
  { id: 'insurance', label: 'Seguro Viagem', icon: ShieldCheck },
  { id: 'gift', label: 'Brinde / Kit', icon: Gift },
  { id: 'equipment', label: 'Equipamentos', icon: Zap },
];
