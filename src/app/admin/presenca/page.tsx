
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, doc, setDoc, deleteDoc, serverTimestamp, getDocs, where, addDoc, getDoc, writeBatch } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, 
  Loader2, 
  Search, 
  Calendar, 
  Clock, 
  Ticket, 
  Building2,
  Users,
  CheckCircle2,
  ArrowUpRight,
  FilterX,
  CircleDot,
  Trophy,
  Award,
  Zap,
  Star,
  Settings2,
  TrendingUp,
  Inbox,
  LayoutGrid,
  Plus,
  Trash2,
  Save,
  BarChart3,
  RefreshCcw,
  History,
  DatabaseZap,
  Edit,
  Palette,
  Target,
  Info,
  ChevronRight,
  Eraser,
  AlertTriangle
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { DEFAULT_LEVELS, DEFAULT_RULES, type LevelConfig, type XPRule } from "@/lib/gamification"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { processGamificationEvent } from "@/lib/gamification-service"

export default function AdminPresencaPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [isSyncingHistory, setIsSyncingHistory] = React.useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false)

  // Consultas de Gamificação
  const levelsQuery = useMemoFirebase(() => db ? query(collection(db, "levels"), orderBy("level", "asc")) : null, [db])
  const badgesQuery = useMemoFirebase(() => db ? collection(db, "badges") : null, [db])
  const rulesQuery = useMemoFirebase(() => db ? collection(db, "xp_rules") : null, [db])
  const presenceQuery = useMemoFirebase(() => db ? query(collection(db, "registrations"), orderBy("timestamp", "desc"), limit(100)) : null, [db])
  const rankingsQuery = useMemoFirebase(() => db ? query(collection(db, "user_gamification"), orderBy("totalXp", "desc"), limit(20)) : null, [db])

  const { data: levels, loading: loadingLevels } = useCollection<any>(levelsQuery)
  const { data: badges, loading: loadingBadges } = useCollection<any>(badgesQuery)
  const { data: rules, loading: loadingRules } = useCollection<any>(rulesQuery)
  const { data: registrations, loading: loadingPresence } = useCollection<any>(presenceQuery)
  const { data: rankings, loading: loadingRankings } = useCollection<any>(rankingsQuery)

  // Estado para Edição de Nível
  const [editingLevel, setEditingLevel] = React.useState<any>(null)
  const [isLevelDialogOpen, setIsLevelDialogOpen] = React.useState(false)
  const [isLevelSaving, setIsLevelSaving] = React.useState(false)

  // Estado para Edição de Regra
  const [editingRule, setEditingRule] = React.useState<any>(null)
  const [isRuleDialogOpen, setIsRuleDialogOpen] = React.useState(false)
  const [isRuleSaving, setIsRuleSaving] = React.useState(false)

  // Estado para Edição de Medalha
  const [editingBadge, setEditingBadge] = React.useState<any>(null)
  const [isBadgeDialogOpen, setIsBadgeDialogOpen] = React.useState(false)
  const [isBadgeSaving, setIsBadgeSaving] = React.useState(false)

  const filteredRegs = React.useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      (reg.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.eventTitle?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [registrations, search])

  const stats = React.useMemo(() => {
    if (!registrations) return { total: 0, checkedIn: 0, today: 0 }
    const now = new Date()
    const todayStr = now.toDateString()
    return registrations.reduce((acc, reg) => {
      const regDate = reg.timestamp?.toDate ? reg.timestamp.toDate() : new Date(reg.timestamp)
      if (regDate.toDateString() === todayStr) acc.today++
      if (reg.checkedIn) acc.checkedIn++
      acc.total++
      return acc
    }, { total: 0, checkedIn: 0, today: 0 })
  }, [registrations])

  // Handlers de Nível
  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingLevel || isLevelSaving) return
    setIsLevelSaving(true)
    try {
      const levelId = editingLevel.id || `l${editingLevel.level}`
      await setDoc(doc(db, "levels", levelId), {
        ...editingLevel,
        id: levelId,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Nível salvo!" })
      setIsLevelDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar nível" })
    } finally {
      setIsLevelSaving(false)
    }
  }

  const handleDeleteLevel = async (id: string) => {
    if (!db || !confirm("Remover este nível?")) return
    try {
      await deleteDoc(doc(db, "levels", id))
      toast({ title: "Nível removido" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  // Handlers de Regras
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingRule || isRuleSaving) return
    setIsRuleSaving(true)
    try {
      const ruleId = editingRule.id || editingRule.event
      await setDoc(doc(db, "xp_rules", ruleId), {
        ...editingRule,
        id: ruleId,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Regra atualizada!" })
      setIsRuleDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar regra" })
    } finally {
      setIsRuleSaving(false)
    }
  }

  // Handlers de Medalhas
  const handleSaveBadge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingBadge || isBadgeSaving) return
    setIsBadgeSaving(true)
    try {
      if (editingBadge.id) {
        await setDoc(doc(db, "badges", editingBadge.id), { ...editingBadge, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, "badges"), { ...editingBadge, createdAt: serverTimestamp() })
      }
      toast({ title: "Medalha salva!" })
      setIsBadgeDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar medalha" })
    } finally {
      setIsBadgeSaving(false)
    }
  }

  const handleSeedGamification = async () => {
    if (!db) return;
    try {
      for (const level of DEFAULT_LEVELS) {
        await setDoc(doc(db, "levels", level.id), level);
      }
      for (const rule of DEFAULT_RULES) {
        await setDoc(doc(db, "xp_rules", rule.id), rule);
      }
      toast({ title: "Sistema inicializado!", description: "Níveis e regras padrão foram carregados." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na inicialização" });
    }
  }

  const handleSyncHistory = async () => {
    if (!db) return
    setIsSyncingHistory(true)
    try {
      // 1. Sincronizar criação de conta para todos os usuários
      const usersSnap = await getDocs(collection(db, "users"))
      for (const uDoc of usersSnap.docs) {
        await processGamificationEvent(db, uDoc.id, 'on_signup', {}, uDoc.id)
      }

      // 2. Sincronizar check-ins passados
      const regsSnap = await getDocs(query(collection(db, "registrations"), where("checkedIn", "==", true)))
      for (const rDoc of regsSnap.docs) {
        const reg = rDoc.data()
        await processGamificationEvent(db, reg.userId, 'on_checkin', {
          eventId: reg.eventId,
          eventTitle: reg.eventTitle,
          categoryName: reg.categoryName,
          neighborhood: reg.eventNeighborhood,
          city: reg.eventCity,
          orgName: reg.organizer?.name
        }, rDoc.id)
      }

      // 3. Sincronizar compras passadas
      const paidSnap = await getDocs(query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"])))
      for (const pDoc of paidSnap.docs) {
        const reg = pDoc.data()
        await processGamificationEvent(db, reg.userId, 'on_ticket_purchase', {
          eventId: reg.eventId,
          eventTitle: reg.eventTitle,
          categoryName: reg.categoryName,
          city: reg.eventCity,
          orgName: reg.organizer?.name
        }, pDoc.id)
      }

      toast({ title: "Sincronização completa!", description: "XP e estatísticas atualizados sem duplicidade." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na sincronização" })
    } finally {
      setIsSyncingHistory(false)
    }
  }

  const handleResetAndRecalculate = async () => {
    if (!db) return
    
    setIsSyncingHistory(true)
    try {
      const collectionsToWipe = ["user_gamification", "cultural_stats", "xp_logs", "user_badges"];
      
      for (const collName of collectionsToWipe) {
        const snap = await getDocs(collection(db, collName));
        if (snap.empty) continue;

        // Firestore batch is limited to 500 operations
        let batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snap.docs) {
          batch.delete(docSnap.ref);
          count++;
          if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }

      toast({ title: "Dados limpos!", description: "Iniciando recalculo do histórico..." });
      
      // Chama a sincronização logo após a limpeza
      await handleSyncHistory();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao resetar dados" });
    } finally {
      setIsSyncingHistory(false)
      setIsResetDialogOpen(false)
    }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR');
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Trophy className="w-8 h-8 text-secondary" />
            Gamificação & Presença
          </h1>
          <p className="text-muted-foreground font-medium">Gestão da identidade cultural e engajamento dos usuários.</p>
        </div>
        <div className="flex gap-2">
           <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isSyncingHistory} className="rounded-xl h-11 font-bold text-xs uppercase gap-2 border-destructive text-destructive hover:bg-destructive/5">
                    {isSyncingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                    Reset Total & Limpeza
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem]">
                <AlertDialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-destructive/10 rounded-2xl text-destructive">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Ação Crítica!</AlertDialogTitle>
                  </div>
                  <AlertDialogDescription className="font-medium text-foreground/80 leading-relaxed">
                    Isso apagará **TODO o progresso de XP, Estatísticas e Medalhas** de todos os usuários cadastrados. O sistema irá reconstruir tudo do zero baseado no histórico de compras e check-ins reais. Esta ação é irreversível.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetAndRecalculate}
                    className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] hover:bg-destructive/90 px-8"
                  >
                    Sim, Limpar e Recalcular
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
           </AlertDialog>

           <Button variant="outline" onClick={handleSyncHistory} disabled={isSyncingHistory} className="rounded-xl h-11 font-bold text-xs uppercase gap-2 border-secondary text-secondary hover:bg-secondary/5">
              {isSyncingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
              Sincronizar Histórico
           </Button>
           <Button variant="outline" onClick={handleSeedGamification} className="rounded-xl h-11 font-bold text-xs uppercase gap-2 border-muted text-muted-foreground hover:bg-muted/5">
              <RefreshCcw className="w-4 h-4" /> Resetar Padrões
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Check-ins Totais</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{stats.checkedIn}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Níveis Configurados</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{levels?.length || 0}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Regras de XP</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-orange-600">{rules?.length || 0}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-secondary text-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Acessos Hoje</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{stats.today}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="access" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="access" className="rounded-lg px-6 font-bold gap-2"><UserCheck className="w-4 h-4" /> Acessos</TabsTrigger>
          <TabsTrigger value="levels" className="rounded-lg px-6 font-bold gap-2"><Trophy className="w-4 h-4" /> Níveis</TabsTrigger>
          <TabsTrigger value="rules" className="rounded-lg px-6 font-bold gap-2"><Zap className="w-4 h-4" /> Regras de XP</TabsTrigger>
          <TabsTrigger value="badges" className="rounded-lg px-6 font-bold gap-2"><Award className="w-4 h-4" /> Medalhas</TabsTrigger>
          <TabsTrigger value="rankings" className="rounded-lg px-6 font-bold gap-2"><BarChart3 className="w-4 h-4" /> Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Participante</TableHead>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest">Evento / Local</TableHead>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest">Check-in em</TableHead>
                       <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Código</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {filteredRegs.map(reg => (
                      <TableRow key={reg.id} className={cn("hover:bg-muted/10 transition-colors", reg.checkedIn && "bg-green-50/20")}>
                        <TableCell className="p-6">
                           <div className="flex flex-col"><span className="font-bold text-sm">{reg.userName}</span><span className="text-[9px] text-muted-foreground">{reg.userEmail}</span></div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col"><span className="font-black text-[10px] text-primary uppercase italic truncate max-w-[200px]">{reg.eventTitle}</span><span className="text-[8px] font-bold text-muted-foreground uppercase">{reg.eventCity}</span></div>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge className={cn("text-[9px] font-black uppercase px-2 h-5", reg.checkedIn ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>{reg.checkedIn ? "Presente" : "Aguardando"}</Badge>
                        </TableCell>
                        <TableCell><span className="text-[10px] font-bold text-muted-foreground">{reg.checkedIn ? formatTimestamp(reg.checkedInAt) : "---"}</span></TableCell>
                        <TableCell className="text-right p-6 font-mono text-[10px] font-bold text-muted-foreground">{reg.ticketCode}</TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="levels" className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {levels?.map((lvl: any) => (
                <Card key={lvl.id} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group border-t-8 transition-all hover:shadow-lg" style={{ borderTopColor: lvl.color }}>
                   <CardHeader className="p-8">
                      <div className="flex justify-between items-start">
                         <div className="p-3 rounded-2xl bg-muted group-hover:scale-110 transition-transform">
                            <Zap className="w-6 h-6" style={{ color: lvl.color }} />
                         </div>
                         <Badge className="font-black text-[10px] uppercase h-6 px-3" style={{ backgroundColor: lvl.color }}>Nível {lvl.level}</Badge>
                      </div>
                      <div className="mt-6">
                         <CardTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">{lvl.name}</CardTitle>
                         <CardDescription className="text-xs font-medium mt-1 leading-relaxed">{lvl.description}</CardDescription>
                      </div>
                   </CardHeader>
                   <CardContent className="px-8 pb-8 pt-0">
                      <div className="p-4 bg-muted/30 rounded-2xl border border-dashed border-border/50">
                         <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">XP Necessário</p>
                         <p className="text-xl font-black text-primary">{(lvl.xpRequired).toLocaleString()} XP</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                         <Button variant="ghost" size="sm" className="flex-1 rounded-xl text-[10px] font-black uppercase text-muted-foreground hover:bg-muted/50" onClick={() => { setEditingLevel(lvl); setIsLevelDialogOpen(true); }}>Editar</Button>
                         <Button variant="ghost" size="icon" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => handleDeleteLevel(lvl.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                   </CardContent>
                </Card>
              ))}
              <Card 
                className="border-2 border-dashed border-border/60 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 text-muted-foreground hover:border-secondary/40 hover:bg-secondary/5 transition-all cursor-pointer group"
                onClick={() => { setEditingLevel({ level: (levels?.length || 0) + 1, name: "", xpRequired: 0, color: "#2C52EE", description: "" }); setIsLevelDialogOpen(true); }}
              >
                 <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors"><Plus className="w-6 h-6" /></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Criar Novo Nível</p>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Ação / Evento</TableHead>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">XP Base</TableHead>
                       <TableHead className="font-black uppercase text-[10px] tracking-widest">Gatilho</TableHead>
                       <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {rules?.map((rule: any) => (
                      <TableRow key={rule.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="p-6">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Zap className="w-4 h-4" /></div>
                              <span className="font-bold text-sm uppercase">{rule.name}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge className="bg-green-600 text-white font-black text-[10px] px-3">+{rule.points} XP</Badge>
                        </TableCell>
                        <TableCell>
                           <code className="text-[9px] font-black bg-muted px-2 py-1 rounded text-primary">{rule.event}</code>
                        </TableCell>
                        <TableCell className="text-right p-6">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditingRule(rule); setIsRuleDialogOpen(true); }}><Settings2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="badges" className="space-y-6">
           <div className="flex justify-between items-center px-4">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Catálogo de Medalhas</h2>
              <Button className="bg-secondary text-white font-black rounded-full px-6" onClick={() => { setEditingBadge({ name: "", description: "", category: "Cultura", color: "#2C52EE", icon: "Award" }); setIsBadgeDialogOpen(true); }}>
                 <Plus className="w-4 h-4 mr-2" /> Nova Medalha
              </Button>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {badges?.map((badge: any) => (
                <Card key={badge.id} className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col items-center text-center gap-3 group hover:scale-105 transition-all">
                   <div className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: badge.color }}>
                      <Award className="w-8 h-8" />
                   </div>
                   <div className="space-y-1">
                      <p className="font-black text-[10px] uppercase tracking-tighter line-clamp-1">{badge.name}</p>
                      <p className="text-[8px] font-medium text-muted-foreground uppercase leading-tight line-clamp-2">{badge.description}</p>
                   </div>
                   <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingBadge(badge); setIsBadgeDialogOpen(true); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={async () => { if(confirm("Excluir medalha?")) await deleteDoc(doc(db!, "badges", badge.id)) }}><Trash2 className="w-3 h-3" /></Button>
                   </div>
                </Card>
              ))}
              {(!badges || badges.length === 0) && (
                <div className="col-span-full py-20 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-border/40">
                   <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-10" />
                   <p className="text-muted-foreground font-black uppercase tracking-widest text-[9px]">Ainda não possui medalhas públicas.</p>
                </div>
              )}
           </div>
        </TabsContent>

        <TabsContent value="rankings" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                       <BarChart3 className="w-5 h-5 text-secondary" /> Liderança Global (XP)
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow>
                             <TableHead className="w-16 text-center font-black">#</TableHead>
                             <TableHead className="font-black">Usuário</TableHead>
                             <TableHead className="text-right font-black">XP Total</TableHead>
                             <TableHead className="text-center font-black">Nível</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {rankings?.map((rank, i) => (
                            <TableRow key={rank.userId} className="hover:bg-muted/5">
                               <TableCell className="text-center font-black text-secondary">#{i + 1}</TableCell>
                               <TableCell>
                                  <div className="flex items-center gap-3">
                                     <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-[10px]">ID</div>
                                     <span className="font-bold text-xs">Usuário {rank.userId.slice(0, 8)}</span>
                                  </div>
                               </TableCell>
                               <TableCell className="text-right font-black text-primary">{rank.totalXp?.toLocaleString()}</TableCell>
                               <TableCell className="text-center"><Badge className="bg-primary text-white text-[9px] font-black uppercase">Lv. {rank.level}</Badge></TableCell>
                            </TableRow>
                          ))}
                          {(!rankings || rankings.length === 0) && (
                            <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground italic text-xs">Nenhum dado de ranking disponível.</TableCell></TableRow>
                          )}
                       </TableBody>
                    </Table>
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-primary text-white">
                 <CardHeader>
                    <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                       <TrendingUp className="w-5 h-5 text-secondary" /> Estatísticas Globais
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-8">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase opacity-60">Média de XP por Usuário</p>
                       <p className="text-4xl font-black italic">
                          {rankings && rankings.length > 0 ? Math.round(rankings.reduce((acc, r) => acc + (r.totalXp || 0), 0) / rankings.length).toLocaleString() : 0} XP
                       </p>
                    </div>
                    <Separator className="bg-white/10" />
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10 flex items-start gap-4">
                       <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                       <p className="text-[10px] font-medium leading-relaxed opacity-80">As estatísticas de categorias e bairros serão habilitadas após a próxima agregação de dados de check-in.</p>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE NÍVEL */}
      <Dialog open={isLevelDialogOpen} onOpenChange={setIsLevelDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-md">
          <form onSubmit={handleSaveLevel} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Configurar Nível</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Número</Label>
                    <Input type="number" value={editingLevel?.level || ""} onChange={e => setEditingLevel({...editingLevel, level: parseInt(e.target.value)})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome do Nível</Label>
                    <Input value={editingLevel?.name || ""} onChange={e => setEditingLevel({...editingLevel, name: e.target.value})} placeholder="Ex: Explorador" required />
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">XP Necessário</Label>
                  <Input type="number" value={editingLevel?.xpRequired || ""} onChange={e => setEditingLevel({...editingLevel, xpRequired: parseInt(e.target.value)})} required />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Cor de Identidade</Label>
                  <div className="flex gap-3 items-center">
                     <Input type="color" value={editingLevel?.color || "#2C52EE"} onChange={e => setEditingLevel({...editingLevel, color: e.target.value})} className="w-12 h-10 p-1" />
                     <span className="font-mono text-xs font-bold">{editingLevel?.color}</span>
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Breve Descrição</Label>
                  <Textarea value={editingLevel?.description || ""} onChange={e => setEditingLevel({...editingLevel, description: e.target.value})} maxLength={100} className="resize-none h-20" />
               </div>
            </div>
            <DialogFooter>
               <Button type="submit" disabled={isLevelSaving} className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic shadow-lg">
                  {isLevelSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Nível
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE REGRA */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-md">
           <form onSubmit={handleSaveRule} className="space-y-6">
              <DialogHeader>
                 <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Editar Regra de XP</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome Amigável</Label>
                    <Input value={editingRule?.name || ""} onChange={e => setEditingRule({...editingRule, name: e.target.value})} required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Evento Gatilho (Técnico)</Label>
                    <Input value={editingRule?.event || ""} disabled className="bg-muted/50" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">XP Atribuído</Label>
                    <Input type="number" value={editingRule?.points || ""} onChange={e => setEditingRule({...editingRule, points: parseInt(e.target.value)})} required />
                 </div>
              </div>
              <DialogFooter>
                 <Button type="submit" disabled={isRuleSaving} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic">
                    {isRuleSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Atualizar Regra
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE MEDALHA */}
      <Dialog open={isBadgeDialogOpen} onOpenChange={setIsBadgeDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-md">
           <form onSubmit={handleSaveBadge} className="space-y-6">
              <DialogHeader>
                 <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Configurar Medalha</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome da Conquista</Label>
                    <Input value={editingBadge?.name || ""} onChange={e => setEditingBadge({...editingBadge, name: e.target.value})} required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                    <Select value={editingBadge?.category || "Cultura"} onValueChange={v => setEditingBadge({...editingBadge, category: v})}>
                       <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="Cultura">Cultura</SelectItem>
                          <SelectItem value="Exploração">Exploração</SelectItem>
                          <SelectItem value="Social">Social</SelectItem>
                          <SelectItem value="Eventos">Eventos</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Cor da Medalha</Label>
                    <Input type="color" value={editingBadge?.color || "#2C52EE"} onChange={e => setEditingBadge({...editingBadge, color: e.target.value})} className="h-10 p-1" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Requisito / Descrição</Label>
                    <Textarea value={editingBadge?.description || ""} onChange={e => setEditingBadge({...editingBadge, description: e.target.value})} maxLength={100} className="h-20" required />
                 </div>
              </div>
              <DialogFooter>
                 <Button type="submit" disabled={isBadgeSaving} className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic">
                    {isBadgeSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Publicar Medalha
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
