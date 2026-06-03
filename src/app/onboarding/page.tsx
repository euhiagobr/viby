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
import { Loader2, Check, X, ShieldCheck, User as UserIcon, Fingerprint, Mail, AtSign } from "lucide-react";
import { cn, validateCPF, validateUsername } from "@/lib/utils";
import { maskCPF, encryptDeterministic } from "@/lib/crypto-utils";
import { updateUserCPF } from "@/app/actions/user";
import { recordAuditLog } from "@/app/actions/audit";

export default function OnboardingPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [cpf, setCpf] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // States de Validação
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
    
    // Se o perfil já estiver completo, expulsa do onboarding para o dashboard
    if (profile && profile.username && profile.cpf && profile.profileComplete) {
      console.log('[Auth-Debug] Profile already complete, moving to dashboard');
      router.replace("/dashboard");
      return;
    }

    if (profile) {
      if (!name && profile.name) setName(profile.name);
    }
  }, [user, profile, isInitialized, authLoading, router]);

  // Validação de Username em tempo real
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

  // Validação de CPF (Unicidade e Formato)
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
        // Verifica se este CPF já está em uso (buscando pelo hash determinístico)
        const encryptedCpf = encryptDeterministic(cleanCPF);
        const q = query(collection(db, "users"), where("cpf", "==", maskCPF(cleanCPF)), limit(1));
        const snap = await getDocs(q);
        
        // No protótipo, verificamos se o documento com esse CPF mascarado existe
        // Em um sistema real, faríamos o check na subcoleção restrita via Server Action
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

    if (usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Username inválido", description: "Escolha outro nome de usuário." });
      return;
    }

    if (cpfStatus !== 'valid') {
      toast({ variant: "destructive", title: "CPF inválido", description: "O CPF informado já está em uso ou é inválido." });
      return;
    }

    setIsSubmitting(true);
    const normalizedUsername = username.toLowerCase().trim();
    const cleanCPF = cpf.replace(/\D/g, "");

    try {
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername);
        const userRef = doc(db, "users", user.uid);

        const usernameSnap = await transaction.get(usernameRef);
        if (usernameSnap.exists() && usernameSnap.data().uid !== user.uid) {
          throw new Error("Este nome de usuário já está em uso.");
        }

        transaction.set(usernameRef, { uid: user.uid, type: 'user', email: user.email }, { merge: true });
        transaction.update(userRef, {
          username: normalizedUsername,
          cpf: maskCPF(cleanCPF),
          profileComplete: true,
          updatedAt: serverTimestamp()
        });
      });

      // Salva o CPF descriptografado na área restrita
      await updateUserCPF(user.uid, cleanCPF);
      
      await recordAuditLog({
        userId: user.uid,
        userEmail: user.email,
        action: 'profile_update',
        category: 'profile',
        success: true,
        metadata: { step: 'onboarding_complete', username: normalizedUsername }
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
          <CardDescription className="text-sm font-medium px-8">Estamos quase lá! Precisamos de apenas mais dois dados para liberar seu acesso total.</CardDescription>
        </CardHeader>
        
        <CardContent className="px-10 py-10 space-y-8">
          <form onSubmit={handleOnboarding} className="space-y-6">
            
            {/* Campos Imutáveis (Read-only do Google) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 grayscale-[0.5]">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Seu Nome (Google)</Label>
                  <div className="relative">
                     <Input value={user?.displayName || ""} readOnly className="rounded-xl h-11 bg-muted border-none font-bold" />
                     <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-30" />
                  </div>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">E-mail (Google)</Label>
                  <div className="relative">
                     <Input value={user?.email || ""} readOnly className="rounded-xl h-11 bg-muted border-none font-bold text-xs" />
                     <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-30" />
                  </div>
               </div>
            </div>

            <Separator className="border-dashed" />

            {/* Campos Obrigatórios */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Escolha seu @Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-40" />
                  <Input 
                    placeholder="ex: joao.viby" 
                    value={username} 
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                    className={cn(
                      "rounded-xl h-12 pl-9 pr-10 font-bold",
                      usernameStatus === 'valid' && 'border-green-500 bg-green-50/10',
                      (usernameStatus === 'taken' || usernameStatus === 'invalid') && 'border-destructive bg-red-50/10'
                    )}
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                     usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                     usernameStatus === 'taken' ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
                {usernameStatus === 'invalid' && <p className="text-[9px] font-bold text-destructive uppercase ml-1">Use apenas letras, números, ponto ou underline.</p>}
                {usernameStatus === 'taken' && <p className="text-[9px] font-bold text-destructive uppercase ml-1">Este username já está sendo usado por outro membro.</p>}
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
                    className={cn(
                      "rounded-xl h-12 pr-10 font-mono text-lg",
                      cpfStatus === 'valid' && 'border-green-500 bg-green-50/10',
                      cpfStatus === 'invalid' && 'border-destructive bg-red-50/10',
                      cpfStatus === 'taken' && 'border-destructive bg-red-50/10'
                    )}
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingCPF ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                     cpfStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                     (cpfStatus === 'invalid' || cpfStatus === 'taken') ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
                {cpfStatus === 'invalid' && <p className="text-[9px] font-bold text-destructive uppercase ml-1">CPF informado é inválido.</p>}
                {cpfStatus === 'taken' && <p className="text-[9px] font-bold text-destructive uppercase ml-1">Este CPF já possui uma conta vinculada.</p>}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || usernameStatus !== 'valid' || cpfStatus !== 'valid'}
              className="w-full bg-primary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic text-lg hover:bg-secondary transition-all active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Concluir meu Acesso"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t p-6 text-center">
           <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <span className="text-[10px] font-black uppercase tracking-widest">Sua conta é única e segura</span>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}
