
'use client';

import * as React from 'react';
import { useCurrency, CurrencyCode } from '@/contexts/CurrencyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Coins, ChevronDown } from "lucide-react";

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  const currencies: { code: CurrencyCode; label: string; symbol: string }[] = [
    { code: 'BRL', label: 'Real Brasileiro', symbol: 'R$' },
    { code: 'USD', label: 'US Dollar', symbol: '$' },
    { code: 'EUR', label: 'Euro', symbol: '€' },
  ];

  const current = currencies.find(c => c.code === currency) || currencies[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 rounded-xl h-9 px-3 font-bold uppercase text-[10px] tracking-widest hover:bg-muted">
          <span className="text-secondary font-black">{current.symbol}</span>
          <span className="hidden sm:inline">{current.code}</span>
          <ChevronDown className="w-3 h-3 opacity-40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl min-w-[160px]">
        {currencies.map((curr) => (
          <DropdownMenuItem 
            key={curr.code} 
            onClick={() => setCurrency(curr.code)}
            className={currency === curr.code ? "bg-muted font-bold" : "cursor-pointer"}
          >
            <span className="mr-2 text-secondary font-black w-6">{curr.symbol}</span>
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase">{curr.code}</span>
               <span className="text-[9px] opacity-60 uppercase">{curr.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
