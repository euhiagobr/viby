
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore } from "@/firebase"
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile, signOut } from "firebase/auth"
import { doc, setDoc, getDoc, runTransaction } from "firebase/firestore"
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
        const userDoc = await getDoc(doc(db, "usernames", normalized))
        if (userDoc.exists()) {
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
          createdAt: new Date().toISOString()
        })
      })

      toast({ title: "Conta criada!", description: "Bem-vindo ao Viby." })
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

  const handleGoogleSignIn = async () => {
    if (!auth || !db) return
    const provider = new GoogleAuthProvider()
    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const userDoc = await getDoc(doc(db, "users", user.uid))
      
      if (!userDoc.exists()) {
        const baseUsername = user.email?.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || "user"
        const finalUsername = baseUsername.length < 5 ? baseUsername + Math.floor(1000 + Math.random() * 9000) : baseUsername
        
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName || "Usuário",
          username: finalUsername.toLowerCase(),
          email: user.email,
          avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
          isVerified: false,
          totalEvents: 0,
          platform: "viby",
          createdAt: new Date().toISOString()
        })
      }

      router.push("/dashboard")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro com Google", description: error.message })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4">
            <Globe className="text-white w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold">Criar uma conta Viby</CardTitle>
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
                  className={usernameStatus === 'valid' ? 'border-green-500' : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive' : ''}
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
              {usernameStatus === 'taken' && <p className="text-[10px] text-destructive">Este nome já está em uso.</p>}
              {usernameStatus === 'invalid' && username.length > 0 && <p className="text-[10px] text-destructive">Formato inválido ou muito curto.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90" disabled={loading || usernameStatus !== 'valid'}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cadastrar no Viby
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta Viby?{" "}
            <Link href="/login" className="text-secondary font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
