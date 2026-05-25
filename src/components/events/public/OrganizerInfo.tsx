
"use client"

import * as React from "react"
import Link from "next/link"
import { BadgeCheck, ArrowRight, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface OrganizerInfoProps {
  organizer: any
}

export function OrganizerInfo({ organizer }: OrganizerInfoProps) {
  if (!organizer) return null;

  const isVerified = organizer.isVerified || organizer.verified;

  return (
    <div className="flex items-center justify-between p-6 bg-muted/20 rounded-[2.5rem] border border-border/40 hover:border-secondary/20 transition-all group">
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <Avatar className="h-16 w-16 md:h-20 md:w-20 border-2 border-background shadow-xl">
            <AvatarImage src={organizer.avatar} className="object-cover" />
            <AvatarFallback className="bg-primary text-white font-black text-xl">
              {organizer.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md">
              <BadgeCheck className="w-5 h-5 fill-blue-500 text-white" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
             <p className="text-xl font-black uppercase italic tracking-tighter leading-none">{organizer.name}</p>
          </div>
          <p className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> Produtor Oficial
          </p>
        </div>
      </div>

      <Button asChild variant="outline" className="rounded-full h-12 px-8 font-black uppercase text-[10px] tracking-widest gap-2 border-secondary/20 text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm">
        <Link href={`/${organizer.username}`}>
          Ver Perfil <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Button>
    </div>
  )
}
