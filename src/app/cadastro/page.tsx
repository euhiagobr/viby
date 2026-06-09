
"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore, useDoc } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Handshake, Info, ArrowLeft, Loader2 } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function CadastroPage() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [affiliateInfo, setAffiliateInfo] = React.useState<{ name: string; code: string; userId: string } | null>(null);
  const [isValidCode, setIsValidCode] = React.useState<boolean | null>(null);
  const [validating, setValidating] = React.useState(false);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  React.useEffect(() => {
    const checkAffiliateCode = async () => {
      if (!refCode || !db) {
        setValidating(false);
        return;
      }

      setValidating(true);
      try {
        const codeDocRef = doc(db, "affiliateCodes", refCode);
        const codeDocSnap = await getDoc(codeDocRef);

        if (codeDocSnap.exists()) {
          const affiliateData = codeDocSnap.data();
          setAffiliateInfo({ 
            name: affiliateData.userName || "Afiliado Viby", 
            code: refCode,
            userId: affiliateData.userId
          });
          setIsValidCode(true);
        } else {
          setIsValidCode(false);
        }
      } catch (error) {
        console.error("Error validating affiliate code:", error);
        setIsValidCode(false);
      } finally {
        setValidating(false);
      }
    };

    checkAffiliateCode();
  }, [refCode, db]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority unoptimized />
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight italic uppercase">{siteName}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="font-semibold text-[10px] uppercase tracking-widest">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 container mx-auto max-w-lg py-12 md:py-20 px-4">
        {refCode && (
          <div className="mb-8 animate-in fade-in duration-500">
            {validating ? (
              <div className="flex items-center justify-center p-4 bg-muted/20 rounded-2xl gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Validando convite...</span>
              </div>
            ) : isValidCode && affiliateInfo ? (
              <Alert className="bg-secondary/5 border-secondary/20 rounded-2xl">
                <Handshake className="h-4 w-4 text-secondary" />
                <AlertTitle className="font-black uppercase italic text-secondary text-xs">Convite Ativo!</AlertTitle>
                <AlertDescription className="text-[10px] font-medium text-muted-foreground uppercase leading-tight mt-1">
                  Você está se cadastrando por indicação de <span className="font-black text-primary">@{affiliateInfo.name}</span>.
                </AlertDescription>
              </Alert>
            ) : !validating && (
              <Alert variant="destructive" className="rounded-2xl bg-destructive/5">
                <Info className="h-4 w-4" />
                <AlertTitle className="font-black uppercase italic text-xs">Referência não localizada</AlertTitle>
                <AlertDescription className="text-[10px] font-medium uppercase leading-tight mt-1">
                  O código {refCode} não é mais válido. O cadastro prosseguirá normalmente.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="text-center pt-10 pb-6 space-y-2">
            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-primary">Criar Conta</CardTitle>
            <CardDescription className="font-medium text-sm">O seu passaporte para o agora.</CardDescription>
          </CardHeader>
          <CardContent className="px-8 md:px-12">
            <SignUpForm referredBy={isValidCode ? affiliateInfo?.userId : undefined} />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4 border-t border-border mt-6 py-8 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground">
              Já tem conta? <Link href="/login" className="text-secondary font-black hover:underline uppercase italic">Entrar</Link>
            </p>
          </CardFooter>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}
