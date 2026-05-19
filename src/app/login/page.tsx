
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
import { Globe, Loader2, User, Mail } from "lucide-react"
import Link from "next/link"

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
        const usernameRef = doc(db, "usernames", identifier.toLowerCase().trim())
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
        throw new Error(`Esta conta não pertence ao ${siteName}.`)
      }

      toast({ title: "Login realizado!", description: `Bem-vindo de volta ao ${siteName}.` })
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 font-body">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={siteName} className="max-w-full max-h-full object-contain p-2" />
            ) : (
              <Globe className="text-white w-7 h-7" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{siteName} Login</CardTitle>
          <CardDescription>Acesse sua conta com e-mail ou nome de usuário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Identificador (E-mail ou Usuário)</Label>
              <div className="relative">
                <Input 
                  id="identifier" 
                  placeholder="seu@email.com ou seu_usuario" 
                  value={identifier} 
                  onChange={(e) => setIdentifier(e.target.value)} 
                  className="pl-10"
                  required 
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {identifier.includes("@") ? <Mail className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="#" className="text-xs text-secondary hover:underline">Esqueceu a senha?</Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 font-bold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Entrar no {siteName}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border mt-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Ainda não tem conta no {siteName}?{" "}
            <Link href="/cadastro" className="text-secondary font-bold hover:underline">
              Cadastrar-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
