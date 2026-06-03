"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Loader2, User, Mail, ArrowLeft, KeyRound } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
import { SocialLoginButtons } from "./SocialLoginButtons"
import { Separator } from "@/components/ui/separator"

function LoginContent() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth)
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  // REDIRECIONAMENTO INTELIGENTE COM LOGS
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    console.log('[Auth-Debug] Login Page State', {
      isInitialized,
      hasUser: !!user,
      hasProfile: !!profile,
      authLoading
    });

    if (user && profile) {
      const isComplete = profile.username && profile.cpf;
      const redirect = searchParams.get('redirect') || "/dashboard";
      const target = isComplete ? redirect : "/onboarding";
      
      if (isComplete) {
        console.log('[Auth-Debug] Redirecting To Dashboard');
      } else {
        console.log('[Auth-Debug] Redirecting To Onboarding');
      }
      router.replace(target);
    } else {
      console.log('[Auth-Debug] Staying On Login');
    }
  }, [user, profile, isInitialized, authLoading, router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth || !db) return

    setLoading(true)
    try {
      let emailToUse = identifier.trim().toLowerCase();

      if (!identifier.includes("@")) {
        const usernameClean = identifier.replace('@', '').toLowerCase().trim();
        const usernameRef = doc(db, "usernames", usernameClean)
        const usernameSnap = await getDoc(usernameRef)
        
        if (!usernameSnap.exists()) throw new Error("Perfil não encontrado.")
        const uData = usernameSnap.data();
        
        if (uData.email) {
          emailToUse = uData.email;
        } else {
          const userSnap = await getDoc(doc(db, "users", uData.uid))
          if (!userSnap.exists()) throw new Error("Perfil não localizado.")
          emailToUse = userSnap.data().email
        }
      }

      await signInWithEmailAndPassword(auth, emailToUse, password)
      toast({ title: "Bem-vindo!" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falha no Acesso",
        description: "E-mail ou senha incorretos."
      })
    } finally {
      setLoading(false)
    }
  }

  const showForm = isInitialized && !user;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30 font-body text-foreground">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority unoptimized />
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">{siteName.charAt(0)}</span></div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold text-xs uppercase tracking-widest">
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Início</Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        {!isInitialized ? (
          <div className="flex flex-col items-center gap-4 text-center">
             <Loader2 className="w-10 h-10 animate-spin text-secondary" />
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Iniciando Viby...</p>
          </div>
        ) : (
          <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="space-y-1 flex flex-col items-center pt-10 pb-6">
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-secondary/20">
                <KeyRound className="text-white w-7 h-7" />
              </div>
              <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Acessar Viby</CardTitle>
              <CardDescription className="font-medium text-center">Entre para viver experiências memoráveis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8">
              <SocialLoginButtons />
              
              {showForm && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-3 text-muted-foreground">Ou use sua senha</span></div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Identificador</Label>
                      <div className="relative">
                        <Input placeholder="E-mail ou @username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="pl-10 h-12 rounded-xl" required />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                          {identifier.includes("@") ? <Mail className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between mb-1"><Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Sua Senha</Label><Link href="/redefinir-senha" className="text-[10px] font-black uppercase tracking-widest text-secondary hover:underline">Esqueceu?</Link></div>
                      <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-12" />
                    </div>
                    <Button type="submit" className="w-full bg-primary text-white font-black h-14 rounded-2xl uppercase italic mt-2" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Entrar com Senha"}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-center gap-4 border-t border-border mt-6 py-8 bg-muted/20">
              <p className="text-xs font-bold text-muted-foreground">Novo por aqui? <Link href="/cadastro" className="text-secondary font-black hover:underline uppercase italic">Criar conta gratuita</Link></p>
            </CardFooter>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-muted/30"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <LoginContent />
    </React.Suspense>
  )
}
