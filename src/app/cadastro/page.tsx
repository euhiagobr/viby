
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Info, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n/i18n-context";

export default function CadastroPage() {
  const { t } = useTranslation();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  // Proteção: Redireciona usuários logados
  React.useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (user) {
      const hasMandatoryData = !!(profile?.username && profile?.cpfHash);
      const isComplete = profile !== null && hasMandatoryData && !profile?.needsCPFUpdate;

      if (!isComplete) {
        router.replace("/onboarding");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, profile, isInitialized, authLoading, router]);

  // Se estiver carregando OU se já estiver logado (aguardando o useEffect de redirect), mostra o loader
  if (!isInitialized || authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-secondary" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={120} 
                height={40} 
                style={{ height: 'auto' }}
                className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <span className="text-xl font-bold tracking-tight italic uppercase text-primary ml-1">{siteName}</span>
              </>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="font-bold text-[10px] uppercase tracking-widest">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Início</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64" />

        <Card className="w-full max-w-xl border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-sm relative z-10">
          <CardHeader className="p-10 pb-6 text-center space-y-4">
             <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl rotate-3">
                <Sparkles className="w-8 h-8" />
             </div>
             <div>
                <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Criar Conta</CardTitle>
                <CardDescription className="text-sm font-medium uppercase tracking-widest text-muted-foreground mt-1">{t('auth.signup_subtitle')}</CardDescription>
             </div>
          </CardHeader>
          
          <CardContent className="p-10 pt-0 space-y-8">
            <SignUpForm />
          </CardContent>

          <CardFooter className="p-10 pt-0 flex flex-col gap-6">
             <Separator className="border-dashed" />
             <div className="text-center space-y-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Já possui uma conta no clube?
                </p>
                <Button variant="outline" asChild className="w-full h-14 rounded-2xl font-black uppercase italic border-2 hover:bg-primary hover:text-white transition-all">
                  <Link href="/login">Fazer Login agora</Link>
                </Button>
             </div>

             <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                <Info className="w-3 h-3" />
                <span>Ambiente Seguro 256-bit SSL</span>
             </div>
          </CardFooter>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
