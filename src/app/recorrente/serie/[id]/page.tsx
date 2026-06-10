import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) return String(data);
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }
  return data;
}

async function getSeriesData(id: string) {
  try {
    const db = getAdminDb();
    const seriesRef = db.collection('events').doc(id);
    let snap = await seriesRef.get();
    
    if (!snap.exists) {
      snap = await db.collection('recurring_events').doc(id).get();
    }
    
    if (!snap.exists) return null;

    const occSnap = await db.collection('recurring_occurrences')
      .where('parentId', '==', id)
      .where('status', '==', 'active')
      .get();
    
    const occurrences = occSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    return serializeData({ id: snap.id, ...snap.data(), occurrences });
  } catch (e) {
    console.error("[getSeriesData] Error:", e);
    return null;
  }
}

export default async function SeriesPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getSeriesData(id);

  if (!series) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
       <h1 className="text-2xl font-bold">Série não encontrada</h1>
       <Button asChild><Link href="/">Voltar ao Início</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-20 max-w-4xl">
        <div className="text-center space-y-6 mb-16">
          <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-4 h-6">Série de Eventos</Badge>
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-primary">{series.name}</h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">{series.description}</p>
        </div>

        <div className="space-y-8">
           <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                 <Calendar className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Escolha uma Data</h2>
           </div>

           <div className="grid grid-cols-1 gap-4">
              {series.occurrences.length > 0 ? (
                series.occurrences.map((occ: any) => (
                  <Link key={occ.id} href={`/recorrente/${occ.id}`}>
                    <Card className="border-none shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all rounded-[2rem] bg-white group cursor-pointer">
                      <CardContent className="p-8 flex items-center justify-between">
                         <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center justify-center w-20 h-20 bg-muted rounded-3xl group-hover:bg-secondary/10 transition-colors">
                               <span className="text-[10px] font-black uppercase text-muted-foreground">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                               <span className="text-3xl font-black text-primary">{occ.date.split('-')[2]}</span>
                            </div>
                            <div className="space-y-1">
                               <p className="font-black text-xl uppercase italic text-primary">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                               <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground uppercase">
                                  <span>{occ.startTime} às {occ.endTime}</span>
                               </div>
                            </div>
                         </div>
                         <ArrowRight className="w-6 h-6 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed">
                   <p className="text-sm font-bold text-muted-foreground uppercase">Nenhuma data disponível</p>
                </div>
              )}
           </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}