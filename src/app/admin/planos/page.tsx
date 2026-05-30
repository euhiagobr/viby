"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Trophy, Percent, Coins, ShieldCheck, Zap, Info, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminPlanosPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Trophy className="w-8 h-8 text-secondary" />
          Modelo de Monetização
        </h1>
        <p className="text-muted-foreground font-medium">Regra única de taxas aplicada a todos os produtores da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
          <CardHeader className="p-8 border-b border-white/10">
            <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-3 w-fit mb-4">Taxa Unificada</Badge>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Regra de Faturamento</CardTitle>
            <CardDescription className="text-white/60 font-medium">A Viby retém automaticamente uma porcentagem ou valor fixo sobre o preço de face.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-10 relative z-10">
            <div className="space-y-6">
               <div className="flex items-center justify-between p-6 bg-white/10 rounded-3xl border border-white/10">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-secondary rounded-2xl"><Percent className="w-6 h-6" /></div>
                     <span className="text-lg font-black uppercase italic">Porcentagem Base</span>
                  </div>
                  <span className="text-4xl font-black italic">10%</span>
               </div>
               
               <div className="flex items-center justify-center font-black uppercase text-xs opacity-40">OU</div>

               <div className="flex items-center justify-between p-6 bg-white/10 rounded-3xl border border-white/10">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-secondary rounded-2xl"><Coins className="w-6 h-6" /></div>
                     <span className="text-lg font-black uppercase italic">Valor Mínimo</span>
                  </div>
                  <span className="text-4xl font-black italic">R$ 3,99</span>
               </div>
            </div>

            <div className="p-6 bg-secondary rounded-[2rem] shadow-xl">
               <p className="text-xs font-black uppercase italic text-center">O sistema aplica sempre o maior valor entre os dois critérios.</p>
            </div>
          </CardContent>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
        </Card>

        <div className="space-y-8">
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-secondary" /> Vantagens para o Produtor
              </h3>
              <div className="grid grid-cols-1 gap-4">
                 {[
                   "Sem custos fixos ou mensalidades",
                   "Criação de marcas e eventos ilimitados",
                   "Acesso total a relatórios e métricas",
                   "Gestão de equipe e co-realização inclusa",
                   "Check-in via QR Code ilimitado",
                   "Suporte prioritário via tickets"
                 ].map((feat, i) => (
                   <div key={i} className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-dashed font-bold text-xs uppercase tracking-tight">
                      <Zap className="w-4 h-4 text-green-500 fill-green-500" />
                      {feat}
                   </div>
                 ))}
              </div>
           </Card>

           <div className="p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 flex items-start gap-4">
              <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-xs italic text-primary">Nota sobre Transações</h4>
                 <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">As taxas de processamento do cartão e PIX (Stripe) são descontadas do lucro bruto da Viby, não afetando o repasse líquido calculado pela regra acima.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}