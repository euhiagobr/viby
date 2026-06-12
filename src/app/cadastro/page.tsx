"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Handshake, Info, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function CadastroPage() {
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
        const cleanRef = refCode.trim();
        let foundData = null;

        // 1. Tentar localizar por ID de documento
        const codeDocRef = doc(db, "affiliateCodes", cleanRef);
        const directSnap = await getDoc(codeDocRef);
        
        if (directSnap.exists()) {
          foundData = directSnap.data();
        } else {
          // 2. Fallback: Tentar busca por campo
          const q = query(collection(db, "affiliateCodes"), where("code", "==", cleanRef), limit(1));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            foundData = querySnap.docs[0].data();
          }
        }

        if (foundData && foundData.active !== false) {
          setAffiliateInfo({ 
            name: foundData.userName || "Afiliado Viby", 
            code: cleanRef,
            userId: foundData.userId
          });
          setIsValidCode(true);
        } else {
          setIsValidCode(false);
        }
      } catch (error) {
        console.error("[Affiliate Lookup Error]", error);
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
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-9 w-auto object-contain transition-transform group-hover:scale-105" priority unoptimized />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <span className="text-xl font-black tracking-tight italic uppercase text-primary ml-1">{siteName}</span>
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

      <main className="flex-1 container mx-auto max-w-lg py-12 md:py-20 px-4">
        {refCode && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {validating ? (
              <div className="flex items-center justify-center p-4 bg-muted/20 rounded-2xl gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40 text-primary">Validando convite...</span>
              </div>
            ) : isValidCode === true && affiliateInfo ? (
              <div className="bg-secondary/10 border-2 border-dashed border-secondary/30 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-secondary rounded-2xl text-white shadow-lg"><Handshake className="w-6 h-6" /></div>
                <div className="space-y-0.5">
                   <p className="font-black uppercase italic text-secondary text-xs">Olá!</p>
                   <p className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">
                     Você acaba de usar o código de convite de <span className="text-primary font-black">@{affiliateInfo.name}</span>. Aproveite essa Viby!
                   </p>
                </div>
              </div>
            ) : isValidCode === false && (
              <div className="bg-orange-50 border-2 border-dashed border-orange-200 rounded-3xl p-6 flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-2xl text-orange-600"><Info className="w-6 h-6" /></div>
                <div className="space-y-0.5">
                   <p className="font-black uppercase italic text-orange-800 text-xs">Aviso de Referência</p>
                   <p className="text-[10px] font-medium text-orange-700 uppercase leading-tight">
                     O código {refCode} não é mais válido. O cadastro prosseguirá normalmente.
                   </p>
                </div>
              </div>
            )}
          </div>
        )}

        <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
          <CardHeader className="text-center pt-12 pb-6 space-y-3">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-2 text-white shadow-xl shadow-primary/10">
               <Sparkles className="w-8 h-8" />
            </div>
            <CardTitle className="text-4xl font-black uppercase italic tracking-tighter text-primary leading-none">Criar Conta</CardTitle>
            <CardDescription className="font-bold text-muted-foreground uppercase text-[10px] tracking-widest">O seu passaporte para o agora.</CardDescription>
          </CardHeader>
          <CardContent className="px-10">
            <SignUpForm referredBy={isValidCode ? affiliateInfo?.userId : undefined} />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4 border-t border-border mt-8 py-10 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground uppercase">
              Já tem conta? <Link href="/login" className="text-secondary font-black hover:underline italic ml-1">Fazer Login</Link>
            </p>
          </CardFooter>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}
