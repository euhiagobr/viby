"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Camera, 
  Keyboard, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  User,
  Calendar,
  Ticket,
  RefreshCw,
  ArrowLeft,
  DollarSign
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { processGamificationEvent } from "@/lib/gamification-service"

export default function AdminScannerPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user: currentUser } = useUser(auth)
  
  const [mode, setMode] = React.useState<'idle' | 'camera' | 'manual'>('idle')
  const [manualCode, setManualCode] = React.useState("")
  const [isValidating, setIsValidating] = React.useState(false)
  const [ticketData, setTicketData] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  const scannerInstance = React.useRef<Html5Qrcode | null>(null)

  const startCamera = async () => {
    setMode('camera');
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerInstance.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            stopCamera();
            validateTicket(decodedText);
          },
          (errorMessage) => {}
        );
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        toast({ variant: "destructive", title: "Erro na Câmera", description: "Certifique-se de dar permissão de acesso." });
        setMode('idle');
      }
    }, 300);
  }

  const stopCamera = async () => {
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
      stopCamera();
    }
  }, [])

  const validateTicket = async (code: string) => {
    if (!db || !code) return

    setIsValidating(true)
    setError(null)
    setTicketData(null)
    setMode('manual')

    try {
      const q = query(collection(db, "registrations"), where("ticketCode", "==", code.trim().toUpperCase()))
      const snap = await getDocs(q)

      if (snap.empty) {
        setError("Ingresso não encontrado ou código inválido.")
        toast({ variant: "destructive", title: "Erro", description: "Código inexistente." })
      } else {
        const docData = snap.docs[0].data()
        
        if (docData.status === 'Cancelado' || docData.paymentStatus === 'Cancelado') {
          setError("Acesso Negado: Este ingresso foi cancelado ou estornado.")
          return
        }

        setTicketData({ ...docData, id: snap.docs[0].id })
        
        if (docData.checkedIn) {
          toast({ variant: "destructive", title: "Atenção!", description: "Ingresso já utilizado." })
        }
      }
    } catch (err) {
      console.error(err)
      setError("Erro ao validar ingresso.")
    } finally {
      setIsValidating(false)
    }
  }

  const handleConfirmCheckIn = async () => {
    if (!db || !ticketData || !currentUser) return

    setIsValidating(true)
    try {
      const regRef = doc(db, "registrations", ticketData.id)
      await updateDoc(regRef, {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
        checkedInBy: currentUser.uid,
        status: "Utilizado"
      })

      // Gatilho Gamificação: Check-in via Scanner Admin (Travado pelo ID do ingresso)
      await processGamificationEvent(db, ticketData.userId, 'on_checkin', {
        eventId: ticketData.eventId,
        eventTitle: ticketData.eventTitle,
        categoryName: ticketData.categoryName,
        neighborhood: ticketData.eventNeighborhood,
        city: ticketData.eventCity,
        orgName: ticketData.organizer?.name
      }, ticketData.id);

      setTicketData({ ...ticketData, checkedIn: true })
      toast({ title: "Check-in realizado!", description: `Entrada autorizada para ${ticketData.userName}.` })
    } catch (err) {
      toast({ variant: "destructive", title: "Erro no check-in" })
    } finally {
      setIsValidating(false)
    }
  }

  const resetScanner = () => {
    stopCamera();
    setMode('idle')
    setTicketData(null)
    setError(null)
    setManualCode("")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 invisible-scrollbar">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Scanner de Acesso</h1>
        </div>
        <Button variant="outline" size="sm" onClick={resetScanner} className="rounded-full gap-2 font-bold text-xs uppercase">
          <RefreshCw className="w-4 h-4" /> Reiniciar
        </Button>
      </div>

      {mode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:border-secondary transition-all cursor-pointer group rounded-[2.5rem] bg-white border-none shadow-sm" onClick={startCamera}>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6">
              <div className="p-8 bg-secondary/10 rounded-full group-hover:bg-secondary group-hover:text-white transition-all group-hover:scale-110">
                <Camera className="w-12 h-12" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-black text-xl uppercase italic tracking-tighter">Usar Câmera</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Leitura rápida via QR Code</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-secondary transition-all cursor-pointer group rounded-[2.5rem] bg-white border-none shadow-sm" onClick={() => setMode('manual')}>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6">
              <div className="p-8 bg-primary/5 rounded-full group-hover:bg-primary group-hover:text-white transition-all group-hover:scale-110">
                <Keyboard className="w-12 h-12" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-black text-xl uppercase italic tracking-tighter">Código Manual</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Digitar código de 16 dígitos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === 'camera' && (
        <Card className="overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-white">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2">
              <Camera className="w-4 h-4 text-secondary" /> Leitor de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div id="reader" className="w-full bg-black aspect-square"></div>
            <Button variant="ghost" className="w-full rounded-none h-16 font-black uppercase italic tracking-widest text-muted-foreground" onClick={resetScanner}>Cancelar e Voltar</Button>
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && !ticketData && !error && (
        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Entrada Manual</CardTitle>
            <CardDescription className="text-xs font-medium">Insira o código alfanumérico presente no voucher do participante.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ticket-code" className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Código do Ingresso</Label>
              <Input 
                id="ticket-code"
                placeholder="XXXX-XXXX-XXXX-XXXX" 
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="font-mono text-xl h-16 text-center rounded-2xl border-secondary/20 focus-visible:ring-secondary/30"
              />
            </div>
            <Button 
              className="w-full bg-secondary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
              onClick={() => validateTicket(manualCode)}
              disabled={isValidating || manualCode.length < 5}
            >
              {isValidating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Ticket className="w-6 h-6 mr-2" />}
              Validar e Consultar
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive bg-destructive/5 rounded-[2.5rem] shadow-sm">
          <CardContent className="p-12 flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
               <XCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-2xl uppercase italic tracking-tighter text-destructive">Acesso Negado</h3>
              <p className="text-sm font-medium text-muted-foreground max-w-xs">{error}</p>
            </div>
            <Button variant="outline" onClick={() => { setError(null); setTicketData(null); setMode('idle'); }} className="rounded-xl h-12 px-8 font-bold uppercase text-xs border-destructive text-destructive hover:bg-destructive/5">Tentar Outro Código</Button>
          </CardContent>
        </Card>
      )}

      {ticketData && (
        <Card className={cn(
          "overflow-hidden transition-all shadow-2xl rounded-[2.5rem] border-none bg-white",
          ticketData.checkedIn ? "ring-4 ring-orange-500/20" : "ring-4 ring-green-500/20"
        )}>
          <CardHeader className={cn(
            "p-8 border-b",
            ticketData.checkedIn ? "bg-orange-500 text-white" : "bg-green-500 text-white"
          )}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter text-2xl">
                {ticketData.checkedIn ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                {ticketData.checkedIn ? "JÁ UTILIZADO" : "INGRESSO VÁLIDO"}
              </CardTitle>
              <Badge variant="outline" className="border-white text-white font-black uppercase text-[10px] px-3">
                {ticketData.batchName || "Lote Único"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center shadow-inner">
                    <User className="w-8 h-8 text-secondary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Participante</p>
                    <p className="font-black text-xl leading-none text-primary uppercase italic">{ticketData.userName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center shadow-inner">
                    <Calendar className="w-8 h-8 text-secondary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Evento</p>
                    <p className="font-bold text-sm leading-tight uppercase">{ticketData.eventTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center shadow-inner">
                    <DollarSign className="w-8 h-8 text-secondary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Valor Nominal</p>
                    <p className="font-black text-xl leading-none text-primary">
                      {formatCurrency(ticketData.ticketBasePrice || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed border-muted-foreground/20 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Protocolo</span>
                  <span className="font-mono font-black text-sm text-secondary">{ticketData.ticketCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pagamento</span>
                  <Badge className={cn("uppercase text-[9px] font-black px-2 h-5", ticketData.paymentStatus === 'Pago' || ticketData.price === 0 ? 'bg-green-500' : 'bg-orange-500')}>
                    {ticketData.paymentStatus || 'Disponível'}
                  </Badge>
                </div>
                {ticketData.checkedIn && (
                  <div className="pt-6 border-t border-orange-200">
                    <p className="text-[10px] font-black text-orange-800 uppercase flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Entrada em: {formatAdDate(ticketData.checkedInAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {!ticketData.checkedIn && (
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black h-24 text-2xl rounded-[2rem] shadow-xl shadow-green-500/20 uppercase italic tracking-tighter group transition-all"
                onClick={handleConfirmCheckIn}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 className="w-10 h-10 animate-spin mr-4" /> : <CheckCircle2 className="w-10 h-10 mr-4 group-hover:scale-110 transition-transform" />}
                LIBERAR ACESSO
              </Button>
            )}

            <Button variant="ghost" className="w-full h-12 font-black text-muted-foreground uppercase text-[10px] tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity" onClick={resetScanner}>
              Voltar ao Início / Novo Scan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
