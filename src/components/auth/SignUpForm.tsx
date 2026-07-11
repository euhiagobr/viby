"use client"

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, AtSign, Fingerprint, Lock as LockIcon, User, Mail, Globe } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { validateCPF, validateUsername, isReservedUsername } from "@/lib/utils";
import { hashCPF, hashDocument } from "@/lib/identity-utils";
import { hashCPF as hashCPFLegacy } from "@/lib/crypto-utils";
import { createUserWithValidation } from "@/app/actions/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { InternationalDocumentField } from "./InternationalDocumentField";
import { isSupportedCountry, isSupportedDocumentType, isValidDocumentFormat } from "@/lib/identity-utils";
import { getDocumentTypesForCountry, getSupportedCountries } from "@/lib/identity-validation";

// Zod schema com campos opcionais para identidade internacional
const formSchema = z.object({
  name: z.string().min(2, { message: "Informe seu nome completo." }),
  username: z.string()
    .min(5, "O nome de usuário deve ter no mínimo 5 caracteres.")
    .regex(/^[a-z0-9._]+$/, "Somente minúsculas, números, ponto e underline")
    .refine((username) => !isReservedUsername(username), "Este @username é reservado pelo sistema"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos").optional().or(z.literal("")),
  email: z.string().email({ message: "E-mail inválido." }),
  gender: z.string().min(1, "Selecione seu gênero"),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  // Phase 3: Novos campos para cadastro internacional
  country: z.string().optional(),
  documentType: z.string().optional(),
  documentValue: z.string().optional(),
}).superRefine((data, ctx) => {
  // Se feature flag está ativa e país é Brasil, exigir CPF
  if (isFeatureEnabled('enableInternationalSignup') && data.country === 'BR') {
    if (!data.cpf || data.cpf.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cpf'],
        message: 'CPF deve ter 11 dígitos',
      });
    }
  }
  // Se feature flag está ativa e país não é Brasil, exigir documento
  else if (isFeatureEnabled('enableInternationalSignup') && data.country && data.country !== 'BR') {
    if (!data.documentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentType'],
        message: 'Selecione o tipo de documento',
      });
    }
    if (!data.documentValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentValue'],
        message: 'Informe o número do documento',
      });
    }
  }
  // Se feature flag está desativa, exigir CPF (compatibilidade)
  else if (!isFeatureEnabled('enableInternationalSignup')) {
    if (!data.cpf || data.cpf.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cpf'],
        message: 'CPF deve ter 11 dígitos',
      });
    }
  }
});

interface SignUpFormProps {
  referredBy?: string; 
}

export function SignUpForm({ referredBy }: SignUpFormProps) {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const internationalSignupEnabled = isFeatureEnabled('enableInternationalSignup');
  
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'valid' | 'taken' | 'invalid'>('idle');
  const [checkingDocument, setCheckingDocument] = React.useState(false);
  const [documentStatus, setDocumentStatus] = React.useState<'idle' | 'valid' | 'taken' | 'invalid'>('idle');



  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      username: "",
      cpf: "",
      email: "",
      gender: "",
      password: "",
      country: internationalSignupEnabled ? "BR" : undefined,
      documentType: "",
      documentValue: "",
    },
  });

  const watchUsername = form.watch("username");
  const watchCountry = form.watch("country");
  const watchDocumentType = form.watch("documentType");
  const watchDocumentValue = form.watch("documentValue");
  const watchCPF = form.watch("cpf");

  // Validação de Username
  React.useEffect(() => {
    const cleanUsername = watchUsername?.toLowerCase().trim();
    
    if (!db || !cleanUsername || cleanUsername.length < 5) {
      setUsernameStatus('idle');
      return;
    }
    
    if (!validateUsername(cleanUsername)) {
      setUsernameStatus('invalid');
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", cleanUsername);
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

  // Validação de Documento (CPF ou Internacional)
  React.useEffect(() => {
    if (!db) return;

    const documentToCheck = internationalSignupEnabled && watchCountry && watchCountry !== 'BR'
      ? watchDocumentValue
      : watchCPF;

    if (!documentToCheck) {
      setDocumentStatus('idle');
      return;
    }

    // Validação básica de formato
    if (internationalSignupEnabled && watchCountry && watchCountry !== 'BR') {
      if (!watchDocumentType || !isValidDocumentFormat(documentToCheck, watchCountry, watchDocumentType)) {
        setDocumentStatus('invalid');
        return;
      }
    } else {
      // CPF
      const cleanCPF = documentToCheck.replace(/\D/g, "");
      if (!validateCPF(cleanCPF)) {
        setDocumentStatus('invalid');
        return;
      }
    }

    setCheckingDocument(true);
    const timer = setTimeout(async () => {
      try {
        if (internationalSignupEnabled && watchCountry && watchCountry !== 'BR') {
          // CPF INTERNACIONAL
          const hash = hashDocument(documentToCheck, watchCountry, watchDocumentType);
          const q = query(
            collection(db, "user_identities"),
            where("documentHash", "==", hash),
            limit(1)
          );
          const snap = await getDocs(q);
          setDocumentStatus(snap.empty ? 'valid' : 'taken');
        } else {
          // CPF BRASIL - BUSCAR EM AMBAS AS COLEÇÕES + HASHES (compatibilidade legada)
          const cleanCPF = documentToCheck.replace(/\D/g, "");
          const hashNew = hashCPF(cleanCPF);
          const hashLegacy = hashCPFLegacy(cleanCPF);
          
          // Buscar em /users com hash NOVO
          const usersQueryNew = query(
            collection(db, "users"),
            where("cpfHash", "==", hashNew),
            limit(1)
          );
          const usersSnapNew = await getDocs(usersQueryNew);
          
          // Buscar em /users com hash LEGADO (compatibilidade)
          const usersQueryLegacy = query(
            collection(db, "users"),
            where("cpfHash", "==", hashLegacy),
            limit(1)
          );
          const usersSnapLegacy = await getDocs(usersQueryLegacy);
          
          if (!usersSnapNew.empty || !usersSnapLegacy.empty) {
            setDocumentStatus('taken');
            return;
          }

          // Buscar em /user_identities (BR:CPF modern)
          const docHash = hashDocument(cleanCPF, 'BR', 'CPF');
          const identitiesQuery = query(
            collection(db, "user_identities"),
            where("documentHash", "==", docHash),
            limit(1)
          );
          const identitiesSnap = await getDocs(identitiesQuery);
          
          // Verifica se a identidade está ativa (isActive: true)
          if (!identitiesSnap.empty && identitiesSnap.docs[0].data().isActive !== false) {
            setDocumentStatus('taken');
          } else {
            setDocumentStatus('valid');
          }
        }
      } catch (e) {
        console.error('[SignUpForm] Erro ao verificar documento:', e);
        // Se houver erro, não deixa passar! Fica como 'invalid' pra bloquear o botão
        setDocumentStatus('invalid');
      } finally {
        setCheckingDocument(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [watchCPF, watchCountry, watchDocumentType, watchDocumentValue, db, internationalSignupEnabled]);

  React.useEffect(() => {
    const cleanUsername = watchUsername?.toLowerCase().trim();
    
    if (!db || !cleanUsername || cleanUsername.length < 5) {
      setUsernameStatus('idle');
      return;
    }
    
    if (!validateUsername(cleanUsername)) {
      setUsernameStatus('invalid');
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", cleanUsername);
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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Validar status
    if (usernameStatus !== 'valid' || documentStatus !== 'valid') {
      toast({ variant: "destructive", title: "Verifique os dados", description: "Dados do cadastro inválidos ou em uso." });
      return;
    }

    setIsLoading(true);
    try {
      // Preparar payload para createUserWithValidation
      const createPayload: any = {
        email: values.email,
        password: values.password,
        name: values.name,
        username: values.username,
        gender: values.gender,
        referredBy: referredBy || undefined,
      };

      // Adicionar documento conforme tipo
      if (internationalSignupEnabled && values.country && values.country !== 'BR') {
        // Phase 3: Cadastro internacional
        createPayload.country = values.country;
        createPayload.documentType = values.documentType;
        createPayload.documentValue = values.documentValue;
      } else {
        // Phase 1/2: Cadastro CPF (Brasil)
        createPayload.cpf = values.cpf;
      }

      // Chamar ação no servidor que faz TUDO:
      // 1. Validação de CPF duplicado
      // 2. Criar usuário no Firebase Auth
      // 3. Salvar no Firestore
      const createRes = await createUserWithValidation(createPayload);

      if (!createRes.success) {
        throw new Error(createRes.error);
      }

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
                  <Input placeholder="Como no seu documento" className="h-14 rounded-2xl pl-12 border-dashed border-primary/20" {...field} />
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
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-40" />
                  <FormControl>
                    <Input placeholder="seu.nick (min 5)" className="h-14 rounded-2xl pl-12 pr-10 border-dashed border-primary/20" {...field} />
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

          {/* Phase 3: País (se flag ativa) */}
          {internationalSignupEnabled && (
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">País</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-14 rounded-2xl border-dashed border-primary/20">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <SelectValue placeholder="Selecione seu país" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getSupportedCountries().map((country) => {
                        const countryNames: Record<string, string> = {
                          BR: '🇧🇷 Brasil',
                          AR: '🇦🇷 Argentina',
                          US: '🇺🇸 Estados Unidos',
                          ES: '🇪🇸 Espanha',
                          PT: '🇵🇹 Portugal',
                        };
                        return (
                          <SelectItem key={country} value={country}>
                            {countryNames[country] || country}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Phase 3: Renderização condicional - CPF ou Documento Internacional */}
        {internationalSignupEnabled && watchCountry && watchCountry !== 'BR' ? (
          <InternationalDocumentField
            country={watchCountry}
            form={form}
            isChecking={checkingDocument}
            validationStatus={documentStatus}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {checkingDocument ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : 
                      documentStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                      (documentStatus === 'taken' || documentStatus === 'invalid') ? <X className="w-4 h-4 text-destructive" /> : null}
                    </div>
                  </div>
                  <FormMessage />
                  {documentStatus === 'valid' && (
                    <p className="text-xs text-muted-foreground px-1">
                      ℹ️ Seu CPF será usado para identificar seus ingressos
                    </p>
                  )}
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Mensagem informativa para cadastro internacional */}
        {internationalSignupEnabled && watchCountry && watchCountry !== 'BR' && documentStatus === 'valid' && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-900">
              ℹ️ Usaremos seu documento nacional para garantir a segurança da sua conta e ingressos.
            </p>
          </div>
        )}

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
                <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
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
          disabled={isLoading || usernameStatus !== 'valid' || documentStatus !== 'valid'} 
          className="w-full bg-secondary text-white font-black h-20 rounded-[2rem] shadow-xl uppercase italic text-xl transition-all hover:scale-[1.02] shadow-secondary/30 mt-4 active:scale-95"
        >
          {isLoading ? <Loader2 className="mr-2 h-8 w-8 animate-spin" /> : "Concluir Cadastro"}
        </Button>
      </form>
    </Form>
  );
}
