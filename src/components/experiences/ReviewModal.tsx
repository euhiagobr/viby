'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { submitExperienceReviewAction } from '@/app/actions/experiences';

interface ReviewModalProps {
  registration: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ReviewModal({ registration, isOpen, onOpenChange, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = React.useState(5);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await submitExperienceReviewAction({
        registrationId: registration.id,
        experienceId: registration.eventId,
        userId: registration.userId,
        userName: registration.userName || "Membro Viby",
        rating,
        comment
      });

      if (res.success) {
        toast({ title: "Avaliação enviada!", description: "Obrigado por ajudar a comunidade Viby." });
        onSuccess?.();
        onOpenChange(false);
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao avaliar", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 border-b bg-muted/30">
          <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Sua Experiência</DialogTitle>
          <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Avalie o que você viveu no arraiá ou vivência</DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
           <div className="text-center space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase">{registration?.eventTitle}</p>
              <div className="flex justify-center gap-2">
                 {[1, 2, 3, 4, 5].map((star) => (
                   <button
                     key={star}
                     type="button"
                     onMouseEnter={() => setHoverRating(star)}
                     onMouseLeave={() => setHoverRating(0)}
                     onClick={() => setRating(star)}
                     className="transition-transform active:scale-90"
                   >
                     <Star 
                       className={cn(
                         "w-10 h-10 transition-colors",
                         (hoverRating || rating) >= star ? "fill-orange-400 text-orange-400" : "text-muted opacity-30"
                       )} 
                     />
                   </button>
                 ))}
              </div>
              <p className="text-[10px] font-black uppercase text-orange-600 italic">
                {rating === 5 ? "Excelente" : rating === 4 ? "Muito Bom" : rating === 3 ? "Regular" : rating === 2 ? "Ruim" : "Péssimo"}
              </p>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Conte os detalhes (Opcional)</Label>
              <Textarea 
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Como foi o atendimento? O local? O que mais gostou?"
                className="min-h-[120px] rounded-2xl resize-none border-dashed border-secondary/20"
              />
           </div>
        </div>

        <DialogFooter className="p-8 bg-muted/10 border-t">
           <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg"
           >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
              Enviar Avaliação
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
