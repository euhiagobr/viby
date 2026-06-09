
"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Handshake, Info } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default function CadastroPage() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [affiliateInfo, setAffiliateInfo] = React.useState<{ name: string; code: string } | null>(null);
  const [isValidCode, setIsValidCode] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

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
    <div className="container mx-auto max-w-sm py-12 md:py-24">
        {refCode && !loading && (
            <div className="mb-6 animate-in fade-in duration-500">
            {isValidCode && affiliateInfo ? (
                <Alert className="bg-secondary/5 border-secondary/20">
                    <Handshake className="h-4 w-4 text-secondary" />
                    <AlertTitle className="font-bold text-secondary">Você foi convidado!</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                        Seu cadastro está sendo feito por indicação de <span className="font-bold">{affiliateInfo.name}</span>.
                    </AlertDescription>
                </Alert>
            ) : (
                 <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Código de Afiliado Inválido</AlertTitle>
                    <AlertDescription>
                       O código de referência utilizado ({refCode}) não é válido. Você pode continuar o cadastro normalmente.
                    </AlertDescription>
                </Alert>
            )}
            </div>
        )}

      <Card className="rounded-2xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Crie sua Conta</CardTitle>
          <CardDescription>Bem-vindo(a) ao Viby! Preencha os campos para se cadastrar.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm referredByCode={isValidCode ? refCode : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
