"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { XCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"

export default function CheckoutCanceladoPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
          <div className="bg-orange-500 p-12 flex flex-col items-center text-white gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Ops!</h1>
            <p className="text-orange-50 font-medium text-center opacity-80">O pagamento não foi concluído ou foi cancelado por você.</p>
          </div>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nenhuma cobrança foi realizada no seu cartão. Você pode tentar garantir seu ingresso novamente a qualquer momento.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className="h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 w-5 h-5" />
                  Voltar aos Eventos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
