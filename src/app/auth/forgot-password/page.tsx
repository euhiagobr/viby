"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, Mail, Send, Clock } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { requestPasswordRecovery } from "@/app/actions/password-recovery"
import Footer from "@/components/layout/Footer"

const COOLDOWN_TIME = 90; // 1:30 min em segundos

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [cooldown, setCooldown] = React.useState(0)
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)

  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  // Carregar cooldown do localStorage ao montar
  React.useEffect(() => {
    const savedUntil = localStorage.getItem("viby_recovery_cooldown");
    if (savedUntil) {
      const remaining = Math.ceil((parseInt(savedUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldown(remaining);
      }
    }
  }, []);

  // Timer do cooldown
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || cooldown > 0) return

    setLoading(true)
    try {
      const result = await requestPasswordRecovery(identifier)
      if (result.success && result.requestId) {
        // Definir cooldown de 1:30 min
        const expiry = Date.now() + (COOLDOWN_TIME * 1000);
        localStorage.setItem("viby_recovery_cooldown", expiry.toString());
        setCooldown(COOLDOWN_TIME);

        toast({ title: "Código enviado!", description: "Confira seu e-mail para continuar." })
        router.push(`/auth/verify-code?req=${encodeURIComponent(result.requestId)}&display=${encodeURIComponent(result.maskedEmail || "")}`)
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao processar solicitação." })
    } finally {
      setLoading(false)
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
               <Mail className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Recuperar Senha</CardTitle>
            <CardDescription className="text-center font-medium px-4">Informe seu e-mail ou @username para receber o código.</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-6">
            <form onSubmit={handleRequest} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Identificador</Label>
                <div className="relative">
                  <Input 
                    placeholder="e-mail ou @username" 
                    value={identifier} 
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-11 h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                    required 
                    disabled={loading || cooldown > 0}
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary opacity-50" />
                </div>
              </div>

              {cooldown > 0 && (
                <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-xl animate-in fade-in zoom-in-95">
                  <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Aguarde {formatTime(cooldown)} para solicitar novo código
                  </p>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading || !identifier || cooldown > 0} 
                className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02]"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                ) : cooldown > 0 ? (
                  `Aguarde (${formatTime(cooldown)})`
                ) : (
                  <><Send className="w-5 h-5 mr-2" /> Enviar Código</>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t border-border mt-4 py-8 bg-muted/20">
            <Link href="/login" className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Login
            </Link>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}