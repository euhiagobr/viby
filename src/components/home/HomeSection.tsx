
'use client';

import * as React from "react";

interface HomeSectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function HomeSection({ title, subtitle, children }: HomeSectionProps) {
  return (
    <section className="py-20 container mx-auto px-4 flex-1">
      {(title || subtitle) && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-2">
            {title && <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">{title}</h2>}
            {subtitle && <p className="text-muted-foreground font-medium text-lg">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
