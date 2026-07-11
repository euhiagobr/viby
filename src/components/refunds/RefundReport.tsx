'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, AlertCircle, DollarSign, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface RefundData {
  id: string;
  registrationId: string;
  eventId: string;
  organizationId: string;
  type: 'cdc' | 'org_cancellation' | 'manual_approval' | 'chargeback';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'won' | 'lost';
  reason?: string;
  approvedBy?: string;
  approvalReason?: string;
  approvalNotes?: string;
  stripeRefundId?: string;
  createdAt: any;
  completedAt?: any;
}

interface RefundTypeConfig {
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  isAutomatic: boolean;
}

const refundTypeConfig: Record<string, RefundTypeConfig> = {
  'cdc': {
    label: 'CDC (7 dias)',
    description: 'Reembolso automático por direito de arrependimento',
    color: 'bg-blue-100 text-blue-800',
    icon: <AlertCircle className="w-4 h-4" />,
    isAutomatic: true
  },
  'org_cancellation': {
    label: 'Cancelamento de Evento',
    description: 'Reembolso automático por cancelamento do organizador',
    color: 'bg-red-100 text-red-800',
    icon: <AlertCircle className="w-4 h-4" />,
    isAutomatic: true
  },
  'manual_approval': {
    label: 'Aprovação Manual',
    description: 'Reembolso cortesia aprovado pelo organizador',
    color: 'bg-orange-100 text-orange-800',
    icon: <Check className="w-4 h-4" />,
    isAutomatic: false
  },
  'chargeback': {
    label: 'Chargeback',
    description: 'Disputa/chargeback do cliente',
    color: 'bg-purple-100 text-purple-800',
    icon: <AlertCircle className="w-4 h-4" />,
    isAutomatic: true
  }
};

interface RefundCardProps {
  refund: RefundData;
  compact?: boolean;
}

/**
 * Card para exibir informações de um reembolso
 */
export function RefundCard({ refund, compact = false }: RefundCardProps) {
  const typeConfig = refundTypeConfig[refund.type] || refundTypeConfig['manual_approval'];
  const createdDate = refund.createdAt?.toDate?.() || new Date(refund.createdAt);

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <div className="flex items-center gap-3 flex-1">
          {typeConfig.icon}
          <div className="flex-1">
            <p className="font-medium text-sm">{typeConfig.label}</p>
            <p className="text-xs text-muted-foreground">
              R$ {(refund.amount / 100).toFixed(2)} • {formatDistanceToNow(createdDate, { locale: ptBR, addSuffix: true })}
            </p>
          </div>
        </div>
        <Badge className={typeConfig.color}>
          {refund.status}
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
              {typeConfig.icon}
              {typeConfig.label}
            </CardTitle>
            <CardDescription>{typeConfig.description}</CardDescription>
          </div>
          <Badge className={typeConfig.color}>
            {refund.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="font-semibold text-lg flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {(refund.amount / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Data</p>
            <p className="font-semibold">
              {new Date(createdDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {refund.reason && (
          <div className="bg-muted p-3 rounded">
            <p className="text-xs text-muted-foreground mb-1">Motivo</p>
            <p className="text-sm">{refund.reason}</p>
          </div>
        )}

        {refund.approvalReason && (
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <p className="text-xs font-medium text-orange-900 mb-1">Motivo de Aprovação</p>
            <p className="text-sm text-orange-800">{refund.approvalReason}</p>
            {refund.approvalNotes && (
              <p className="text-xs text-orange-700 mt-2 italic">Notas: {refund.approvalNotes}</p>
            )}
          </div>
        )}

        {refund.approvedBy && (
          <div className="text-xs text-muted-foreground">
            Aprovado por: {refund.approvedBy}
          </div>
        )}

        {refund.stripeRefundId && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            Stripe Refund ID: {refund.stripeRefundId.slice(-12)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RefundReportProps {
  refunds: RefundData[];
  organizationId?: string;
}

/**
 * Relatório consolidado de reembolsos
 */
export function RefundReport({ refunds, organizationId }: RefundReportProps) {
  const stats = React.useMemo(() => {
    const totals = {
      total: 0,
      cdc: 0,
      org_cancellation: 0,
      manual_approval: 0,
      chargeback: 0
    };

    const counts = {
      total: refunds.length,
      cdc: 0,
      org_cancellation: 0,
      manual_approval: 0,
      chargeback: 0
    };

    refunds.forEach((r) => {
      totals.total += r.amount;
      totals[r.type as keyof typeof totals] += r.amount;
      counts[r.type as keyof typeof counts] += 1;
    });

    return { totals, counts };
  }, [refunds]);

  const filteredByCDC = refunds.filter(r => r.type === 'cdc');
  const filteredByOrgCancel = refunds.filter(r => r.type === 'org_cancellation');
  const filteredByManual = refunds.filter(r => r.type === 'manual_approval');
  const filteredByChargeback = refunds.filter(r => r.type === 'chargeback');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reembolsado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {(stats.totals.total / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.counts.total} transações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CDC</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {(stats.totals.cdc / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.counts.cdc} automáticos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Manual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {(stats.totals.manual_approval / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.counts.manual_approval} aprovações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chargebacks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {(stats.totals.chargeback / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.counts.chargeback} disputas</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Tipo</CardTitle>
          <CardDescription>
            Histórico completo de reembolsos, aprovações manuais e chargebacks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">Todos ({stats.counts.total})</TabsTrigger>
              <TabsTrigger value="cdc">CDC ({stats.counts.cdc})</TabsTrigger>
              <TabsTrigger value="manual">Manual ({stats.counts.manual_approval})</TabsTrigger>
              <TabsTrigger value="org">Evento ({stats.counts.org_cancellation})</TabsTrigger>
              <TabsTrigger value="chargeback">Disputa ({stats.counts.chargeback})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 mt-4">
              {refunds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum reembolso registrado</p>
              ) : (
                refunds.map((r) => <RefundCard key={r.id} refund={r} compact />)
              )}
            </TabsContent>

            <TabsContent value="cdc" className="space-y-3 mt-4">
              {filteredByCDC.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum reembolso CDC</p>
              ) : (
                filteredByCDC.map((r) => <RefundCard key={r.id} refund={r} compact />)
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-3 mt-4">
              {filteredByManual.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum reembolso manual</p>
              ) : (
                filteredByManual.map((r) => <RefundCard key={r.id} refund={r} compact />)
              )}
            </TabsContent>

            <TabsContent value="org" className="space-y-3 mt-4">
              {filteredByOrgCancel.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cancelamento de evento</p>
              ) : (
                filteredByOrgCancel.map((r) => <RefundCard key={r.id} refund={r} compact />)
              )}
            </TabsContent>

            <TabsContent value="chargeback" className="space-y-3 mt-4">
              {filteredByChargeback.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum chargeback</p>
              ) : (
                filteredByChargeback.map((r) => <RefundCard key={r.id} refund={r} compact />)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
