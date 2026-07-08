/**
 * IdentityStatusBadge.tsx
 * 
 * Componente para exibir o status de uma identidade com badge visual.
 * Mapeia os valores de verificationStatus para labels e cores legíveis.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';

export type VerificationStatus = 'pending' | 'verified' | 'expired' | 'revoked';
export type VerificationLevel = 'self' | 'document_upload' | 'kyc';

interface IdentityStatusBadgeProps {
  status: VerificationStatus;
  level?: VerificationLevel;
  className?: string;
}

/**
 * Mapping de status para labels e cores
 */
const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: string }> = {
  pending: {
    label: 'Aguardando',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '⏱️',
  },
  verified: {
    label: 'Verificada',
    color: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  expired: {
    label: 'Expirada',
    color: 'bg-red-100 text-red-800',
    icon: '⚠️',
  },
  revoked: {
    label: 'Revogada',
    color: 'bg-gray-100 text-gray-800',
    icon: '❌',
  },
};

const LEVEL_CONFIG: Record<VerificationLevel, string> = {
  self: 'Auto-verificada',
  document_upload: 'Upload de Documento',
  kyc: 'Verificação Completa',
};

export function IdentityStatusBadge({
  status,
  level,
  className = '',
}: IdentityStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Badge className={`${config.color} border-0`}>
        {config.icon} {config.label}
      </Badge>
      {level && (
        <span className="text-xs text-gray-500">
          {LEVEL_CONFIG[level]}
        </span>
      )}
    </div>
  );
}

export default IdentityStatusBadge;
