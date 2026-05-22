
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
    if (!identifier.trim()) return
    
    setLoading(true)
    try {
      const result = await requestPasswordReset(identifier)
      if (result.success) {
        setResolvedEmail(result.email!)
        setStep('verify')
        toast({ title: "Código enviado!", description: `Verifique a caixa de entrada de ${result.email}.` })
      } else {
        toast({ variant: "destructive", title: "Ops!", description: result.error || "Não conseguimos localizar sua conta." })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no servidor" })
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 8 || !newPassword) return
    
    setLoading(true)
    try {
      const result = await verifyAndResetPassword({ 
        email: resolvedEmail, 
        code: code.trim().toUpperCase(),
        password: newPassword
      })
      
      if (result.success) {
        setStep('success')
        toast({ title: "Acesso Validado!", description: "Sua solicitação foi processada." })
      } else {
        toast({ variant: "destructive", title: "Código Inválido", description: result.error || "Verifique se o código está correto ou se expirou." })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na validação" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] font-body">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-8 w-auto object-contain" priority />
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold text-xs uppercase tracking-widest">
            <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Login</Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
            <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 text-secondary shadow-inner">
               {step === 'request' ? <KeyRound className="w-8 h-8" /> : step === 'verify' ? <ShieldCheck className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8 text-green-500" />}
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">
              {step === 'request' ? 'Esqueceu a Senha?' : step === 'verify' ? 'Código de Acesso' : 'Senha Alterada!'}
            </CardTitle>
            <CardDescription className="text-center font-medium px-4">
              {step === 'request' ? 'Informe seu e-mail ou @username para receber um código de segurança.' : step === 'verify' ? `Enviamos um código de 8 dígitos para ${resolvedEmail}.` : 'Tudo certo! Você já pode acessar sua conta com a nova senha.'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-10 pb-10">
            {step === 'request' && (
              <form onSubmit={handleRequest} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">E-mail ou Nome de Usuário</Label>
                  <div className="relative">
                    <Input 
                      placeholder="Ex: joao@email.com ou @joao" 
                      value={identifier} 
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-11 h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                      required 
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary opacity-50" />
                  </div>
                </div>
                <Button type="submit" disabled={loading || !identifier} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-[1.02] transition-transform">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : 'Receber Código'}
                </Button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-center block">Código de 8 Dígitos</Label>
                    <Input 
                      placeholder="XXXXXXXX" 
                      maxLength={8}
                      value={code} 
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      className="h-20 text-3xl font-black text-center tracking-[0.4em] rounded-[1.5rem] border-2 border-dashed border-secondary/40 focus-visible:ring-secondary/30 text-secondary bg-secondary/5 uppercase"
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Nova Senha</Label>
                    <div className="relative">
                      <Input 
                        type="password"
                        placeholder="••••••••" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-11 h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                        required 
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary opacity-50" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button type="submit" disabled={loading || code.length < 8 || !newPassword} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl shadow-secondary/20 uppercase italic text-lg">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : 'Redefinir Senha'}
                  </Button>
                  <button type="button" onClick={() => setStep('request')} className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Não recebeu? Tentar novamente</button>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="p-6 bg-green-50 rounded-3xl border-2 border-dashed border-green-100">
                   <p className="text-sm text-green-800 font-medium leading-relaxed uppercase italic tracking-tighter text-center">
                     Sua identidade foi validada. Para o protótipo, utilize suas credenciais originais ou aguarde a integração com o Firebase Admin.
                   </p>
                </div>
                <Button asChild className="w-full bg-primary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg">
                  <Link href="/login">Fazer Login Agora</Link>
                </Button>
              </div>
            )}
          </CardContent>
          {step !== 'success' && (
            <CardFooter className="flex justify-center border-t border-border mt-4 py-8 bg-muted/20">
              <p className="text-xs font-bold text-muted-foreground">
                Lembrou a senha?{" "}
                <Link href="/login" className="text-secondary font-black hover:underline uppercase italic">
                  Voltar ao Login
                </Link>
              </p>
            </CardFooter>
          )}
        </Card>
      </div>
      <Footer />
    </div>
  )
}
