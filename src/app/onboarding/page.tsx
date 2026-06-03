'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, ShieldCheck, User as UserIcon, Fingerprint, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskCPF } from "@/lib/crypto-utils";
import { updateUserCPF } from "@/app/actions/user";

export default function OnboardingPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [cpf, setCpf] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle');

  // Guard e Redirecionamento
  useEffect(() => {
    console.log("[Auth-Debug] Onboarding State:", { isInitialized, hasUser: !!user, hasProfile: !!profile });

    if (isInitialized && !user) {
      console.log("[Auth-Debug] Onboarding: No user found, forcing /login");
      router.replace("/login");
      return;
    }
    
    // Se o perfil carregou e já está completo, pula o onboarding
    if (isInitialized && profile) {
       const isComplete = profile.username && profile.cpf && profile.name;
       console.log("[Auth-Debug] Onboarding check profile completion:", { isComplete, username: profile.username, cpf: !!profile.cpf, name: profile.name });
       
       if (profile.profileComplete || isComplete) {
         console.log("[Auth-Debug] Profile already complete, skipping onboarding to /dashboard");
         router.replace("/dashboard");
         return;
       }
       
       // Preenche dados existentes (caso tenha vindo do social)
       if (!name && profile.name) setName(profile.name);
       if (!username && profile.username) setUsername(profile.username);
    }
  }, [user, profile, isInitialized, router]);

  useEffect(() => {
    if (!db || !username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const cleanUsername = username.toLowerCase().trim();
    const regex = /^[a-z0-9_]+$/;
    
    if (cleanUsername.length < 3 || cleanUsername.length > 20 || !regex.test(cleanUsername)) {
      setUsernameStatus('invalid');
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", cleanUsername);
        const usernameSnap = await getDoc(usernameRef);
        
        // Se o username já for o do próprio usuário, é válido
        if (usernameSnap.exists() && usernameSnap.data().uid === user?.uid) {
          setUsernameStatus('valid');
        } else {
          setUsernameStatus(usernameSnap.exists() ? 'taken' : 'valid');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, db, user?.uid]);

  const validateCPF = (v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length !== 11) return false;
    if (/^(\d)\1+$/.test(clean)) return false;
    let sum = 0;
    let rev;
    for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(10))) return false;
    return true;
  };

  const formatCPFInput = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    return v;
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || usernameStatus !== 'valid') return;

    const cleanCPF = cpf.replace(/\D/g, "");
    if (!validateCPF(cleanCPF)) {
      toast({ variant: "destructive", title: "CPF Inválido", description: "Informe um CPF real para prosseguir." });
      return;
    }

    setIsSubmitting(true);
    const normalizedUsername = username.toLowerCase().trim();

    try {
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername);
        const userRef = doc(db, "users", user.uid);

        const usernameSnap = await transaction.get(usernameRef);
        if (usernameSnap.exists() && usernameSnap.data().uid !== user.uid) {
          throw new Error("Username já ocupado.");
        }

        transaction.set(usernameRef, { uid: user.uid, type: 'user', email: user.email }, { merge: true });
        transaction.update(userRef, {
          name: name.trim(),
          username: normalizedUsername,
          cpf: maskCPF(cleanCPF),
          profileComplete: true,
          updatedAt: serverTimestamp()
        });
      });

      // Salva o CPF na subcoleção privada
      await updateUserCPF(user.uid, cleanCPF);

      toast({ title: "Perfil completado!", description: "Bem-vindo à Viby." });
      router.push("/dashboard");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isInitialized) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/30"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="text-center pt-10">
          <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-secondary" />
          </div>
          <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Quase lá!</CardTitle>
          <CardDescription>Complete seus dados para acessar a plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-8">
          <form onSubmit={handleOnboarding} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nome Completo</Label>
              <Input 
                placeholder="Como você quer ser chamado?" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="rounded-xl h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Seu @Username</Label>
              <div className="relative">
                <Input 
                  placeholder="ex: joao_viby" 
                  value={username} 
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className={cn(
                    "rounded-xl h-12 pr-10",
                    usernameStatus === 'valid' ? 'border-green-500' : 
                    (usernameStatus === 'taken' || usernameStatus === 'invalid') ? 'border-destructive' : ''
                  )}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin opacity-40" /> : 
                   usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                   (usernameStatus === 'taken' || usernameStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                </div>
              </div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Apenas letras, números e underline.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2 ml-1">
                <Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF (Obrigatório)
              </Label>
              <Input 
                placeholder="000.000.000-00" 
                value={cpf} 
                onChange={e => setCpf(formatCPFInput(e.target.value))}
                className="rounded-xl h-12"
                required
              />
              <p className="text-[8px] font-bold text-muted-foreground uppercase italic">Necessário para segurança e conformidade.</p>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || usernameStatus !== 'valid' || cpf.length < 11 || !name.trim()}
              className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Concluir Cadastro"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t p-6 text-center">
           <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Sua conta Viby está protegida</span>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}
