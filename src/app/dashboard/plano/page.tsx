"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  CheckCircle2, 
  Zap, 
  Loader2, 
  Sparkles, 
  Info, 
  Building2, 
  ArrowRight,
  Percent,
  Coins,
  Ticket,
  Palette
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import Link from "next/link"
import { formatCurrency, VIBY_BUYER_MARKUP, VIBY_ORGANIZER_FEE, VIBY_MIN_FEE_BRL, VIBY_EXPERIENCE_BUYER_MARKUP, VIBY_EXPERIENCE_ORGANIZER_FEE, VIBY_EXPERIENCE_MIN_FEE_BRL } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"

export default function PlanoPage() {
  const db = useFirestore()
  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees, loading: feesLoading } = useDoc<any>(feesRef)

  if (feesLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  const eventMarkup = globalFees?.buyerMarkupPercent || (VIBY_BUYER_MARKUP * 100);
  const eventCommission = globalFees?.organizerBasePercent || (VIBY_ORGANIZER_FEE * 100);
  const eventMin = globalFees?.organizerMinFee || VIBY_MIN_FEE_BRL;

  const expMarkup = globalFees?.experienceBuyerMarkupPercent || (VIBY_EXPERIENCE_BUYER_MARKUP * 100);
  const expCommission = globalFees?.experienceOrganizerBasePercent || (VIBY_EXPERIENCE_ORGANIZER_FEE * 100);
  const expMin = globalFees?.experienceOrganizerMinFee || VIBY_EXPERIENCE_MIN_FEE_BRL;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Transparência Viby</h1>
        <p className="text-muted-foreground font-medium">Entenda como funcionam as taxas e os repasses da sua marca por tipo de produto.</p>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
        <CardContent className="p-10 md:p-16 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-6">
            <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-3">Modelo Zero Custo Fixo</Badge>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-tight">Você só paga quando vende.</h2>
            <p className="text-lg opacity-80 leading-relaxed font-medium">
              Eliminamos todos os planos e mensalidades. Tenha acesso total a todas as ferramentas da plataforma pagando apenas uma taxa sobre o que for comercializado.
            </p>
          </div>
          <div className="shrink-0">
             <div className="w-40 h-40 bg-secondary rounded-full flex items-center justify-center shadow-2xl shadow-secondary/20">
                <Sparkles className="w-20 h-20 text-white animate-pulse" />
             </div>
          </div>
        </CardContent>
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* BOX EVENTOS */}
         <section className="space-y-6">
            <div className="flex items-center gap-2 px-2">
               <Ticket className="w-5 h-5 text-secondary" />
               <h3 className="text-lg font-black uppercase italic tracking-tighter">Eventos</h3>
            </div>
            <Card className="border-none shadow-sm rounded-[2rem] bg-white group hover:shadow-md transition-all">
               <CardContent className="p-8 space-y-6">
                  <div className="space-y-4">
                     <FeeItem label="Taxa do Comprador" value={`${eventMarkup}%`} sub="Markup aplicado no checkout" />
                     <FeeItem label="Comissão Viby" value={`${eventCommission}%`} sub="Retido do valor de face" />
                     <FeeItem label="Valor Mínimo" value={formatCurrency(eventMin)} sub="Piso de repasse por ingresso" />
                  </div>
                  <div className="p-4 bg-muted/30 rounded-2xl border border-dashed text-[9px] font-medium uppercase leading-relaxed">
                    Ideal para shows, festas e festivais com grandes volumes e bilheteria em lotes.
                  </div>
               </CardContent>
            </Card>
         </section>

         {/* BOX EXPERIÊNCIAS */}
         <section className="space-y-6">
            <div className="flex items-center gap-2 px-2">
               <Palette className="w-5 h-5 text-secondary" />
               <h3 className="text-lg font-black uppercase italic tracking-tighter">Experiências</h3>
            </div>
            <Card className="border-none shadow-sm rounded-[2rem] bg-white group hover:shadow-md transition-all">
               <CardContent className="p-8 space-y-6">
                  <div className="space-y-4">
                     <FeeItem label="Taxa do Comprador" value={`${expMarkup}%`} sub="Taxa reduzida para o cliente" />
                     <FeeItem label="Comissão Viby" value={`${expCommission}%`} sub="Foco em valor agregado" />
                     <FeeItem label="Valor Mínimo" value={formatCurrency(expMin)} sub="Piso de repasse por horário" />
                  </div>
                  <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/20 text-[9px] font-medium uppercase leading-relaxed text-secondary">
                    Perfeito para workshops, vivências exclusivas e roteiros com agendamento.
                  </div>
               </CardContent>
            </Card>
         </section>
      </div>

      <div className="max-w-2xl mx-auto">
         <Card className="border-none shadow-sm rounded-3xl bg-muted/20 p-8 space-y-4">
            <div className="flex items-center gap-3">
               <Info className="w-5 h-5 text-primary" />
               <h4 className="font-black uppercase text-xs italic">Sobre os Repasses</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium">
               A Viby garante que você nunca tenha repasse negativo. Em casos de ingressos de baixo valor onde a comissão seria maior que o preço de face, a plataforma transfere automaticamente a responsabilidade da taxa para o comprador (Low Price Protection).
            </p>
         </Card>
      </div>

      <div className="flex justify-center pt-4">
         <Button asChild className="bg-secondary text-white font-black h-16 rounded-[1.5rem] px-12 shadow-xl shadow-secondary/20 uppercase italic text-lg transition-all hover:scale-105 gap-2">
            <Link href="/dashboard/projetos/novo">Criar Próximo Projeto <ArrowRight className="w-6 h-6" /></Link>
         </Button>
      </div>
    </div>
  )
}

function FeeItem({ label, value, sub }: { label: string, value: string, sub: string }) {
   return (
      <div className="flex justify-between items-center py-2 border-b border-dashed last:border-none">
         <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase text-primary">{label}</p>
            <p className="text-[8px] font-bold text-muted-foreground uppercase">{sub}</p>
         </div>
         <span className="text-xl font-black text-primary italic">{value}</span>
      </div>
   )
}
