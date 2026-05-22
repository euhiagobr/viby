"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
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
  RefreshCcw
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

export default function AdminPresencaPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

  // Consultas de Gamificação
  const levelsQuery = useMemoFirebase(() => db ? query(collection(db, "levels"), orderBy("level", "asc")) : null, [db])
  const badgesQuery = useMemoFirebase(() => db ? collection(db, "badges") : null, [db])
  const rulesQuery = useMemoFirebase(() => db ? collection(db, "xp_rules") : null, [db])
  const presenceQuery = useMemoFirebase(() => db ? query(collection(db, "registrations"), orderBy("timestamp", "desc"), limit(100)) : null, [db])

  const { data: levels, loading: loadingLevels } = useCollection<any>(levelsQuery)
  const { data: badges, loading: loadingBadges } = useCollection<any>(badgesQuery)
  const { data: rules, loading: loadingRules } = useCollection<any>(rulesQuery)
  const { data: registrations, loading: loadingPresence } = useCollection<any>(presenceQuery)

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

  // Lógica de Sincronização Inicial de Gamificação (Seed)
  const handleSeedGamification = async () => {
    if (!db) return;
    try {
      // Seed Levels
      for (const level of DEFAULT_LEVELS) {
        await setDoc(doc(db, "levels", level.id), level);
      }
      // Seed Rules
      for (const rule of DEFAULT_RULES) {
        await setDoc(doc(db, "xp_rules", rule.id), rule);
      }
      toast({ title: "Sistema inicializado!", description: "Níveis e regras padrão foram carregados." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na inicialização" });
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
           <Button variant="outline" onClick={handleSeedGamification} className="rounded-xl h-11 font-bold text-xs uppercase gap-2 border-secondary text-secondary hover:bg-secondary/5">
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
           <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar participante ou evento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
              </div>
           </div>
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
                         <Button variant="ghost" size="sm" className="flex-1 rounded-xl text-[10px] font-black uppercase text-muted-foreground hover:bg-muted/50">Editar</Button>
                         <Button variant="ghost" size="icon" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => deleteDoc(doc(db!, "levels", lvl.id))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                   </CardContent>
                </Card>
              ))}
              <Card className="border-2 border-dashed border-border/60 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 text-muted-foreground hover:border-secondary/40 hover:bg-secondary/5 transition-all cursor-pointer group">
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
                       <TableHead className="font-black uppercase text-[10px] tracking-widest">Gatilho (Firestore Event)</TableHead>
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
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Settings2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="badges" className="space-y-6">
           <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner">
              <Award className="w-16 h-16 text-muted-foreground opacity-10 mb-4" />
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Módulo de Conquistas em Desenvolvimento</p>
              <Button className="mt-4 bg-secondary text-white font-black h-11 rounded-xl uppercase italic text-[10px] px-8">Novo Design de Badge</Button>
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
                    <div className="py-12 text-center opacity-30 italic text-sm">Aguardando agregação de dados...</div>
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                       <TrendingUp className="w-5 h-5 text-secondary" /> Top Categorias
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="py-12 text-center opacity-30 italic text-sm">Aguardando agregação de dados...</div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
