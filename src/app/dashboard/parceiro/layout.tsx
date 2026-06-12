
"use client"

import * as React from "react"
import { useAuth, useUser } from "@/firebase"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const { user, profile, loading, isInitialized } = useUser(auth)
  const router = useRouter()

  React.useEffect(() => {
    if (isInitialized && !loading) {
      if (!user) {
        router.push("/login")
      }
    }
  }, [user, loading, isInitialized, router])

  if (loading || !isInitialized) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Autenticando Parceiro...</p>
      </div>
    )
  }

  if (!profile?.isPartner) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6 gap-6">
        <div className="w-20 h-20 bg-destructive/10 rounded-[2rem] flex items-center justify-center text-destructive">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Acesso Restrito</h2>
          <p className="text-muted-foreground font-medium max-w-sm mx-auto">
            Esta área é exclusiva para parceiros selecionados da Viby. Se você possui um convite, entre em contato com seu gestor.
          </p>
        </div>
        <Button asChild className="rounded-xl font-black uppercase italic px-8 h-12 shadow-lg">
          <Link href="/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
