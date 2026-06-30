
'use client';

import * as React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Share2, 
  ShieldCheck, 
  Clock, 
  Building2,
  BadgeCheck,
  Info,
  ArrowLeft
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichText } from '@/components/ui/rich-text';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ExperienciaPublicaClientProps {
  experience: any;
}

export default function ExperienciaPublicaClient({ experience }: ExperienciaPublicaClientProps) {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: experience.title,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copiado!");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack />

      <main className="flex-1 container mx-auto px-4 py-12 md:py-24 max-w-4xl space-y-12 animate-in fade-in duration-700">
         <div className="flex flex-col items-center text-center space-y-6">
            <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-6 h-7 tracking-widest border-none shadow-lg">
               Vivência Cultural
            </Badge>
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">
               {experience.title}
            </h1>
            <p className="text-xl md:text-2xl font-medium text-muted-foreground max-w-2xl leading-relaxed uppercase tracking-wide italic">
               {experience.shortDescription}
            </p>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-12">
               <section className="space-y-6">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                     <Info className="w-4 h-4 text-secondary" /> Detalhes da Experiência
                  </h2>
                  <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                     <CardContent className="p-8 md:p-12">
                        <RichText content={experience.description} className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" />
                     </CardContent>
                  </Card>
               </section>

               <div className="p-8 bg-secondary/5 rounded-[2.5rem] border-2 border-dashed border-secondary/20 flex items-start gap-6">
                  <div className="p-4 bg-white rounded-2xl shadow-sm text-secondary">
                     <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-lg font-black uppercase italic tracking-tighter text-primary">Disponibilidade em breve</h3>
                     <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        Esta experiência está em fase de lançamento. Fique atento às redes oficiais do organizador para a abertura da agenda e venda de acessos.
                     </p>
                  </div>
               </div>
            </div>

            <aside className="lg:col-span-4 space-y-8">
               <Card className="border-none shadow-xl rounded-[2rem] bg-white p-8 space-y-8 sticky top-24">
                  <div className="space-y-6">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 border-2 border-secondary/10 p-0.5">
                           <AvatarImage src={experience.organizer?.avatar} className="rounded-full object-cover" />
                           <AvatarFallback className="font-bold text-xl uppercase">{experience.organizer?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-sm uppercase italic text-primary truncate">{experience.organizer?.name}</h4>
                              <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                           </div>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">@{experience.organizer?.username}</p>
                        </div>
                     </div>
                     <Separator className="border-dashed" />
                     <div className="space-y-4">
                        <Button onClick={handleShare} className="w-full h-12 bg-secondary text-white font-black rounded-xl uppercase italic text-[11px] gap-2 shadow-lg">
                           <Share2 className="w-4 h-4" /> Indicar para Amigos
                        </Button>
                        <Button variant="outline" asChild className="w-full h-12 rounded-xl font-bold uppercase text-[10px] border-secondary text-secondary">
                           <Link href={`/${experience.organizer?.username}`}>Ver Perfil da Marca</Link>
                        </Button>
                     </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-2xl flex items-start gap-3">
                     <ShieldCheck className="w-4 h-4 text-secondary opacity-40 shrink-0" />
                     <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">
                        Experiência protegida pela curadoria oficial Viby.
                     </p>
                  </div>
               </Card>
            </aside>
         </div>
      </main>

      <Footer />
    </div>
  );
}
