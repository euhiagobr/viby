
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock as LockIcon, CheckCircle2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { resetPasswordWithCode } from "@/app/actions/password-recovery"
import Footer from "@/components/layout/Footer"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const requestId = searchParams.get("req") || ""
  const code = searchParams.get("code") || ""

  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard")
      return
    }
    if (!requestId || !code) router.push("/auth/forgot-password")
  }, [requestId, code, router, user, authLoading])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem." })
      return
    }

    setLoading(true)
    try {
      const result = await resetPasswordWithCode(requestId, code, password)
      if (result.success) {
        setSuccess(true)
        toast({ title: "Sucesso!", description: "Sua senha foi redefinida." })
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao redefinir." })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white text-center">
            <CardHeader className="pt-12 pb-6">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg mb-6">
                 <CheckCircle2 className="w-10 h-10" />
              </div>
              <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Senha Atualizada</CardTitle>
              <CardDescription className="px-8 mt-2">Sua conta está protegida com a nova senha.</CardDescription>
            </CardHeader>
            <CardContent className="px-10 pb-12">
               <Button asChild className="w-full bg-primary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg">
                 <a href="/login">Acessar Clube</a>
               </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary">
               <LockIcon className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Nova Senha</CardTitle>
            <CardDescription className="text-center font-medium px-4">Crie uma senha forte de no mínimo 6 caracteres.</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-6">
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Nova Senha</Label>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Confirmar Senha</Label>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                    required 
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading || password.length < 6} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02]">
                {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Redefinir Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <ResetPasswordContent />
    </React.Suspense>
  )
}
