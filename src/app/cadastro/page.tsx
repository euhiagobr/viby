"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Globe, Loader2, Check, X, ArrowLeft, Fingerprint } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { encryptDeterministic } from "@/lib/crypto-utils"
import { cn } from "@/lib/utils"
import { sendWelcomeEmail } from "@/app/actions/email"
import Image from "next/image"

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
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')
  const [isUsernameCustom, setIsUsernameCustom] = useState(false)
  
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);
  const { data: blockedData } = useDoc<any>(blockedRef);

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

    const normalized = username.toLowerCase()

    setUsernameStatus('idle')
    setCheckingUsername(true)

    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", normalized)
        const usernameSnap = await getDoc(usernameRef)
        const isBlocked = blockedData?.list?.includes(normalized);
        
        if (usernameSnap.exists() || isBlocked) {
          if (!isUsernameCustom) {
             let nextNum = 1;
             let found = false;
             let currentTry = normalized;

             while(!found && nextNum <= 15) {
                const tryName = `${normalized}${nextNum}`;
                const tryRef = doc(db, "usernames", tryName);
                const trySnap = await getDoc(tryRef);
                const tryBlocked = blockedData?.list?.includes(tryName);
                
                if (!trySnap.exists() && !tryBlocked) {
                   found = true;
                   currentTry = tryName;
                } else {
                   nextNum++;
                }
             }

             if (found) {
                setUsername(currentTry);
                setUsernameStatus('valid');
             } else {
                setUsernameStatus('taken');
             }
          } else {
            setUsernameStatus('taken');
          }
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
  }, [username, db, blockedData, isUsernameCustom])

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
      toast({ variant: "destructive", title: "Erro", description: "Nome de usuário inválido ou já em uso." })
      return
    }

    if (!birthDate || !gender || !cpf) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios." })
      return
    }

    setLoading(true)
    const normalizedUsername = username.toLowerCase()

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await updateProfile(user, { displayName: name })

      const encryptedCpf = encryptDeterministic(cpf);

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername)
        const userRef = doc(db, "users", user.uid)

        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) {
          throw new Error("Nome de usuário acaba de ser ocupado.")
        }

        // Criar conta e username
        transaction.set(usernameRef, { uid: user.uid, type: 'user' })
        transaction.set(userRef, {
          uid: user.uid,
          name,
          username: normalizedUsername,
          email,
          birthDate,
          gender,
          cpf: encryptedCpf,
          avatar: `https://picsum.photos/seed/${user.uid}/100/100`,
          plan: "free",
          platform: "viby",
          role: "user",
          city: "",
          state: "",
          country: "Brasil",
          createdAt: serverTimestamp()
        })

        // SEGUIR CONTA OFICIAL AUTOMATICAMENTE
        const officialOrgId = "92aee5c9-6741-432e-9511-f5a1afbaa8db"
        const followId = `${user.uid}_${officialOrgId}`
        const followRef = doc(db, "follows", followId)
        transaction.set(followRef, {
          followerId: user.uid,
          followingId: officialOrgId,
          targetType: 'organization',
          timestamp: serverTimestamp()
        })
      })

      sendWelcomeEmail({
        to: email,
        userName: name,
        siteName: siteName
      });

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
        <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] overflow-hidden">
          <CardHeader className="space-y-1 flex flex-col items-center pt-8 pb-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 overflow-hidden">
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
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Conta Viby</CardTitle>
            <CardDescription className="font-medium">Cadastre seu perfil pessoal para acessar eventos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome Completo</Label>
                <input 
                  id="name" 
                  placeholder="Seu nome" 
                  value={name} 
                  onChange={handleNameChange} 
                  required 
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome de Usuário</Label>
                <div className="relative">
                  <Input 
                    id="username" 
                    placeholder="ex: joaosilva123" 
                    value={username} 
                    onChange={handleUsernameChange} 
                    className={cn(
                      "rounded-xl h-11", 
                      usernameStatus === 'valid' ? 'border-green-500 pr-10' : 
                      usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10'
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
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-[10px] font-black uppercase tracking-widest opacity-60">Sexo / Gênero</Label>
                  <Select value={gender} onValueChange={setGender} required>
                    <SelectTrigger id="gender" className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="homem trans">Homem Trans</SelectItem>
                      <SelectItem value="mulher trans">Mulher Trans</SelectItem>
                      <SelectItem value="outro">Outro / Não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="text-[10px] font-black uppercase tracking-widest opacity-60">Nascimento</Label>
                  <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className="rounded-xl h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 text-secondary" />
                  Seu CPF
                </Label>
                <Input 
                  id="cpf" 
                  placeholder="000.000.000-00" 
                  value={cpf} 
                  onChange={(e) => setCpf(formatCPF(e.target.value))} 
                  required 
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest opacity-60">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest opacity-60">Senha</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-11" />
              </div>
              
              <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic mt-4" disabled={loading || (usernameStatus !== 'valid' && usernameStatus !== 'idle')}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Finalizar Cadastro
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border mt-6 py-8 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-secondary font-black hover:underline uppercase italic">
                Entrar agora
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
