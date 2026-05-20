'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
  Receipt
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Footer from '@/components/layout/Footer';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const db = useFirestore();
  const { user, loading: authLoading } = useUser(auth);
  const router = useRouter();
  const pathname = usePathname();
  const [verifying, setVerifying] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      if (authLoading) return;
      
      if (!user) {
        router.push('/login');
        return;
      }

      if (db && user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data()?.role === 'admin') {
            setIsAdmin(true);
          } else {
            toast({
              variant: 'destructive',
              title: 'Acesso Negado',
              description: 'Área restrita a administradores Viby.',
            });
            router.push('/dashboard');
          }
        } catch (e) {
          console.error("Erro na verificação admin:", e);
          router.push('/dashboard');
        }
      }
      setVerifying(false)
    }

    checkAdmin();
  }, [user, authLoading, db, router]);

  if (authLoading || verifying) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const navItems = [
    { title: 'Painel', url: '/admin', icon: LayoutDashboard },
    { title: 'Eventos', url: '/admin/eventos', icon: CalendarDays },
    { title: 'Financeiro (Contas)', url: '/admin/financeiro', icon: Landmark },
    { title: 'Extrato Global', url: '/admin/extrato', icon: Receipt },
    { title: 'Denúncias', url: '/admin/denuncias', icon: ShieldAlert },
    { title: 'Suporte', url: '/admin/suporte', icon: LifeBuoy },
    { title: 'Categorias', url: '/admin/categorias', icon: Tag },
    { title: 'Usuários', url: '/admin/usuarios', icon: Users },
    { title: 'Configurações', url: '/admin/configuracoes', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside className="w-64 bg-primary text-white hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-8">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Admin Viby</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <p className="px-4 text-[10px] font-black uppercase text-white/40 tracking-widest mb-4">Gestão do Sistema</p>
          {navItems.map((item) => (
            <Link 
              key={item.url} 
              href={item.url}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm',
                (pathname === item.url || (item.url !== '/admin' && pathname?.startsWith(item.url))) ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto space-y-2">
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
            <h2 className="font-bold text-xs uppercase tracking-widest">Plataforma Administrativa</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-xs font-bold">{user?.displayName || 'Administrador'}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Viby Control Center</span>
             </div>
             <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-white font-bold shadow-sm">
                {user?.displayName?.charAt(0) || 'A'}
             </div>
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
