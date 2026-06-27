"use client"

import * as React from "react"
import { useEffect, useState, useRef } from "react"
import { useAuth, useFirestore } from "@/firebase"
import { 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult, 
  User 
} from "firebase/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, User as UserIcon } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Separator } from "@/components/ui/separator"
import { ensureUserProfile } from "@/services/auth-service"

/**
 * @fileOverview Lab de Autenticação via Redirecionamento.
 * Otimizado para Google Cloud Workstations onde popups falham.
 */
export default function Login2Page() {
  const auth = useAuth()
  const db = useFirestore()
  
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checkRedirectRef = useRef(false)

  useEffect(() => {
    if (!auth || !db || checkRedirectRef.current) return;
    
    const checkRedirect = async () => {
      console.log('[Auth-Debug] 1. Component mounted, checking redirect result...');
      try {
        const result = await getRedirectResult(auth);
        
        if (result?.user) {
          console.log('[Auth-Debug] 2. User detected on return:', result.user.email);
          setUser(result.user);
          
          // Opcional: Garante que o perfil exista no Firestore
          await ensureUserProfile(result.user, db);
          console.log('[Auth-Debug] 3. Profile synced successfully');
        } else {
          console.log('[Auth-Debug] 2. No redirect result found (Normal mount)');
        }
      } catch (err: any) {
        console.error('[Auth-Debug] ERROR on redirect result:', err.code, err.message);
        setError(err.message);
      } finally {
        setLoading(false);
        checkRedirectRef.current = true;
      }
    }

    checkRedirect();
  }, [auth, db]);

  const handleLogin = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    
    console.log('[Auth-Debug] Initializing signInWithRedirect...');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('[Auth-Debug] Redirect Start Failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PublicHeader showBack />

      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] -mr-64 -mt-64" />
        
        <Card className="w-full max-w-lg border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/90 backdrop-blur-md relative z-10">
          <CardHeader className="text-center pt-12 pb-6 bg-secondary/5 border-b border-dashed">
            <div className="w-16 h-16 bg-secondary text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Lab: Redirecionamento</CardTitle>
            <CardDescription className="text-sm font-medium uppercase tracking-widest text-muted-foreground mt-1">Ambiente de Nuvem (Workstations)</CardDescription>
          </CardHeader>
          
          <CardContent className="p-10 space-y-8">
            {loading ? (
              <div className="py-10 flex flex-col items-center gap-4 text-center">
                 <Loader2 className="w-10 h-10 animate-spin text-secondary" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando com Google...</p>
              </div>
            ) : user ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                 <div className="p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center text-center gap-4">
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                    <div className="space-y-1">
                       <h3 className="text-xl font-black uppercase italic text-primary">Login Sucesso!</h3>
                       <p className="text-sm font-medium text-green-700">{user.displayName}</p>
                       <p className="text-xs text-green-600 opacity-60 font-mono">{user.email}</p>
                    </div>
                 </div>
                 <Button asChild className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                    <Link href="/dashboard">Acessar Meu Painel <ArrowRight className="ml-2 w-4 h-4" /></Link>
                 </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 text-red-600 animate-in shake">
                     <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                     <p className="text-xs font-bold uppercase leading-tight">{error}</p>
                  </div>
                )}

                <div className="p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 flex items-start gap-4">
                   <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                   <div className="space-y-1">
                      <h4 className="font-black uppercase text-xs italic text-blue-800">Conformidade com Workstations</h4>
                      <p className="text-[10px] text-blue-700 font-medium leading-relaxed uppercase">
                        O método Redirect é obrigatório neste ambiente para evitar bloqueios de segurança do proxy de nuvem.
                      </p>
                   </div>
                </div>

                <Button 
                  onClick={handleLogin}
                  className="w-full h-16 rounded-2xl gap-4 font-black uppercase italic text-lg bg-white border-2 border-primary text-primary hover:bg-muted transition-all"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Testar Login Google
                </Button>
              </div>
            )}

            <Separator className="border-dashed" />
            
            <p className="text-center text-[10px] font-black uppercase text-muted-foreground opacity-40">
               Acompanhe os logs técnicos no console (F12).
            </p>
          </CardContent>

          <CardFooter className="p-10 pt-0 flex flex-col gap-6">
             <Button variant="ghost" asChild className="w-full h-14 rounded-2xl font-black uppercase italic border-2 hover:bg-muted">
                <Link href="/login"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Login E-mail</Link>
             </Button>
          </CardFooter>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
