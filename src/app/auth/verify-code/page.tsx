
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OTPInput } from "@/components/auth/OTPInput"
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { verifyRecoveryCode, requestPasswordRecovery } from "@/app/actions/password-recovery"
import Footer from "@/components/layout/Footer"

export default function VerifyCodePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get("email") || ""

  const [code, setCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  React.useEffect(() => {
    if (!email) router.push("/auth/forgot-password")
  }, [email, router])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 6) return

    setLoading(true)
    try {
      const result = await verifyRecoveryCode(email, code)
      if (result.success) {
        toast({ title: "Código validado!", description: "Defina sua nova senha agora." })
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`)
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
        setCode("")
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha na verificação." })
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const result = await requestPasswordRecovery(email)
      if (result.success) {
        toast({ title: "Código reenviado!" })
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao reenviar." })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-1 flex flex-col items-center pt-12 pb-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary">
               <ShieldCheck className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Verificação</CardTitle>
            <CardDescription className="text-center font-medium px-4">Insira o código de 6 caracteres enviado para <strong>{email}</strong>.</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-6">
            <form onSubmit={handleVerify} className="space-y-8">
              <OTPInput value={code} onChange={setCode} disabled={loading} />
              
              <Button type="submit" disabled={loading || code.length < 6} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl uppercase italic text-lg transition-transform hover:scale-[1.02]">
                {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Validar Código"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t border-border mt-4 py-8 bg-muted/20 text-center">
            <button 
              onClick={handleResend}
              disabled={resending}
              className="text-xs font-bold text-secondary flex items-center gap-2 uppercase tracking-widest hover:underline disabled:opacity-50"
            >
              {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Não recebi o código
            </button>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
