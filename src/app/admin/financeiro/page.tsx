"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, orderBy, getDocs, getDoc, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Landmark, 
  Loader2, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  DollarSign,
  History,
  ShieldCheck,
  Save,
  Wallet,
  Clock,
  ArrowRight,
  Zap,
  Ticket,
  ChevronRight,
  ArrowUpRight,
  Inbox,
  Info
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/financial-utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export default function AdminFinanceiroPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [selectedOrgForFinance, setSelectedOrgForFinance] = React.useState<any>(null)

  const orgsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "organizations"))
  }, [db])

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"]))
  }, [db])

  const { data: orgs, loading: loadingOrgs } = useCollection<any>(orgsQuery)
  const { data: regs, loading: loadingRegs } = useCollection<any>(regsQuery)

  const filteredOrgs = React.useMemo(() => {
    if (!orgs) return []
    
    const orgBalances = (regs || []).reduce((acc: any, reg: any) => {
      const orgId = reg.organizationId;
      if (!acc[orgId]) acc[orgId] = { available: 0, locked: 0 };
      
      const now = new Date();
      const saleDate = reg.timestamp?.toDate ? reg.timestamp.toDate() : new Date(reg.timestamp);
      
      // Regra de liberação: 30 dias após venda ou 24h após solicitação de antecipação
      const standardReleaseDate = new Date(saleDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const releaseDate = reg.advanceRequestedAt 
        ? new Date(new Date(reg.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
        : standardReleaseDate;

      if (now >= releaseDate) {
        acc[orgId].available += (reg.producerNetAmount || 0);
      } else {
        acc[orgId].locked += (reg.producerNetAmount || 0);
      }
      return acc;
    }, {});

    return orgs.map(o => ({
      ...o,
      availableBalance: orgBalances[o.id]?.available || 0,
      lockedBalance: orgBalances[o.id]?.locked || 0
    })).filter(o => 
      (o.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (o.legalName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (o.cnpj?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (o.username?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [orgs, regs, search])

  const [isDepositModalOpen, setIsDepositModalOpen] = React.useState(false)
  const [selectedOrg, setSelectedOrg] = React.useState<any>(null)
  const [depositAmount, setDepositAmount] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSignalDeposit = async () => {
    if (!db || !selectedOrg || !depositAmount) return
    
    const amount = parseFloat(depositAmount.replace(',', '.'))
    if (isNaN(amount) || amount < 0.01 || amount > 0.51) {
      toast({ variant: "destructive", title: "Valor inválido", description: "O valor deve ser entre R$ 0,01 e R$ 0,51." })
      return
    }

    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, "organizations", selectedOrg.id), {
        "payoutSettings.verificationAmountSent": amount,
        "payoutSettings.status": "waiting_user",
        "payoutSettings.updatedAt": new Date().toISOString(),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Depósito Sinalizado!", description: "A marca agora pode validar o recebimento inserindo este valor no painel dela." })
      setIsDepositModalOpen(false)
      setSelectedOrg(null)
      setDepositAmount("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleValidateVerification = async (org: any) => {
    if (!db) return
    
    const sent = org.payoutSettings?.verificationAmountSent
    const input = org.payoutSettings?.verificationAmountInput

    if (!input) {
      toast({ variant: "destructive", title: "Erro", description: "A marca ainda não informou o valor recebido." })
      return
    }

    if (Math.abs(sent - input) < 0.001) {
      setIsSubmitting(true)
      try {
        await updateDoc(doc(db, "organizations", org.id), {
          "payoutSettings.status": "verified",
          "payoutSettings.verifiedAt": new Date().toISOString(),
          updatedAt: serverTimestamp()
        })
        toast({ title: "Conta Verificada!", description: `A conta de ${org.name} foi validada com sucesso.` })
      } catch (e) {
        toast({ variant: "destructive", title: "Erro na validação" })
      } finally {
        setIsSubmitting(false)
      }
    } else {
      toast({ 
        variant: "destructive", 
        title: "Divergência de Valores", 
        description: `O valor informado (R$ ${input.toFixed(2)}) não coincide com o enviado (R$ ${sent.toFixed(2)}).` 
      })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Landmark className="w-8 h-8 text-secondary" />
          Valores a Pagar (Repasses)
        </h1>
        <p className="text-muted-foreground font-medium">Monitore os saldos e valide as contas bancárias PJ das organizações para repasses.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white border-l-4 border-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
              Total Disponível para Saque
              <Wallet className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">
              {formatCurrency(filteredOrgs.reduce((acc, o) => acc + o.availableBalance, 0))}
            </div>
            <p className="text-[9px] mt-1 font-bold opacity-40 uppercase">Montante total aguardando solicitação dos produtores</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Total Bloqueado (Em Custódia)
              <Clock className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">
              {formatCurrency(filteredOrgs.reduce((acc, o) => acc + o.lockedBalance, 0))}
            </div>
            <p className="text-[9px] mt-1 font-bold text-muted-foreground uppercase">Valores em período de D+30</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="bg-white border-b pb-6 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                Custódia por Organização
              </CardTitle>
              <CardDescription className="font-medium">Clique em uma organização para ver o detalhamento de vendas.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Marca ou CNPJ..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl h-11"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOrgs || loadingRegs ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : filteredOrgs.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Marca / Razão Social</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Saldo Disponível</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Bloqueado</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Banco PJ</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.map((org) => {
                  const ps = org.payoutSettings;
                  return (
                    <TableRow 
                      key={org.id} 
                      className="hover:bg-muted/10 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrgForFinance(org)}
                    >
                      <TableCell className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-sm uppercase italic text-primary">{org.name}</span>
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">{org.cnpj || "Sem CNPJ"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <span className={cn("font-black text-sm", org.availableBalance > 0 ? "text-green-600" : "text-muted-foreground/30")}>
                           {formatCurrency(org.availableBalance)}
                         </span>
                      </TableCell>
                      <TableCell className="text-right">
                         <span className="font-bold text-xs text-orange-600">
                           {org.lockedBalance > 0 ? formatCurrency(org.lockedBalance) : "---"}
                         </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {ps?.bank ? (
                          <div className="flex flex-col text-[10px] font-medium text-muted-foreground">
                            <span className="font-black text-primary uppercase text-[9px]">{ps.bank}</span>
                            <span>Ag: {ps.branch} | Cta: {ps.account}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground/30 uppercase italic">Não configurado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-2.5 h-6",
                          ps?.status === 'verified' ? "bg-green-500 text-white" :
                          ps?.status === 'waiting_user' ? "bg-blue-500 text-white" :
                          ps?.status === 'pending_admin' ? "bg-orange-500 text-white" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {ps?.status === 'none' || !ps?.status ? 'Inativo' :
                           ps?.status === 'pending_admin' ? 'Pendente' :
                           ps?.status === 'waiting_user' ? 'Aguardando' :
                           'Verificada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {ps?.status === 'pending_admin' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary hover:bg-secondary/5"
                              onClick={() => { setSelectedOrg(org); setIsDepositModalOpen(true); }}
                            >
                                <DollarSign className="w-3 h-3" /> Sinalizar Depósito
                            </Button>
                          )}
                          {ps?.status === 'waiting_user' && ps?.verificationAmountInput && (
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="h-8 bg-green-600 text-white text-[9px] font-black uppercase gap-1.5 shadow-lg"
                              onClick={() => handleValidateVerification(org)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Validar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground/40">
                             <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-20 text-center">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-10" />
              <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs">Nenhuma organização cadastrada.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DETALHAMENTO FINANCEIRO DA ORG */}
      <Dialog open={!!selectedOrgForFinance} onOpenChange={(o) => !o && setSelectedOrgForFinance(null)}>
         <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                        <Wallet className="w-6 h-6" />
                     </div>
                     <div>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Finanças: {selectedOrgForFinance?.name}</DialogTitle>
                        <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">@{selectedOrgForFinance?.username} • CNPJ: {selectedOrgForFinance?.cnpj}</DialogDescription>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[9px] font-black uppercase opacity-40">Saldo Total em Custódia</p>
                     <p className="text-2xl font-black text-primary">{formatCurrency((selectedOrgForFinance?.availableBalance || 0) + (selectedOrgForFinance?.lockedBalance || 0))}</p>
                  </div>
               </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden flex flex-col">
               {selectedOrgForFinance && <OrgFinanceDetail orgId={selectedOrgForFinance.id} />}
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Sinalizar Micro-depósito</DialogTitle>
            <DialogDescription className="font-medium">
              Informe o valor exato transferido para <strong>{selectedOrg?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Valor Enviado (R$ 0,01 a 0,51)</Label>
              <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                 <Input 
                   placeholder="0,00" 
                   value={depositAmount} 
                   onChange={(e) => setDailyBudgetInput(e.target.value)}
                   className="text-3xl font-black h-20 text-center rounded-[1.5rem] pl-8 border-secondary/20 focus-visible:ring-secondary/30"
                 />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDepositModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
            <Button 
              onClick={handleSignalDeposit} 
              disabled={isSubmitting || !depositAmount} 
              className="bg-secondary text-white rounded-xl font-black uppercase text-[10px] h-12 px-8 shadow-xl"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Confirmar Sinalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Componente interno para gerenciar a listagem detalhada de uma organização
 */
function OrgFinanceDetail({ orgId }: { orgId: string }) {
  const db = useFirestore()
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null)

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "registrations"), 
      where("organizationId", "==", orgId),
      where("paymentStatus", "in", ["Pago", "Disponível"])
    )
  }, [db, orgId])

  const { data: sales, loading } = useCollection<any>(regsQuery)

  const sortedSales = React.useMemo(() => {
    if (!sales) return []
    return [...sales].sort((a, b) => {
      const tA = a.timestamp?.seconds || 0
      const tB = b.timestamp?.seconds || 0
      return tB - tA
    })
  }, [sales])

  const handleReleaseImmediately = async (sale: any) => {
    if (!db) return
    setIsUpdating(sale.id)
    try {
      // Forçar liberação imediata definindo a data de antecipação como ontem
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);

      await updateDoc(doc(db, "registrations", sale.id), {
        advanceRequestedAt: yesterday.toISOString(),
        isManuallyReleased: true,
        manuallyReleasedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Saldo Liberado!", description: "O valor agora consta como Disponível no painel da marca." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao liberar" })
    } finally {
      setIsUpdating(null)
    }
  }

  const getSaleStatus = (sale: any) => {
    const now = new Date()
    const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp)
    const standardReleaseDate = new Date(saleDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const releaseDate = sale.advanceRequestedAt 
      ? new Date(new Date(sale.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
      : standardReleaseDate

    const isAvailable = now >= releaseDate
    return { isAvailable, releaseDate }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>

  return (
    <ScrollArea className="flex-1">
      <div className="p-8">
         {sortedSales.length === 0 ? (
           <div className="py-24 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground opacity-10 mx-auto mb-4" />
              <p className="text-muted-foreground font-bold italic">Nenhuma venda registrada para esta organização.</p>
           </div>
         ) : (
           <Table>
             <TableHeader className="bg-muted/30">
               <TableRow>
                 <TableHead className="font-black uppercase text-[9px] tracking-widest py-4">Data de Venda</TableHead>
                 <TableHead className="font-black uppercase text-[9px] tracking-widest">Tipo de Ingresso</TableHead>
                 <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Saldo Bloqueado</TableHead>
                 <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Saldo Disponível</TableHead>
                 <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Liberação</TableHead>
                 <TableHead className="text-right font-black uppercase text-[9px] tracking-widest">Ação</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {sortedSales.map((sale) => {
                 const { isAvailable, releaseDate } = getSaleStatus(sale)
                 const val = sale.producerNetAmount || 0
                 const isAnticipated = sale.advanceRequested === true;

                 return (
                   <TableRow key={sale.id} className={cn("hover:bg-muted/10 transition-colors", isAvailable && "bg-green-50/20")}>
                     <TableCell className="py-4">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold">{sale.timestamp?.toDate ? sale.timestamp.toDate().toLocaleDateString('pt-BR') : new Date(sale.timestamp).toLocaleDateString('pt-BR')}</span>
                           <span className="text-[8px] font-medium text-muted-foreground uppercase">{sale.timestamp?.toDate ? sale.timestamp.toDate().toLocaleTimeString('pt-BR') : ""}</span>
                        </div>
                     </TableCell>
                     <TableCell>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black uppercase italic text-primary truncate max-w-[150px]">{sale.eventTitle}</span>
                           <span className="text-[8px] font-bold text-secondary uppercase">{sale.ticketTypeName || "Geral"}</span>
                        </div>
                     </TableCell>
                     <TableCell className="text-right">
                        <span className={cn("text-[11px] font-bold", !isAvailable ? "text-orange-600" : "text-muted-foreground/20")}>
                          {!isAvailable ? formatCurrency(val) : "---"}
                        </span>
                     </TableCell>
                     <TableCell className="text-right">
                        <span className={cn("text-[11px] font-black", isAvailable ? "text-green-600" : "text-muted-foreground/20")}>
                          {isAvailable ? formatCurrency(val) : "---"}
                        </span>
                     </TableCell>
                     <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                           <span className={cn("text-[9px] font-black uppercase", isAvailable ? "text-green-600" : "text-muted-foreground")}>
                             {releaseDate.toLocaleDateString('pt-BR')}
                           </span>
                           {isAnticipated && !sale.isManuallyReleased && (
                             <Badge variant="outline" className="text-[6px] h-3 uppercase border-orange-200 text-orange-600 mt-1">Antecipação User</Badge>
                           )}
                           {sale.isManuallyReleased && (
                             <Badge variant="outline" className="text-[6px] h-3 uppercase border-blue-200 text-blue-600 mt-1">Manual Admin</Badge>
                           )}
                        </div>
                     </TableCell>
                     <TableCell className="text-right">
                        {!isAvailable && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[8px] font-black uppercase gap-1.5 border-secondary text-secondary hover:bg-secondary hover:text-white"
                            onClick={() => handleReleaseImmediately(sale)}
                            disabled={isUpdating === sale.id}
                          >
                             {isUpdating === sale.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5 fill-current" />}
                             Liberar Agora
                          </Button>
                        )}
                     </TableCell>
                   </TableRow>
                 )
               })}
             </TableBody>
           </Table>
         )}

         {sortedSales.length > 0 && (
           <div className="mt-8 p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-[9px] tracking-widest text-secondary">Aviso de Antecipação</h4>
                 <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                    A liberação imediata por este painel ignora a taxa de antecipação do usuário e torna o valor disponível instantaneamente na carteira da organização. Use em casos de suporte direto ou acordos específicos.
                 </p>
              </div>
           </div>
         )}
      </div>
    </ScrollArea>
  )
}
