'use client';

import * as React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Share2, 
  Clock, 
  BadgeCheck,
  MapPin,
  Star,
  Users,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Info,
  Zap,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichText } from '@/components/ui/rich-text';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useFirestore } from '@/firebase';
import { ExperiencePublicReviews } from '@/components/experiences/ExperiencePublicReviews';
import { CommunityGallery } from '@/components/experiences/CommunityGallery';
import { ExperienceBookingCard } from '@/components/experiences/ExperienceBookingCard';
import { EXPERIENCE_CHARACTERISTICS, EXPERIENCE_RULES } from '@/lib/experience-catalog';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface ExperienciaPublicaClientProps {
  experience: any;
}

export default function ExperienciaPublicaClient({ experience }: ExperienciaPublicaClientProps) {
  const db = useFirestore();
  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);

  const attributes = React.useMemo(() => {
    return (experience.characteristics || []).map((id: string) => 
      EXPERIENCE_CHARACTERISTICS.find(c => c.id === id)
    ).filter(Boolean);
  }, [experience.characteristics]);

  const rules = React.useMemo(() => {
    return (experience.rules || []).map((rule: any) => {
      const id = typeof rule === 'string' ? rule : rule.id;
      const catalog = EXPERIENCE_RULES.find(r => r.id === id);
      if (catalog) return { ...catalog };
      return typeof rule === 'string' ? { label: rule, icon: 'info' } : rule;
    });
  }, [experience.rules]);

  const lat = experience.latitude || experience.address?.latitude || -23.55052;
  const lng = experience.longitude || experience.address?.longitude || -46.633308;

  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-secondary/10 selection:text-secondary">
      <PublicHeader showBack />

      <main className="flex-1 pb-32">
        {/* PREMIUM GALLERY HEADER */}
        <section className="container mx-auto px-4 pt-8 md:pt-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[500px] md:h-[600px] rounded-[3rem] overflow-hidden shadow-2xl relative group">
             <div className="md:col-span-2 relative h-full">
                <Image src={experience.image} alt={experience.title} fill className="object-cover" priority unoptimized />
             </div>
             <div className="hidden md:grid grid-cols-2 grid-rows-2 col-span-2 gap-2 h-full">
                {Array.from({ length: 4 }).map((_, i) => {
                  const url = experience.gallery?.[i];
                  if (!url) return <div key={i} className="bg-muted/30" />;
                  return (
                    <div key={i} className="relative bg-muted overflow-hidden">
                       <Image src={url} alt="" fill className="object-cover" unoptimized />
                    </div>
                  );
                })}
             </div>
             {experience.gallery?.length > 4 && (
               <button 
                onClick={() => setIsGalleryOpen(true)}
                className="absolute bottom-8 right-8 bg-white/90 backdrop-blur-md text-primary font-black uppercase italic text-xs h-12 px-8 rounded-2xl shadow-xl hover:bg-white border-none z-10"
               >
                 + {experience.gallery.length - 4} Fotos
               </button>
             )}
          </div>
        </section>

        <div className="container mx-auto px-4 pt-12 max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8 space-y-20">
            
            {/* CLEAN IDENTITY HEADER */}
            <section className="space-y-6">
               <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                     <Badge className="bg-secondary text-white border-none font-black uppercase text-[10px] tracking-widest px-4 h-6">Experiência</Badge>
                     {experience.reviewCount > 0 && (
                       <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                          <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                          <span className="text-sm font-black">{Number(experience.averageRating || 5.0).toFixed(1)} <span className="opacity-40 font-bold">({experience.reviewCount})</span></span>
                       </div>
                     )}
                  </div>
                  <h1 className="text-4xl md:text-7xl font-black text-primary uppercase tracking-tighter leading-[0.85]">{experience.title}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground font-bold text-lg uppercase tracking-tight">
                     <MapPin className="w-5 h-5 text-secondary" /> {experience.city} • {experience.state}
                  </div>
               </div>

               <div className="flex flex-wrap gap-4 pt-4 border-t border-dashed">
                  {experience.duration?.value && <Highlight icon={Clock} label={`${experience.duration.value} ${experience.duration.unit}`} />}
                  {experience.maxGroupSize && <Highlight icon={Users} label={`Até ${experience.maxGroupSize} pessoas`} />}
                  {experience.confirmationType === 'immediate' && <Highlight icon={Zap} label="Reserva Imediata" />}
                  {experience.digitalVoucher && <Highlight icon={ShieldCheck} label="Voucher Digital" />}
               </div>

               {attributes.length > 0 && (
                 <div className="flex flex-wrap gap-8 pt-4">
                    {attributes.map((attr: any) => (
                      <div key={attr.id} className="flex items-center gap-2 opacity-70">
                         <attr.icon className="w-4 h-4 text-primary" />
                         <span className="text-[10px] font-black uppercase tracking-tight">{attr.label}</span>
                      </div>
                    ))}
                 </div>
               )}
            </section>

            <section className="space-y-8">
               <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-2">
                 <Info className="w-4 h-4 text-secondary" /> Sobre esta experiência
               </h2>
               <div className="prose prose-slate max-w-none">
                  <RichText content={experience.description} className="text-xl font-medium text-foreground/70 leading-relaxed" />
               </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 {experience.inclusions?.length > 0 && (
                   <div className="space-y-6">
                      <h3 className="font-black uppercase italic tracking-tighter text-xl text-primary">Incluso</h3>
                      <ul className="space-y-4">
                         {experience.inclusions.map((item: any, i: number) => (
                           <li key={i} className="flex items-center gap-3 text-lg font-medium text-foreground/70">
                              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" /> {item.label}
                           </li>
                         ))}
                      </ul>
                   </div>
                 )}
                 {experience.exclusions?.length > 0 && (
                   <div className="space-y-6">
                      <h3 className="font-black uppercase italic tracking-tighter text-xl text-primary">Não incluso</h3>
                      <ul className="space-y-4">
                         {experience.exclusions.map((item: any, i: number) => (
                           <li key={i} className="flex items-center gap-3 text-lg font-medium text-muted-foreground/60">
                              <XCircle className="w-6 h-6 text-destructive shrink-0 opacity-40" /> {item.label}
                           </li>
                         ))}
                      </ul>
                   </div>
                 )}
            </section>

            <section className="space-y-8">
               <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground px-2">Localização</h2>
               <div className="h-96 rounded-[3rem] overflow-hidden shadow-xl border relative">
                  <LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} />
                  <div className="absolute bottom-6 right-6 z-10">
                     <Button asChild className="bg-white text-primary font-black h-12 rounded-2xl shadow-xl uppercase italic text-[10px] border">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank">Google Maps</a>
                     </Button>
                  </div>
               </div>
            </section>

            {experience.faqs?.length > 0 && (
              <section className="space-y-8">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><HelpCircle className="w-6 h-6" /></div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Dúvidas</h2>
                 </div>
                 <Accordion type="single" collapsible className="w-full space-y-4">
                    {experience.faqs.map((faq: any, i: number) => (
                      <AccordionItem key={i} value={`faq-${i}`} className="border-none">
                         <Card className="border-none shadow-sm bg-muted/10 rounded-[1.5rem] overflow-hidden">
                            <AccordionTrigger className="px-8 py-6 hover:no-underline font-black uppercase italic text-primary text-left">
                              {faq.q}
                            </AccordionTrigger>
                            <AccordionContent className="px-8 pb-6 text-base font-medium text-muted-foreground leading-relaxed">
                              {faq.a}
                            </AccordionContent>
                         </Card>
                      </AccordionItem>
                    ))}
                 </Accordion>
              </section>
            )}
          </div>

          <aside className="lg:col-span-4">
             <div className="sticky top-24 space-y-8">
                <ExperienceBookingCard experience={experience} />
                
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 space-y-6">
                   <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-4 border-muted">
                         <AvatarImage src={experience.organizer?.avatar} className="object-cover" />
                         <AvatarFallback className="font-black">{experience.organizer?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                         <div className="flex items-center gap-1.5">
                            <h4 className="font-black text-lg uppercase italic text-primary leading-none">{experience.organizer?.name}</h4>
                            {(experience.organizer?.verified || experience.organizer?.isVerified) && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                         </div>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Anfitrião Verificado</p>
                      </div>
                   </div>
                   <Button variant="ghost" asChild className="w-full h-10 rounded-xl font-black uppercase italic text-[10px] gap-2 border">
                      <Link href={`/${experience.organizer?.username}`}>Ver Perfil <ArrowRight className="w-3.5 h-3.5" /></Link>
                   </Button>
                </Card>
             </div>
          </aside>
        </div>

        <CommunityGallery experienceId={experience.id} />
        <ExperiencePublicReviews experience={experience} />
      </main>
      <Footer />
    </div>
  );
}

function Highlight({ icon: Icon, label }: any) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl">
       <Icon className="w-4 h-4 text-secondary" />
       <span className="text-[10px] font-black uppercase tracking-tight text-primary/80">{label}</span>
    </div>
  )
}
