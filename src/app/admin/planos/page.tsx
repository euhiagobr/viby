"use client"

import * as React from "react"
import { useFirestore, useDoc } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  Zap, 
  ShieldCheck, 
  BarChart3, 
  Percent, 
  Coins, 
  Building2, 
  CalendarDays, 
  Ticket,
  Save,
  Loader2,
  Trophy,
  Star,
  Clock,
  Calendar
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const PLAN_DEFAULTS = {
  start: {
    name: "Start",
    monthlyPrice: 0,
    annualPrice: 0,
    maxOrganizations: 1,
    maxActiveEvents: 1,
    maxTicketsPerEvent: 30,
    isVerified: false,
    feePercent: 16,
    minFeeAmount: 9.99,
    hasReports: false
  },
  pro: {
    name: "Pro",
    monthlyPrice: 129.90,
    annualPrice: 1198.80,
    maxOrganizations: 5,
    maxActiveEvents: 5,
    maxTicketsPerEvent: 0, // Ilimitado
    isVerified: true,
    feePercent: 10,
    minFeeAmount: 7.49,
    hasReports: true
  },
  top: {
    name: "Top",
    monthlyPrice: 229.90,
    annualPrice: 2398.80,
    maxOrganizations: 10,
    maxActiveEvents: 100,
    maxTicketsPerEvent: 0, // Ilimitado
    isVerified: true,
    feePercent: 8,
    minFeeAmount: 3.99,
    hasReports: true
  }
}

export default function AdminPlanosPage() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, 'settings', 'plans') : null, [db])
  const { data: plansData, loading } = useDoc<any>(settingsRef)
  
  const [plans, setPlans] = React.useState<any>(PLAN_DEFAULTS)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (plansData) {
      setPlans({ ...PLAN_DEFAULTS, ...plansData })
    }
  }, [plansData])

  const handleUpdateField = (planKey: string, field: string, value: any) => {
    setPlans((prev: any) => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        [field]: value
      }
    }))
  }

  const handleSavePlans = async () => {
    if (!db) return
    setIsSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'plans'), {
        ...plans,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Configurações de planos salvas!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Trophy className="w-8 h-8 text-secondary" />
          Configuração Global de Planos
        </h1>
        <p className="text-muted-foreground font-medium">Defina os limites, taxas e valores de venda para cada nível de assinatura.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {Object.entries(plans).filter(([key]) => key !== 'updatedAt').map(([key, plan]: [string, any]) => (
          <Card key={key} className={cn(
            "border-none shadow-sm rounded-[2rem] overflow-hidden",
            key === 'start' ? "bg-white" : key === 'pro' ? "bg-primary text-white" : "bg-secondary text-white"
          )}>
            <CardHeader className="border-b border-white/10 pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Viby {plan.name}</CardTitle>
                {key === 'start' ? <Zap className="w-6 h-6 text-muted-foreground" /> : key === 'pro' ? <Star className="w-6 h-6 text-secondary fill-secondary" /> : <Trophy className="w-6 h-6 text-white" />}
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-6">
                {/* PREÇOS (Somente para PRO e TOP) */}
                {key !== 'start' && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Valores de Venda (BRL)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> Mensal
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-40">R$</span>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={plan.monthlyPrice} 
                            onChange={e => handleUpdateField(key, 'monthlyPrice', parseFloat(e.target.value))}
                            className="rounded-xl h-11 bg-black/5 border-none font-black pl-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                          <Calendar className="w-3 h-3" /> Anual
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-40">R$</span>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={plan.annualPrice} 
                            onChange={e => handleUpdateField(key, 'annualPrice', parseFloat(e.target.value))}
                            className="rounded-xl h-11 bg-black/5 border-none font-black pl-8"
                          />
                        </div>
                      </div>
                    </div>
                    <Separator className={cn(key === 'start' ? "bg-border" : "bg-white/10")} />
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Limites Operacionais</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" /> Máx. Organizações
                      </Label>
                      <Input 
                        type="number" 
                        value={plan.maxOrganizations} 
                        onChange={e => handleUpdateField(key, 'maxOrganizations', parseInt(e.target.value))}
                        className="rounded-xl h-11 bg-black/5 border-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5" /> Máx. Eventos Ativos
                      </Label>
                      <Input 
                        type="number" 
                        value={plan.maxActiveEvents} 
                        onChange={e => handleUpdateField(key, 'maxActiveEvents', parseInt(e.target.value))}
                        className="rounded-xl h-11 bg-black/5 border-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <Ticket className="w-3.5 h-3.5" /> Máx. Ingressos/Evento
                      </Label>
                      <Input 
                        type="number" 
                        value={plan.maxTicketsPerEvent} 
                        onChange={e => handleUpdateField(key, 'maxTicketsPerEvent', parseInt(e.target.value))}
                        placeholder="0 = Ilimitado"
                        className="rounded-xl h-11 bg-black/5 border-none font-bold"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Taxas e Receitas</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <Percent className="w-3.5 h-3.5" /> Taxa (%)
                      </Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={plan.feePercent} 
                        onChange={e => handleUpdateField(key, 'feePercent', parseFloat(e.target.value))}
                        className="rounded-xl h-11 bg-black/5 border-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <Coins className="w-3.5 h-3.5" /> Taxa Mín (R$)
                      </Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={plan.minFeeAmount} 
                        onChange={e => handleUpdateField(key, 'minFeeAmount', parseFloat(e.target.value))}
                        className="rounded-xl h-11 bg-black/5 border-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Recursos</h4>
                  <div className="flex items-center justify-between p-4 bg-black/5 rounded-2xl">
                    <div className="space-y-0.5">
                        <Label className="font-bold text-xs">Selo Verificado</Label>
                        <p className="text-[8px] uppercase font-black opacity-40">Ativa selo automático</p>
                    </div>
                    <Switch 
                      checked={plan.isVerified} 
                      onCheckedChange={v => handleUpdateField(key, 'isVerified', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/5 rounded-2xl">
                    <div className="space-y-0.5">
                        <Label className="font-bold text-xs">Relatórios VIP</Label>
                        <p className="text-[8px] uppercase font-black opacity-40">Acesso a métricas avançadas</p>
                    </div>
                    <Switch 
                      checked={plan.hasReports} 
                      onCheckedChange={v => handleUpdateField(key, 'hasReports', v)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center pt-8">
        <Button 
          onClick={handleSavePlans} 
          disabled={isSaving}
          className="bg-secondary text-white font-black h-16 px-16 rounded-[2rem] shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-105 transition-all"
        >
          {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
          Salvar Configurações Globais
        </Button>
      </div>
    </div>
  )
}
