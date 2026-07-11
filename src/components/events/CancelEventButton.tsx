'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { requestOrgEventCancellation } from '@/app/actions/org-cancellation';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

export interface CancelEventButtonProps {
  eventId: string;
  organizationId: string;
  eventTitle: string;
  activeRegistrations?: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: 'default' | 'destructive' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

/**
 * Button para cancelamento de evento pelo organizador
 * 
 * Processa:
 * - Reembolso de 100% a todos os compradores
 * - Viby retém application fee
 * - Organizador absorve impacto no Stripe Connect
 * - Evento marcado como 'cancelled'
 * 
 * Fluxo:
 * 1. Clique → Dialog para inserir motivo
 * 2. Confirma → AlertDialog de dupla confirmação
 * 3. Executa → requestOrgEventCancellation
 * 4. Feedback → Toast com resultado
 */
export function CancelEventButton({
  eventId,
  organizationId,
  eventTitle,
  activeRegistrations = 0,
  onSuccess,
  onError,
  variant = 'destructive',
  size = 'sm',
  className = ''
}: CancelEventButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showReasonDialog, setShowReasonDialog] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const handleOpenReasonDialog = () => {
    setReason('');
    setShowReasonDialog(true);
  };

  const handleProceedToConfirm = () => {
    if (!reason.trim()) {
      toast({
        title: '⚠️ Motivo obrigatório',
        description: 'Por favor, informe o motivo do cancelamento.',
        variant: 'destructive'
      });
      return;
    }
    setShowReasonDialog(false);
    setShowConfirmDialog(true);
  };

  const handleConfirmCancellation = async () => {
    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
      const response = await requestOrgEventCancellation({
        eventId,
        organizationId,
        userId: '', // será obtido via contexto no servidor se necessário
        reason: reason.trim()
      });

      if (response.success) {
        toast({
          title: '✓ Evento Cancelado',
          description: response.message,
          variant: 'default'
        });
        onSuccess?.();
      } else {
        toast({
          title: '❌ Erro ao Cancelar',
          description: response.message,
          variant: 'destructive'
        });
        onError?.(response.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Error requesting org event cancellation:', error);
      toast({
        title: '❌ Erro',
        description: 'Falha ao cancelar evento. Tente novamente.',
        variant: 'destructive'
      });
      onError?.(error.message);
    } finally {
      setIsLoading(false);
      setReason('');
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpenReasonDialog}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Cancelando...
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar Evento
          </>
        )}
      </Button>

      {/* Dialog 1: Motivo do cancelamento */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Evento</DialogTitle>
            <DialogDescription>
              <strong>{eventTitle}</strong>
              <br />
              <br />
              {activeRegistrations > 0 && (
                <span className="text-sm">
                  Este evento tem <strong>{activeRegistrations}</strong> ingresso(s) ativo(s).
                  <br />
                  Todos os compradores receberão reembolso de 100%.
                  <br />
                  <br />
                </span>
              )}
              Informe o motivo do cancelamento (obrigatório):
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Ex: Cancelamento por motivos climáticos, questões de saúde, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-24"
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReasonDialog(false)}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleProceedToConfirm}
              disabled={!reason.trim() || isLoading}
            >
              Próximo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Confirmação dupla */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Cancelamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Atenção!</strong> Esta ação é irreversível.
              <br />
              <br />
              <strong>O que acontecerá:</strong>
              <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
                <li>Evento será marcado como cancelado</li>
                <li>{activeRegistrations > 0 ? `${activeRegistrations} ingresso(s) serão reembolsado(s)` : 'Nenhum ingresso ativo para reembolsar'}</li>
                <li>Cada comprador receberá 100% de reembolso</li>
                <li>Viby retém a taxa de processamento</li>
                <li>Você receberá notificação sobre o resultado</li>
              </ul>
              <br />
              <strong>Motivo do cancelamento:</strong>
              <p className="text-sm bg-muted p-2 rounded mt-2 border-l-2 border-yellow-500">
                {reason}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancellation}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Processando...' : 'Sim, Cancelar Evento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
