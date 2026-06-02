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
import { Globe, Loader2, Check, X, ArrowLeft, Fingerprint } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { cn } from "@/lib/utils"
import { sendWelcomeEmail } from "@/app/actions/email"
import Image from "next/image"
import { processGamificationEvent } from "@/lib/gamification-service"
import { updateUserCPF } from "@/app/actions/user"

const validateCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
};

export default function CadastroPage() {
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [gender, setGender] = useState("")
  const [cpf, setCpf] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken' | 'error'>('idle')
  const [isUsernameCustom, setIsUsernameCustom] = useState(false)
  
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);
  const { data: blockedData } = useDoc<any>(blockedRef);

  const siteName = settings?.siteName || "Viby"

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!db || !username) {
      setUsernameStatus('idle')
      return
    }

    const newUsername = username.toLowerCase().trim()
    const regex = /^[a-zA-Z0-9]+$/
    
    if (newUsername.length < 5 || !regex.test(newUsername)) {
      setUsernameStatus('invalid')
      return
    }

    if (blockedData?.list?.includes(newUsername)) {
      setUsernameStatus('taken')
      return
    }

    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", newUsername)
        const usernameSnap = await getDoc(usernameRef)
        if (usernameSnap.exists()) {
          setUsernameStatus('taken')
        } else {
          setUsernameStatus('valid')
        }
      } catch (e: any) {
        console.error("[Username Check Error]", e)
        if (e.code === 'permission-denied') {
          setUsernameStatus('error')
        }
      } finally {
        setCheckingUsername(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [username, db, blockedData])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    
    if (!isUsernameCustom) {
      const suggested = val
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 20);
      setUsername(suggested);
    }
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
    setIsUsernameCustom(true);
  }

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (v.length > 6) {
      return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    }
    if (v.length > 3) {
      return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    }
    return v;
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth || !db) return
    
    if (usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Erro", description: "Nome de usuário inválido, em uso ou erro de permissão." })
      return
    }

    if (!birthDate || !gender || !cpf) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios." })
      return
    }

    if (!validateCPF(cpf)) {
      toast({ variant: "destructive", title: "CPF Inválido", description: "O número de CPF informado não é válido." })
      return
    }

    setLoading(true)
    const normalizedUsername = username.toLowerCase()

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await updateProfile(user, { displayName: name })

      const userData = {
        uid: user.uid,
        name,
        username: normalizedUsername,
        email: email.toLowerCase().trim(),
        birthDate,
        gender,
        avatar: `https://picsum.photos/seed/${user.uid}/100/100`,
        plan: "free",
        platform: "viby",
        role: "user",
        city: "",
        state: "",
        country: "Brasil",
        createdAt: serverTimestamp()
      };

      const officialOrgId = "d3c9fdc1-7fcc-4a70-ab99-79729fad2bf9";

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername)
        const userRef = doc(db, "users", user.uid)

        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) {
          throw new Error("Nome de usuário acaba de ser ocupado.")
        }

        transaction.set(usernameRef, { uid: user.uid, type: 'user', email: email.toLowerCase().trim() })
        transaction.set(userRef, userData)

        const followRef1 = doc(db, "follows", `${user.uid}_${officialOrgId}`)
        transaction.set(followRef1, {
          followerId: user.uid,
          followingId: officialOrgId,
          targetType: 'organization',
          timestamp: serverTimestamp()
        })
      });

      await updateUserCPF(user.uid, cpf);

      await processGamificationEvent(db, user.uid, 'on_signup', {}, user.uid, userData);
      
      sendWelcomeEmail({
        to: email,
        userName: name,
        siteName: siteName
      });

      toast({ title: "Conta criada!", description: `Bem-vindo à ${siteName}.` })
      router.push("/dashboard")
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: "destructive",
          title: "E-mail já cadastrado",
          description: "Este endereço de e-mail já está associado a uma conta."
        })
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao cadastrar",
          description: error.message
        })
      }
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
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority unoptimized />
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Início
            </Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-8 pb-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-secondary/20">
               <Globe className="text-white w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Conta Viby</CardTitle>
            <CardDescription className="font-medium">Junte-se à comunidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome Completo</Label>
                <Input placeholder="Seu nome" value={name} onChange={handleNameChange} required className="rounded-xl h-11" />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome de Usuário (@)</Label>
                <div className="relative">
                  <Input 
                    placeholder="ex: joaosilva" 
                    value={username} 
                    onChange={handleUsernameChange} 
                    className={cn(
                      "rounded-xl h-11 pr-10", 
                      usernameStatus === 'valid' && 'border-green-500', 
                      (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'error') && 'border-destructive'
                    )}
                    required 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : usernameStatus === 'valid' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                      <X className="w-4 h-4 text-destructive" />
                    ) : usernameStatus === 'error' ? (
                      <ShieldAlert className="w-4 h-4 text-destructive" />
                    ) : null}
                  </div>
                </div>
                {usernameStatus === 'error' && <p className="text-[9px] text-destructive font-bold uppercase mt-1">Erro de permissão no banco</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Gênero</Label>
                  <Select value={gender} onValueChange={setGender} required>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Nascimento</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className="rounded-xl h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF
                </Label>
                <Input placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} required className="rounded-xl h-11" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">E-mail</Label>
                <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Senha</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-11" />
              </div>
              
              <Button type="submit" className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic mt-4" disabled={loading || usernameStatus !== 'valid'}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Criar Minha Conta"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border mt-6 py-6 bg-muted/20">
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
