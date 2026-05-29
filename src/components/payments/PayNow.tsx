"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"
import { useAuth, useUser } from "@/firebase"
import { useErrorManager } from "@/components/error-manager/ErrorManagerProvider"
import { processPayNow } from "@/services/payments/pay-now-service"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface PayNowProps {
  items: any[]
  totals: any
  profile: any
  orgsData: any
  globalFees: any
  promotions: any
  useBalance: boolean
  onSuccess: () => void
  className?: string
  disabled?: boolean
}

/**
 * @fileOverview PayNow Component - O botão de pagamento agora utiliza a instância estática estável do banco.
 */
export function PayNow({ 
  items, 
  totals, 
  profile, 
  orgsData, 
  globalFees, 
  promotions, 
  useBalance, 
  onSuccess,
  className,
  disabled
}: PayNowProps) {
  const [loading, setLoading] = React.useState(false)
  const auth = useAuth()
  const { user } = useUser(auth)
  const { reportError } = useErrorManager()
  const router = useRouter()

  const handlePay = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    if (items.length === 0 || loading) return

    setLoading(true)
    try {
      // Bypassing hookDb - o service utilizará o staticDb estático automaticamente
      const result = await processPayNow(null, {
        user,
        profile,
        items,
        totals,
        globalFees,
        promotions,
        orgsData,
        useBalance
      })

      if (result.type === 'internal') {
        onSuccess()
        toast({ title: "Confirmado!", description: "Sua reserva foi concluída com sucesso." })
        router.push("/dashboard/ingressos")
      } else if (result.type === 'stripe' && result.url) {
        window.open(result.url, '_blank')
        toast({ title: "Pagamento Iniciado", description: "Conclua a transação na página do Stripe." })
      }
    } catch (e: any) {
      console.error("[PayNow Error]", e);
      reportError({ 
        error: e, 
        type: 'checkout_process_failure', 
        severity: 'error', 
        metadata: { items: items.length, amount: totals.total } 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      onClick={handlePay} 
      disabled={loading || disabled || items.length === 0} 
      className={cn(
        "w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg transition-all hover:scale-[1.02]",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
      ) : (
        <><CreditCard className="w-6 h-6 mr-2" /> Pagar Agora</>
      )}
    </Button>
  )
}
