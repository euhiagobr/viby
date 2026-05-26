
"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Share2, Globe, Instagram, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "./VerifiedBadge";
import { FollowButton } from "./FollowButton";
import { toast } from "@/hooks/use-toast";

interface OrganizerHeroProps {
  organization: any;
}

export function OrganizerHero({ organization }: OrganizerHeroProps) {
  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!", description: "Compartilhe este perfil." });
    }
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Banner */}
      <div className="relative h-[40vh] md:h-[50vh] w-full">
        {organization.banner ? (
          <Image
            src={organization.banner}
            alt={organization.name}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-primary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* Info Overlay */}
      <div className="container mx-auto px-4 -mt-24 md:-mt-32 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Avatar className="h-40 w-40 md:h-48 md:w-48 border-8 border-background shadow-2xl rounded-[3rem]">
                <AvatarImage src={organization.avatar} className="object-cover" />
                <AvatarFallback className="text-4xl font-black bg-muted">
                  {organization.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            <div className="space-y-3 pb-2">
              <div className="flex flex-col gap-1">
                <Badge className="w-fit mx-auto md:mx-0 bg-secondary text-white font-black uppercase text-[10px] tracking-widest px-3">
                  {organization.type || "Produtor"}
                </Badge>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary leading-none">
                    {organization.name}
                  </h1>
                  {organization.verified && <VerifiedBadge />}
                </div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  @{organization.username}
                </p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start items-center gap-8 pt-2">
                <StatItem label="Seguidores" value={organization.followersCount || 0} />
                <StatItem label="Eventos" value={organization.totalEventsCount || 0} />
                <StatItem label="Público Total" value={organization.totalAttendeesCount || 0} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
            <FollowButton organizationId={organization.id} />
            <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-2" onClick={handleShare} title="Compartilhar">
              <Share2 className="w-5 h-5" />
            </Button>
            {organization.website && (
              <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-2" asChild title="Site Oficial">
                <a href={organization.website} target="_blank" rel="noopener noreferrer"><Globe className="w-5 h-5" /></a>
              </Button>
            )}
            {organization.instagram && (
              <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-2" asChild title="Instagram">
                <a href={`https://instagram.com/${organization.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"><Instagram className="w-5 h-5" /></a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col md:items-start">
      <span className="text-2xl font-black italic tracking-tighter text-primary">
        {value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
        {label}
      </span>
    </div>
  );
}
