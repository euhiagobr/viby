"use client"

import * as React from "react"
import { useState } from "react"
import { useAuth, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, Mail, ShieldCheck, Lock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { requestPasswordRecovery, verifyRecoveryCode, resetPasswordWithCode } from "@/app/actions/password-recovery"
import { OTPInput } from "@/components/auth/OTPInput"
import Footer from "@/components/layout/Footer"

function RedefinirSenhaContent() {
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [identifier, setIdentifier] = setIdentifier("");
  const [requestId, setRequestId] = setRequestId("");
  const [maskedEmail, setMaskedEmail] = setMaskedEmail("");
  const [otp, setOtp] = setOtp("");
  const [newPassword, setNewPassword] = setNewPassword("");
  const [confirmPassword, setConfirmPassword] = setConfirmPassword("");

  React.useEffect(() => {
    if (user && !authLoading) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || loading) return
    
    setLoading(true)
    try {
      const result = await requestPasswordRecovery(identifier)
      if (result.success) {
        if (result.requestId) {
          setRequestId(result.requestId)
          setMaskedEmail(result.maskedEmail || "")
          setStep(2)
          toast({ title: "Código enviado!", description: "Verifique seu e-mail." })
        } else {
          // Resposta genérica para manter privacidade
          setMaskedEmail("seu e-mail")
          setStep(2)
        }
      } else {
        toast({ variant: "destructive", title: "Atenção", description: result.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Falha na solicitação" })
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6 || loading) return

    setLoading(true)
    try {
      if (!requestId) {
        toast({ variant: "destructive", title: "Código Inválido", description: "Sessão expirada. Solicite um novo código." })
        setStep(1)
        setLoading(false)
        return
      }
      const result = await verifyRecoveryCode(requestId, otp)
      if (result.success) {
        setStep(3)
      } else {
        toast({ variant: "destructive", title: "Erro na validação", description: result.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Falha técnica" })
    } finally {
      setLoading(false)
    }
  }

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem." })
      return
    }

    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Senha Curta", description: "A senha deve ter no mínimo 6 caracteres." })
      return
    }

    setLoading(true)
    try {
      const result = await resetPasswordWithCode(requestId, otp, newPassword)
      if (result.success) {
        toast({ title: "Tudo pronto!", description: "Sua senha foi redefinida com sucesso." })
        router.push("/login")
      } else {
        toast({ variant: "destructive", title: "Erro ao resetar", description: result.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no servidor" })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-10 pb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 text-secondary shadow-inner">
               {step === 1 ? <Mail className="w-8 h-8" /> : step === 2 ? <ShieldCheck className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">
              {step === 1 ? "Recuperar Acesso" : step === 2 ? "Validar Código" : "Nova Senha"}
            </CardTitle>
            <CardDescription className="px-6 font-medium">
              {step === 1 ? "Informe seu e-mail ou @username para receber o código." : 
               step === 2 ? `Digite o código enviado para ${maskedEmail}` : 
               "Crie uma nova senha segura para sua conta."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-10 pb-8">
            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Identificador</Label>
                  <Input 
                    placeholder="E-mail ou @username" 
                    value={identifier} 
                    onChange={e => setIdentifier(e.target.value)}
                    className="h-12 rounded-xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic hover:scale-[1.02] transition-transform">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Enviar Código"}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-8 text-center">
                <OTPInput value={otp} onChange={setOtp} disabled={loading} />
                <div className="space-y-4">
                  <Button type="submit" disabled={loading || otp.length < 6} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Validar Código"}
                  </Button>
                  <Button variant="link" type="button" onClick={() => setStep(1)} className="text-[10px] font-black uppercase text-muted-foreground hover:text-primary transition-colors">
                    Não recebi / Voltar
                  </Button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleStep3} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nova Senha</Label>
                    <Input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-12 rounded-xl" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Confirmar Nova Senha</Label>
                    <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-12 rounded-xl" required />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Atualizar Senha"}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border py-6 bg-muted/20">
            <Link href="/login" className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Login
            </Link>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>}>
      <RedefinirSenhaContent />
    </React.Suspense>
  )
}
