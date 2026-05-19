"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { Html5QrcodeScanner } from "html5-qrcode"
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

export default function AdminScannerPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user: currentUser } = useUser(auth)
  
  const [mode, setMode] = React.useState<'idle' | 'camera' | 'manual'>('idle')
  const [manualCode, setManualCode] = React.useState("")
  const [isValidating, setIsValidating] = React.useState(false)
  const [ticketData, setTicketData] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null)

  React.useEffect(() => {
    if (mode === 'camera') {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => console.error("Scanner cleanup error:", error));
      }
    }
  }, [mode])

  const onScanSuccess = (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => {
        setMode('manual')
        validateTicket(decodedText)
      })
    }
  }

  const onScanFailure = (error: any) => {
    // Silently handle scan failures
  }

  const validateTicket = async (code: string) => {
    if (!db || !code) return

    setIsValidating(true)
    setError(null)
    setTicketData(null)

    try {
      const q = query(collection(db, "registrations"), where("ticketCode", "==", code.trim().toUpperCase()))
      const snap = await getDocs(q)

      if (snap.empty) {
        setError("Ingresso não encontrado ou código inválido.")
        toast({ variant: "destructive", title: "Erro", description: "Código inexistente." })
      } else {
        const docData = snap.docs[0].data()
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

      setTicketData({ ...ticketData, checkedIn: true })
      toast({ title: "Check-in realizado!", description: `Entrada autorizada para ${ticketData.userName}.` })
    } catch (err) {
      toast({ variant: "destructive", title: "Erro no check-in" })
    } finally {
      setIsValidating(false)
    }
  }

  const resetScanner = () => {
    setMode('idle')
    setTicketData(null)
    setError(null)
    setManualCode("")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Scanner de Acesso</h1>
        </div>
        <Button variant="outline" size="sm" onClick={resetScanner} className="rounded-full gap-2">
          <RefreshCw className="w-4 h-4" /> Reiniciar
        </Button>
      </div>

      {mode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:border-secondary transition-all cursor-pointer group" onClick={() => setMode('camera')}>
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="p-6 bg-secondary/10 rounded-full group-hover:bg-secondary group-hover:text-white transition-colors">
                <Camera className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Usar Câmera</h3>
                <p className="text-sm text-muted-foreground">Leitura rápida via QR Code</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-secondary transition-all cursor-pointer group" onClick={() => setMode('manual')}>
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="p-6 bg-secondary/10 rounded-full group-hover:bg-secondary group-hover:text-white transition-colors">
                <Keyboard className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Código Manual</h3>
                <p className="text-sm text-muted-foreground">Digitar código de 16 dígitos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === 'camera' && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2">
              <Camera className="w-4 h-4 text-secondary" /> Leitor de QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div id="reader" className="w-full"></div>
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && !ticketData && (
        <Card>
          <CardHeader>
            <CardTitle>Entrada Manual</CardTitle>
            <CardDescription>Insira o código XXXX-XXXX-XXXX-XXXX presente no voucher.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-code">Código do Ingresso</Label>
              <Input 
                id="ticket-code"
                placeholder="A7F2-X91K-..." 
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="font-mono text-lg h-14"
              />
            </div>
            <Button 
              className="w-full bg-secondary text-white font-bold h-14 rounded-xl"
              onClick={() => validateTicket(manualCode)}
              disabled={isValidating || manualCode.length < 5}
            >
              {isValidating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Ticket className="w-5 h-5 mr-2" />}
              Validar Ingresso
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <XCircle className="w-16 h-16 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-bold text-xl">Acesso Negado</h3>
              <p className="text-muted-foreground font-medium">{error}</p>
            </div>
            <Button variant="outline" onClick={() => { setError(null); setTicketData(null); }} className="rounded-full">Tentar Novamente</Button>
          </CardContent>
        </Card>
      )}

      {ticketData && (
        <Card className={cn(
          "overflow-hidden transition-all shadow-2xl",
          ticketData.checkedIn ? "border-orange-500 bg-orange-50/50" : "border-green-500 bg-green-50/50"
        )}>
          <CardHeader className={cn(
            "border-b",
            ticketData.checkedIn ? "bg-orange-500 text-white" : "bg-green-500 text-white"
          )}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {ticketData.checkedIn ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                {ticketData.checkedIn ? "INGRESSO JÁ UTILIZADO" : "INGRESSO VÁLIDO"}
              </CardTitle>
              <Badge variant="outline" className="border-white text-white font-bold">
                {ticketData.batchName || "Lote Único"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md">
                    <User className="w-8 h-8 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Participante</p>
                    <p className="font-black text-xl leading-none text-primary uppercase italic">{ticketData.userName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Calendar className="w-8 h-8 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Evento</p>
                    <p className="font-bold text-sm leading-tight">{ticketData.eventTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md">
                    <DollarSign className="w-8 h-8 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Valor do Ingresso</p>
                    <p className="font-black text-xl leading-none text-primary">
                      {ticketData.price === 0 ? "GRÁTIS" : `R$ ${parseFloat(ticketData.price).toFixed(2).replace('.', ',')}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/50 rounded-3xl border border-dashed border-muted-foreground/30 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Ticket ID</span>
                  <span className="font-mono font-black text-sm text-secondary">{ticketData.ticketCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Pagamento</span>
                  <Badge className={ticketData.paymentStatus === 'Pago' || ticketData.price === 0 ? 'bg-green-500' : 'bg-orange-500'}>
                    {ticketData.paymentStatus || 'Disponível'}
                  </Badge>
                </div>
                {ticketData.checkedIn && (
                  <div className="pt-4 border-t border-orange-200">
                    <p className="text-[10px] font-bold text-orange-800 uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Entrada em: {ticketData.checkedInAt?.toDate?.()?.toLocaleString() || '---'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {!ticketData.checkedIn && (
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black h-20 text-2xl rounded-[2rem] shadow-xl shadow-green-500/20 uppercase italic tracking-tighter"
                onClick={handleConfirmCheckIn}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 className="w-8 h-8 animate-spin mr-3" /> : <CheckCircle2 className="w-8 h-8 mr-3" />}
                CONFIRMAR ENTRADA
              </Button>
            )}

            <Button variant="ghost" className="w-full h-12 font-bold text-muted-foreground uppercase text-xs tracking-widest" onClick={resetScanner}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
