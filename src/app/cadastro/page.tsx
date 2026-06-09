"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore, useDoc } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Handshake, Info, ArrowLeft } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function CadastroPage() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [affiliateInfo, setAffiliateInfo] = React.useState<{ name: string; code: string } | null>(null);
  const [isValidCode, setIsValidCode] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  React.useEffect(() => {
    const checkAffiliateCode = async () => {
      if (!refCode || !db) {
        setLoading(false);
        return;
      }

      try {
        const codeDocRef = doc(db, "affiliateCodes", refCode);
        const codeDocSnap = await getDoc(codeDocRef);

        if (codeDocSnap.exists()) {
          const affiliateData = codeDocSnap.data();
          setAffiliateInfo({ 
            name: affiliateData.userName || "Afiliado Viby", 
            code: refCode
          });
          setIsValidCode(true);
        } else {
          setIsValidCode(false);
        }
      } catch (error) {
        console.error("Error validating affiliate code:", error);
        setIsValidCode(false);
      } finally {
        setLoading(false);
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
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="font-semibold text-xs uppercase tracking-widest">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 container mx-auto max-w-lg py-12 md:py-20 px-4">
        {refCode && !loading && (
          <div className="mb-8 animate-in fade-in duration-500">
            {isValidCode && affiliateInfo ? (
              <Alert className="bg-secondary/5 border-secondary/20 rounded-2xl">
                <Handshake className="h-4 w-4 text-secondary" />
                <AlertTitle className="font-bold text-secondary">Convite Ativo!</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Você está se cadastrando por indicação de <span className="font-bold">{affiliateInfo.name}</span>.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive" className="rounded-2xl">
                <Info className="h-4 w-4" />
                <AlertTitle>Referência não localizada</AlertTitle>
                <AlertDescription className="text-xs">
                  O código {refCode} não é mais válido. O cadastro prosseguirá normalmente.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="text-center pt-10 pb-6 space-y-2">
            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-primary">Criar Conta</CardTitle>
            <CardDescription className="font-medium text-sm">Entre para o clube e viva o agora.</CardDescription>
          </CardHeader>
          <CardContent className="px-8 md:px-12">
            <SignUpForm referredByCode={isValidCode ? refCode : undefined} />
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
