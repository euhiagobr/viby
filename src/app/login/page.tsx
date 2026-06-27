"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Loader2, User, Lock as LockIcon, KeyRound, AlertCircle, ShieldCheck } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n/i18n-context"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function LoginContent() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth)

  // PROTEÇÃO DE ROTA E ONBOARDING
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (user) {
      const hasMandatoryData = !!(profile?.username && profile?.cpfHash);
      if (!hasMandatoryData || profile?.needsCPFUpdate) {
        router.replace("/onboarding");
      } else {
        const redirect = searchParams.get('redirect') || "/dashboard";
        router.replace(redirect);
      }
    }
  }, [user, profile, isInitialized, authLoading, router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth) return
    setLoading(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, identifier.trim().toLowerCase(), password)
    } catch (err: any) {
      setError("Credenciais inválidas. Verifique seu e-mail e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-secondary" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Sincronizando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PublicHeader showBack />

      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] -ml-64 -mt-64" />
        <Card className="w-full max-w-lg border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-sm relative z-10">
          <CardHeader className="text-center pt-12 pb-6 bg-muted/30">
            <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <KeyRound className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">{t('auth.login_title')}</CardTitle>
            <CardDescription className="text-sm font-medium uppercase tracking-widest text-muted-foreground mt-1">{t('auth.login_subtitle')}</CardDescription>
          </CardHeader>
          
          <CardContent className="p-10 space-y-8">
            {error && (
              <Alert variant="destructive" className="rounded-2xl border-2 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-black uppercase italic text-[10px]">Erro de Acesso</AlertTitle>
                <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-8">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">{t('auth.email_label')}</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <Input id="identifier" type="email" placeholder="seu@email.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required disabled={loading} className="h-14 rounded-2xl pl-12 border-dashed border-primary/20" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="password" name="password" className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('auth.password_label')}</Label>
                    <Link href="/redefinir-senha" className="text-[10px] font-black uppercase text-secondary hover:underline">{t('auth.forgot_password')}</Link>
                  </div>
                  <div className="relative">
                    <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="h-14 rounded-2xl pl-12 border-dashed border-primary/20" />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-primary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-all hover:scale-[1.02]">
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t('auth.login_btn')}
                </Button>
              </form>
            </div>
          </CardContent>

          <CardFooter className="p-10 pt-0 flex flex-col gap-6">
             <Separator className="border-dashed" />
             <div className="text-center space-y-4">
                <p className="text-xs font-medium text-muted-foreground">{t('auth.no_account')}</p>
                <Button variant="outline" asChild className="w-full h-14 rounded-2xl font-black uppercase italic border-2 hover:bg-secondary hover:text-white transition-all">
                  <Link href="/cadastro">{t('auth.create_free')}</Link>
                </Button>
             </div>
             <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                <ShieldCheck className="w-3 h-3" />
                <span>Autenticação Viby Cloud Protegida</span>
             </div>
          </CardFooter>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <LoginContent />
    </React.Suspense>
  )
}
