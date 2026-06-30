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
  ArrowLeft,
  MapPin,
  Navigation,
  CheckCircle2,
  ShoppingBag,
  Coins
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichText } from '@/components/ui/rich-text';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCurrency, CurrencyCode } from '@/contexts/CurrencyContext';
import { Separator } from '@/components/ui/separator';

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface ExperienciaPublicaClientProps {
  experience: any;
}

export default function ExperienciaPublicaClient({ experience }: ExperienciaPublicaClientProps) {
  const { formatPriceWithOriginal } = useCurrency();

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

  const address = experience.address || {};
  const lat = address.latitude || experience.latitude || -23.55052;
  const lng = address.longitude || experience.longitude || -46.633308;
  const locationQuery = encodeURIComponent(`${address.addressLine1} ${address.city}`);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack />

      <main className="flex-1 animate-in fade-in duration-700">
        {/* Banner Section */}
        <div className="relative h-[40vh] md:h-[60vh] w-full overflow-hidden bg-black">
          {experience.image && (
            <Image 
              src={experience.image} 
              alt={experience.title} 
              fill 
              className="object-cover opacity-80"
              priority
              unoptimized 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full">
            <div className="container mx-auto max-w-6xl space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">
                  Vivência Cultural
                </Badge>
              </div>
              <h1 className="text-4xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-[0.85]">{experience.title}</h1>
              <p className="text-lg md:text-2xl font-medium text-primary/70 max-w-2xl leading-relaxed uppercase tracking-wide italic">
                {experience.shortDescription}
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            
            {/* Galeria se existir */}
            {experience.gallery?.length > 0 && (
              <section className="space-y-6">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2">Galeria</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {experience.gallery.map((url: string, i: number) => (
                     <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
                        <Image src={url} alt={`Preview ${i}`} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                     </div>
                   ))}
                </div>
              </section>
            )}

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

            {/* Localização Reutilizada */}
            <section className="space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-secondary" /> Localização
              </h2>
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <div className="h-64 w-full">
                  <LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} />
                </div>
                <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="space-y-1 text-center md:text-left">
                      <h4 className="font-black text-xl uppercase italic tracking-tighter text-primary">
                        {address.venueName || "Local de Realização"}
                      </h4>
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        {address.addressLine1} {address.streetNumber && `, ${address.streetNumber}`}
                        <br />
                        {address.neighborhood && `${address.neighborhood}, `} {address.city} - {address.stateRegion}
                      </p>
                   </div>
                   <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${locationQuery}`} target="_blank">
                        <Navigation className="w-4 h-4" /> GPS
                      </a>
                   </Button>
                </CardContent>
              </Card>
            </section>

            {/* Informações Adicionais */}
            {(experience.additionalInfo || experience.usagePolicy) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {experience.additionalInfo && (
                  <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Informações Úteis</h4>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">{experience.additionalInfo}</p>
                  </Card>
                )}
                {experience.usagePolicy && (
                  <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary">Políticas e Regras</h4>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">{experience.usagePolicy}</p>
                  </Card>
                )}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-8">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 space-y-8 sticky top-24">
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

                <div className="space-y-6">
                   <div className="flex justify-between items-end">
                      <div className="space-y-1">
                         <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Valor da Experiência</p>
                         {formatPriceWithOriginal(experience.price || 0, (experience.currency || 'BRL') as CurrencyCode)}
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Vagas</p>
                         <p className="text-sm font-bold">{experience.capacity || "Ilimitado"}</p>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <Button disabled className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-sm gap-2">
                        <ShoppingBag className="w-5 h-5" /> Reservar Vaga
                      </Button>
                      <div className="p-3 bg-muted/50 rounded-xl flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 opacity-30 shrink-0 mt-0.5" />
                        <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight">Vendas e agendamento serão habilitados na Etapa 3.</p>
                      </div>
                   </div>
                </div>

                <Separator className="border-dashed" />

                <div className="space-y-4">
                  <Button onClick={handleShare} variant="outline" className="w-full h-11 rounded-xl font-black uppercase italic text-[11px] gap-2 border-secondary/20 text-secondary">
                    <Share2 className="w-4 h-4" /> Indicar para Amigos
                  </Button>
                  <Button variant="ghost" asChild className="w-full h-11 rounded-xl font-bold uppercase text-[10px] text-muted-foreground">
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
