'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth, useFirestore } from "@/firebase";
import { startSocialLogin, handleSocialLoginResult, authConfig } from "@/services/auth-service";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function SocialLoginButtons() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(true);

  // Efeito para capturar o resultado do redirecionamento ao montar o componente
  React.useEffect(() => {
    if (!auth || !db) return;

    const checkRedirect = async () => {
      try {
        const result = await handleSocialLoginResult(auth, db);
        if (result) {
          toast({ 
            title: result.isNew ? "Bem-vindo à Viby!" : "Bem-vindo de volta!",
            description: "Autenticação social concluída."
          });
          router.push("/dashboard");
        }
      } catch (error: any) {
        console.error("[Social Redirect Error]", error);
        if (error.code !== 'auth/no-auth-event') {
          toast({ 
            variant: "destructive", 
            title: "Erro na autenticação", 
            description: "Não foi possível completar o login via rede social." 
          });
        }
      } finally {
        setIsProcessing(false);
      }
    };

    checkRedirect();
  }, [auth, db, router]);

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'x') => {
    if (!auth) return;
    setLoading(provider);
    try {
      // Inicia o redirecionamento. A página será recarregada.
      await startSocialLogin(auth, provider);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Erro de Conexão", 
        description: "Não foi possível iniciar o login social." 
      });
      setLoading(null);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-secondary opacity-40" />
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
          disabled={!!loading}
        >
          {loading === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading === 'google' ? 'Redirecionando...' : 'Entrar com Google'}
        </Button>
      )}

      {(authConfig.facebook || authConfig.x) && <div className="flex gap-3">
        {authConfig.facebook && (
          <Button 
            variant="outline" 
            className="flex-1 h-12 rounded-xl text-xs font-bold"
            onClick={() => handleSocialLogin('facebook')}
            disabled={!!loading}
          >
            {loading === 'facebook' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Facebook"}
          </Button>
        )}
        {authConfig.x && (
          <Button 
            variant="outline" 
            className="flex-1 h-12 rounded-xl text-xs font-bold"
            onClick={() => handleSocialLogin('x')}
            disabled={!!loading}
          >
            {loading === 'x' ? <Loader2 className="w-4 h-4 animate-spin" /> : "X / Twitter"}
          </Button>
        )}
      </div>}
    </div>
  );
}
