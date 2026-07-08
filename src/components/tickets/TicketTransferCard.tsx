'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { respondTransferAction } from '@/app/actions/ticket-transfers';

interface TicketTransfer {
  id: string;
  eventTitle: string;
  eventImage?: string;
  fromUserName: string;
  toDocumentMasked: string;
  toCountry: string;
  toDocumentType: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  requestedAt: any;
  expiresAt: any;
  ticketId: string;
}

interface TicketTransferCardProps {
  transfer: TicketTransfer;
  userId: string;
  onActionSuccess?: () => void;
}

export function TicketTransferCard({
  transfer,
  userId,
  onActionSuccess,
}: TicketTransferCardProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isExpired = transfer.status === 'expired';
  const isPending = transfer.status === 'pending';

  const expiresDate = transfer.expiresAt?.toDate
    ? transfer.expiresAt.toDate()
    : new Date(transfer.expiresAt);
  
  const now = new Date();
  const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const statusConfig = {
    pending: {
      label: 'Aguardando Resposta',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock,
    },
    accepted: {
      label: 'Aceito',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: CheckCircle2,
    },
    rejected: {
      label: 'Recusado',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle,
    },
    expired: {
      label: 'Expirado',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: AlertCircle,
    },
    cancelled: {
      label: 'Cancelado',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: XCircle,
    },
  };

  const config = statusConfig[transfer.status];
  const StatusIcon = config.icon;

  const handleAccept = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await respondTransferAction({
        transferId: transfer.id,
        userId,
        action: 'accept',
      });

      if (result.success) {
        toast({
          title: 'Ingresso aceito! ✓',
          description: 'O ingresso agora é seu.',
        });
        onActionSuccess?.();
      } else {
        setError(result.error || 'Erro ao aceitar transferência');
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.error || 'Não foi possível aceitar a transferência',
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao aceitar transferência';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await respondTransferAction({
        transferId: transfer.id,
        userId,
        action: 'reject',
      });

      if (result.success) {
        toast({
          title: 'Transferência recusada',
          description: 'O ingresso voltará ao proprietário original.',
        });
        onActionSuccess?.();
      } else {
        setError(result.error || 'Erro ao recusar transferência');
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.error || 'Não foi possível recusar a transferência',
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao recusar transferência';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-none shadow-sm rounded-[1.5rem] bg-white">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border/50">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-black uppercase italic text-primary line-clamp-2">
              {transfer.eventTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Transferência de {transfer.fromUserName}
            </p>
          </div>
          <Badge className={`border ${config.color} font-black text-[10px] uppercase`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Documento e Informações */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase text-muted-foreground">
              Documento do Destinatário
            </span>
            <span className="text-xs font-black text-foreground">
              {transfer.toCountry}: {transfer.toDocumentType}
            </span>
          </div>
          <div className="p-2.5 bg-secondary/10 rounded-lg border border-secondary/20">
            <p className="font-black text-sm text-center text-secondary">
              {transfer.toDocumentMasked}
            </p>
          </div>
        </div>

        {/* Tempo de Expiração */}
        {isPending && (
          <div className="flex items-center gap-2 p-2.5 bg-yellow-50 rounded-lg border border-yellow-200">
            <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700 font-semibold">
              {daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Expiring today'}
            </p>
          </div>
        )}

        {isExpired && (
          <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700 font-semibold">
              This transfer has expired
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {/* Buttons */}
        {isPending && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleReject}
              disabled={isLoading}
              variant="outline"
              className="flex-1 h-10 rounded-lg border-red-200 text-red-600 hover:bg-red-50 font-black uppercase text-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Recusando...
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Recusar
                </>
              )}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 h-10 rounded-lg bg-green-600 text-white hover:bg-green-700 font-black uppercase text-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Aceitando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Aceitar
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
