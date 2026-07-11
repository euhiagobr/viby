'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ChargebackData {
  id: string;
  organizationId: string;
  registrationId?: string;
  eventId?: string;
  chargeId: string;
  amount: number;
  currency: string;
  reason: string;
  reasonCode: string;
  status: 'warning_needs_response' | 'under_review' | 'won' | 'lost';
  evidenceDueBy?: any;
  evidence: any[];
  notificationSent: boolean;
  createdAt: any;
  updatedAt: any;
  closedAt?: any;
  closedReason?: string;
}

interface ChargebackStatusProps {
  chargeback: ChargebackData;
  compact?: boolean;
}

/**
 * Componente para exibir status de uma disputa/chargeback
 * Mostra informações do Stripe sobre a contestação
 */
export function ChargebackStatus({ chargeback, compact = false }: ChargebackStatusProps) {
  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    'warning_needs_response': {
      label: 'Resposta Necessária',
      color: 'bg-yellow-100 text-yellow-800',
      icon: <AlertCircle className="w-4 h-4" />
    },
    'under_review': {
      label: 'Em Análise',
      color: 'bg-blue-100 text-blue-800',
      icon: <Clock className="w-4 h-4" />
    },
    'won': {
      label: 'Ganha',
      color: 'bg-green-100 text-green-800',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    'lost': {
      label: 'Perdida',
      color: 'bg-red-100 text-red-800',
      icon: <XCircle className="w-4 h-4" />
    }
  };

  const config = statusConfig[chargeback.status];
  const createdDate = chargeback.createdAt?.toDate?.() || new Date(chargeback.createdAt);
  const dueDate = chargeback.evidenceDueBy?.toDate?.() || chargeback.evidenceDueBy;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <div className="flex items-center gap-3">
          {config.icon}
          <div>
            <p className="font-medium text-sm">R$ {(chargeback.amount / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{chargeback.reason}</p>
          </div>
        </div>
        <Badge variant="secondary" className={config.color}>
          {config.label}
        </Badge>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {config.icon}
              Disputa/Chargeback #{chargeback.id.slice(-8)}
            </CardTitle>
            <CardDescription>
              Contestação iniciada {formatDistanceToNow(createdDate, { locale: ptBR, addSuffix: true })}
            </CardDescription>
          </div>
          <Badge className={config.color}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Valor Contestado</p>
            <p className="font-semibold">R$ {(chargeback.amount / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Motivo</p>
            <p className="font-semibold text-sm">{chargeback.reason}</p>
          </div>
        </div>

        {dueDate && chargeback.status === 'warning_needs_response' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm font-medium text-yellow-900">
              ⚠️ Prazo para responder: {new Date(dueDate).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Você tem {Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias para enviar evidências de não-fraude.
            </p>
          </div>
        )}

        {chargeback.closedAt && (
          <div className={`rounded p-3 ${chargeback.closedReason === 'won' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm font-medium ${chargeback.closedReason === 'won' ? 'text-green-900' : 'text-red-900'}`}>
              Disputa {chargeback.closedReason === 'won' ? '✓ Ganha' : '✗ Perdida'}
            </p>
            <p className={`text-xs mt-1 ${chargeback.closedReason === 'won' ? 'text-green-700' : 'text-red-700'}`}>
              Finalizada em {new Date(chargeback.closedAt.toDate?.() || chargeback.closedAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        )}

        {chargeback.status === 'lost' && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm font-medium text-red-900">
              💳 Impacto Financeiro
            </p>
            <p className="text-xs text-red-700 mt-1">
              O valor de R$ {(chargeback.amount / 100).toFixed(2)} foi debitado do seu saldo Stripe Connect.
            </p>
          </div>
        )}

        {chargeback.evidence.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Evidências Enviadas ({chargeback.evidence.length})
            </p>
            <div className="space-y-1">
              {chargeback.evidence.map((doc: any, idx: number) => (
                <p key={idx} className="text-xs text-muted-foreground">
                  • {doc.type || 'Documento'} - {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>ID Stripe: {chargeback.chargeId}</p>
          <p>Última atualização: {formatDistanceToNow(chargeback.updatedAt.toDate?.() || new Date(chargeback.updatedAt), { locale: ptBR, addSuffix: true })}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface ChargebackListProps {
  chargebacks: ChargebackData[];
  onlyPending?: boolean;
  compact?: boolean;
}

/**
 * Lista de chargebacks do organizador
 */
export function ChargebackList({ chargebacks, onlyPending = false, compact = false }: ChargebackListProps) {
  const filtered = onlyPending
    ? chargebacks.filter(cb => cb.status !== 'won' && cb.status !== 'lost')
    : chargebacks;

  if (filtered.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
        <p>Nenhuma disputa registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filtered.map((cb) => (
        <ChargebackStatus key={cb.id} chargeback={cb} compact={compact} />
      ))}
    </div>
  );
}
