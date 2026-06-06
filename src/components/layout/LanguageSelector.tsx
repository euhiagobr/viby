'use client';

import * as React from 'react';
import { useTranslation, Language } from '@/i18n/i18n-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSelector() {
  const { language, setLanguage } = useTranslation();

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'pt-BR', label: 'Português', flag: '🇧🇷' },
    { code: 'en-US', label: 'English', flag: '🇺🇸' },
  ];

  const current = languages.find(l => l.code === language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 rounded-xl h-9 px-3 font-bold uppercase text-[10px] tracking-widest hover:bg-muted">
          <span className="text-sm">{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
          <Globe className="w-3.5 h-3.5 opacity-40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl min-w-[140px]">
        {languages.map((lang) => (
          <DropdownMenuItem 
            key={lang.code} 
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? "bg-muted font-bold" : "cursor-pointer"}
          >
            <span className="mr-2 text-sm">{lang.flag}</span>
            <span className="text-xs font-bold uppercase tracking-widest">{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
