
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, Mail, Send, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { requestPasswordRecovery } from "@/app/actions/password-recovery"
import Footer from "@/components/layout/Footer"

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [emailSentTo, setEmailSentTo] = React.useState("")
  
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)

  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || loading) return

    setLoading(true)
    try {
      const result = await requestPasswordRecovery(identifier)
      if (result.success) {
        setSuccess(true)
        setEmailSentTo(result.maskedEmail || "seu e-mail")
        toast({ title: "Link enviado!", description: "Verifique seu e-mail para prosseguir." })
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao processar solicitação." })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          {!success ? (
            <>
              <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary">
                   <Mail className="w-8 h-8" />
                </div>
                <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Recuperar Senha</CardTitle>
                <CardDescription className="text-center font-medium px-4">Informe seu e-mail ou @username para receber o link de acesso.</CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-6">
                <form onSubmit={handleRequest} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Identificador</Label>
                    <div className="relative">
                      <Input 
                        placeholder="e-mail ou @username" 
                        value={identifier} 
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="pl-11 h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                        required 
                        disabled={loading}
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary opacity-50" />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading || !identifier} 
                    className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02]"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    ) : (
                      <><Send className="w-5 h-5 mr-2" /> Enviar Link</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="pt-16 pb-12 px-10 text-center space-y-6">
               <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg animate-in zoom-in-50 duration-500">
                  <CheckCircle2 className="w-10 h-10" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">E-mail Enviado</h3>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    Um link seguro foi enviado para <strong>{emailSentTo}</strong>. Clique nele para redefinir sua senha na página oficial do Viby.
                  </p>
               </div>
               <Button asChild className="w-full bg-primary text-white font-black h-14 rounded-2xl uppercase italic">
                  <Link href="/login">Ir para o Login</Link>
               </Button>
            </CardContent>
          )}
          <CardFooter className="flex flex-col gap-4 border-t border-border mt-4 py-8 bg-muted/20">
            <Link href="/login" className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Login
            </Link>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
