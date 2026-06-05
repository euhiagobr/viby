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
import { Loader2, User, Mail, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
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

  // REDIRECIONAMENTO INTELIGENTE
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (user) {
      console.log('[Auth-Debug] User authenticated, evaluating profile completeness...');
      
      // O perfil é considerado completo se existir no Firestore E possuir username e CPF
      const hasMandatoryData = !!(profile?.username && profile?.cpf);
      const isComplete = profile !== null && hasMandatoryData;

      if (!isComplete) {
        console.log('[Auth-Debug] Redirecting To Onboarding (Missing Firestore data)');
        router.replace("/onboarding");
      } else {
        const redirect = searchParams.get('redirect') || "/dashboard";
        console.log('[Auth-Debug] Redirecting To:', redirect);
        router.replace(redirect);
      }
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
        
        if (!usernameSnap.exists()) throw new Error("Usuário não encontrado.")
        emailToUse = usernameSnap.data().email
      }

      await signInWithEmailAndPassword(auth, emailToUse, password)
      toast({ title: "Acesso liberado!" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no login", description: "Credenciais incorretas." })
    } finally {
      setLoading(false)
    }
  }

  const showSync = !isInitialized || authLoading;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
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
        <Card className="w-full max-w-md border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-10 pb-6 text-center">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <KeyRound className="text-white w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Acessar Viby</CardTitle>
            <CardDescription className="font-medium">Vença o tédio. Viva experiências.</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 px-8 pb-10">
            {showSync ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                 <Loader2 className="w-10 h-10 animate-spin text-secondary" />
                 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando conta...</p>
              </div>
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Usuário ou E-mail</Label>
                    <Input placeholder="Identificador" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-12 rounded-xl" required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between mb-1">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Sua Senha</Label>
                      <Link href="/redefinir-senha" className="text-[10px] font-black uppercase text-secondary hover:underline">Esqueceu?</Link>
                    </div>
                    <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-12" />
                  </div>
                  <Button type="submit" className="w-full bg-primary text-white font-black h-14 rounded-2xl uppercase italic mt-2 shadow-lg" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Entrar agora"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col items-center gap-4 border-t border-border mt-0 py-8 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground">
              Novo no clube? <Link href="/cadastro" className="text-secondary font-black hover:underline uppercase italic">Criar conta grátis</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
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

import { KeyRound } from "lucide-react"
