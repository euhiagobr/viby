"use client";

import { Card, CardContent } from "@/components/ui/card";
import { 
  Instagram, 
  Youtube, 
  Twitter, 
  Linkedin, 
  Globe, 
  Phone, 
  Music, 
  Radio, 
  Video,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrganizerSocialsProps {
  organization: any;
}

const SOCIAL_MAP: Record<string, any> = {
  instagram: { icon: Instagram, color: "text-pink-500", bg: "bg-pink-50" },
  tiktok: { icon: Video, color: "text-slate-900", bg: "bg-slate-100" },
  youtube: { icon: Youtube, color: "text-red-500", bg: "bg-red-50" },
  spotify: { icon: Music, color: "text-green-500", bg: "bg-green-50" },
  soundcloud: { icon: Radio, color: "text-orange-500", bg: "bg-orange-50" },
  whatsapp: { icon: Phone, color: "text-emerald-500", bg: "bg-emerald-50" },
  linkedin: { icon: Linkedin, color: "text-blue-600", bg: "bg-blue-50" },
  twitter: { icon: Twitter, color: "text-sky-500", bg: "bg-sky-50" },
  website: { icon: Globe, color: "text-primary", bg: "bg-primary/5" },
};

export function OrganizerSocials({ organization }: OrganizerSocialsProps) {
  const links = organization.socialLinks || {};
  
  const activeLinks = Object.entries(links).filter(([key, url]) => {
    if (!url) return false;
    // Respeita as configurações de privacidade globais para redes específicas
    if (key === 'instagram' && organization.showInstagram === false) return false;
    return true;
  });

  if (activeLinks.length === 0) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Conexões Digitais</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {activeLinks.map(([key, url]: [string, any]) => {
          const config = SOCIAL_MAP[key] || SOCIAL_MAP.website;
          return (
            <a 
              key={key} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group block"
            >
              <Card className="border-none shadow-sm rounded-3xl bg-white hover:bg-muted/50 transition-all hover:-translate-y-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl shrink-0 transition-transform group-hover:scale-110", config.bg, config.color)}>
                    <config.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase opacity-40">{key}</p>
                    <p className="text-[11px] font-bold truncate">Acessar</p>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
