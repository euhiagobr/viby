
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Sparkles } from "lucide-react";
import { RichText } from "@/components/ui/rich-text";

interface OrganizerBioProps {
  bio: string;
}

export function OrganizerBio({ bio }: OrganizerBioProps) {
  if (!bio) return null;

  const renderContent = (text: string) => {
    return text.split(/\n\n+/).map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('# ')) {
        return (
          <h3 key={idx} className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-primary block my-4 leading-none">
            <RichText content={trimmed.replace('# ', '')} />
          </h3>
        );
      }

      return (
        <div key={idx} className="mb-4 last:mb-0 text-lg md:text-xl font-medium text-foreground/80 leading-relaxed">
          <RichText content={trimmed} />
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
          <Sparkles className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Sobre</h2>
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
