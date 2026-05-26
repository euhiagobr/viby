
"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore, useDoc } from "@/firebase"
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Globe, Loader2, User, Mail, ArrowLeft, KeyRound } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const siteName = settings?.siteName || "Viby"

  const verifyVibyUserAndGetEmail = async (uid: string) => {
    if (!db) return null
    try {
      const userDoc = await getDoc(doc(db, "users", uid))
      if (!userDoc.exists() || userDoc.data()?.platform !== "viby") {
        return null
      }
      return userDoc.data()?.email
    } catch (e) {
      console.error("Erro ao verificar usuário Viby:", e)
      return null
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !db) return

    setLoading(true)
    try {
      let emailToUse = identifier

      if (!identifier.includes("@")) {
        const usernameRef = doc(db, "usernames", identifier.toLowerCase().trim().replace('@', ''))
        const usernameSnap = await getDoc(usernameRef)
        
        if (!usernameSnap.exists()) {
          throw new Error("Nome de usuário não encontrado.")
        }

        const uid = usernameSnap.data().uid
        const userEmail = await verifyVibyUserAndGetEmail(uid)
        
        if (!userEmail) {
          throw new Error("Acesso negado para esta plataforma.")
        }
        emailToUse = userEmail
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password)
      
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid))
      if (!userDoc.exists() || userDoc.data()?.platform !== "viby") {
        await signOut(auth)
        throw new Error(`Esta conta não pertence à ${siteName}.`)
      }

      toast({ title: "Login realizado!", description: `Bem-vindo de volta à ${siteName}.` })
      router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: error.message || "Verifique suas credenciais."
      })
    } finally {
      setLoading(false)
    }
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
                className="h-8 w-auto object-contain" 
                priority 
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
          <Button variant="ghost" asChild className="font-semibold">
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
              {settings?.logoUrl ? (
                <Image 
                  src={settings.logoUrl} 
                  alt={siteName} 
                  width={48} 
                  height={48} 
                  className="w-full h-full object-contain p-2" 
                  priority 
                />
              ) : (
                <Globe className="text-white w-7 h-7" />
              )}
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Acessar Clube</CardTitle>
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
                    className="pl-10 h-12 rounded-xl border-dashed border-secondary/30"
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
                     className="pl-10 h-12 rounded-xl border-dashed border-secondary/30"
                   />
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                      <KeyRound className="h-4 w-4" />
                   </div>
                </div>
              </div>
              <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic mt-4" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Entrar na {siteName}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border mt-6 py-8 bg-muted/20">
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
