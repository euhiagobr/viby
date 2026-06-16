'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Smartphone, 
  Layers, 
  Plus, 
  History,
  ChevronRight,
  Clock,
  Download,
  Image as ImageIcon,
  Inbox,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  {
    id: 'agenda',
    title: 'Agenda da Semana',
    description: 'Lista vertical de eventos com fotos e datas.',
    icon: CalendarDays,
    url: '/admin/imagens/agenda',
    color: 'text-secondary',
    bg: 'bg-secondary/10'
  },
  {
    id: 'stories',
    title: 'Stories Únicos',
    description: 'Destaque para um único evento em 9:16.',
    icon: Smartphone,
    url: '/admin/imagens/stories',
    color: 'text-primary',
    bg: 'bg-primary/10'
  },
  {
    id: 'carrossel',
    title: 'Carrosséis',
    description: 'Sequência de artes para Feed do Instagram.',
    icon: Layers,
    url: '/admin/imagens/carrossel',
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  }
];

export default function ImagensDashboard() {
  const db = useFirestore();

  const historyQuery = useMemoFirebase(() => 
    db ? query(collection(db, "generated_images_logs"), orderBy("createdAt", "desc"), limit(10)) : null,
    [db]
  );
  const { data: logs, loading } = useCollection<any>(historyQuery);

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary px-2">Templates Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TEMPLATES.map((t) => (
            <Link key={t.id} href={t.url}>
              <Card className="border-none shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all rounded-[2rem] bg-white group overflow-hidden h-full">
                <CardHeader className="p-8">
                  <div className={cn("p-3 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform", t.bg, t.color)}>
                    <t.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">{t.title}</CardTitle>
                  <CardDescription className="font-medium text-xs mt-1">{t.description}</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-secondary">
                      Começar a criar <ChevronRight className="w-3.5 h-3.5" />
                   </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-2">
             <History className="w-5 h-5 text-secondary" /> Últimas Gerações
           </h2>
        </div>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-0">
             {loading ? (
               <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
             ) : logs && logs.length > 0 ? (
               <div className="divide-y">
                 {logs.map((log: any) => (
                   <div key={log.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
                            {log.thumbnailUrl ? <img src={log.thumbnailUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 opacity-10" />}
                         </div>
                         <div className="space-y-0.5">
                            <p className="font-bold text-sm text-primary uppercase">{log.templateName}</p>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase">
                               <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(log.createdAt?.seconds * 1000).toLocaleString('pt-BR')}</span>
                               <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {log.format}</span>
                            </div>
                         </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground/30"><ChevronRight className="w-5 h-5" /></Button>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="py-32 text-center opacity-20 italic flex flex-col items-center gap-4">
                  <Inbox className="w-12 h-12" />
                  <p className="text-xs font-black uppercase tracking-widest">Nenhuma imagem gerada recentemente</p>
               </div>
             )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
