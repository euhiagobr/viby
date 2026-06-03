
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, KeyRound, Mail, Send, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { requestPasswordRecovery } from "@/app/actions/password-recovery"

export default function RedefinirSenhaPage() {
  const [identifier, setIdentifier] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [emailSentTo, setEmailSentTo] = useState("")
  
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  useEffect(() => {
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
        toast({ title: "E-mail enviado!", description: "Confira sua caixa de entrada." })
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no servidor", description: "Falha ao processar solicitação." })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] font-body">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority unoptimized />
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
          {!success ? (
            <>
              <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner bg-secondary/10 text-secondary">
                   <KeyRound className="w-8 h-8" />
                </div>
                <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary text-center">
                  Recuperar Senha
                </CardTitle>
                <CardDescription className="text-center font-medium px-4">
                  Informe seu e-mail ou @username para receber o link de redefinição.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="px-10 pb-10">
                <form onSubmit={handleRequest} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Identificador</Label>
                    <div className="relative">
                      <Input 
                        placeholder="Ex: joao@email.com ou @joao" 
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
                    className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><Send className="w-5 h-5 mr-2" /> Enviar Link Seguro</>}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="pt-12 pb-12 px-10 text-center space-y-6">
               <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg animate-in zoom-in-50 duration-500">
                  <CheckCircle2 className="w-10 h-10" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Verifique seu E-mail</h3>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    Enviamos um link seguro para <strong>{emailSentTo}</strong>. Clique no botão contido no e-mail para escolher sua nova senha.
                  </p>
               </div>
               <div className="pt-4">
                  <Button asChild className="w-full bg-primary text-white font-black h-14 rounded-2xl uppercase italic">
                    <Link href="/login">Voltar para o Login</Link>
                  </Button>
               </div>
            </CardContent>
          )}
          
          <CardFooter className="flex justify-center border-t border-border py-8 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground">
              Lembrou a senha?{" "}
              <Link href="/login" className="text-secondary font-black hover:underline uppercase italic">
                Acessar agora
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
