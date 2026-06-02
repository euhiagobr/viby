
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
  CreditCard, 
  Undo2,
  Info,
  CheckCircle2
} from "lucide-react";
import { formatCurrency } from "@/lib/financial-utils";
import { processStripeRefund, RefundType } from "@/app/actions/stripe-refund";
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

  // Cálculos baseados nos dados salvos no ingresso
  const totalPaid = registration.price || 0;
  const netOrg = registration.producerNetAmount || 0;
  const vibyFee = totalPaid - netOrg;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await processStripeRefund({
        registrationId: registration.id,
        executorUid,
        role: userRole,
        refundType
      });

      if (result.success) {
        toast({ 
          title: "Estorno Concluído!", 
          description: "O cliente receberá o valor integral em sua fatura ou conta PIX." 
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({ 
          variant: "destructive", 
          title: "Falha no Estorno", 
          description: result.error 
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro de comunicação com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[2.5rem] max-w-md border-none shadow-2xl">
        <AlertDialogHeader>
          <div className="mx-auto w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-2 text-orange-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center text-primary">
            Confirmação de Estorno
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center font-medium">
            Você está prestes a devolver o valor integral de <strong>{formatCurrency(totalPaid)}</strong> para o cliente <strong>{registration.userName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          <div className="p-6 bg-muted/30 rounded-3xl border space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
               <span>Valor de Face (Org)</span>
               <span className="text-primary">{formatCurrency(registration.ticketBasePrice)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
               <span>Taxa de Serviço (Viby)</span>
               <span className="text-primary">{formatCurrency(registration.administrativeFeeAmount)}</span>
            </div>
            <Separator className="border-dashed" />
            <div className="flex justify-between items-center">
               <span className="text-xs font-black uppercase italic text-primary">Total a Devolver</span>
               <span className="text-2xl font-black text-secondary">{formatCurrency(totalPaid)}</span>
            </div>
          </div>

          {isAdmin && (
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
                       <p className="text-[8px] text-muted-foreground uppercase leading-none">O produtor devolve o lucro e a Viby devolve a taxa.</p>
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
                       <p className="text-[8px] text-muted-foreground uppercase leading-none">O produtor mantém o repasse. A Viby paga todo o reembolso.</p>
                    </div>
                    {refundType === 'platform_absorbed' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
               </RadioGroup>
            </div>
          )}

          {!isAdmin && (
            <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
               <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
               <p className="text-[9px] text-secondary font-black uppercase leading-tight italic">
                 Como organizador, ao processar este estorno, você autoriza a devolução automática do seu repasse líquido para este ingresso.
               </p>
            </div>
          )}
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
              isAdmin && refundType === 'platform_absorbed' ? "bg-primary" : "bg-secondary"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
            Confirmar Estorno
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
