'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { doc, getDoc, runTransaction, serverTimestamp, query, collection, where, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, ShieldCheck, User as UserIcon, Fingerprint, Mail, AtSign, Lock } from "lucide-react";
import { cn, validateCPF, validateUsername } from "@/lib/utils";
import { hashCPF, maskCPF } from "@/lib/crypto-utils";
import { updateUserCPF } from "@/app/actions/user";
import { recordAuditLog } from "@/app/actions/audit";
import { Separator } from "@/components/ui/separator";

const RESERVED_USERNAMES = [
  "admin", "suporte", "support", "help", "ajuda", "dashboard", "login", "cadastro", 
  "signup", "signin", "redefinir-senha", "reset-password", "checkout", "privacidade", 
  "privacy", "termos", "terms", "api", "viby", "oficial", "official", "status", 
  "settings", "configuracoes", "root", "sys", "system", "onboarding"
];

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
  
  const [checkingCPF, setCheckingCPF] = useState(false);
  const [cpfStatus, setCPFStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle');

  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    
    const hasMandatoryData = !!(profile?.username && profile?.cpfHash);
    if (profile !== null && hasMandatoryData) {
      router.replace("/dashboard");
      return;
    }

    if (profile) {
      if (!name && profile.name) setName(profile.name);
    }
  }, [user, profile, isInitialized, authLoading, router, name]);

  useEffect(() => {
    if (!db || !username) {
      setUsernameStatus('idle');
      return;
    }
    const cleanUsername = username.toLowerCase().trim();
    if (!validateUsername(cleanUsername)) {
      setUsernameStatus('invalid');
      return;
    }
    if (RESERVED_USERNAMES.includes(cleanUsername)) {
      setUsernameStatus('taken');
      return;
    }
    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", cleanUsername);
        const usernameSnap = await getDoc(usernameRef);
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

  useEffect(() => {
    if (!db || !cpf || cpf.length < 11) {
      setCPFStatus('idle');
      return;
    }
    const cleanCPF = cpf.replace(/\D/g, "");
    if (!validateCPF(cleanCPF)) {
      setCPFStatus('invalid');
      return;
    }
    setCheckingCPF(true);
    const timer = setTimeout(async () => {
      try {
        const hash = hashCPF(cleanCPF);
        const q = query(collection(db, "users"), where("cpfHash", "==", hash), limit(1));
        const snap = await getDocs(q);
        setCPFStatus(snap.empty ? 'valid' : 'taken');
      } catch (e) {
        setCPFStatus('idle');
      } finally {
        setCheckingCPF(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [cpf, db]);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || isSubmitting) return;
    if (usernameStatus !== 'valid' || cpfStatus !== 'valid') return;

    setIsSubmitting(true);
    const normalizedUsername = username.toLowerCase().trim();
    const cleanCPF = cpf.replace(/\D/g, "");

    try {
      const cpfRes = await updateUserCPF(user.uid, cleanCPF);
      if (!cpfRes.success) throw new Error(cpfRes.error);

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername);
        const userRef = doc(db, "users", user.uid);
        transaction.set(usernameRef, { uid: user.uid, type: 'user', email: user.email }, { merge: true });
        transaction.update(userRef, {
          username: normalizedUsername,
          profileComplete: true,
          updatedAt: serverTimestamp()
        });
      });

      toast({ title: "Perfil finalizado!", description: "Bem-vindo à comunidade Viby." });
      router.replace("/dashboard");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isInitialized) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/30"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8fafc]">
      <Card className="w-full max-w-lg border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <CardHeader className="text-center pt-12 pb-6 bg-muted/30">
          <div className="w-20 h-20 bg-secondary rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-secondary/10">
            <UserIcon className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Concluir Perfil</CardTitle>
          <CardDescription className="text-sm font-medium px-8">Precisamos validar sua identidade para habilitar compras e transferências.</CardDescription>
        </CardHeader>
        
        <CardContent className="px-10 py-10 space-y-8">
          <form onSubmit={handleOnboarding} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 grayscale-[0.5]">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Seu Nome</Label>
                  <Input value={user?.displayName || ""} readOnly className="rounded-xl h-11 bg-muted border-none font-bold" />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">E-mail</Label>
                  <Input value={user?.email || ""} readOnly className="rounded-xl h-11 bg-muted border-none font-bold text-xs" />
               </div>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Username (@)</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-40" />
                  <Input 
                    placeholder="ex: joao.viby" 
                    value={username} 
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                    className="rounded-xl h-12 pl-9 pr-10 font-bold"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                     usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                     (usernameStatus === 'taken' || usernameStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2 ml-1">
                  <Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF (Obrigatório)
                </Label>
                <div className="relative">
                  <Input 
                    placeholder="000.000.000-00" 
                    value={cpf} 
                    onChange={e => setCpf(e.target.value.replace(/\D/g, "").substring(0, 11))}
                    className="rounded-xl h-12 pr-10 font-mono text-lg"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingCPF ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                     cpfStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                     (cpfStatus === 'invalid' || cpfStatus === 'taken') ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
                {cpfStatus === 'taken' && <p className="text-[9px] font-bold text-destructive uppercase ml-1">Este CPF já está sendo usado.</p>}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || usernameStatus !== 'valid' || cpfStatus !== 'valid'}
              className="w-full bg-primary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic text-lg hover:bg-secondary transition-all"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Concluir meu Cadastro"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t p-6 text-center">
           <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <span className="text-[10px] font-black uppercase tracking-widest">Seus dados são protegidos por criptografia</span>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}
