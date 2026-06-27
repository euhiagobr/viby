'use client';

import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, LogOut, ArrowRight, Terminal } from 'lucide-react';
import Link from 'next/link';
import { startSocialRedirect, captureRedirectResult, ensureUserProfile } from '@/services/auth-service';
import { toast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Login2AuditPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const checkStarted = useRef(false);

  useEffect(() => {
    if (!auth || !db) return;
    if (checkStarted.current) {
        console.log('[AUDIT-UI] useEffect blocked by ref lock (Strict Mode Prevention)');
        return;
    }
    checkStarted.current = true;

    console.group('[AUDIT-UI] COMPONENT MOUNTED');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Location:', window.location.href);
    console.log('Referrer:', document.referrer);
    // @ts-ignore
    console.log('Navigation Type:', performance.getEntriesByType("navigation")[0]?.type || 'unknown');
    
    const init = async () => {
      try {
        console.log('[AUDIT-UI] 1. Calling captureRedirectResult...');
        const user = await captureRedirectResult(auth);
        
        if (user) {
          console.log('[AUDIT-UI] 2. Redirect User Detected. Ensuring Profile...');
          const profile = await ensureUserProfile(user, db);
          console.log('[AUDIT-UI] 3. Profile Success. UID:', user.uid);
          setCurrentUser(user);
          
          if (profile && (!profile.username || !profile.cpfHash)) {
             console.log('[AUDIT-UI] 3.1 Redirecting to onboarding (Missing Data)');
             router.push('/onboarding');
          }
        } else {
          console.log('[AUDIT-UI] 2. No redirect result found. Checking current session state...');
          console.log('[AUDIT-UI] 2.1 auth.currentUser (immediate):', auth.currentUser ? 'PRESENT' : 'NULL');
          
          const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            console.log('[AUDIT-UI] 2.2 onAuthStateChanged Fired:', authUser ? 'USER_PRESENT' : 'USER_NULL');
            if (authUser) {
              setCurrentUser(authUser);
            }
            setLoading(false);
            unsubscribe();
          });
          return;
        }
      } catch (err: any) {
        console.error('[AUDIT-UI] CRITICAL FAILURE:', err);
        setError(`${err.code}: ${err.message}`);
      } finally {
        setLoading(false);
        console.groupEnd();
      }
    };

    init();
  }, [auth, db, router]);

  const handleLoginGoogle = async () => {
    if (!auth) return;
    console.log('[AUDIT-UI] User clicked Google Login');
    setError(null);
    setLoading(true);
    try {
      await startSocialRedirect(auth, 'google');
    } catch (err: any) {
      console.error('[AUDIT-UI] Error initiating redirect:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    setLoading(true);
    await signOut(auth);
    setCurrentUser(null);
    setLoading(false);
    toast({ title: "Sessão encerrada" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-lg border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <CardHeader className="text-center pt-10 pb-6 bg-muted/20 border-b border-dashed">
          <div className="w-16 h-16 bg-secondary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Terminal className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Auth Audit Console</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Diagnostic Mode: check browser console (F12)</CardDescription>
        </CardHeader>

        <CardContent className="p-10 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="w-10 h-10 animate-spin text-secondary" />
              <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Running Diagnostic...</p>
            </div>
          ) : currentUser ? (
            <div className="space-y-6 animate-in zoom-in-95">
               <div className="p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center gap-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Session Verified</p>
                    <p className="text-sm font-bold text-green-800">{currentUser.displayName || 'No Name'}</p>
                    <p className="text-xs font-mono opacity-60">{currentUser.email}</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-3">
                  <Button asChild className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                    <Link href="/dashboard">Acessar Dashboard <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" onClick={handleLogout} className="text-destructive font-black uppercase text-[10px]">Encerrar Sessão</Button>
               </div>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 text-red-600">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold uppercase">{error}</p>
                </div>
              )}

              <div className="p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-100 flex items-start gap-4">
                 <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                 <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase text-blue-800 italic">Audit Status</h4>
                    <p className="text-[10px] text-blue-700 leading-relaxed font-medium uppercase">
                      Clique no botão abaixo e observe o fluxo no console. Não feche a janela até o redirecionamento ocorrer.
                    </p>
                 </div>
              </div>

              <Button 
                onClick={handleLoginGoogle}
                className="w-full h-16 bg-white border-2 border-primary text-primary font-black uppercase italic text-lg rounded-2xl shadow-xl gap-4 hover:bg-muted"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Audit Google Login
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-8 pt-0 border-t bg-muted/10">
           <p className="w-full text-center text-[9px] font-black uppercase text-muted-foreground opacity-40 italic">
              Viby System Auth Audit • v2.2.0
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
