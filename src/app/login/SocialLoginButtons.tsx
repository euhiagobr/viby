'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { startSocialLogin, handleSocialLoginResult, authConfig, ensureUserProfile } from "@/services/auth-service";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function SocialLoginButtons() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { user, profile, isInitialized } = useUser(auth);
  
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const pipelineStarted = React.useRef(false);

  // 1. Monitor de Redirecionamento (Roda uma vez ao montar)
  React.useEffect(() => {
    if (!auth || !db || !isInitialized || pipelineStarted.current) return;

    const runRedirectCheck = async () => {
      pipelineStarted.current = true;
      try {
        console.log("[Auth-Debug] SocialButtons: Verificando se há retorno de login...");
        const result = await handleSocialLoginResult(auth, db);
        
        if (result) {
          setIsProcessing(true);
          console.log("[Auth-Debug] Resultado capturado. Validando completude do perfil...");
          const isComplete = result.profile?.username && result.profile?.cpf;
          router.replace(isComplete ? "/dashboard" : "/onboarding");
        }
      } catch (error: any) {
        console.error("[Auth-Debug] Erro no componente ao tratar redirect:", error);
      }
    };

    runRedirectCheck();
  }, [auth, db, isInitialized, router]);

  // 2. Monitor de Estado (Reativo - Resolve o caso do Redirect Result ser Null mas o User existir)
  React.useEffect(() => {
    if (!isInitialized || !user || isProcessing) return;

    // Se o usuário está logado mas o perfil ainda não existe no Firestore
    if (!profile) {
      const syncProfile = async () => {
        setIsProcessing(true);
        try {
          console.log("[Auth-Debug] Usuário detectado via Sessão mas sem Perfil. Forçando sincronização...");
          const synced = await ensureUserProfile(user, db);
          if (synced) {
            const isComplete = synced.username && synced.cpf;
            router.replace(isComplete ? "/dashboard" : "/onboarding");
          }
        } catch (e) {
          console.error("[Auth-Debug] Falha na sincronização forçada:", e);
          setIsProcessing(false);
        }
      };
      syncProfile();
    }
  }, [user, profile, isInitialized, db, router, isProcessing]);

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'x') => {
    if (!auth) return;
    setLoadingProvider(provider);
    try {
      console.log(`[Auth-Debug] Iniciando login social: ${provider}`);
      await startSocialLogin(auth, provider);
    } catch (error: any) {
      console.error("[Auth-Debug] Erro ao disparar redirecionamento:", error);
      toast({ 
        variant: "destructive", 
        title: "Erro de Conexão", 
        description: "Não foi possível iniciar o login social. Verifique seu navegador." 
      });
      setLoadingProvider(null);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-3 animate-in fade-in">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando conta...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
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
          {loadingProvider === 'google' ? 'Redirecionando...' : 'Entrar com Google'}
        </Button>
      )}
    </div>
  );
}
