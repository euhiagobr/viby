"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { useErrorManager } from "@/components/error-manager/ErrorManagerProvider"
import { processPayNow, CheckoutOptions } from "@/services/payments/pay-now-service"
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
 * @fileOverview PayNow Component - O botão inteligente de pagamentos da Viby.
 * Encapsula toda a complexidade do processamento de checkout.
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
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { reportError } = useErrorManager()
  const router = useRouter()

  const handlePay = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    if (!db || items.length === 0 || loading) return

    setLoading(true)
    try {
      const result = await processPayNow(db, {
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
        toast({ title: "Inscrição concluída!", description: "Seus ingressos já estão disponíveis." })
        router.push("/dashboard/ingressos")
      } else if (result.type === 'stripe' && result.url) {
        window.open(result.url, '_blank')
        toast({ title: "Aguardando pagamento", description: "Conclua a operação na nova aba." })
      }
    } catch (e: any) {
      reportError({ 
        error: e, 
        type: 'pay_now_failure', 
        severity: 'error', 
        metadata: { itemsCount: items.length, total: totals.total } 
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
