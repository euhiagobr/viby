"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Handshake, Info, ArrowLeft, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SocialLoginButtons } from "../login/SocialLoginButtons";
import { useTranslation } from "@/i18n/i18n-context";
import { handleSocialRedirectResult } from "@/services/auth-service";
import { cn } from "@/lib/utils";

export default function CadastroPage() {
  const { t } = useTranslation();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth);
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [affiliateInfo, setAffiliateInfo] = React.useState<{ name: string; code: string; userId: string } | null>(null);
  const [isValidCode, setIsValidCode] = React.useState<boolean | null>(null);
  const [validating, setValidating] = React.useState(false);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  // Ouvinte de retorno do redirecionamento social
  React.useEffect(() => {
    if (auth && db && !authLoading) {
      handleSocialRedirectResult(auth, db).catch(err => {
         console.error("[Signup-Page] Redirect Result Failed:", err);
      });
    }
  }, [auth, db, authLoading]);

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

  React.useEffect(() => {
    const checkAffiliateCode = async () => {
      if (!refCode || !db) {
        setIsValidCode(null);
        return;
      }

      setValidating(true);
      try {
        const codeDocRef = doc(db, "affiliateCodes", refCode.trim());
        const directSnap = await getDoc(codeDocRef);
        
        if (directSnap.exists() && directSnap.data().active !== false) {
          const foundData = directSnap.data();
          setAffiliateInfo({ 
            name: foundData.userName || "Afiliado Viby", 
            code: refCode.trim(),
            userId: foundData.userId
          });
          setIsValidCode(true);
        } else {
          setIsValidCode(false);
        }
      } catch (error) {
        setIsValidCode(false);
      } finally {
        setValidating(false);
      }
    };

    checkAffiliateCode();
  }, [refCode, db]);

  if (!isInitialized || authLoading) {
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
            {refCode && (
              <div className={cn(
                "p-5 rounded-2xl border-2 border-dashed flex items-center gap-4 transition-all duration-500",
                validating ? "bg-muted border-border animate-pulse" : 
                isValidCode ? "bg-secondary/5 border-secondary/20" : "bg-red-50 border-red-100"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  isValidCode ? "bg-secondary text-white" : "bg-muted text-muted-foreground"
                )}>
                  {validating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Handshake className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Convite Especial</p>
                  <p className="text-sm font-bold text-primary truncate">
                    {validating ? "Validando convite..." : 
                     isValidCode ? `Indicado por: ${affiliateInfo?.name}` : "Código de convite inválido ou expirado."}
                  </p>
                </div>
                {isValidCode && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
              </div>
            )}

            <div className="space-y-8">
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-center opacity-40">Criação rápida</p>
                  <SocialLoginButtons />
               </div>

               <div className="relative">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full border-dashed" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-4 text-muted-foreground">Ou use seu e-mail</span></div>
               </div>

               <SignUpForm referredBy={isValidCode ? affiliateInfo?.userId : undefined} />
            </div>
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
