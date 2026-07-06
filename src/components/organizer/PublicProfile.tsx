
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PublicMenu } from '@/components/organizer/PublicMenu';
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs"
import { 
    MapPin, 
    Globe, 
    Phone, 
    Instagram, 
    Facebook, 
    Twitter, 
    Youtube, 
    Linkedin, 
    ExternalLink, 
    Utensils
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { notFound } from 'next/navigation';

const SocialLink = ({ platform, url }: { platform: string, url: string }) => {
    const icons: { [key: string]: React.ElementType } = {
        instagram: Instagram,
        facebook: Facebook,
        twitter: Twitter,
        youtube: Youtube,
        linkedin: Linkedin,
        website: Globe,
    };
    const Icon = icons[platform] || ExternalLink;
    return <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary"><Icon className="w-5 h-5" /></a>;
};

export function PublicProfile({ org, hasMenu }: { org: any, hasMenu: boolean }) {

    if (!org) return notFound();

    const defaultTab = hasMenu ? "menu" : "about";

    return (
        <div className="w-full">
            {/* --- CAPA E AVATAR --- */}
            <div className="relative h-48 md:h-64 w-full bg-gray-200">
                {org.coverUrl && <Image src={org.coverUrl} alt={`Capa de ${org.nome}`} layout="fill" objectFit="cover" />}
                <div className="absolute -bottom-12 left-6 md:left-10">
                    <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-white shadow-lg">
                        <AvatarImage src={org.logoUrl} alt={`Logo de ${org.nome}`} />
                        <AvatarFallback className="text-3xl font-bold">{org.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {/* --- CABEÇALHO DO PERFIL --- */}
            <div className="pt-16 pb-6 px-6 md:px-10 bg-white">
                <h1 className="text-3xl font-bold text-gray-900">{org.nome}</h1>
                {org.slogan && <p className="mt-1 text-lg text-gray-500">{org.slogan}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                    {org.endereco && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {org.endereco}</div>}
                    {org.telefone && <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {org.telefone}</div>}
                </div>
                <div className="mt-4 flex items-center gap-4">
                    {Object.entries(org.socialLinks || {}).map(([platform, url]) => url && <SocialLink key={platform} platform={platform} url={url as string} />)}
                </div>
            </div>
            
            <Separator />

            {/* --- NAVEGAÇÃO E CONTEÚDO --- */}
             <div className="p-4 sm:p-6 md:p-8">
                {hasMenu ? (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                        <Utensils className="w-10 h-10 mx-auto text-primary" />
                        <h3 className="mt-4 text-xl font-semibold">Nosso Cardápio</h3>
                        <p className="mt-2 text-gray-600 max-w-md mx-auto">Temos uma página exclusiva com todos os nossos pratos, bebidas e sobremesas. Clique no botão abaixo para explorar.</p>
                        <Button asChild className="mt-6">
                            <Link href={`/${org.username}/cardapio`}>Acessar Cardápio Completo</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <h3 className="text-lg font-medium text-gray-800">Sobre Nós</h3>
                        <p className="mt-2 text-gray-500 max-w-prose mx-auto">{org.bio || "Este organizador ainda não compartilhou sua história."}</p>
                    </div>
                )}
            </div>

        </div>
    );
}
