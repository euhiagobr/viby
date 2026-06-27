'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { loginWithGoogle, logout } from '@/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ArrowRight, LogOut, Terminal, Globe } from 'lucide-react';
import Link from 'next/link';

export default function Login2DefinitivePage() {
  const { user, profile, loading, isInitialized } = useUser();

  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-secondary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Firebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-lg border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <CardHeader className="text-center pt-10 pb-6 bg-muted/20 border-b border-dashed">
          <div className="w-16 h-16 bg-secondary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Terminal className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Auth V2</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Fluxo de Redirecionamento Determinístico</CardDescription>
        </CardHeader>

        <CardContent className="p-10 space-y-8">
          {user ? (
            <div className="space-y-6">
               <div className="p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center gap-4 text-center">
                  <ShieldCheck className="w-12 h-12 text-green-600" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Usuário Autenticado</p>
                    <p className="text-sm font-bold text-green-800">{user.displayName || user.email}</p>
                    {profile?.username && <p className="text-xs font-mono text-secondary">@{profile.username}</p>}
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-3">
                  <Button asChild className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                    <Link href="/dashboard">Ir para o Dashboard <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" onClick={() => logout()} className="text-destructive font-black uppercase text-[10px] h-10">Encerrar Sessão</Button>
               </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Button 
                onClick={() => loginWithGoogle()}
                className="w-full h-16 bg-white border-2 border-primary text-primary font-black uppercase italic text-lg rounded-2xl shadow-xl gap-4 hover:bg-muted"
              >
                <Globe className="w-6 h-6" />
                Entrar com Google
              </Button>
              <p className="text-[10px] text-center text-muted-foreground uppercase font-medium leading-relaxed">
                Utilizando signInWithRedirect para compatibilidade total com Cloud Workstations e Proxy reverso.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-8 pt-0 border-t bg-muted/10 flex justify-center">
           <Badge variant="outline" className="text-[9px] font-black uppercase border-dashed">Persistence: LOCAL</Badge>
        </CardFooter>
      </Card>
    </div>
  );
}
