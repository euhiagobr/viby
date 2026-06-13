
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { 
  Share2, 
  MapPin, 
  BadgeCheck, 
  Heart, 
  MessageCircle, 
  Edit, 
  Lock as LockIcon, 
  EyeOff,
  Instagram,
  Facebook,
  Mail,
  Phone,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FollowButton } from "@/components/organizer/FollowButton";

interface UserHeroProps {
  profile: any;
  gamification: any;
  followersCount: number;
  followingCount: number;
  eventsCount: number;
  isOwner?: boolean;
}

export function UserHero({ 
  profile, 
  gamification,
  followersCount, 
  followingCount, 
  eventsCount,
  isOwner = false 
}: UserHeroProps) {
  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!", description: "Compartilhe este perfil." });
    }
  };

  const showStats = isOwner || !profile.privacy?.hideStats;
  const showGamification = isOwner || !profile.privacy?.hideGamification;
  const showFollowers = isOwner || !profile.privacy?.hideFollowers;

  const renderLocation = () => {
    const visibility = profile.addressVisibility || (profile.privacy?.hideLocation ? 'hidden' : 'city');
    if (visibility === 'hidden') return null;

    const loc = profile.location || {};
    const city = loc.city || profile.city;
    const state = loc.state || profile.state;
    const country = loc.country || profile.country;
    const neighborhood = loc.neighborhood || profile.neighborhood;

    if (visibility === 'city') {
      const parts = [city, country].filter(Boolean);
      if (parts.length === 0) return null;
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
          <MapPin className="w-3 h-3" /> {parts.join(", ")}
        </div>
      );
    }

    // Full visibility (Neighborhood, City, State, Country)
    const parts = [neighborhood, city, state, country].filter(Boolean);
    if (parts.length === 0) return null;

    return (
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
        <MapPin className="w-3 h-3" /> {parts.join(" • ")}
      </div>
    );
  };

  return (
    <section className="relative w-full">
      {/* Banner / Cover */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-primary/5">
        {profile.banner ? (
          <img src={profile.banner} alt="Capa" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 via-secondary/5 to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-20 md:-mt-24 relative z-10 max-w-7xl">
        <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
          {/* Avatar and Name */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <Avatar className="h-40 w-40 md:h-44 md:w-44 border-8 border-background shadow-2xl rounded-[3rem]">
                <AvatarImage src={profile.avatar} className="object-cover" />
                <AvatarFallback className="text-4xl font-black bg-muted">{profile.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              {showGamification && (
                <div className="absolute -bottom-2 -right-2 bg-secondary text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-xl border-4 border-background">
                   Lv. {gamification?.level || 1}
                </div>
              )}
            </motion.div>

            <div className="space-y-3 pb-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-primary leading-none">
                    {profile.name || "Membro Viby"}
                  </h1>
                  {profile.isVerified && <BadgeCheck className="w-6 h-6 fill-blue-500 text-white" />}
                  {isOwner && (
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5">Seu Perfil</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <span className="text-sm font-bold text-secondary uppercase tracking-widest">@{profile.username}</span>
                  {renderLocation()}
                  {isOwner && profile.addressVisibility === 'hidden' && (
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                      <EyeOff className="w-3 h-3" /> Localização Privada
                    </div>
                  )}
                </div>
              </div>

              {profile.bio && (
                <p className="text-sm font-medium text-muted-foreground max-w-md line-clamp-2">
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 pt-2">
                {showFollowers && <StatItem label="Seguidores" value={followersCount} />}
                {isOwner && <StatItem label="Seguindo" value={followingCount} />}
                {showStats && <StatItem label="Experiências" value={eventsCount} />}
              </div>

              {/* Social Quick Links */}
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 pt-3">
                 {profile.instagramPublico && profile.instagram && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-pink-50 hover:text-pink-500 transition-colors" asChild>
                       <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                          <Instagram className="w-4 h-4" />
                       </a>
                    </Button>
                 )}
                 {profile.facebookPublico && profile.facebook && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" asChild>
                       <a href={`https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer">
                          <Facebook className="w-4 h-4" />
                       </a>
                    </Button>
                 )}
                 {profile.whatsappPublico && profile.whatsapp && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors" asChild>
                       <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                          <Phone className="w-4 h-4" />
                       </a>
                    </Button>
                 )}
                 {profile.emailPublico && profile.email && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors" asChild>
                       <a href={`mailto:${profile.email}`}>
                          <Mail className="w-4 h-4" />
                       </a>
                    </Button>
                 )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
            {isOwner ? (
              <Button asChild className="bg-primary text-white font-black uppercase italic h-12 px-8 rounded-2xl shadow-xl hover:scale-105 transition-all gap-2">
                 <Link href="/dashboard/perfil/editar"><Edit className="w-4 h-4" /> Editar Perfil</Link>
              </Button>
            ) : (
              <>
                <FollowButton organizationId={profile.id} username={profile.username} targetType="user" />
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-2 hover:bg-muted">
                   <MessageCircle className="w-5 h-5" />
                </Button>
              </>
            )}
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-2" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col md:items-start group cursor-default">
      <span className="text-xl font-black italic tracking-tighter text-primary">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
        {label}
      </span>
    </div>
  );
}
