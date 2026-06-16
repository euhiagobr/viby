
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Send, 
  Users, 
  Layout, 
  Zap, 
  History,
  Target
} from 'lucide-react';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { title: 'Dashboard', url: '/admin/crm', icon: LayoutDashboard },
    { title: 'Campanhas', url: '/admin/crm/campanhas', icon: Send },
    { title: 'Segmentos', url: '/admin/crm/segmentos', icon: Users },
    { title: 'Templates', url: '/admin/crm/templates', icon: Layout },
    { title: 'Automações', url: '/admin/crm/automacoes', icon: Zap },
    { title: 'Histórico', url: '/admin/crm/historico', icon: History },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-secondary/10 rounded-2xl text-secondary">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary leading-none">CRM & Marketing</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Gestão de Relacionamento e Crescimento</p>
        </div>
      </div>

      <nav className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-2xl w-fit border border-border/40 shadow-inner">
        {navItems.map((item) => {
          const isActive = pathname === item.url || (item.url !== '/admin/crm' && pathname?.startsWith(item.url));
          return (
            <Link 
              key={item.url} 
              href={item.url}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all",
                isActive 
                  ? "bg-white text-primary shadow-sm ring-1 ring-border/50" 
                  : "text-muted-foreground hover:text-primary hover:bg-white/50"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      
      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
