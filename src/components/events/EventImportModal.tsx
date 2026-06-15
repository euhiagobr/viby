'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link as LinkIcon, Loader2, Zap, Globe, AlertTriangle, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { fetchEventDataFromUrl } from '@/app/actions/event-import';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

interface EventImportModalProps {
  onImport: (data: any) => void;
}

export function EventImportModal({ onImport }: EventImportModalProps) {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const auth = useAuth();

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !auth?.currentUser) return;

    setLoading(true);
    try {
      const result = await fetchEventDataFromUrl(url, auth.currentUser.uid);
      if (result.success) {
        onImport(result.data);
        toast({ title: "Importação concluída!", description: "Revise os campos preenchidos automaticamente." });
        setIsOpen(false);
        setUrl("");
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl h-11 border-dashed gap-2 font-bold text-xs uppercase border-secondary text-secondary hover:bg-secondary/5">
          <LinkIcon className="w-4 h-4" /> Importar por Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
        <DialogHeader className="p-8 border-b bg-muted/30">
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                <Globe className="w-6 h-6" />
             </div>
             <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Viby Import</DialogTitle>
          </div>
          <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Extração inteligente de dados</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleImport} className="p-8 space-y-6">
          <div className="space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Cole a URL do evento original</Label>
                <div className="relative">
                   <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 text-secondary" />
                   <Input 
                     placeholder="https://sympla.com.br/evento-exemplo" 
                     value={url}
                     onChange={e => setUrl(e.target.value)}
                     required
                     className="pl-10 h-12 rounded-xl border-dashed border-secondary/30"
                   />
                </div>
             </div>

             <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <p className="text-[10px] text-secondary font-bold uppercase leading-tight italic">
                     Plataformas Suportadas
                   </p>
                   <p className="text-[9px] text-muted-foreground font-medium uppercase">
                     Sympla, Ingresse, Shotgun, Eventbrite, Fever, Ticket360 e outros domínios via OpenGraph.
                   </p>
                </div>
             </div>
          </div>

          <Button type="submit" disabled={loading || !url} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic">
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Zap className="w-5 h-5 mr-2" /> Iniciar Importação</>}
          </Button>
        </form>

        <div className="p-4 bg-orange-50 border-t flex items-center justify-center gap-2">
           <ShieldCheck className="w-4 h-4 text-orange-600 opacity-60" />
           <p className="text-[8px] font-black uppercase text-orange-800">Apenas para membros oficiais da organização Viby.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}