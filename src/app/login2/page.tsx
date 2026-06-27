"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { SocialLoginButtons } from "../login/SocialLoginButtons"
import { handleSocialRedirectResult } from "@/services/auth-service"

function Login2Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const db = useFirestore()
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth)

  const checkRedirectRef = useRef(false);

  // 1. CAPTURA DE RESULTADO DO REDIRECIONAMENTO SOCIAL (EXCLUSIVO PARA TESTES)
  useEffect(() => {
    if (auth && db && !authLoading && !checkRedirectRef.current) {
      checkRedirectRef.current = true;
      console.log("[Login2-Debug] Iniciando verificação de retorno social...");
      handleSocialRedirectResult(auth, db)
        .then((result) => {
          if (result) {
             console.log("[Login2-Debug] Sucesso no retorno! Usuário:", result.email);
          } else {
             console.log("[Login2-Debug] Nenhum resultado de redirecionamento pendente.");
          }
        })
        .catch(err => {
           console.error("[Login2-Debug] Falha no processamento do retorno:", err);
        });
    }
  }, [auth, db, authLoading]);

  // 2. PROTEÇÃO DE ROTA E ONBOARDING
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (user) {
      console.log("[Login2-Debug] Usuário autenticado detectado. Verificando perfil...");
      const hasMandatoryData = !!(profile?.username && profile?.cpfHash);
      if (!hasMandatoryData || profile?.needsCPFUpdate) {
        console.log("[Login2-Debug] Perfil incompleto. Redirecionando para Onboarding.");
        router.replace("/onboarding");
      } else {
        console.log("[Login2-Debug] Perfil OK. Redirecionando para Dashboard.");
        const redirect = searchParams.get('redirect') || "/dashboard";
        router.replace(redirect);
      }
    }
  }, [user, profile, isInitialized, authLoading, router, searchParams]);

  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-secondary" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Iniciando Teste...</p>
        </div>
      </div>
    );
  }

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
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Lab: Login Social</CardTitle>
            <CardDescription className="text-sm font-medium uppercase tracking-widest text-muted-foreground mt-1">Ambiente de Teste Google & Facebook</CardDescription>
          </CardHeader>
          
          <CardContent className="p-10 space-y-8">
            <div className="p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 flex items-start gap-4">
               <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
               <div className="space-y-1">
                  <h4 className="font-black uppercase text-xs italic text-blue-800">Modo de Redirecionamento</h4>
                  <p className="text-[10px] text-blue-700 font-medium leading-relaxed uppercase">
                    Esta página utiliza Redirect para contornar bloqueios de pop-up em ambientes de desenvolvimento.
                  </p>
               </div>
            </div>

            <SocialLoginButtons />
            
            <Separator className="border-dashed" />
            
            <p className="text-center text-[10px] font-black uppercase text-muted-foreground opacity-40">
               Consulte o console (F12) para o log de debug.
            </p>
          </CardContent>

          <CardFooter className="p-10 pt-0 flex flex-col gap-6">
             <Button variant="ghost" asChild className="w-full h-14 rounded-2xl font-black uppercase italic border-2 hover:bg-muted">
                <Link href="/login"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Login Padrão</Link>
             </Button>
          </CardFooter>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

export default function Login2Page() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <Login2Content />
    </React.Suspense>
  )
}
