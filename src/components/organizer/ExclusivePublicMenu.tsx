
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
    Utensils, Share2, ArrowLeft, Star, User, ShoppingBasket, Tag, 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';

// --- TIPOS ---
interface MenuItem { id: string; nome: string; descricao: string; valor: number; priceDisplayMode?: 'value' | 'consult' | 'hidden'; imageUrl?: string; featured?: boolean; serves?: string; porcao?: string; valorPromocional?: number; promocional?: boolean; alergenicos?: string[]; sectionId?: string; }
interface MenuSection { id: string; nome: string; }
interface Organization {
  id: string;
  nome: string;
  username: string;
  category?: string;
  cidade?: string;
  estado?: string;
  slogan?: string;
  bio?: string;
  logoUrl?: string;
  coverUrl?: string;
  themeColor?: string;
  whatsapp?: string;
  phone?: string;
  contactEmail?: string;
  website?: string;
  instagram?: string;
  endereco?: any;
  preferredCurrency?: string;
}

// --- COMPONENTES INTERNOS ---

const MenuPageHero = ({ org, onShare }: { org: Organization; onShare: () => void; }) => (
    <section className="relative bg-gray-800 text-white pt-24 pb-12">
        <div className="absolute inset-0 z-0">
            {org.coverUrl ? (
                <Image src={org.coverUrl} alt={`Capa de ${org.nome}`} fill className="object-cover" priority unoptimized />
            ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(45deg, ${org.themeColor || '#1f2937'}, ${org.themeColor ? `${org.themeColor}b3` : '#374151'})` }} />
            )}
            <div className="absolute inset-0 bg-black/60 z-10" />
        </div>

        <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Avatar className="w-28 h-28 mx-auto border-4 border-white/20 shadow-xl bg-white">
                <AvatarImage src={org.logoUrl} alt={`Logo de ${org.nome}`} className="p-1"/>
                <AvatarFallback className="text-4xl font-bold text-gray-700">{(org.nome || 'O').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg">{org.nome || 'Nome da Organização'}</h1>
            
            <div className="mt-2 flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-base font-medium text-white/90">
                {org.category && <span>{org.category}</span>}
                {(org.cidade || org.estado) && <span className="hidden md:inline">•</span>}
                {(org.cidade || org.estado) && <span>{[org.cidade, org.estado].filter(Boolean).join(', ')}</span>}
            </div>

            {org.bio && <p className="mt-4 text-lg max-w-2xl mx-auto font-light opacity-95">{org.bio}</p>}

            <div className="mt-8 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center justify-center gap-4 text-sm text-white/80">
                    {org.phone && (
                        <a href={`https://wa.me/${org.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                            📱 {org.phone}
                        </a>
                    )}
                    {org.website && (
                        <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                            🌐 Website
                        </a>
                    )}
                    {org.instagram && (
                        <a href={org.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                            📸 Instagram
                        </a>
                    )}
                </div>
                
                <div className="flex items-center justify-center gap-3 pt-4">
                    <Button onClick={onShare} variant="secondary" size="lg"><Share2 className="w-4 h-4 mr-2"/> Compartilhar</Button>
                    <Button variant="outline" size="lg" asChild className="bg-white/10 border-white/20 hover:bg-white/20 backdrop-blur-sm"><Link href={`/${org.username}`}><ArrowLeft className="w-4 h-4 mr-2"/> Perfil</Link></Button>
                </div>
            </div>
        </div>
    </section>
);

const PriceDisplay = ({ item, currency = 'BRL' }: { item: MenuItem; currency?: string }) => {
    const displayMode = item.priceDisplayMode || 'value';
    if (displayMode === 'consult') return <p className="text-lg font-bold text-gray-800">Sob consulta</p>;
    
    if (displayMode === 'hidden') {
        // Mostra cifra baseado no valor em BRL
        const getPriceCifra = (valor: number) => {
            if (valor <= 50) return '$';
            if (valor <= 150) return '$$';
            if (valor <= 350) return '$$$';
            if (valor <= 800) return '$$$$';
            return '$$$$$';
        };
        return <p className="text-3xl font-bold tracking-tighter text-gray-400">{getPriceCifra(item.valor)}</p>;
    }
    
    const isPromo = item.promocional && item.valorPromocional && item.valorPromocional > 0;
    const format = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(val);
    return (
        <div>
            {isPromo ? (
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-primary">{format(item.valorPromocional!)}</p>
                    <p className="text-md font-medium text-gray-400 line-through">{format(item.valor)}</p>
                </div>
            ) : (
                <p className="text-xl font-bold text-primary">{format(item.valor)}</p>
            )}
        </div>
    );
};

const ItemInfoChips = ({ item }: { item: MenuItem }) => {
    const formatDate = (date: any) => {
        if (!date) return null;
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
        } catch { return null; }
    };
    
    const chips = [
        item.serves && { icon: User, text: `Serve ${item.serves.replace(/[^0-9]/g, '')}` },
        item.porcao && { icon: ShoppingBasket, text: item.porcao },
        item.promocional && item.valorPromocional && { icon: Tag, text: `Promoção${item.promoFim ? ` até ${formatDate(item.promoFim)}` : ''}`, className: 'bg-red-100 text-red-800' },
    ].filter(Boolean);
    if (!chips.length && (!item.alergenicos || item.alergenicos.length === 0)) return null;
    return (
        <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip: any, i) => (
                    <Badge key={i} variant="outline" className={cn("font-normal text-xs py-1 px-2.5", chip.className)}>
                        <chip.icon className="w-3 h-3 mr-1.5" /> {chip.text}
                    </Badge>
                ))}
            </div>
            {item.alergenicos && item.alergenicos.length > 0 && (
                <div className="text-xs text-gray-500">Contém: {item.alergenicos.join(', ')}</div>
            )}
        </div>
    );
};

const MenuItemCard = ({ item, org, isFeatured }: { item: MenuItem, org: Organization, isFeatured?: boolean }) => (
    <div className={cn(
        "bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 border border-gray-100 group",
        isFeatured ? "md:col-span-2" : ""
    )}>
        <div className={cn("grid gap-4", isFeatured ? "md:grid-cols-2" : "")}>
            <div className="relative w-full aspect-[4/3] bg-gray-100">
                {item.imageUrl || org.logoUrl ? (
                    <Image src={item.imageUrl || org.logoUrl!} alt={item.nome} fill className="object-cover" loading="lazy"/>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <Utensils className="w-8 h-8 text-gray-300" />
                    </div>
                )}
                {item.featured && (
                    <Badge className="absolute top-3 right-3 bg-yellow-400 text-gray-900 border-2 border-white shadow-md z-10">
                        <Star className="w-3.5 h-3.5 mr-1.5" /> Especial da Casa
                    </Badge>
                )}
            </div>
            <div className="p-5 flex flex-col">
                <h3 className={cn("font-bold text-gray-900 leading-tight", isFeatured ? "text-3xl" : "text-xl")}>{item.nome}</h3>
                <p className="text-gray-600 mt-2 text-sm flex-grow">{item.descricao}</p>
                <ItemInfoChips item={item} />
                <div className="mt-5 pt-5 border-t border-gray-100 flex justify-end">
                    <PriceDisplay item={item} currency={org?.preferredCurrency || 'BRL'} />
                </div>
            </div>
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export function ExclusivePublicMenu({ org, sections, items }: { org: Organization, sections: MenuSection[], items: MenuItem[] }) {
    const { toast } = useToast();
    const [activeCategory, setActiveCategory] = React.useState('all');

    const handleShare = () => {
        const url = `${window.location.origin}/${org.username}/cardapio`;
        navigator.clipboard.writeText(url);
        toast({ title: "Link do Cardápio Copiado!", description: "Agora você pode compartilhar onde quiser." });
    };

    const handleCategoryClick = (categoryId: string) => {
        if (!categoryId) return;
        const element = document.getElementById(`section-${categoryId}`);
        if (element) {
            const headerOffset = 80; // Altura do header principal
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    };
    
    const allCategories = [{ id: 'all-scroll', nome: 'Todos' }, ...sections];
    
    if (!org) {
        return <div className="py-40 text-center">Carregando informações da organização...</div>
    }

    if (!items || items.length === 0) {
        return (
          <>
             <MenuPageHero org={org} onShare={handleShare} />
             <div className="py-20 text-center bg-white">
                 <Utensils className="w-12 h-12 mx-auto text-gray-400" />
                 <h3 className="mt-4 text-lg font-semibold">Cardápio em breve</h3>
                 <p className="mt-1 text-sm text-gray-500">Este estabelecimento ainda não publicou seus pratos.</p>
             </div>
          </>
        );
    }

    return (
        <>
            <MenuPageHero org={org} onShare={handleShare} />

            <div className="bg-gray-50">
                <nav className="sticky top-[65px] z-30 bg-white/95 backdrop-blur-lg shadow-sm py-3">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2 no-scrollbar">
                            {allCategories.map(cat => (
                                <Button
                                    key={cat.id}
                                    variant={activeCategory === cat.id ? "default" : "outline"}
                                    size="sm" className="rounded-full shrink-0"
                                    onClick={() => handleCategoryClick(cat.id === 'all-scroll' ? sections[0]?.id : cat.id)}
                                >
                                    {cat.nome}
                                </Button>
                            ))}
                        </div>
                    </div>
                </nav>
            
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {sections.map(section => {
                        const sectionItems = items.filter(item => item.sectionId === section.id);
                        if (sectionItems.length === 0) return null;
                        return (
                            <section key={section.id} id={`section-${section.id}`} className="mb-16 scroll-mt-24">
                                <div className="relative text-left mb-8">
                                    <h2 className="text-3xl font-bold text-gray-800">{section.nome}</h2>
                                    <div className="h-1 w-20 bg-primary rounded"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {sectionItems.map((item) => (
                                        <MenuItemCard key={item.id} item={item} org={org} isFeatured={item.featured} />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </main>
            </div>
        </>
    );
}
