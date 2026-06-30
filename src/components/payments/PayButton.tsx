"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2, Zap } from "lucide-react"
import { executeCheckoutFlow } from "@/services/payments/pay-button-service"
import { useErrorManager } from "@/components/error-manager/ErrorManagerProvider"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn, serializeForServer } from "@/lib/utils"

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
  rates: Record<string, number>
  appliedCoupon?: any
}

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
  className,
  rates,
  appliedCoupon
}: PayButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const { reportError } = useErrorManager()
  const router = useRouter()

  const handleCheckout = async () => {
    if (items.length === 0 || loading) return;
    
    setLoading(true)
    try {
      // Sanitização rigorosa antes do envio para Server Action
      const sanitizedOptions = serializeForServer({
        user: profile,
        profile,
        items,
        totals,
        globalFees,
        promotions,
        orgsData,
        useBalance,
        rates,
        coupon: appliedCoupon
      });

      const result = await executeCheckoutFlow(sanitizedOptions);

      if (result.type === 'free') {
        onSuccess()
        toast({ title: "Reserva confirmada!", description: "Seus ingressos gratuitos já estão disponíveis." })
        router.push("/dashboard/ingressos")
      } else if (result.type === 'stripe' && result.url) {
        window.location.href = result.url
      }
    } catch (e: any) {
      console.error("[Checkout Failure]", e);
      reportError({
        error: e,
        type: 'checkout_pipeline_error',
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
