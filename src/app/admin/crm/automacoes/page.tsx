'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Zap, 
  Plus, 
  Loader2, 
  Clock, 
  ChevronRight, 
  Inbox,
  Play
} from 'lucide-react';
import { toggleAutomationAction } from '@/app/actions/crm-marketing';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CrmAutomationsPage() {
  const db = useFirestore();
  const [isProcessing, setIsProcessing] = React.useState<string | null>(null);

  const automationsQuery = useMemoFirebase(() => 
    db ? query(collection(db, "crm_automation_rules"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: automations, loading } = useCollection<any>(automationsQuery);

  const handleToggle = async (ruleId: string, active: boolean) => {
    setIsProcessing(ruleId);
    try {
      const res = await toggleAutomationAction(ruleId, active);
      if (res.success) toast({ title: active ? "Automação ativada!" : "Automação pausada." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase italic text-primary">Automações Reais</h2>
          <p className="text-xs font-bold text-muted-foreground uppercase">Gatilhos automáticos baseados em eventos do sistema</p>
        </div>
        <Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic shrink-0">
          <Plus className="w-5 h-5" /> Nova Regra
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
        ) : automations && automations.length > 0 ? (
          automations.map(rule => (
            <Card key={rule.id} className={cn(
              "border-none shadow-sm rounded-[1.5rem] bg-white transition-all overflow-hidden",
              !rule.active && "opacity-60"
            )}>
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <div className={cn(
                     "p-3 rounded-2xl",
                     rule.active ? "bg-orange-50 text-orange-600" : "bg-muted text-muted-foreground"
                   )}>
                      <Zap className={cn("w-6 h-6", rule.active && "fill-current")} />
                   </div>
                   <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <h3 className="font-black text-base uppercase italic text-primary leading-none">{rule.name}</h3>
                         <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1.5">{rule.trigger}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-[9px] font-bold text-muted-foreground uppercase">
                         <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Delay: {rule.delayDays} dias</span>
                         <span className="flex items-center gap-1"><Play className="w-3 h-3" /> Template: {rule.templateId?.slice(-6)}</span>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black uppercase opacity-40">{rule.active ? 'Ativa' : 'Inativa'}</span>
                      {isProcessing === rule.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                      ) : (
                        <Switch 
                          checked={rule.active} 
                          onCheckedChange={(v) => handleToggle(rule.id, v)} 
                        />
                      )}
                   </div>
                   <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground/30"><ChevronRight className="w-5 h-5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-30 italic flex flex-col items-center gap-4">
             <Inbox className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-widest">Nenhuma regra configurada na base</p>
          </div>
        )}
      </div>
    </div>
  );
}
