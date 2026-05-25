
"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BadgeCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function OrganizerInfo({ organizer }: { organizer: any }) {
  if (!organizer) return null;

  return (
    <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-border/40 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-secondary/10 p-0.5">
          <AvatarImage src={organizer.avatar} className="object-cover" />
          <AvatarFallback className="font-bold bg-muted">{organizer.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Organizado por</p>
          <div className="flex items-center gap-1.5">
            <h4 className="font-black text-lg uppercase italic tracking-tighter text-primary">{organizer.name}</h4>
            {organizer.isVerified && <BadgeCheck className="w-5 h-5 fill-blue-500 text-white" />}
          </div>
        </div>
      </div>
      <Button asChild variant="ghost" className="rounded-full font-black text-[10px] uppercase tracking-widest gap-2 hover:bg-secondary/5 text-secondary">
        <Link href={`/${organizer.username}`}>
          Ver Perfil <ArrowRight className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  )
}
