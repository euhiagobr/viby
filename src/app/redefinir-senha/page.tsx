
"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, KeyRound, Mail, ShieldCheck, CheckCircle2, Lock } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
import { requestPasswordReset, verifyAndResetPassword } from "@/app/actions/auth"

export default function RedefinirSenhaPage() {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request')
  const [identifier, setIdentifier] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [resolvedEmail, setResolvedEmail] = useState("")
  
  const router = useRouter()
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await requestPasswordReset(identifier)
    if (result.success) {
      setResolvedEmail(result.email!)
      setStep('verify')
      toast({ title: "Código enviado!", description: `Verifique o e-mail ${result.email}.` })
    } else {
      toast({ variant: "destructive", title: "Erro", description: result.error })
    }
    setLoading(false)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Validamos o código. Em produção, aqui mudaríamos a senha no Auth.
    const result = await verifyAndResetPassword({ email: resolvedEmail, code: code.trim().toUpperCase() })
    
    if (result.success) {
      setStep('success')
    } else {
      toast({ variant: "destructive", title: "Erro na validação", description: result.error })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30 font-body">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-8 w-auto object-contain" priority />
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">{siteName.charAt(0)}</span></div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold">
            <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Login</Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-10 pb-6">
            <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4 text-secondary">
               {step === 'request' ? <KeyRound className="w-6 h-6" /> : step === 'verify' ? <ShieldCheck className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6 text-green-500" />}
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">
              {step === 'request' ? 'Esqueceu a Senha?' : step === 'verify' ? 'Validar Acesso' : 'Tudo Pronto!'}
            </CardTitle>
            <CardDescription className="text-center font-medium">
              {step === 'request' ? 'Informe seu e-mail ou @username para receber o código.' : step === 'verify' ? 'Insira o código de 8 dígitos enviado ao seu e-mail.' : 'Sua senha foi redefinida com sucesso.'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            {step === 'request' && (
              <form onSubmit={handleRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">E-mail ou Usuário</Label>
                  <div className="relative">
                    <Input 
                      placeholder="seu@email.com" 
                      value={identifier} 
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                      required 
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic mt-4">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Receber Código'}
                </Button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Código de 8 Dígitos</Label>
                  <Input 
                    placeholder="XXXXXXXX" 
                    maxLength={8}
                    value={code} 
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="h-16 text-2xl font-black text-center tracking-[0.3em] rounded-xl border-dashed border-secondary/40"
                    required 
                  />
                  <p className="text-[9px] text-center text-muted-foreground uppercase font-bold">Verifique o e-mail: {resolvedEmail}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Nova Senha</Label>
                  <div className="relative">
                    <Input 
                      type="password"
                      placeholder="••••••••" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                      required 
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirmar Nova Senha'}
                </Button>
              </form>
            )}

            {step === 'success' && (
              <div className="text-center space-y-6">
                <p className="text-sm text-muted-foreground font-medium">Agora você já pode acessar sua conta normalmente com sua nova senha.</p>
                <Button asChild className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  <Link href="/login">Ir para o Login</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
