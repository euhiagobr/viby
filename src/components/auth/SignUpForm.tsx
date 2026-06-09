
"use client"

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth, useFirestore } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, ShieldCheck, Fingerprint, AtSign, Phone, Calendar, MapPin, User as UserIcon } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { validateCPF, validateUsername, cn } from "@/lib/utils";
import { hashCPF } from "@/lib/crypto-utils";
import { updateUserCPF } from "@/app/actions/user";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  email: z.string().email({ message: "E-mail inválido." }),
  username: z.string().min(3, "Mínimo 3 caracteres").regex(/^[a-z0-9._]+$/, "Somente letras minúsculas, números, ponto e underline"),
  phone: z.string().min(10, "Telefone inválido"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
  birthDate: z.string().min(10, "Data de nascimento obrigatória"),
  gender: z.string().min(1, "Selecione seu gênero"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "UF deve ter 2 caracteres"),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
});

interface SignUpFormProps {
  referredByCode?: string;
}

export function SignUpForm({ referredByCode }: SignUpFormProps) {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Estados para validação assíncrona
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'valid' | 'taken' | 'invalid'>('idle');
  const [checkingCPF, setCheckingCPF] = React.useState(false);
  const [cpfStatus, setCPFStatus] = React.useState<'idle' | 'valid' | 'taken' | 'invalid'>('idle');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      phone: "",
      cpf: "",
      birthDate: "",
      gender: "",
      city: "",
      state: "",
      password: "",
    },
  });

  const watchUsername = form.watch("username");
  const watchCPF = form.watch("cpf");

  // Check Username Availability
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

  // Check CPF Uniqueness
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
    if (usernameStatus !== 'valid' || cpfStatus !== 'valid') {
      toast({ variant: "destructive", title: "Verifique os dados", description: "Username ou CPF não disponíveis." });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Criar Auth User
      const userCredential = await auth.createUserWithEmailAndPassword(values.email, values.password);
      const user = userCredential.user;
      const uid = user.uid;

      // 2. Processar CPF Seguro (Hash, Masked, Encrypted) via Server Action
      const cpfRes = await updateUserCPF(uid, values.cpf);
      if (!cpfRes.success) throw new Error(cpfRes.error);

      // 3. Criar Perfil e Índice de Username em Transação
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", values.username.toLowerCase().trim());
        const userRef = doc(db, "users", uid);

        transaction.set(usernameRef, { 
          uid, 
          type: 'user', 
          email: values.email.toLowerCase().trim(),
          username: values.username.toLowerCase().trim()
        });

        transaction.update(userRef, {
          name: values.name,
          username: values.username.toLowerCase().trim(),
          phone: values.phone,
          birthDate: values.birthDate,
          gender: values.gender,
          city: values.city,
          state: values.state.toUpperCase(),
          referredBy: referredByCode || null,
          profileComplete: true,
          plan: "free",
          walletBalance: 0,
          totalXp: 0,
          level: 1,
          status: "Ativo",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      toast({ title: "Bem-vindo à Viby!", description: "Sua conta foi criada com sucesso." });
      router.replace("/dashboard");

    } catch (error) {
      let errorMessage = "Ocorreu um erro ao criar sua conta.";
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/email-already-in-use":
            errorMessage = "Este e-mail já está em uso.";
            break;
          case "auth/invalid-email":
            errorMessage = "O e-mail fornecido é inválido.";
            break;
          case "auth/weak-password":
            errorMessage = "A senha deve ter no mínimo 6 caracteres.";
            break;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({ variant: "destructive", title: "Erro no Cadastro", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          {/* Dados de Identidade */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
              <UserIcon className="w-3 h-3" /> Identidade Cultural
            </h3>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Como no seu documento" className="h-11 rounded-xl" {...field} />
                  </FormControl>
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
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Username (@)</FormLabel>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                      <FormControl>
                        <Input placeholder="seu.nick" className="h-11 rounded-xl pl-9 pr-10" {...field} />
                      </FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                        usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                        (usernameStatus === 'taken' || usernameStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                      </div>
                    </div>
                    {usernameStatus === 'taken' && <p className="text-[9px] font-bold text-destructive uppercase">Indisponível</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">WhatsApp</FormLabel>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" className="h-11 rounded-xl pl-9" {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                    <Fingerprint className="w-3 h-3 text-secondary" /> CPF (Obrigatório)
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        placeholder="000.000.000-00" 
                        className="h-11 rounded-xl pr-10 font-mono" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").substring(0, 11))}
                      />
                    </FormControl>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingCPF ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                      cpfStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                      (cpfStatus === 'taken' || cpfStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                    </div>
                  </div>
                  {cpfStatus === 'taken' && <p className="text-[9px] font-bold text-destructive uppercase">Já cadastrado</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator className="border-dashed" />

          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Perfil Pessoal
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11 rounded-xl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Sexo / Gênero</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao-binario">Não-binário</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                        <SelectItem value="prefiro-nao-dizer">Não informar</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> Cidade
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: São Paulo" className="h-11 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">UF</FormLabel>
                      <FormControl>
                        <Input placeholder="SP" maxLength={2} className="h-11 rounded-xl uppercase text-center" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <Separator className="border-dashed" />

          {/* Dados de Acesso */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Acesso Seguro
            </h3>
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="seu@email.com" className="h-11 rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="h-11 rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="pt-6">
          <Button 
            type="submit" 
            disabled={isLoading || usernameStatus !== 'valid' || cpfStatus !== 'valid'} 
            className="w-full bg-secondary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02] shadow-secondary/20"
          >
            {isLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : "Criar Minha Conta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
