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
import { useToast } from '@/hooks/use-toast';
import { requestCDCRefund } from '@/app/actions/cdc-refund';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

export interface CancelCDCButtonProps {
  registration: any;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: 'default' | 'destructive' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

/**
 * Button para cancelamento de ingresso com direito a reembolso (CDC)
 * 
 * Valida automaticamente se ingresso é elegível para CDC:
 * - Menos de 7 dias desde compra
 * - Evento/experiência inicia em mais de 48 horas
 * - Ingresso não foi utilizado
 * 
 * Se elegível: processa refund automático
 * Se não elegível: oferece opção de solicitar aprovação manual
 */
export function CancelCDCButton({
  registration,
  onSuccess,
  onError,
  variant = 'destructive',
  size = 'sm',
  className = ''
}: CancelCDCButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  if (!registration || registration.status !== 'active') {
    return null;
  }

  const handleConfirmCancel = async () => {
    setIsLoading(true);
    setShowConfirm(false);

    try {
      const response = await requestCDCRefund(
        registration.id,
        '', // userId será obtido via context no server action se necessário
        registration.buyerEmail || registration.userEmail
      );

      setResult(response);

      if (response.success) {
        toast({
          title: '✓ Reembolso Processado',
          description: response.message,
          variant: 'default'
        });
        onSuccess?.();
      } else if (response.requiresApproval) {
        toast({
          title: '⚠️ Aprovação Manual Necessária',
          description: response.message,
          variant: 'default'
        });
        // TODO: Aqui poderia abrir modal para solicitar aprovação do organizador
        onError?.(response.message);
      } else {
        toast({
          title: '❌ Erro ao Cancelar',
          description: response.message,
          variant: 'destructive'
        });
        onError?.(response.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Error requesting CDC refund:', error);
      toast({
        title: '❌ Erro',
        description: 'Falha ao processar reembolso. Tente novamente.',
        variant: 'destructive'
      });
      onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowConfirm(true)}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Cancelar com Direito a Reembolso
          </>
        )}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Ingresso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este ingresso?
              <br />
              <br />
              <strong>Informações:</strong>
              <br />
              • Você receberá reembolso de R$ {((registration.price || 0) / 100).toFixed(2)}
              <br />
              • A vaga será liberada para outros compradores
              <br />
              • Você receberá um email de confirmação
              <br />
              <br />
              <span className="text-xs text-muted-foreground">
                Nota: Este cancelamento segue a Lei de Direito de Arrependimento (CDC).
                Apenas elegível se comprado há menos de 7 dias e evento inicia em mais de 48 horas.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Processando...' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
