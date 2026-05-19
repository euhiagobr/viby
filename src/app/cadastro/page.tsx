
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore, useDoc } from "@/firebase"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, getDoc, runTransaction } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Globe, Loader2, Check, X } from "lucide-react"
import Link from "next/link"

export default function CadastroPage() {
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const siteName = settings?.siteName || "Viby"

  useEffect(() => {
    if (!db) return

    if (username.length === 0) {
      setUsernameStatus('idle')
      setCheckingUsername(false)
      return
    }

    const regex = /^[a-zA-Z0-9]+$/
    if (username.length < 5 || !regex.test(username)) {
      setUsernameStatus('invalid')
      setCheckingUsername(false)
      return
    }

    setUsernameStatus('idle')
    setCheckingUsername(true)

    const timer = setTimeout(async () => {
      try {
        const normalized = username.toLowerCase()
        const usernameRef = doc(db, "usernames", normalized)
        const usernameSnap = await getDoc(usernameRef)
        
        if (usernameSnap.exists()) {
          setUsernameStatus('taken')
        } else {
          setUsernameStatus('valid')
        }
      } catch (e) {
        console.error(e)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, db])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !db) return
    if (usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Erro", description: "Nome de usuário inválido ou já em uso." })
      return
    }

    setLoading(true)
    const normalizedUsername = username.toLowerCase()

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await updateProfile(user, { displayName: name })

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername)
        const userRef = doc(db, "users", user.uid)

        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) {
          throw new Error("Nome de usuário acaba de ser ocupado.")
        }

        transaction.set(usernameRef, { uid: user.uid })
        transaction.set(userRef, {
          name,
          username: normalizedUsername,
          email,
          avatar: `https://picsum.photos/seed/${user.uid}/100/100`,
          isVerified: false,
          totalEvents: 0,
          platform: "viby",
          role: "user",
          createdAt: new Date().toISOString()
        })
      })

      toast({ title: "Conta criada!", description: `Bem-vindo ao ${siteName}.` })
      router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description: error.message
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
          <CardTitle className="text-2xl font-bold">Criar uma conta {siteName}</CardTitle>
          <CardDescription>Acesso exclusivo para a plataforma de eventos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <div className="relative">
                <Input 
                  id="username" 
                  placeholder="ex: joaosilva123" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className={usernameStatus === 'valid' ? 'border-green-500 pr-10' : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10'}
                  required 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : usernameStatus === 'valid' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                    <X className="w-4 h-4 text-destructive" />
                  ) : null}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Mínimo 5 caracteres, apenas letras e números.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 font-bold" disabled={loading || usernameStatus !== 'valid'}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cadastrar no {siteName}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border mt-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta {siteName}?{" "}
            <Link href="/login" className="text-secondary font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
