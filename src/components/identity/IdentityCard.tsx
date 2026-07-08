/**
 * IdentityCard.tsx
 * 
 * Componente reutilizável para exibir uma identidade cadastrada.
 * Mostra informações mascaradas e status.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import IdentityStatusBadge, {
  VerificationStatus,
  VerificationLevel,
} from './IdentityStatusBadge';

interface IdentityCardProps {
  id: string;
  country: string;
  documentType: string;
  documentMasked: string;
  status: VerificationStatus;
  level: VerificationLevel;
  isActive: boolean;
  createdAt: Date;
  onSetPrimary?: (identityId: string) => Promise<void>;
  onRemove?: (identityId: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Mapear código de país para nome
 */
const COUNTRY_NAMES: Record<string, string> = {
  BR: '🇧🇷 Brasil',
  AR: '🇦🇷 Argentina',
  US: '🇺🇸 Estados Unidos',
  ES: '🇪🇸 Espanha',
  PT: '🇵🇹 Portugal',
};

export function IdentityCard({
  id,
  country,
  documentType,
  documentMasked,
  status,
  level,
  isActive,
  createdAt,
  onSetPrimary,
  onRemove,
  isLoading = false,
}: IdentityCardProps) {
  const [settingPrimary, setSettingPrimary] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const handleSetPrimary = async () => {
    if (!onSetPrimary) return;
    setSettingPrimary(true);
    try {
      await onSetPrimary(id);
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    if (!confirm('Tem certeza que deseja revogar esta identidade?')) return;
    setRemoving(true);
    try {
      await onRemove(id);
    } finally {
      setRemoving(false);
    }
  };

  const countryName = COUNTRY_NAMES[country] || country;
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(createdAt);

  return (
    <Card className={`relative ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      {isActive && (
        <div className="absolute -top-3 -right-3 bg-blue-500 text-white rounded-full p-1">
          ⭐
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{countryName}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{documentType}</p>
          </div>
          {isActive && (
            <Badge className="bg-blue-100 text-blue-800 border-0">
              Identidade Principal
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Documento Mascarado */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Documento</p>
          <p className="text-lg font-mono font-medium text-gray-900 mt-1">
            {documentMasked}
          </p>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <IdentityStatusBadge status={status} level={level} />
        </div>

        {/* Data de Criação */}
        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">
            Cadastrada em {formattedDate}
          </p>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          {!isActive && onSetPrimary && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetPrimary}
              disabled={settingPrimary || isLoading}
              className="flex-1"
            >
              {settingPrimary ? 'Definindo...' : 'Definir como Principal'}
            </Button>
          )}

          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={removing || isLoading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {removing ? 'Revogando...' : 'Revogar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default IdentityCard;
