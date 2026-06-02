"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Globe, Loader2, User, Mail, ArrowLeft, KeyRound, AlertTriangle } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const siteName = settings?.siteName || "Viby"

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  /**
   * Verifica se o UID existe na coleção /users do banco eventosviby
   */
  const verifyVibyUserAndGetEmail = async (uid: string) => {
    if (!db) return null
    try {
      const userDoc = await getDoc(doc(db, "users", uid))
      if (!userDoc.exists()) {
        return null
      }
      return userDoc.data()?.email
    } catch (e: any) {
      return null
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth || !db) return

    setLoading(true)
    try {
      let emailToUse = identifier.trim().toLowerCase();

      // Fluxo 1: Login via Username
      if (!identifier.includes("@")) {
        const usernameClean = identifier.replace('@', '').toLowerCase().trim();
        const usernameRef = doc(db, "usernames", usernameClean)
        const usernameSnap = await getDoc(usernameRef)
        
        if (!usernameSnap.exists()) {
          throw new Error("Perfil não encontrado na rede Viby.")
        }

        const uData = usernameSnap.data();
        
        // Tentamos usar o e-mail cacheado no índice de usernames
        if (uData.email) {
          emailToUse = uData.email;
        } else {
          // Fallback para contas antigas (tenta ler do perfil se público)
          const userEmail = await verifyVibyUserAndGetEmail(uData.uid)
          if (!userEmail) {
            throw new Error("Sua conta não pôde ser resolvida via username. Tente entrar com e-mail.")
          }
          emailToUse = userEmail
        }
      }

      // Fluxo 2: Autenticação Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password)
      
      // Validação Pós-Login: Garantir que o perfil existe no Firestore
      const userDocRef = doc(db, "users", userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await signOut(auth)
        throw new Error(`Acesso Negado: Perfil não localizado na base ${siteName}.`)
      }

      const userData = userDoc.data();

      // AUTO-REPARO: Se o usuário logou e o índice de usernames não tem o e-mail, atualizamos agora
      if (userData.username) {
        const idxRef = doc(db, "usernames", userData.username.toLowerCase());
        const idxSnap = await getDoc(idxRef);
        if (idxSnap.exists() && !idxSnap.data().email) {
          await setDoc(idxRef, { email: emailToUse }, { merge: true });
        }
      }

      toast({ title: "Bem-vindo!", description: `Acesso autorizado em ${siteName}.` })
      router.push("/dashboard")
      
    } catch (error: any) {
      let msg = "Credenciais inválidas. Tente novamente."
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = "E-mail ou senha incorretos."
      } else if (error.message) {
        msg = error.message
      }
      
      toast({
        variant: "destructive",
        title: "Falha no Acesso",
        description: msg
      })
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

  return (
    <div className="min-h-screen flex flex-col bg-muted/30 font-body">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={120} 
                height={40} 
                className="h-10 w-auto object-contain" 
                priority 
                unoptimized
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
                </div>
                <span className="text-xl font-bold tracking-tight">{siteName}</span>
              </>
            )}
          </Link>
          <Button variant="ghost" asChild className="font-semibold text-xs uppercase tracking-widest">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-10 pb-6">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 overflow-hidden shadow-lg shadow-secondary/20">
              <KeyRound className="text-white w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Acessar Viby</CardTitle>
            <CardDescription className="font-medium text-center">Entre com seu e-mail ou @username exclusivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-[10px] font-black uppercase tracking-widest opacity-60">Identificador</Label>
                <div className="relative">
                  <Input 
                    id="identifier" 
                    placeholder="E-mail ou @username" 
                    value={identifier} 
                    onChange={(e) => setIdentifier(e.target.value)} 
                    className="pl-10 h-12 rounded-xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                    required 
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                    {identifier.includes("@") ? <Mail className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest opacity-60">Sua Senha</Label>
                  <Link href="/redefinir-senha" className="text-[10px] font-black uppercase tracking-widest text-secondary hover:underline">Esqueceu a senha?</Link>
                </div>
                <div className="relative">
                   <Input 
                     id="password" 
                     type="password" 
                     placeholder="••••••••" 
                     value={password} 
                     onChange={(e) => setPassword(e.target.value)} 
                     required 
                     className="pl-10 h-12 rounded-xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                   />
                </div>
              </div>
              <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic mt-4" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Entrar na Viby"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4 border-t border-border mt-6 py-8 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground">
              Novo por aqui?{" "}
              <Link href="/cadastro" className="text-secondary font-black hover:underline uppercase italic">
                Criar conta gratuita
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
