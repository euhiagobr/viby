
'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, 
  Search, 
  MapPin, 
  Globe, 
  BadgeCheck, 
  ChevronRight, 
  ArrowRight,
  FilterX,
  Inbox,
  LayoutGrid
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CityCompaniesClientProps {
  initialOrgs: any[];
  cityName: string;
}

export default function CityCompaniesClient({ initialOrgs, cityName }: CityCompaniesClientProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    initialOrgs.forEach(org => {
      if (org.type) cats.add(org.type);
    });
    return Array.from(cats).sort();
  }, [initialOrgs]);

  const filteredOrgs = useMemo(() => {
    return initialOrgs.filter(org => {
      const matchSearch = !search || 
        (org.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (org.username || "").toLowerCase().includes(search.toLowerCase());
      
      const matchCategory = selectedCategory === 'all' || org.type === selectedCategory;
      
      return matchSearch && matchCategory;
    }).sort((a, b) => {
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [initialOrgs, search, selectedCategory]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-3">
          <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-4 h-6 tracking-widest border-none shadow-lg">
            Diretório Local
          </Badge>
          <h1 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter text-primary leading-none">
            Empresas em <br /><span className="text-secondary">{cityName}</span>
          </h1>
          <p className="text-muted-foreground font-medium text-lg max-w-2xl">
            Conecte-se com marcas, produtoras e prestadores de serviço oficiais em {cityName}.
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar pelo nome..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl shadow-sm border-none bg-white" 
          />
        </div>
      </div>

      <section className="space-y-6">
         <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 no-wrap">
            <Button 
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "rounded-full px-6 font-black uppercase text-[10px] tracking-widest transition-all",
                selectedCategory === 'all' ? "bg-primary text-white" : "text-muted-foreground"
              )}
            >
              Ver Tudo
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-full px-6 font-black uppercase text-[10px] tracking-widest transition-all shrink-0",
                  selectedCategory === cat ? "bg-secondary text-white border-none shadow-md" : "text-muted-foreground"
                )}
              >
                {cat}
              </Button>
            ))}
            {selectedCategory !== 'all' && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedCategory('all')} className="rounded-full h-8 w-8 text-destructive">
                 <FilterX className="w-4 h-4" />
              </Button>
            )}
         </div>

         {filteredOrgs.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6">
              {filteredOrgs.map((org) => (
                <Link key={org.id} href={`/${org.username}`} className="group block h-full">
                  <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 h-full flex flex-col">
                    <div className="relative h-32 bg-muted overflow-hidden shrink-0">
                       {org.banner ? (
                         <img src={org.banner} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                       ) : (
                         <div className="w-full h-full bg-primary/5" />
                       )}
                       <div className="absolute inset-0 bg-black/10" />
                    </div>
                    
                    <CardContent className="p-8 pt-0 flex-1 flex flex-col relative">
                       <div className="absolute -top-10 left-8">
                          <Avatar className="h-20 w-20 border-4 border-white shadow-xl rounded-[1.5rem] overflow-hidden">
                             <AvatarImage src={org.avatar} className="object-cover" />
                             <AvatarFallback className="font-black bg-muted text-primary">{org.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                       </div>
                       
                       <div className="mt-12 space-y-4 flex-1">
                          <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors truncate">
                                   {org.name}
                                </h3>
                                {org.verified && <BadgeCheck className="w-5 h-5 fill-blue-500 text-white shrink-0" />}
                             </div>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">@{org.username}</p>
                          </div>

                          <div className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-medium min-h-[48px]">
                             {org.bio || "Nenhuma descrição informada pela marca."}
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                             <Badge variant="secondary" className="bg-muted text-primary border-none text-[8px] font-black uppercase px-2 h-5">
                                {org.type || "Marca"}
                             </Badge>
                             <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                <MapPin className="w-3 h-3" /> {org.neighborhood || org.city}
                             </div>
                          </div>
                       </div>

                       <div className="mt-8 flex items-center justify-between group/btn">
                          <span className="text-[10px] font-black uppercase italic text-secondary tracking-widest">Ver Perfil Oficial</span>
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center transition-all group-hover/btn:bg-secondary group-hover/btn:text-white group-hover/btn:rotate-[-5deg]">
                             <ArrowRight className="w-5 h-5" />
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
           </div>
         ) : (
           <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-border flex flex-col items-center gap-6 shadow-inner animate-in fade-in">
              <Inbox className="w-16 h-16 text-muted-foreground opacity-20" />
              <div className="space-y-2">
                 <h3 className="text-2xl font-black uppercase italic text-primary">Nenhuma marca encontrada</h3>
                 <p className="text-muted-foreground font-medium uppercase text-xs">Tente mudar o filtro ou buscar por outro nome.</p>
              </div>
              <Button variant="outline" onClick={clearFilters} className="rounded-2xl h-14 px-10 border-2 uppercase font-black italic">
                 Limpar Filtros
              </Button>
           </div>
         )}
      </section>

      <div className="p-8 bg-secondary/5 rounded-[3rem] border border-secondary/10 flex flex-col md:flex-row items-center justify-between gap-8">
         <div className="flex items-center gap-4">
            <div className="p-4 bg-white rounded-[1.5rem] shadow-xl text-secondary"><Building2 className="w-8 h-8" /></div>
            <div>
               <h4 className="text-xl font-black uppercase italic tracking-tighter text-primary">Sua empresa em {cityName}?</h4>
               <p className="text-sm font-medium text-muted-foreground">Cadastre-se para aparecer no diretório local da Viby.</p>
            </div>
         </div>
         <Button asChild className="bg-primary text-white font-black h-14 px-12 rounded-2xl shadow-xl uppercase italic hover:scale-105 transition-all">
            <Link href="/anunciar">Começar Agora</Link>
         </Button>
      </div>
    </div>
  );
}

function clearFilters() {
  window.location.reload();
}
