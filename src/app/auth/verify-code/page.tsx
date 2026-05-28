"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OTPInput } from "@/components/auth/OTPInput"
import { Loader2, ShieldCheck, RefreshCw, Clock } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { verifyRecoveryCode, requestPasswordRecovery } from "@/app/actions/password-recovery"
import Footer from "@/components/layout/Footer"

const COOLDOWN_TIME = 90;

function VerifyCodeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const requestId = searchParams.get("req") || ""
  const maskedEmail = searchParams.get("display") || "seu e-mail"

  const [code, setCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [cooldown, setCooldown] = React.useState(0)
  const [resending, setResending] = React.useState(false)

  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  // Carregar cooldown
  React.useEffect(() => {
    const savedUntil = localStorage.getItem("viby_recovery_cooldown");
    if (savedUntil) {
      const remaining = Math.ceil((parseInt(savedUntil) - Date.now()) / 1000);
      if (remaining > 0) setCooldown(remaining);
    }
    if (!requestId && !authLoading) router.push("/auth/forgot-password");
  }, [requestId, router, authLoading]);

  // Timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 6) return

    setLoading(true)
    try {
      const result = await verifyRecoveryCode(requestId, code)
      if (result.success) {
        toast({ title: "Código validado!", description: "Defina sua nova senha agora." })
        router.push(`/auth/reset-password?req=${encodeURIComponent(requestId)}&code=${encodeURIComponent(code)}&display=${encodeURIComponent(maskedEmail)}`)
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
        setCode("")
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha na verificação." })
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    
    setResending(true);
    try {
      toast({ title: "Reenviando...", description: "Estamos processando seu novo código." });
      
      const expiry = Date.now() + (COOLDOWN_TIME * 1000);
      localStorage.setItem("viby_recovery_cooldown", expiry.toString());
      setCooldown(COOLDOWN_TIME);
    } finally {
      setResending(false);
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary">
               <ShieldCheck className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Verificação</CardTitle>
            <CardDescription className="text-center font-medium px-4">Insira o código de 6 caracteres enviado para <strong>{maskedEmail}</strong>.</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-6">
            <form onSubmit={handleVerify} className="space-y-8">
              <OTPInput value={code} onChange={setCode} disabled={loading} />
              
              <Button type="submit" disabled={loading || code.length < 6} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02]">
                {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Validar Código"}
              </Button>
            </form>

            <div className="mt-8 text-center">
              {cooldown > 0 ? (
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-center gap-2">
                  <Clock className="w-3 h-3" /> Reenviar em {formatTime(cooldown)}
                </p>
              ) : (
                <Button 
                  variant="ghost" 
                  onClick={handleResend}
                  disabled={resending}
                  className="text-secondary font-black uppercase italic text-[10px] tracking-widest gap-2"
                >
                  {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Não recebi o código
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default function VerifyCodePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <VerifyCodeContent />
    </React.Suspense>
  )
}