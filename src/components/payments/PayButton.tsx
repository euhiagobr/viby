"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2, ShoppingCart, Zap, ExternalLink } from "lucide-react"
import { executeCheckoutFlow } from "@/services/payments/pay-button-service"
import { useErrorManager } from "@/components/error-manager/ErrorManagerProvider"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface PayButtonProps {
  items: any[]
  totals: any
  profile: any
  orgsData: any
  globalFees: any
  promotions: any
  useBalance: boolean
  onSuccess: () => void
  disabled?: boolean
  className?: string
}

/**
 * @fileOverview PayButton - O novo componente central de pagamentos da Viby.
 * Substitui o PayNow com uma arquitetura modular e estável.
 */
export function PayButton({ 
  items, 
  totals, 
  profile, 
  orgsData, 
  globalFees, 
  promotions, 
  useBalance, 
  onSuccess,
  disabled,
  className
}: PayButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const { reportError } = useErrorManager()
  const router = useRouter()

  const handleCheckout = async () => {
    if (items.length === 0 || loading) return
    
    setLoading(true)
    try {
      // Executa o fluxo orquestrado no service
      const result = await executeCheckoutFlow({
        user: profile, // Passamos o perfil que contém o UID e email
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
        toast({ title: "Reserva confirmada!", description: "Seus ingressos já estão na sua conta." })
        router.push("/dashboard/ingressos")
      } else if (result.type === 'stripe' && result.url) {
        // Redireciona para o Stripe Checkout (Hosted Page para máxima estabilidade)
        window.location.href = result.url
      }
    } catch (e: any) {
      reportError({
        error: e,
        type: 'checkout_flow_failure',
        severity: 'error',
        metadata: { itemsCount: items.length, total: totals.total }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleCheckout} 
      disabled={loading || disabled || items.length === 0} 
      className={cn(
        "w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg transition-all active:scale-95",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
      ) : (
        <>
          {totals.total > 0 ? <CreditCard className="w-6 h-6 mr-2" /> : <Zap className="w-6 h-6 mr-2 fill-current" />}
          {totals.total > 0 ? "Pagar Agora" : "Confirmar Reserva"}
        </>
      )}
    </Button>
  )
}
