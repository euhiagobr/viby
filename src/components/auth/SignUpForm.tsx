
"use client"

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { FirebaseError } from "firebase/app";

const formSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  email: z.string().email({ message: "E-mail inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
});

interface SignUpFormProps {
  referredByCode?: string;
}

export function SignUpForm({ referredByCode }: SignUpFormProps) {
  const auth = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        await auth.createUserWithEmailAndPassword(values.email, values.password);
        // The rest of the logic (updating profile, etc.) is handled by the useUser hook
        // and the onAuthStateChanged listener in the firebase context.
        // We just need to pass the referredByCode to the user creation process.
        await auth.currentUser?.updateProfile({ displayName: values.name });
        
        if (referredByCode) {
            // Here you would call a cloud function or a server action to process the referral
            // For now, we'll just log it to the console
            console.log(`User signed up with referral code: ${referredByCode}`);
        }

        toast({ title: "Conta criada com sucesso!" });

    } catch (error) {
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/email-already-in-use":
            errorMessage = "Este e-mail já está em uso.";
            break;
          case "auth/invalid-email":
            errorMessage = "O e-mail fornecido é inválido.";
            break;
          case "auth/weak-password":
            errorMessage = "A senha é muito fraca.";
            break;
          default:
            errorMessage = "Ocorreu um erro durante o cadastro.";
        }
      }
      toast({ variant: "destructive", title: "Erro no Cadastro", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="seu@email.com" {...field} />
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
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Sua senha secreta" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
          Criar Conta
        </Button>
      </form>
    </Form>
  );
}
