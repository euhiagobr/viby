"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, getDoc, runTransaction, serverTimestamp, increment } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Globe, Loader2, Check, X, ArrowLeft, Fingerprint, ShieldAlert, UserPlus } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { cn } from "@/lib/utils"
import { sendWelcomeEmail } from "@/app/actions/email"
import Image from "next/image"
import { updateUserCPF } from "@/app/actions/user"
import { maskCPF } from "@/lib/crypto-utils"
import { SocialLoginButtons } from "../login/SocialLoginButtons"
import { Separator } from "@/components/ui/separator"

const DEFAULT_PROFILE_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media";

function CadastroContent() {
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [gender, setGender] = useState("")
  const [cpf, setCpf] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')
  
  const router = useRouter()
  const auth = useAuth()
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth)
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  // REDIRECIONAMENTO IMEDIATO
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (user && profile) {
      const isComplete = profile.username && profile.cpf;
      const target = isComplete ? "/dashboard" : "/onboarding";
      router.replace(target);
    }
  }, [user, profile, isInitialized, authLoading, router]);

  useEffect(() => {
    if (!db || !username || username.length < 5) {
      setUsernameStatus('idle')
      return
    }

    const newUsername = username.toLowerCase().trim()
    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", newUsername)
        const usernameSnap = await getDoc(usernameRef)
        setUsernameStatus(usernameSnap.exists() ? 'taken' : 'valid')
      } catch (e) {
        setUsernameStatus('idle')
      } finally {
        setCheckingUsername(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [username, db])

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    return v;
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth || !db) return
    
    if (usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Username indisponível" })
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await updateProfile(user, { displayName: name })

      const cleanCPF = cpf.replace(/\D/g, "");
      const userData = {
        uid: user.uid,
        name,
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        avatar: DEFAULT_PROFILE_IMAGE,
        birthDate,
        gender,
        cpf: maskCPF(cleanCPF),
        profileComplete: true,
        role: "user",
        status: "Ativo",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await runTransaction(db, async (transaction) => {
        transaction.set(doc(db, "usernames", userData.username), { uid: user.uid, type: 'user', email: userData.email })
        transaction.set(doc(db, "users", user.uid), userData)
      });

      await updateUserCPF(user.uid, cleanCPF);
      sendWelcomeEmail({ to: email, userName: name }).catch(() => {});

      toast({ title: "Bem-vindo ao clube!" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao cadastrar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const showSync = !isInitialized || authLoading || (user && !profile);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
            </div>
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold text-xs uppercase tracking-widest">
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Início</Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-8 pb-4 text-center">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <UserPlus className="text-white w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Conta</CardTitle>
            <CardDescription className="font-medium">O seu passaporte para o agora.</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 px-8 pb-10">
            {showSync ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                 <Loader2 className="w-10 h-10 animate-spin text-secondary" />
                 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Iniciando Viby...</p>
              </div>
            ) : (
              <>
                <SocialLoginButtons />
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black">
                    <span className="bg-white px-3 text-muted-foreground">Ou preencha os campos</span>
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome Completo</Label>
                    <Input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} required className="rounded-xl h-11" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Username (@)</Label>
                      <div className="relative">
                        <Input 
                          placeholder="joao_viby" 
                          value={username} 
                          onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} 
                          className="rounded-xl h-11"
                          required 
                        />
                        {checkingUsername && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin opacity-40" />}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">CPF</Label>
                      <Input placeholder="00000000000" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} required className="rounded-xl h-11" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">E-mail</Label>
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Senha</Label>
                    <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="rounded-xl h-11" />
                  </div>
                  
                  <Button type="submit" className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic mt-4" disabled={loading || usernameStatus !== 'valid'}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Concluir Cadastro"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border mt-0 py-6 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground">
              Já tem conta? <Link href="/login" className="text-secondary font-black hover:underline uppercase italic">Entrar</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default function CadastroPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <CadastroContent />
    </React.Suspense>
  )
}