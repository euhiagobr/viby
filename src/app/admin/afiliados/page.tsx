"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, orderBy, limit, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Handshake, 
  Loader2, 
  Search, 
  TrendingUp, 
  Users, 
  Ticket, 
  Inbox,
  RefreshCw,
  History,
  ShieldCheck,
  AlertTriangle,
  Settings,
  Power,
  PowerOff
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
import { formatCurrency } from "@/lib/financial-utils"
import { generatePendingAffiliateCodesAction } from "@/app/actions/affiliates"
import { useAdminPermissions } from "@/hooks/use-admin-permissions"
import { Switch } from "@/components/ui/switch"

export default function AdminAfiliadosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { isSuperAdmin, adminProfile } = useAdminPermissions()
  
  const [search, setSearch] = React.useState("")
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isStatusUpdating, setIsStatusUpdating] = React.useState(false)

  const adminUid = adminProfile?.uid;

  // Configuração Global
  const affConfigRef = React.useMemo(() => db ? doc(db, "settings", "affiliates") : null, [db]);
  const { data: affConfig, loading: loadingConfig } = useDoc<any>(affConfigRef);

  // Consultas Estabilizadas
  const statsQuery = useMemoFirebase(() => {
    if (!db || !adminUid) return null
    return query(collection(db, "affiliate_stats"), orderBy("totalTicketsSold", "desc"), limit(50))
  }, [db, adminUid])

  const recentCommissionsQuery = useMemoFirebase(() => {
    if (!db || !adminUid) return null
    return query(collection(db, "affiliate_commissions"), orderBy("createdAt", "desc"), limit(20))
  }, [db, adminUid])

  const { data: stats, loading: loadingStats } = useCollection<any>(statsQuery)
  const { data: commissions, loading: loadingComms } = useCollection<any>(recentCommissionsQuery)

  const isEnabled = affConfig?.enabled !== false;

  const handleToggleProgram = async (v: boolean) => {
    if (!db || !isSuperAdmin) return;
    setIsStatusUpdating(true);
    try {
      await updateDoc(doc(db, "settings", "affiliates"), {
        enabled: v,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      });
      toast({ title: v ? "Programa Ativado!" : "Programa Suspenso!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao alterar status" });
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const filteredStats = React.useMemo(() => {
    if (!stats) return []
    return stats.filter(s => 
      s.userName?.toLowerCase().includes(search.toLowerCase()) ||
      s.userId?.toLowerCase().includes(search.toLowerCase())
    )
  }, [stats, search])

  const handleGeneratePending = async () => {
    if (!isSuperAdmin) return
    setIsProcessing(true)
    try {
      const res = await generatePendingAffiliateCodesAction()
      if (res.success) {
        toast({ title: "Processo concluído!", description: `${res.count} novos códigos gerados.` })
      } else {
        throw new Error(res.error)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na manutenção", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const globalMetrics = React.useMemo(() => {
    if (!stats) return { sales: 0, users: 0, orgs: 0 }
    return stats.reduce((acc, s) => {
      acc.sales += (s.totalTicketsSold || 0)
      acc.users += (s.totalUsersReferred || 0)
      acc.orgs += (s.totalOrgsLinked || 0)
      return acc
    }, { sales: 0, users: 0, orgs: 0 })
  }, [stats])

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Handshake className="w-8 h-8 text-secondary" />
            Divulgue e Ganhe
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de crescimento e rede de indicações Viby.</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Button onClick={handleGeneratePending} disabled={isProcessing} variant="outline" className="rounded-xl h-11 border-dashed gap-2 uppercase italic text-[10px] font-black border-secondary text-secondary">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Manutenção de Códigos
            </Button>
          )}
        </div>
      </div>

      {/* Controle Global do Programa */}
      <Card className={cn(
        "border-none shadow-sm rounded-[2rem] overflow-hidden transition-all duration-500",
        isEnabled ? "bg-white ring-1 ring-border" : "bg-orange-50 border-2 border-dashed border-orange-200"
      )}>
        <CardContent className="p-8">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                 <div className={cn(
                   "p-4 rounded-[1.5rem] shadow-lg transition-colors",
                   isEnabled ? "bg-green-500 text-white" : "bg-orange-500 text-white"
                 )}>
                    {isEnabled ? <Power className="w-8 h-8" /> : <PowerOff className="w-8 h-8" />}
                 </div>
                 <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">Status do Programa</h3>
                       <Badge className={cn("text-[9px] font-black uppercase h-5", isEnabled ? "bg-green-600" : "bg-orange-600")}>
                          {isEnabled ? "ATIVO" : "SUSPENSO"}
                       </Badge>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed max-w-md">
                       {isEnabled 
                         ? "O programa está operando normalmente. Novos usuários podem se afiliar e gerar comissões." 
                         : "Novas indicações e cadastros de afiliados estão bloqueados em toda a rede."}
                    </p>
                 </div>
              </div>

              {isSuperAdmin && (
                <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-2xl border border-dashed">
                   <div className="space-y-0.5 text-right mr-2">
                      <p className="text-[9px] font-black uppercase opacity-60">Alternar Chave Mestra</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase italic">Afeta toda a plataforma</p>
                   </div>
                   {isStatusUpdating ? <Loader2 className="w-6 h-6 animate-spin text-secondary" /> : (
                     <Switch 
                        checked={isEnabled} 
                        onCheckedChange={handleToggleProgram} 
                     />
                   )}
                </div>
              )}
           </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Ingressos por Afiliados" value={globalMetrics.sales} icon={Ticket} color="orange" />
        <MetricCard label="Usuários Indicados" value={globalMetrics.users} icon={Users} color="blue" />
        <MetricCard label="Organizações Vinculadas" value={globalMetrics.orgs} icon={TrendingUp} color="secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 border-b p-8 flex flex-row items-center justify-between">
            <div>
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Ranking de Performance</CardTitle>
               <CardDescription className="text-[10px] font-bold uppercase">Liderança por volume de vendas convertidas.</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 rounded-xl text-xs" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingStats ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
            ) : filteredStats.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-black uppercase text-[9px] p-6">Afiliado</TableHead>
                    <TableHead className="font-black uppercase text-[9px] text-center">Nível</TableHead>
                    <TableHead className="font-black uppercase text-[9px] text-center">Indicações</TableHead>
                    <TableHead className="font-black uppercase text-[9px] text-right p-6">Vendas Totais</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.map((s, idx) => (
                    <TableRow key={s.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="p-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">#{idx + 1}</div>
                           <div className="flex flex-col">
                              <span className="font-bold text-sm uppercase italic text-primary">{s.userName || "Membro"}</span>
                              <span className="text-[9px] text-muted-foreground uppercase font-black">ID: {s.userId?.slice(0, 8)}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary">Level {s.currentLevel || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{s.totalUsersReferred || 0}</TableCell>
                      <TableCell className="text-right p-6">
                         <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-primary">{s.totalTicketsSold || 0}</span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">Ingressos</span>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-24 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum afiliado registrado.</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-8">
            <CardTitle className="text-lg font-black italic uppercase tracking-tighter flex items-center gap-2">
               <History className="w-5 h-5 text-secondary" /> Últimos Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {loadingComms ? (
               <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
             ) : commissions && commissions.length > 0 ? (
               <div className="divide-y">
                  {commissions.map((c: any) => (
                    <div key={c.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                       <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black text-primary uppercase italic">Comissão {c.currency}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{new Date(c.createdAt?.seconds * 1000 || c.createdAt).toLocaleDateString('pt-BR')}</span>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-green-600">+{formatCurrency(c.amount)}</p>
                          <Badge variant="outline" className="text-[7px] h-3.5 px-1 uppercase font-black">{c.status}</Badge>
                       </div>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="py-20 text-center opacity-20 italic text-[10px] uppercase font-bold">Sem movimentações.</div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: any) {
   const colors: any = { 
     blue: "border-blue-200 text-blue-600 bg-blue-50", 
     secondary: "border-secondary/20 text-secondary bg-secondary/5", 
     orange: "border-orange-200 text-orange-600 bg-orange-50" 
   };
   return (
      <Card className={cn("border-none shadow-sm rounded-[1.5rem] bg-white border-l-4", colors[color])}>
         <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
               <Icon className="w-4 h-4 opacity-40" />
            </div>
            <div className="text-2xl font-black text-primary">{value.toLocaleString()}</div>
         </CardContent>
      </Card>
   )
}
