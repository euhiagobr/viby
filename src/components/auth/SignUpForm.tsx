"use client"

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth, useFirestore } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, AtSign, Fingerprint, Lock, User, Mail } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { validateCPF, validateUsername } from "@/lib/utils";
import { hashCPF } from "@/lib/crypto-utils";
import { updateUserCPF } from "@/app/actions/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(2, { message: "Informe seu nome completo." }),
  username: z.string().min(3, "Mínimo 3 caracteres").regex(/^[a-z0-9._]+$/, "Somente minúsculas, números, ponto e underline"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
  email: z.string().email({ message: "E-mail inválido." }),
  gender: z.string().min(1, "Selecione seu gênero"),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
});

interface SignUpFormProps {
  referredBy?: string; 
}

export function SignUpForm({ referredBy }: SignUpFormProps) {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'valid' | 'taken' | 'invalid'>('idle');
  const [checkingCPF, setCheckingCPF] = React.useState(false);
  const [cpfStatus, setCPFStatus] = React.useState<'idle' | 'valid' | 'taken' | 'invalid'>('idle');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      username: "",
      cpf: "",
      email: "",
      gender: "",
      password: "",
    },
  });

  const watchUsername = form.watch("username");
  const watchCPF = form.watch("cpf");

  React.useEffect(() => {
    if (!db || !watchUsername || watchUsername.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    if (!validateUsername(watchUsername)) {
      setUsernameStatus('invalid');
      return;
    }
    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", watchUsername.toLowerCase().trim());
        const snap = await getDoc(usernameRef);
        setUsernameStatus(snap.exists() ? 'taken' : 'valid');
      } catch (e) {
        setUsernameStatus('idle');
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [watchUsername, db]);

  React.useEffect(() => {
    if (!db || !watchCPF || watchCPF.length < 11) {
      setCPFStatus('idle');
      return;
    }
    const clean = watchCPF.replace(/\D/g, "");
    if (!validateCPF(clean)) {
      setCPFStatus('invalid');
      return;
    }
    setCheckingCPF(true);
    const timer = setTimeout(async () => {
      try {
        const hash = hashCPF(clean);
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
  }, [watchCPF, db]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Username ocupado", description: "Escolha outro @nick para seu perfil." });
      return;
    }
    if (cpfStatus !== 'valid') {
      toast({ variant: "destructive", title: "CPF Inválido", description: "Verifique os dados ou se já possui conta." });
      return;
    }

    setIsLoading(true);
    try {
      if (!auth || !db) throw new Error("Serviço de rede indisponível.");
      
      const userCredential = await auth.createUserWithEmailAndPassword(values.email, values.password);
      const user = userCredential.user;
      const uid = user.uid;

      // 1. Vincular CPF (Segurança Tripla)
      const cpfRes = await updateUserCPF(uid, values.cpf);
      if (!cpfRes.success) throw new Error(cpfRes.error);

      // 2. Transação de Criação de Identidade
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", values.username.toLowerCase().trim());
        const userRef = doc(db, "users", uid);

        transaction.set(usernameRef, { 
          uid, 
          type: 'user', 
          email: values.email.toLowerCase().trim(),
          username: values.username.toLowerCase().trim()
        });

        const expireAt = new Date();
        expireAt.setDate(expireAt.getDate() + 365); 

        transaction.update(userRef, {
          name: values.name,
          username: values.username.toLowerCase().trim(),
          gender: values.gender,
          referredBy: referredBy || null,
          affiliateExpireAt: referredBy ? expireAt.toISOString() : null,
          profileComplete: true,
          plan: "free",
          walletBalance: 0,
          totalXp: 50,
          level: 1,
          status: "Ativo",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        if (referredBy) {
          const statsRef = doc(db, "affiliate_stats", referredBy);
          transaction.update(statsRef, {
            totalUsersReferred: increment(1),
            updatedAt: serverTimestamp()
          });
        }
      });

      toast({ title: "Bem-vindo à Viby!", description: "Sua conta foi criada com sucesso." });
      router.replace("/dashboard");

    } catch (error) {
      let errorMessage = "Erro ao processar cadastro.";
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/email-already-in-use": errorMessage = "E-mail já cadastrado."; break;
          case "auth/invalid-email": errorMessage = "E-mail inválido."; break;
          case "auth/weak-password": errorMessage = "Senha muito fraca."; break;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nome Completo</FormLabel>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <FormControl>
                  <Input placeholder="Como no seu documento" className="h-14 rounded-2xl pl-12 border-dashed border-primary/20 focus-visible:ring-secondary/30" {...field} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Username (@)</FormLabel>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                  <FormControl>
                    <Input placeholder="seu.nick" className="h-14 rounded-2xl pl-12 pr-10 border-dashed border-primary/20" {...field} />
                  </FormControl>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                    usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                    (usernameStatus === 'taken' || usernameStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">CPF (11 dígitos)</FormLabel>
                <div className="relative">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                  <FormControl>
                    <Input 
                      placeholder="000.000.000-00" 
                      className="h-14 rounded-2xl pl-12 pr-10 font-mono border-dashed border-primary/20" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").substring(0, 11))}
                    />
                  </FormControl>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingCPF ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                    cpfStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                    (cpfStatus === 'taken' || cpfStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">E-mail</FormLabel>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <FormControl>
                  <Input type="email" placeholder="seu@email.com" className="h-14 rounded-2xl pl-12 border-dashed border-primary/20" {...field} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Gênero</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-14 rounded-2xl border-dashed border-primary/20 px-6">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="nao-binario">Não-binário</SelectItem>
                  <SelectItem value="outro">Outro / Prefiro não dizer</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Senha de Acesso</FormLabel>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <FormControl>
                  <Input type="password" placeholder="Mínimo 6 caracteres" className="h-14 rounded-2xl pl-12 border-dashed border-primary/20" {...field} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isLoading || usernameStatus !== 'valid' || cpfStatus !== 'valid'} 
          className="w-full bg-secondary text-white font-black h-20 rounded-[2rem] shadow-xl uppercase italic text-xl transition-all hover:scale-[1.02] shadow-secondary/30 mt-4 active:scale-95"
        >
          {isLoading ? <Loader2 className="mr-2 h-8 w-8 animate-spin" /> : "Concluir Cadastro"}
        </Button>
      </form>
    </Form>
  );
}
