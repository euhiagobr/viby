'use client';

import * as React from 'react';
import { useAuth, useUser } from '@/firebase';
import { loginWithGoogle, logout } from '@/services/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ShieldCheck, 
  ArrowRight, 
  LogOut, 
  Terminal, 
  Globe,
  AlertTriangle,
  Info,
  MousePointer2
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const nowTs = () => new Date().getTime();

export default function Login2DefinitivePage() {
  const { user, profile, loading, isInitialized } = useUser();
  const auth = useAuth();
  
  const [envData, setEnvData] = React.useState({
    origin: "",
    authDomain: "",
    match: false
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined' && auth) {
      const currentOrigin = window.location.origin;
      const configDomain = (auth as any).config?.authDomain || "vibyeventos.firebaseapp.com";
      setEnvData({
        origin: currentOrigin,
        authDomain: configDomain,
        match: currentOrigin.includes(configDomain.split('.')[0])
      });
    }
  }, [auth]);

  const handleLoginGoogle = async () => {
    console.log(`[${nowTs()}] [LOGIN] 1. Button clicked (Audit Google Login)`);
    console.log(`[${nowTs()}] [LOGIN] - LocalStorage keys:`, Object.keys(localStorage));
    console.log(`[${nowTs()}] [LOGIN] - SessionStorage keys:`, Object.keys(sessionStorage));
    
    try {
      await loginWithGoogle();
    } catch (e: any) {
      console.error(`[${nowTs()}] [LOGIN] ERR: loginWithGoogle() failed to initiate`);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 flex-col gap-8">
      {/* CARD DE AUDITORIA DE AMBIENTE */}
      <Card className="w-full max-w-lg border-none shadow-sm rounded-3xl bg-white overflow-hidden border-l-8 border-orange-500">
         <CardHeader className="bg-orange-50/50 p-6">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-orange-800 flex items-center gap-2">
               <Terminal className="w-4 h-4" /> Diagnóstico de Ambiente
            </CardTitle>
         </CardHeader>
         <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-3">
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase opacity-40">URL de Acesso (Origin)</p>
                  <p className="text-[10px] font-mono bg-muted p-2 rounded-lg truncate">{envData.origin}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase opacity-40">Firebase Auth Domain</p>
                  <p className="text-[10px] font-mono bg-muted p-2 rounded-lg truncate">{envData.authDomain}</p>
               </div>
            </div>
            
            {!envData.match && (
              <div className="p-4 bg-orange-100 rounded-xl flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                 <p className="text-[10px] text-orange-900 font-bold uppercase leading-relaxed">
                    Mismatched Domains: Verifique os Authorized Domains no Firebase Console.
                 </p>
              </div>
            )}
         </CardContent>
      </Card>

      {/* CARD DE LOGIN */}
      <Card className="w-full max-w-lg border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <CardHeader className="text-center pt-10 pb-6 bg-muted/20 border-b border-dashed">
          <div className="w-16 h-16 bg-secondary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Auditoria de Login</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Trace de Execução em Tempo Real</CardDescription>
        </CardHeader>

        <CardContent className="p-10 space-y-8">
          {user ? (
            <div className="space-y-6 text-center animate-in zoom-in-95">
               <div className="p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center gap-4">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Usuário Detectado</p>
                    <p className="text-sm font-bold text-green-800">{user.email}</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-3">
                  <Button asChild className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                    <Link href="/dashboard">Entrar no Sistema <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" onClick={() => logout()} className="text-destructive font-black uppercase text-[10px] h-10">Sair para Novo Teste</Button>
               </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Button 
                onClick={handleLoginGoogle}
                className="w-full h-16 bg-white border-2 border-primary text-primary font-black uppercase italic text-lg rounded-2xl shadow-xl gap-4 hover:bg-muted"
              >
                <MousePointer2 className="w-6 h-6 text-secondary" />
                Audit Google Login
              </Button>
              
              <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                 <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[9px] text-secondary font-bold uppercase leading-tight italic">
                   Abra o console (F12) antes de clicar para visualizar o trace completo da execução.
                 </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-8 pt-0 border-t bg-muted/10 flex justify-center">
           <Badge variant="outline" className="text-[9px] font-black uppercase border-dashed">Status: {user ? 'Autenticado' : 'Visitante'}</Badge>
        </CardFooter>
      </Card>
    </div>
  );
}
