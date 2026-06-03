
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Redireciona usuários da rota de verificação de código (OTP)
 * para a nova rota de fluxo por e-mail link.
 */
export default function VerifyCodeRedirect() {
  const router = useRouter()

  React.useEffect(() => {
    router.replace("/redefinir-senha")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
    </div>
  )
}
