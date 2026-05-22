"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, orderBy, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Landmark, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Building2,
  DollarSign,
  User,
  ExternalLink,
  RefreshCw,
  Fingerprint,
  ShieldCheck,
  Save,
  Wallet,
  Clock
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

export default function AdminFinanceiroPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

  const orgsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "organizations"))
  }, [db])

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    // Import de 'where' corrigido no topo do arquivo
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
      const releaseDate = reg.advanceRequestedAt 
        ? new Date(new Date(reg.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
        : new Date(saleDate.getTime() + 30 * 24 * 60 * 60 * 1000);

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
              <CardDescription className="font-medium">Visualize quem tem valores a receber da plataforma.</CardDescription>
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
                    <TableRow key={org.id} className="hover:bg-muted/10 transition-colors">
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
                        <div className="flex items-center justify-end gap-2">
                          {ps?.status === 'pending_admin' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary hover:bg-secondary/5"
                              onClick={() => { setSelectedOrg(org); setIsDepositModalOpen(true); }}
                            >
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Sinalizar Depósito
                              </div>
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
                              Validar Manualmente
                            </Button>
                          )}
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
                   onChange={(e) => setDepositAmount(e.target.value)}
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
