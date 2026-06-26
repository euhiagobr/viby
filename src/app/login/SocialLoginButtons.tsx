'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { startSocialLogin, authConfig } from "@/services/auth-service";
import { Loader2, AlertCircle, Facebook } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function SocialLoginButtons() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    if (!auth || !db) return;
    
    setError(null);
    setLoadingProvider(provider);
    
    try {
      const result = await startSocialLogin(auth, db, provider);
      
      if (result && result.profile) {
        setIsProcessing(true);
        // Verifica se o perfil está completo para decidir a rota
        const hasMandatory = !!(result.profile?.username && result.profile?.cpfHash);
        const isComplete = result.profile?.profileComplete && hasMandatory && !result.profile?.needsCPFUpdate;
        
        if (!isComplete) {
          toast({ title: "Bem-vindo!", description: "Vamos concluir seu cadastro." });
          router.replace("/onboarding");
        } else {
          toast({ title: "Acesso autorizado!", description: "Entrando na sua conta..." });
          router.replace("/dashboard");
        }
      } else {
        setLoadingProvider(null);
      }
    } catch (err: any) {
      console.error("[Auth-Social] Process Error:", err);
      setLoadingProvider(null);
      setIsProcessing(false);

      if (err.code === 'auth/popup-closed-by-user') {
         setError("O login foi cancelado. Clique novamente para tentar.");
      } else if (err.code === 'auth/popup-blocked') {
         setError("O seu navegador bloqueou o popup de login. Por favor, habilite-o.");
      } else {
         setError("Não foi possível sincronizar sua conta social.");
      }
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse text-center">
          Sincronizando Perfil...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {error && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 text-red-600 mb-2 animate-in zoom-in-95">
           <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
           <p className="text-xs font-bold uppercase leading-tight">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {authConfig.google && (
          <Button 
            variant="outline" 
            className="w-full h-14 rounded-2xl gap-3 font-bold border-2 hover:bg-muted transition-all active:scale-[0.98]"
            onClick={() => handleSocialLogin('google')}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Google
          </Button>
        )}

        {authConfig.facebook && (
          <Button 
            variant="outline" 
            className="w-full h-14 rounded-2xl gap-3 font-bold border-2 hover:bg-[#1877F2]/5 hover:text-[#1877F2] hover:border-[#1877F2]/20 transition-all active:scale-[0.98]"
            onClick={() => handleSocialLogin('facebook')}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'facebook' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <Facebook className="w-5 h-5 fill-[#1877F2] text-[#1877F2]" />
            )}
            Facebook
          </Button>
        )}
      </div>
    </div>
  );
}
