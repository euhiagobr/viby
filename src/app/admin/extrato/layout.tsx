
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  ListOrdered, 
  ArrowDownCircle, 
  SendHorizontal, 
  BarChart3,
  ShieldCheck,
  Receipt
} from 'lucide-react';

export default function ExtratoERPLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { title: 'Dashboard Executivo', url: '/admin/extrato', icon: LayoutDashboard },
    { title: 'Livro de Lançamentos', url: '/admin/extrato/lancamentos', icon: ListOrdered },
    { title: 'Gestão de Repasses', url: '/admin/extrato/repasses', icon: SendHorizontal },
    { title: 'Controle de Despesas', url: '/admin/extrato/despesas', icon: ArrowDownCircle },
    { title: 'Relatórios Fiscais', url: '/admin/extrato/relatorios', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 p-1 bg-muted/50 rounded-2xl w-fit border border-border/40">
        {navItems.map((item) => (
          <Link 
            key={item.url} 
            href={item.url}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all",
              pathname === item.url 
                ? "bg-white text-primary shadow-sm ring-1 ring-border/50" 
                : "text-muted-foreground hover:text-primary hover:bg-white/50"
            )}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="animate-in fade-in slide-in-from-top-2 duration-500">
        {children}
      </div>
    </div>
  );
}
