
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, Ban } from "lucide-react"

export type AgeRatingCode = 'free' | 'not_recommended_18' | 'adults_only_18' | '10' | '12' | '14' | '16';

export interface AgeRatingConfig {
  code: AgeRatingCode;
  label: string;
  shortLabel: string;
  minimumAge: number;
  color: string; // Hex color for inline style
  textColor: string;
  isAdultsOnly?: boolean;
  description?: string;
}

export const AGE_RATINGS: Record<string, AgeRatingConfig> = {
  free: {
    code: 'free',
    label: 'Livre para todos os públicos',
    shortLabel: 'L',
    minimumAge: 0,
    color: '#00A859', // Verde oficial
    textColor: 'text-white',
    description: 'Classificação Livre'
  },
  '10': {
    code: '10',
    label: 'Não recomendado para menores de 10 anos',
    shortLabel: '10',
    minimumAge: 10,
    color: '#00AEEF', // Azul
    textColor: 'text-white'
  },
  '12': {
    code: '12',
    label: 'Não recomendado para menores de 12 anos',
    shortLabel: '12',
    minimumAge: 12,
    color: '#F9AD19', // Amarelo
    textColor: 'text-white'
  },
  '14': {
    code: '14',
    label: 'Não recomendado para menores de 14 anos',
    shortLabel: '14',
    minimumAge: 14,
    color: '#F26522', // Laranja
    textColor: 'text-white'
  },
  '16': {
    code: '16',
    label: 'Não recomendado para menores de 16 anos',
    shortLabel: '16',
    minimumAge: 16,
    color: '#ED1C24', // Vermelho
    textColor: 'text-white'
  },
  not_recommended_18: {
    code: 'not_recommended_18',
    label: 'Não recomendado para menores de 18 anos',
    shortLabel: '18',
    minimumAge: 18,
    color: '#000000', // Preto
    textColor: 'text-white',
    description: '18 Anos'
  },
  adults_only_18: {
    code: 'adults_only_18',
    label: 'Proibido para menores de 18 anos',
    shortLabel: '18',
    minimumAge: 18,
    isAdultsOnly: true,
    color: '#ED1C24', // Vermelho vibrante
    textColor: 'text-white',
    description: 'Exclusivo 18+'
  }
};

export function getAgeRatingConfig(code: AgeRatingCode | string): AgeRatingConfig {
  return AGE_RATINGS[code] || AGE_RATINGS.free;
}

export function AgeRatingBadge({ 
  code, 
  showLabel = false, 
  className 
}: { 
  code: AgeRatingCode | string, 
  showLabel?: boolean,
  className?: string 
}) {
  const config = getAgeRatingConfig(code);
  
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div 
        style={{ backgroundColor: config.color }}
        className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center font-black text-[12px] shadow-sm shrink-0",
          config.textColor
        )}
      >
        {config.code === 'adults_only_18' ? (
           <div className="relative flex items-center justify-center">
              <span>18</span>
              <div className="absolute inset-0 border-2 border-white rounded-full scale-125 opacity-20" />
           </div>
        ) : config.shortLabel}
      </div>
      {showLabel && (
        <span className="text-[10px] font-black uppercase tracking-tight text-primary/80">
          {config.label}
        </span>
      )}
    </div>
  );
}

export function AgeRatingWarning({ code }: { code: string }) {
  const config = getAgeRatingConfig(code);
  if (config.minimumAge < 18) return null;

  return (
    <div className="p-4 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-orange-800 italic">Aviso de Faixa Etária</p>
        <p className="text-[11px] text-orange-700 font-medium leading-relaxed uppercase">
          Este evento é {config.isAdultsOnly ? 'PROIBIDO' : 'NÃO RECOMENDADO'} para menores de 18 anos. 
          <strong> Será obrigatória a apresentação de documento oficial com foto na entrada.</strong>
        </p>
      </div>
    </div>
  );
}
