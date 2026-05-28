
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { requestPasswordRecovery } from "@/app/actions/password-recovery"
import Footer from "@/components/layout/Footer"

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const result = await requestPasswordRecovery(email)
      if (result.success) {
        toast({ title: "Código enviado!", description: "Confira seu e-mail para continuar." })
        router.push(`/auth/verify-code?email=${encodeURIComponent(email.toLowerCase())}`)
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao processar solicitação." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary">
               <Mail className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Recuperar Senha</CardTitle>
            <CardDescription className="text-center font-medium px-4">Informe seu e-mail para receber o código de verificação.</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-6">
            <form onSubmit={handleRequest} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">E-mail</Label>
                <div className="relative">
                  <Input 
                    type="email"
                    placeholder="seu@email.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-14 rounded-2xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                    required 
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary opacity-50" />
                </div>
              </div>
              <Button type="submit" disabled={loading || !email} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02]">
                {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><Send className="w-5 h-5 mr-2" /> Enviar Código</>}
              </Button>
            </form>
          </CardContent>
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
