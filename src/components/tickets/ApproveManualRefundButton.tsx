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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { requestManualRefund } from '@/app/actions/manual-refund';
import { Check, RefreshCw, AlertTriangle } from 'lucide-react';

export interface ApproveManualRefundButtonProps {
  registration: any;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: 'default' | 'destructive' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

/**
 * Button para aprovar reembolso manual de um ingresso
 * 
 * Permite que organizador reembolse qualquer ingresso (sem validações de prazo)
 * Por ser uma "cortesia", Viby retém a taxa de processamento
 * 
 * Fluxo:
 * 1. Clique → Dialog com motivo de aprovação
 * 2. Insira motivo + notas opcionais
 * 3. Confirma → AlertDialog de dupla confirmação
 * 4. Executa → requestManualRefund
 * 5. Resultado → Toast + callback
 */
export function ApproveManualRefundButton({
  registration,
  onSuccess,
  onError,
  variant = 'default',
  size = 'sm',
  className = ''
}: ApproveManualRefundButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showReasonDialog, setShowReasonDialog] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [approvalReason, setApprovalReason] = React.useState('');
  const [approvalNotes, setApprovalNotes] = React.useState('');

  if (!registration || registration.status !== 'active') {
    return null;
  }

  const isPaid = (registration.price || 0) > 0;
  const amount = (registration.price || 0) / 100;

  const handleOpenReasonDialog = () => {
    setApprovalReason('');
    setApprovalNotes('');
    setShowReasonDialog(true);
  };

  const handleProceedToConfirm = () => {
    if (!approvalReason.trim()) {
      toast({
        title: '⚠️ Motivo obrigatório',
        description: 'Por favor, informe o motivo da aprovação.',
        variant: 'destructive'
      });
      return;
    }
    setShowReasonDialog(false);
    setShowConfirmDialog(true);
  };

  const handleConfirmRefund = async () => {
    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
      const response = await requestManualRefund({
        registrationId: registration.id,
        organizationId: registration.organizationId,
        userId: '', // será obtido via contexto no servidor
        approvalReason: approvalReason.trim(),
        approvalNotes: approvalNotes.trim() || undefined
      });

      if (response.success) {
        toast({
          title: '✓ Reembolso Aprovado',
          description: response.message,
          variant: 'default'
        });
        onSuccess?.();
      } else {
        toast({
          title: '❌ Erro ao Aprovar',
          description: response.message,
          variant: 'destructive'
        });
        onError?.(response.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Error requesting manual refund:', error);
      toast({
        title: '❌ Erro',
        description: 'Falha ao processar reembolso. Tente novamente.',
        variant: 'destructive'
      });
      onError?.(error.message);
    } finally {
      setIsLoading(false);
      setApprovalReason('');
      setApprovalNotes('');
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
            Processando...
          </>
        ) : (
          <>
            <Check className="w-4 h-4 mr-2" />
            Aprovar Reembolso
          </>
        )}
      </Button>

      {/* Dialog 1: Inserir motivo e notas */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar Reembolso Manual</DialogTitle>
            <DialogDescription>
              <strong>{registration.buyerName || 'Comprador'}</strong>
              {isPaid && (
                <p className="mt-2 font-semibold">
                  Valor: R$ {amount.toFixed(2)}
                </p>
              )}
              {!isPaid && (
                <p className="mt-2 text-sm">Ingresso Gratuito</p>
              )}
              <br />
              <span className="text-xs">
                {isPaid
                  ? 'Será processado um reembolso integral ao cliente. Viby manterá a taxa de processamento como uma cortesia operacional.'
                  : 'Ingresso gratuito será cancelado e a vaga será liberada.'}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                Motivo da Aprovação *
              </label>
              <Textarea
                placeholder="Ex: Cliente teve problema técnico, evento foi adiado, cortesia de relacionamento, etc."
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="mt-1 min-h-20"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Notas Adicionais (opcional)
              </label>
              <Textarea
                placeholder="Informações extras para registro interno..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="mt-1 min-h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReasonDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProceedToConfirm}
              disabled={!approvalReason.trim() || isLoading}
            >
              Próximo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Confirmação final */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirmar Aprovação de Reembolso
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Resumo da operação:</strong>
              <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
                {isPaid && (
                  <>
                    <li>Cliente receberá R$ {amount.toFixed(2)} de volta</li>
                    <li>Transação será revertida no Stripe</li>
                    <li>Viby manterá a taxa de processamento</li>
                  </>
                )}
                {!isPaid && (
                  <li>Ingresso gratuito será cancelado</li>
                )}
                <li>Vaga será liberada para novos compradores</li>
                <li>Auditoria registrará esta ação</li>
              </ul>
              <br />
              <strong>Motivo aprovado:</strong>
              <p className="text-sm bg-muted p-2 rounded mt-2 border-l-2 border-orange-400">
                {approvalReason}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRefund}
              disabled={isLoading}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isLoading ? 'Processando...' : 'Sim, Aprovar Reembolso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
