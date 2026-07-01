
'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  Loader2, 
  ShieldCheck, 
  Undo2,
  Info,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { formatCurrency } from "@/lib/financial-utils";
import { processStripeRefund, RefundType } from "@/app/actions/stripe-refund";
import { processTicketRefund } from "@/app/actions/finance";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface RefundDialogProps {
  registration: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: 'admin' | 'organizer';
  executorUid: string;
  onSuccess?: () => void;
}

export function RefundDialog({ 
  registration, 
  isOpen, 
  onOpenChange, 
  userRole, 
  executorUid,
  onSuccess 
}: RefundDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [refundType, setRefundType] = React.useState<RefundType>('shared');

  if (!registration) return null;

  const totalPaid = registration.price || 0;
  const isFree = totalPaid <= 0;
  const isStripe = !!registration.stripeSessionId;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      let result;
      
      if (isStripe && !isFree) {
        // Fluxo 1: Estorno via Stripe (Cartão/Pix)
        result = await processStripeRefund({
          registrationId: registration.id,
          executorUid,
          role: userRole,
          refundType
        });
      } else {
        // Fluxo 2: Cancelamento Interno (Gratuito ou Saldo)
        result = await processTicketRefund(
          registration.id, 
          executorUid, 
          isFree ? "Reserva gratuita cancelada pelo gestor." : "Estorno de saldo interno processado."
        );
      }

      if (result.success) {
        toast({ 
          title: isFree ? "Reserva Cancelada!" : "Estorno Concluído!", 
          description: isFree ? "A vaga foi devolvida ao estoque." : "O valor foi processado com sucesso." 
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({ 
          variant: "destructive", 
          title: "Falha na Operação", 
          description: result.error 
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro de rede", description: "Tente novamente mais tarde." });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[2.5rem] max-w-md border-none shadow-2xl">
        <AlertDialogHeader>
          <div className={cn(
            "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-2",
            isFree ? "bg-muted text-muted-foreground" : "bg-orange-50 text-orange-600"
          )}>
            {isFree ? <XCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>
          <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center text-primary">
            {isFree ? "Confirmar Cancelamento" : "Confirmação de Estorno"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center font-medium">
            {isFree ? (
              <>Você está cancelando a reserva gratuita de <strong>{registration.userName}</strong>.</>
            ) : (
              <>Você devolverá o valor integral de <strong>{formatCurrency(totalPaid)}</strong> para <strong>{registration.userName}</strong>.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {!isFree && (
            <div className="p-6 bg-muted/30 rounded-3xl border space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
                 <span>Valor de Face</span>
                 <span className="text-primary">{formatCurrency(registration.ticketBasePrice)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
                 <span>Taxa de Serviço</span>
                 <span className="text-primary">{formatCurrency(registration.administrativeFeeAmount)}</span>
              </div>
              <Separator className="border-dashed" />
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black uppercase italic text-primary">Total a Devolver</span>
                 <span className="text-2xl font-black text-secondary">{formatCurrency(totalPaid)}</span>
              </div>
            </div>
          )}

          {isAdmin && isStripe && !isFree && (
            <div className="space-y-3">
               <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Responsabilidade do Custo</Label>
               <RadioGroup 
                 value={refundType} 
                 onValueChange={(v: RefundType) => setRefundType(v)}
                 className="grid grid-cols-1 gap-2"
               >
                  <div className={cn(
                    "flex items-center space-x-3 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                    refundType === 'shared' ? "border-secondary bg-secondary/5" : "border-transparent bg-muted/20"
                  )} onClick={() => setRefundType('shared')}>
                    <RadioGroupItem value="shared" id="shared" className="sr-only" />
                    <div className="flex-1 space-y-1">
                       <p className="font-bold text-xs uppercase">Estorno Compartilhado</p>
                       <p className="text-[8px] text-muted-foreground uppercase leading-none">Produtor e Viby dividem a devolução.</p>
                    </div>
                    {refundType === 'shared' && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                  </div>

                  <div className={cn(
                    "flex items-center space-x-3 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                    refundType === 'platform_absorbed' ? "border-primary bg-primary/5" : "border-transparent bg-muted/20"
                  )} onClick={() => setRefundType('platform_absorbed')}>
                    <RadioGroupItem value="platform_absorbed" id="absorbed" className="sr-only" />
                    <div className="flex-1 space-y-1">
                       <p className="font-bold text-xs uppercase">Viby Assume 100%</p>
                       <p className="text-[8px] text-muted-foreground uppercase leading-none">O produtor mantém o valor; a Viby paga o estorno.</p>
                    </div>
                    {refundType === 'platform_absorbed' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
               </RadioGroup>
            </div>
          )}

          <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
             <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
             <p className="text-[9px] text-secondary font-bold uppercase leading-tight italic">
               {isFree ? "Ao cancelar, o ingresso perde a validade e a vaga volta a ficar disponível para outros membros." : "O estorno é processado conforme as regras vigentes e autoriza o débito do repasse líquido do produtor."}
             </p>
          </div>
        </div>

        <AlertDialogFooter className="grid grid-cols-2 gap-3">
          <AlertDialogCancel disabled={loading} className="rounded-xl font-bold uppercase text-[10px] h-12 mt-0">
            Desistir
          </AlertDialogCancel>
          <Button 
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "rounded-xl font-black uppercase text-[10px] h-12 shadow-xl",
              (isAdmin && refundType === 'platform_absorbed') ? "bg-primary" : "bg-secondary"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
            {isFree ? "Confirmar Cancelamento" : "Confirmar Estorno"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
