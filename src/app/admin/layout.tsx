'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { 
  Loader2, 
  ShieldCheck, 
  ArrowLeft, 
  LayoutDashboard, 
  Tag, 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  CalendarDays, 
  LifeBuoy, 
  ShieldAlert, 
  Landmark,
  Receipt,
  Megaphone,
  Mail,
  Scale,
  SendHorizontal,
  UserCheck,
  Zap,
  Ticket,
  Terminal,
  Building2,
  RefreshCw,
  TicketPercent,
  Bell,
  Handshake,
  Send,
  Trash2,
  History,
  Target,
  Globe,
  Map
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Footer from '@/components/layout/Footer';
import Image from "next/image"
import { UserNav } from '@/components/layout/UserNav';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const db = useFirestore();
  const { user, isInitialized, loading: authLoading } = useUser(auth);
  const router = useRouter();
  const pathname = usePathname();
  const { adminProfile, hasPermission, loading: permsLoading } = useAdminPermissions();
  
  const redirecting = useRef(false);

  useEffect(() => {
    if (!isInitialized || authLoading || permsLoading || redirecting.current) return;
    
    if (!user) {
      redirecting.current = true;
      router.push('/login');
      return;
    }

    if (!adminProfile) {
      redirecting.current = true;
      router.push('/dashboard');
    }
  }, [user, isInitialized, authLoading, permsLoading, adminProfile, router]);

  const settingsRef = React.useMemo(() => (db && isInitialized) ? doc(db, "settings", "site") : null, [db, isInitialized])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  if (!isInitialized || authLoading || permsLoading || (!adminProfile && user)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Autenticando...</p>
      </div>
    );
  }

  const navItems = [
    { title: 'Painel', url: '/admin', icon: LayoutDashboard, permission: 'dashboard.view' as any },
    { title: 'Leads (Organização)', url: '/admin/leads', icon: Target, permission: 'marketing.view' as any },
    { title: 'CRM & Marketing', url: '/admin/crm', icon: Mail, permission: 'marketing.emails' as any },
    { title: 'Eventos', url: '/admin/eventos', icon: CalendarDays, permission: 'events.view' as any },
    { title: 'Recorrentes', url: '/admin/eventos-recorrentes', icon: RefreshCw, permission: 'events.view' as any },
    { title: 'Páginas de Cidades', url: '/admin/paginas-cidades', icon: Map, permission: 'events.view' as any },
    { title: 'Páginas', url: '/admin/paginas', icon: Building2, permission: 'organizations.view' as any },
    { title: 'Usuários', url: '/admin/usuarios', icon: Users, permission: 'users.view' as any },
    { title: 'Operação Ingressos', url: '/admin/ingressos', icon: Ticket, permission: 'tickets.view' as any },
    { title: 'Divulgue e Ganhe', url: '/admin/afiliados', icon: Handshake, permission: 'marketing.view' as any },
    { title: 'Parceiros', url: '/admin/marketing/parceiros', icon: Users, permission: 'marketing.view' as any },
    { title: 'Anúncios', url: '/admin/anuncios', icon: Megaphone, permission: 'marketing.view' as any },
    { title: 'Cupons Globais', url: '/admin/cupons', icon: TicketPercent, permission: 'marketing.coupons' as any },
    { title: 'Campanhas', url: '/admin/campanhas', icon: Zap, permission: 'marketing.campaigns' as any },
    { title: 'Fiscal / Impostos', url: '/admin/imposto', icon: Scale, permission: 'financial.view' as any },
    { title: 'Transferências', url: '/admin/transferencias', icon: SendHorizontal, permission: 'financial.payouts' as any },
    { title: 'Financeiro (Contas)', url: '/admin/financeiro', icon: Landmark, permission: 'financial.view' as any },
    { title: 'Presença', url: '/admin/presenca', icon: UserCheck, permission: 'dashboard.view' as any },
    { title: 'Extrato Global', url: '/admin/extrato', icon: Receipt, permission: 'financial.view' as any },
    { title: 'Notificações', url: '/admin/notificacoes', icon: Bell, permission: 'marketing.notifications' as any },
    { title: 'Logs do Sistema', url: '/admin/logs', icon: Terminal, permission: 'settings.view' as any },
    { title: 'E-mails Enviados', url: '/admin/emails', icon: Mail, permission: 'settings.view' as any },
    { title: 'Denúncias', url: '/admin/denuncias', icon: ShieldAlert, permission: 'events.approve' as any },
    { title: 'Prp. Eventos', url: '/admin/solicitacoes-propriedade', icon: UserCheck, permission: 'events.approve' as any },
    { title: 'Remoção Jurídica', url: '/admin/solicitacoes-remocao', icon: Trash2, permission: 'events.approve' as any },
    { title: 'Lixeira Eventos', url: '/admin/lixeira-eventos', icon: History, permission: 'events.approve' as any },
    { title: 'Suporte', url: '/admin/suporte', icon: LifeBuoy, permission: 'tickets.view' as any },
    { title: 'Categorias', url: '/admin/categorias', icon: Tag, permission: 'settings.view' as any },
    { title: 'Equipe Admin', url: '/admin/configuracoes/equipe', icon: Users, permission: 'admins.view' as any },
    { title: 'Configurações', url: '/admin/configuracoes', icon: SettingsIcon, permission: 'settings.edit' as any },
  ];

  const visibleItems = navItems.filter(item => hasPermission(item.permission));

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside className="w-64 bg-primary text-white hidden lg:flex flex-col sticky top-0 h-screen shrink-0">
        <div className="p-8">
          <Link href="/admin" className="flex items-center gap-3">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={140} 
                height={40} 
                className="h-8 w-auto object-contain brightness-0 invert" 
                priority 
                unoptimized
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
                </div>
                <span className="text-xl font-bold tracking-tight">{siteName} Admin</span>
              </>
            )}
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <p className="px-4 text-[10px] font-black uppercase text-white/40 tracking-widest mb-4">Gestão do Sistema</p>
          {visibleItems.map((item) => {
            const isActive = pathname === item.url || (item.url !== '/admin' && pathname?.startsWith(item.url));
            return (
              <Link 
                key={item.url} 
                href={item.url}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm',
                  isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto space-y-2 border-t border-white/5">
          <Button variant="ghost" className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5 gap-3" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4" />
              Painel de Usuário
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-destructive hover:bg-destructive/10 gap-3"
            onClick={() => {
              signOut(auth!);
              router.push('/login');
            }}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-border bg-white flex items-center justify-between px-8 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-secondary" />
            <h2 className="font-bold text-xs uppercase tracking-widest">Console: {adminProfile?.cargo?.toUpperCase()}</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end hidden sm:flex text-right">
                <span className="text-xs font-black uppercase italic text-primary leading-none">{adminProfile?.nome} {adminProfile?.sobrenome}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Viby System Control</span>
             </div>
             <UserNav />
          </div>
        </header>
        <div className="p-10 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
