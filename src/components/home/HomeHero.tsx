
'use client';

import * as React from "react";
import Link from "next/link";
import { Search, MapPin, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/i18n/i18n-context";

interface HomeHeroProps {
  searchName: string;
  setSearchName: (v: string) => void;
  searchCity: string;
  setSearchCity: (v: string) => void;
}

export function HomeHero({ searchName, setSearchName, searchCity, setSearchCity }: HomeHeroProps) {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-primary text-white text-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/40 to-primary" />
      </div>
      <div className="container mx-auto px-4 relative z-10 py-20">
        <div className="max-w-5xl mx-auto space-y-10 flex flex-col items-center">
          <Link href="/copa-do-mundo">
            <Badge className="bg-[#ffdf00] text-[#002776] border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest w-fit flex items-center gap-2 animate-pulse cursor-pointer">
              <Trophy className="w-3.5 h-3.5 fill-current" /> Onde assistir à Copa do Mundo 2026
            </Badge>
          </Link>
          <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8]">
            {t('home.hero_title_1')} <span className="text-secondary">{t('home.hero_title_2')}</span>
          </h1>
          <p className="text-lg md:text-2xl font-medium opacity-80 max-w-2xl leading-relaxed">
            {t('home.hero_subtitle')}
          </p>

          <Card className="bg-black/70 backdrop-blur-2xl border-white/10 rounded-[3rem] p-6 md:p-8 shadow-2xl mt-12 w-full text-left">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input 
                  placeholder={t('home.search_placeholder')} 
                  className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <div className="md:col-span-4 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                <Input 
                  placeholder={t('home.where_placeholder')} 
                  className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                />
              </div>
              <div className="md:col-span-4">
                 <Button onClick={() => window.scrollTo({top: 800, behavior:'smooth'})} className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl">
                    Explorar Agora
                 </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
