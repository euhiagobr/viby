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
  Map,
  ImageIcon,
  Calculator,
  ScanQrCode,
  ChevronDown,
  Layout,
  Coins,
  Wallet,
  User,
  Star,
  Code2,
  Cpu,
  Key
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';

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

  const navGroups = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        { title: 'Painel', url: '/admin', icon: LayoutDashboard, permission: 'dashboard.view' as any },
      ]
    },
    {
      id: 'eventos',
      title: 'Eventos',
      icon: Ticket,
      items: [
        { title: 'Eventos', url: '/admin/eventos', icon: CalendarDays, permission: 'events.view' as any },
        { title: 'Recorrentes', url: '/admin/eventos-recorrentes', icon: RefreshCw, permission: 'events.view' as any },
        { title: 'Operação Ingressos', url: '/admin/ingressos', icon: Ticket, permission: 'tickets.view' as any },
        { title: 'Scanner Portaria', url: '/dashboard/scanner', icon: ScanQrCode, permission: 'tickets.view' as any },
        { title: 'Presença', url: '/admin/presenca', icon: UserCheck, permission: 'dashboard.view' as any },
        { title: 'Lixeira Eventos', url: '/admin/lixeira-eventos', icon: History, permission: 'events.approve' as any },
      ]
    },
    {
      id: 'conteudo',
      title: 'Conteúdo',
      icon: Globe,
      items: [
        { title: 'Páginas', url: '/admin/paginas', icon: Building2, permission: 'organizations.view' as any },
        { title: 'Páginas de Cidades', url: '/admin/paginas-cidades', icon: Map, permission: 'events.view' as any },
        { title: 'Categorias', url: '/admin/categorias', icon: Tag, permission: 'settings.view' as any },
        { title: 'Estúdio de Imagens', url: '/admin/imagens', icon: ImageIcon, permission: 'marketing.view' as any },
        { title: 'Media Kit Viby', url: '/viby/marca', icon: ImageIcon, permission: 'marketing.view' as any },
      ]
    },
    {
      id: 'comunidade',
      title: 'Comunidade',
      icon: Users,
      items: [
        { title: 'Usuários', url: '/admin/usuarios', icon: User, permission: 'users.view' as any },
        { title: 'Parceiros', url: '/admin/marketing/parceiros', icon: Handshake, permission: 'marketing.view' as any },
        { title: 'Divulgue e Ganhe', url: '/admin/afiliados', icon: Handshake, permission: 'marketing.view' as any },
      ]
    },
    {
      id: 'comercial',
      title: 'Comercial',
      icon: Coins,
      items: [
        { title: 'Leads', url: '/admin/leads', icon: Target, permission: 'marketing.view' as any },
        { title: 'CRM & Marketing', url: '/admin/crm', icon: Mail, permission: 'marketing.emails' as any },
        { title: 'Taxas Atração', url: '/admin/taxas-atracao', icon: Calculator, permission: 'marketing.view' as any },
        { title: 'Cupons Globais', url: '/admin/cupons', icon: TicketPercent, permission: 'marketing.coupons' as any },
        { title: 'Campanhas', url: '/admin/campanhas', icon: Zap, permission: 'marketing.campaigns' as any },
      ]
    },
    {
      id: 'integrações',
      title: 'Integrações',
      icon: Code2,
      items: [
        { title: 'Tokens de API', url: '/admin/integracoes/tokens', icon: Key, permission: 'settings.edit' as any },
        { title: 'Webhooks (Soon)', url: '#', icon: RefreshCw, permission: 'settings.view' as any },
      ]
    },
    {
      id: 'marketing',
      title: 'Marketing',
      icon: Megaphone,
      items: [
        { title: 'Anúncios', url: '/admin/anuncios', icon: Megaphone, permission: 'marketing.view' as any },
        { title: 'Notificações', url: '/admin/notificacoes', icon: Bell, permission: 'marketing.notifications' as any },
        { title: 'E-mails Enviados', url: '/admin/emails', icon: Mail, permission: 'settings.view' as any },
      ]
    },
    {
      id: 'financeiro',
      title: 'Financeiro',
      icon: Wallet,
      items: [
        { title: 'Transferências', url: '/admin/transferencias', icon: SendHorizontal, permission: 'financial.payouts' as any },
        { title: 'Financeiro', url: '/admin/financeiro', icon: Landmark, permission: 'financial.view' as any },
        { title: 'Fiscal / Impostos', url: '/admin/imposto', icon: Scale, permission: 'financial.view' as any },
        { title: 'Extrato Global', url: '/admin/extrato', icon: Receipt, permission: 'financial.view' as any },
      ]
    },
    {
      id: 'moderacao',
      title: 'Moderação',
      icon: ShieldCheck,
      items: [
        { title: 'Denúncias', url: '/admin/denuncias', icon: ShieldAlert, permission: 'events.approve' as any },
        { title: 'Prp. Eventos', url: '/admin/solicitacoes-propriedade', icon: UserCheck, permission: 'events.approve' as any },
        { title: 'Remoção Jurídica', url: '/admin/solicitacoes-remocao', icon: Trash2, permission: 'events.approve' as any },
      ]
    },
    {
      id: 'sistema',
      title: 'Sistema',
      icon: SettingsIcon,
      items: [
        { title: 'Logs do Sistema', url: '/admin/logs', icon: Terminal, permission: 'settings.view' as any },
        { title: 'Diagnóstico Stripe', url: '/admin/diagnostico-stripe', icon: Terminal, permission: 'financial.view' as any },
        { title: 'Configurações', url: '/admin/configuracoes', icon: SettingsIcon, permission: 'settings.edit' as any },
      ]
    },
    {
      id: 'administracao',
      title: 'Administração',
      icon: User,
      items: [
        { title: 'Equipe Admin', url: '/admin/configuracoes/equipe', icon: Users, permission: 'admins.view' as any },
        { title: 'Suporte', url: '/admin/suporte', icon: LifeBuoy, permission: 'tickets.view' as any },
      ]
    },
  ];

  // Identificar quais grupos devem estar abertos baseado no pathname atual
  const defaultOpenGroups = navGroups.filter(group => 
    group.items.some(item => pathname === item.url || (item.url !== '/admin' && pathname?.startsWith(item.url)))
  ).map(group => group.id);

  if (!isInitialized || authLoading || permsLoading || (!adminProfile && user)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Autenticando...</p>
      </div>
    );
  }

  const handleLogout = () => {
    signOut(auth!);
    router.push('/login');
  };

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
                className="h-8 w-auto object-contain" 
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

        <ScrollArea className="flex-1 px-4">
          <Accordion type="multiple" defaultValue={defaultOpenGroups} className="space-y-1">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(item => hasPermission(item.permission));
              if (visibleItems.length === 0) return null;

              return (
                <AccordionItem key={group.id} value={group.id} className="border-none">
                  <AccordionTrigger className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 hover:no-underline transition-all font-semibold text-sm text-white/60 data-[state=open]:text-white">
                    <div className="flex items-center gap-3">
                      <group.icon className="w-4 h-4" />
                      <span className="uppercase text-[10px] font-black tracking-widest">{group.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-2 space-y-1">
                    {visibleItems.map((item) => {
                      const isActive = pathname === item.url || (item.url !== '/admin' && pathname?.startsWith(item.url));
                      return (
                        <Link 
                          key={item.url} 
                          href={item.url}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg ml-4 transition-all font-medium text-xs',
                            isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white hover:bg-white/5'
                          )}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          {item.title}
                        </Link>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>

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
            onClick={handleLogout}
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
