
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Sparkles } from "lucide-react";

interface OrganizerBioProps {
  bio: string;
}

export function OrganizerBio({ bio }: OrganizerBioProps) {
  if (!bio) return null;

  const renderContent = (text: string) => {
    return text.split(/\n\n+/).map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Custom formatting
      const parts = trimmed.split(/(\*\*.*?\*\*|@[\w.]+|\+.*?\+)/g);
      const renderedParts = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-black text-primary">{part.slice(2, -2)}</strong>;
        if (part.startsWith('+') && part.endsWith('+'))
          return <span key={i} className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-primary block my-2">{part.slice(1, -1)}</span>;
        return part;
      });

      return <p key={idx} className="mb-4 last:mb-0 text-lg md:text-xl font-medium text-foreground/80 leading-relaxed">{renderedParts}</p>;
    }).filter(Boolean);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
          <Sparkles className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Manifesto & História</h2>
      </div>
      
      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-8 md:p-12 relative group">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
          <Info className="w-48 h-48 text-primary" />
        </div>
        <CardContent className="p-0 relative z-10">
          <div className="max-w-3xl">
            {renderContent(bio)}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
