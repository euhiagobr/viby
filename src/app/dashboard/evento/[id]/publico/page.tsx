
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { doc, collection, query, where, updateDoc, deleteDoc, getDoc, writeBatch, serverTimestamp, getDocs } from "firebase/firestore"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Users, 
  ArrowLeft, 
  Loader2, 
  Calendar,
  Download,
  Search,
  CheckCircle2,
  Trash2,
  Ticket,
  Clock,
  RefreshCcw,
  AlertTriangle,
  ScanQrCode,
  X,
  User,
  DollarSign,
  TrendingUp,
  Percent,
  Layers
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Html5Qrcode } from "html5-qrcode"
import { formatCurrency } from "@/lib/financial-utils"

export default function EventoPublicoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user: currentUser } = useUser(auth)
  
  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !eventId || !event?.organizationId) return null
    return query(
      collection(db, "registrations"), 
      where("eventId", "==", eventId),
      where("organizationId", "==", event.organizationId)
    )
  }, [db, eventId, event?.organizationId])

  const { data: registrations, loading: registrationsLoading } = useCollection<any>(registrationsQuery)
  const [search, setSearch] = React.useState("")
  const [isSyncing, setIsSyncing] = React.useState(false)

  const [isScannerOpen, setIsScannerOpen] = React.useState(false)
  const [scanMode, setScanMode] = React.useState<'idle' | 'scanning' | 'result'>('idle')
  const [manualCode, setManualCode] = React.useState("")
  const [scanResult, setScanResult] = React.useState<any>(null)
  const [isValidating, setIsValidating] = React.useState(false)
  
  const scannerInstance = React.useRef<Html5Qrcode | null>(null)

  const stats = React.useMemo(() => {
    const total = registrations?.length || 0;
    const present = registrations?.filter((r: any) => r.checkedIn).length || 0;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    
    const financial = (registrations || []).reduce((acc: any, reg: any) => {
      acc.gross += (reg.ticketBasePrice || 0);
      acc.net += (reg.producerNetAmount || 0);
      return acc;
    }, { gross: 0, net: 0 });

    return { total, present, percentage, ...financial };
  }, [registrations]);

  const filteredRegistrations = React.useMemo(() => {
    if (!registrations) return []
    
    const sorted = [...registrations].sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });

    return sorted.filter(reg => 
      (reg.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.userEmail?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.ticketCode?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [registrations, search])

  const startScanning = async () => {
    setScanMode('scanning');
    
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader-integrated");
        scannerInstance.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            stopScanning();
            validateTicket(decodedText);
          },
          (errorMessage) => {}
        );
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
        toast({ variant: "destructive", title: "Erro na Câmera", description: "Não foi possível acessar a câmera." });
        setScanMode('idle');
      }
    }, 300);
  }

  const stopScanning = async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try {
        await scannerInstance.current.stop();
        scannerInstance.current.clear();
        scannerInstance.current = null;
      } catch (e) {
        console.error("Erro ao parar scanner:", e);
      }
    }
  }

  React.useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const validateTicket = async (code: string) => {
    if (!db || !code || !eventId || !event?.organizationId) return

    setIsValidating(true)
    try {
      const q = query(
        collection(db, "registrations"), 
        where("ticketCode", "==", code.trim().toUpperCase()),
        where("eventId", "==", eventId),
        where("organizationId", "==", event.organizationId)
      )
      const snap = await getDocs(q)

      if (snap.empty) {
        toast({ variant: "destructive", title: "Não encontrado", description: "Ingresso inválido para este evento." })
        setScanMode('idle');
      } else {
        const data = snap.docs[0].data()
        setScanResult({ ...data, id: snap.docs[0].id })
        setScanMode('result')
        if (data.checkedIn) {
          toast({ variant: "destructive", title: "Atenção", description: "Este ingresso já foi utilizado." })
        }
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro na busca" })
      setScanMode('idle');
    } finally {
      setIsValidating(false)
    }
  }

  const confirmCheckIn = async () => {
    if (!db || !scanResult || !currentUser) return
    setIsValidating(true)
    try {
      await updateDoc(doc(db, "registrations", scanResult.id), {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
        checkedInBy: currentUser.uid,
        status: "Utilizado"
      })
      toast({ title: "Sucesso!", description: `Check-in de ${scanResult.userName} realizado.` })
      setScanMode('idle')
      setScanResult(null)
      setManualCode("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Sem permissão." })
    } finally {
      setIsValidating(false)
    }
  }

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return "---";
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
      return isNaN(age) ? "---" : `${age} anos`;
    } catch (e) { return "---"; }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  }

  const handleCheckIn = async (regId: string, currentStatus: boolean) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "registrations", regId), {
        checkedIn: !currentStatus,
        checkedInAt: !currentStatus ? serverTimestamp() : null,
        checkedInBy: !currentStatus ? currentUser?.uid : null,
        status: !currentStatus ? "Utilizado" : "Ativo"
      })
      toast({ title: !currentStatus ? "Check-in realizado!" : "Check-in removido." })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no check-in" })
    }
  }

  const handleRepairData = async () => {
    if (!db || !registrations || !event) return
    setIsSyncing(true)
    const batch = writeBatch(db)
    let count = 0
    try {
      for (const reg of registrations) {
        if (!reg.organizerId || !reg.userGender || !reg.userBirthDate || !reg.userName || !reg.organizationId) {
          const userRef = doc(db, "users", reg.userId)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            const userData = userSnap.data()
            batch.update(doc(db, "registrations", reg.id), {
              organizationId: event.organizationId,
              organizerId: event.organizerId,
              userName: userData.name || reg.userName || "Usuário",
              userEmail: userData.email || reg.userEmail || "",
              userGender: userData.gender || "Não informado",
              userBirthDate: userData.birthDate || "",
              eventTitle: event.title
            })
            count++
          }
        }
      }
      if (count > 0) await batch.commit();
      toast({ title: "Concluído", description: `${count} registros sincronizados.` })
    } catch (error) { toast({ variant: "destructive", title: "Erro" }) }
    finally { setIsSyncing(false) }
  }

  if (eventLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!event) return <div className="flex flex-col items-center justify-center h-[60vh] gap-4"><h2 className="text-2xl font-bold">Evento não encontrado</h2><Button onClick={() => router.push('/dashboard/projetos')}>Voltar</Button></div>

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Público</h1>
            <p className="text-muted-foreground line-clamp-1">{event.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            className="rounded-xl font-bold gap-2 bg-primary text-white shadow-lg"
            onClick={() => { setIsScannerOpen(true); setScanMode('idle'); }}
          >
            <ScanQrCode className="w-4 h-4" />
            Scanner Check-in
          </Button>
          <Button 
            variant="outline" 
            className="rounded-xl font-bold gap-2 text-xs border-secondary text-secondary hover:bg-secondary/10"
            onClick={handleRepairData}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Inscritos Totais</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-foreground">{stats.total}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card border-l-4 border-green-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Presenças</CardTitle></CardHeader>
          <CardContent><div className="flex items-baseline gap-3"><div className="text-3xl font-black text-green-600">{stats.present}/{stats.total}</div><div className="text-sm font-bold text-muted-foreground">{stats.percentage}%</div></div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card bg-secondary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-secondary tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Receita Líquida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">{formatCurrency(stats.net)}</div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Bruto: {formatCurrency(stats.gross)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card bg-orange-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Info Taxas</CardTitle></CardHeader>
          <CardContent><p className="text-[10px] text-orange-800 leading-tight">Os valores exibidos aqui já consideram os descontos automáticos das taxas do seu plano.</p></CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Lista de Participantes</CardTitle>
              <CardDescription>Gerencie check-ins manuais ou visualize quem já chegou.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar participante ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {registrationsLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[80px] text-center font-bold">Portaria</TableHead>
                  <TableHead className="w-[200px] font-bold">Participante</TableHead>
                  <TableHead className="font-bold">Dados</TableHead>
                  <TableHead className="font-bold">Tipo / Ingresso</TableHead>
                  <TableHead className="font-bold">Entrada</TableHead>
                  <TableHead className="font-bold">Líquido</TableHead>
                  <TableHead className="font-bold">Código</TableHead>
                  <TableHead className="text-right font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id} className={cn("hover:bg-muted/20 transition-colors", reg.checkedIn && "bg-green-50/30")}>
                    <TableCell className="text-center">
                      <Button variant={reg.checkedIn ? "default" : "outline"} size="icon" onClick={() => handleCheckIn(reg.id, reg.checkedIn)} className={cn("h-9 w-9 rounded-full transition-all", reg.checkedIn ? "bg-green-500 hover:bg-green-600 text-white" : "border-muted-foreground/30")}>
                        <CheckCircle2 className={cn("w-5 h-5", reg.checkedIn ? "text-white" : "text-muted-foreground/20")} />
                      </Button>
                    </TableCell>
                    <TableCell><div className="flex flex-col"><span className="font-bold text-sm text-foreground">{reg.userName || "Pendente"}</span><span className="text-[10px] text-muted-foreground">{reg.userEmail}</span></div></TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                         <span className="text-xs font-bold text-muted-foreground">{calculateAge(reg.userBirthDate)}</span>
                         <Badge variant="outline" className="text-[8px] font-black w-fit h-4 uppercase">{reg.userGender || "N/A"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold">{reg.ticketTypeName || "Acesso"}</span>
                          {reg.poolName && <span className="text-[8px] font-black text-secondary uppercase flex items-center gap-1"><Layers className="w-2 h-2" /> Pool: {reg.poolName}</span>}
                       </div>
                    </TableCell>
                    <TableCell>
                      {reg.checkedIn ? (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(reg.checkedInAt)}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase">---</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className="text-xs font-black text-primary">{formatCurrency(reg.producerNetAmount || 0)}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Bruto: {formatCurrency(reg.ticketBasePrice || 0)}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="p-3 space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-1">Breakdown Financeiro</p>
                             <div className="space-y-1">
                                <div className="flex justify-between gap-8 text-[10px] font-bold"><span>Valor Base:</span> <span>{formatCurrency(reg.ticketBasePrice)}</span></div>
                                <div className="flex justify-between gap-8 text-[10px] font-bold text-red-500"><span>Taxa Plano:</span> <span>-{formatCurrency(reg.producerFeeAmount)}</span></div>
                                <Separator />
                                <div className="flex justify-between gap-8 text-[10px] font-black text-green-600"><span>Líquido Produtor:</span> <span>{formatCurrency(reg.producerNetAmount)}</span></div>
                             </div>
                             <p className="text-[8px] text-muted-foreground italic mt-2">* Taxa administrativa do comprador ({formatCurrency(reg.administrativeFeeAmount)}) excluída desta visão.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell><span className="text-[10px] font-mono font-bold text-secondary">{reg.ticketCode}</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={async () => {
                        if (confirm(`Remover inscrição de ${reg.userName}?`)) {
                          await deleteDoc(doc(db!, "registrations", reg.id))
                          toast({ title: "Inscrição removida" })
                        }
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isScannerOpen} onOpenChange={(open) => { setIsScannerOpen(open); if(!open) { stopScanning(); setScanMode('idle'); } }}>
        <DialogContent className="max-w-xl rounded-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 bg-muted/30">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <ScanQrCode className="w-5 h-5 text-secondary" />
                Validador Integrado
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsScannerOpen(false)} className="rounded-full h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <DialogDescription>Apenas ingressos deste evento ({event.title}) serão aceitos.</DialogDescription>
          </DialogHeader>

          <div className="p-6">
            {scanMode === 'idle' && (
              <div className="grid grid-cols-2 gap-4">
                <Button className="h-32 flex-col gap-3 rounded-2xl" variant="outline" onClick={startScanning}>
                  <div className="p-3 bg-secondary/10 rounded-full"><ScanQrCode className="w-6 h-6 text-secondary" /></div>
                  <span className="font-bold">Usar Câmera</span>
                </Button>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black opacity-60">Código Manual</Label>
                    <Input placeholder="XXXX-XXXX-..." value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} className="font-mono text-center" />
                  </div>
                  <Button className="w-full font-bold bg-primary text-white" disabled={manualCode.length < 4} onClick={() => validateTicket(manualCode)}>Validar Código</Button>
                </div>
              </div>
            )}

            {scanMode === 'scanning' && (
              <div className="space-y-4">
                <div id="reader-integrated" className="w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-black aspect-square"></div>
                <Button variant="ghost" className="w-full font-bold" onClick={() => { stopScanning(); setScanMode('idle'); }}>Voltar</Button>
              </div>
            )}

            {scanMode === 'result' && scanResult && (
              <div className="space-y-6">
                <div className={cn("p-6 rounded-[2rem] border-2 transition-all", scanResult.checkedIn ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200")}>
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={scanResult.checkedIn ? "bg-orange-500" : "bg-green-500"}>{scanResult.checkedIn ? "JÁ UTILIZADO" : "VÁLIDO"}</Badge>
                    <span className="text-[10px] font-mono font-black opacity-40">{scanResult.ticketCode}</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center"><User className="w-5 h-5 text-secondary" /></div>
                      <div><p className="text-[10px] font-black uppercase text-muted-foreground">Participante</p><p className="font-bold text-lg">{scanResult.userName}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center"><DollarSign className="w-5 h-5 text-secondary" /></div>
                      <div><p className="text-[10px] font-black uppercase text-muted-foreground">Valor (Líquido Produtor)</p><p className="font-black">{formatCurrency(scanResult.producerNetAmount || 0)}</p></div>
                    </div>
                  </div>
                </div>
                {!scanResult.checkedIn ? (
                  <Button className="w-full h-16 bg-green-600 text-white font-black text-xl rounded-2xl shadow-xl" onClick={confirmCheckIn} disabled={isValidating}>
                    {isValidating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
                    CONFIRMAR ENTRADA
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full h-12 rounded-xl font-bold" onClick={() => { setScanMode('idle'); setScanResult(null); }}>Tentar Outro</Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
