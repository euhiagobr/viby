"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { collection, query, where, getDocs, doc, serverTimestamp, getDoc, runTransaction } from "firebase/firestore"
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
  DollarSign,
  Clock,
  ShieldAlert,
  UserCheck,
  Lock
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { processGamificationEvent } from "@/lib/gamification-service"
import { formatCurrency } from "@/lib/financial-utils"

export default function AdminScannerPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user: currentUser } = useUser(auth)
  
  const [mode, setMode] = React.useState<'idle' | 'camera' | 'manual'>('idle')
  const [manualCode, setManualCode] = React.useState("")
  const [isValidating, setIsValidating] = React.useState(false)
  const [ticketData, setTicketData] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [occData, setOccData] = React.useState<any>(null)

  const scannerInstance = React.useRef<Html5Qrcode | null>(null)

  const startCamera = async () => {
    setMode('camera');
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerInstance.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 } }, 
          (decodedText) => {
            stopCamera();
            processScanResult(decodedText);
          }, 
          () => {}
        );
      } catch (err) {
        toast({ variant: "destructive", title: "Câmera bloqueada" });
        setMode('idle');
      }
    }, 300);
  }

  const stopCamera = async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try { await scannerInstance.current.stop(); scannerInstance.current.clear(); scannerInstance.current = null; } catch (e) {}
    }
  }

  const processScanResult = (decodedText: string) => {
    try {
      const data = JSON.parse(decodedText);
      // O QR Code Viby v3.0 envia 'reg' (document ID) e 'code' (ticketCode)
      validateTicket(data.code || data.reg || decodedText);
    } catch (e) {
      validateTicket(decodedText);
    }
  };

  const validateTicket = async (input: string) => {
    if (!db || !input) return
    setIsValidating(true); setError(null); setTicketData(null); setOccData(null);
    setMode('manual');

    const cleanInput = input.trim();

    try {
      // 1. Tentar busca por ID direto (mais rápido e preciso se disponível no QR)
      let targetDoc: any = null;
      if (cleanInput.length >= 20 && !cleanInput.includes('-')) {
        const docRef = doc(db, "registrations", cleanInput);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          targetDoc = { id: docSnap.id, ...docSnap.data() };
        }
      }

      // 2. Se não achou por ID, tenta busca por ticketCode (formato XXXX-XXXX-...)
      if (!targetDoc) {
        const q = query(collection(db, "registrations"), where("ticketCode", "==", cleanInput.toUpperCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }

      if (!targetDoc) {
        setError("Ingresso não encontrado ou código inválido.");
      } else {
        const isCancelled = targetDoc.status === 'cancelled' || targetDoc.status === 'refunded' || targetDoc.paymentStatus === 'refunded_wallet' || targetDoc.status === 'Cancelado';
        
        const now = new Date();
        let invalidTime = false;
        let windowInfo = { start: null as Date | null, end: null as Date | null };

        // Lógica de Janela de Tempo
        if (targetDoc.occurrenceId) {
           const oSnap = await getDoc(doc(db, "recurring_occurrences", targetDoc.occurrenceId));
           if (oSnap.exists()) {
              const occ = oSnap.data();
              setOccData(occ);
              const startDateTime = new Date(`${occ.date}T${occ.startTime}:00`);
              let endDateTime = new Date(`${occ.date}T${occ.endTime}:00`);
              if (occ.endTime <= occ.startTime) endDateTime.setDate(endDateTime.getDate() + 1);
              windowInfo = { start: startDateTime, end: endDateTime };
              // Adicionamos uma margem de 1h antes para check-in antecipado
              if (now < new Date(startDateTime.getTime() - 3600000) || now > endDateTime) invalidTime = true;
           }
        } else {
           const eSnap = await getDoc(doc(db, "events", targetDoc.eventId));
           if (eSnap.exists()) {
              const ev = eSnap.data();
              const startDateTime = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date);
              const endDateTime = ev.endDate?.toDate ? ev.endDate.toDate() : (ev.endDate ? new Date(ev.endDate) : new Date(startDateTime.getTime() + 4 * 60 * 60 * 1000));
              windowInfo = { start: startDateTime, end: endDateTime };
              if (now < new Date(startDateTime.getTime() - 3600000) || now > endDateTime) invalidTime = true;
           }
        }

        setTicketData({ 
          ...targetDoc, 
          isCancelled, 
          invalidTime,
          windowInfo 
        })
      }
    } catch (err) {
      setError("Falha técnica na consulta.");
    } finally { setIsValidating(false) }
  }

  const handleConfirmCheckIn = async () => {
    if (!db || !ticketData || !currentUser) return
    setIsValidating(true)
    
    try {
      const regRef = doc(db, "registrations", ticketData.id)
      
      await runTransaction(db, async (transaction) => {
        const regSnap = await transaction.get(regRef)
        if (!regSnap.exists()) throw new Error("Registro de ingresso não localizado.")
        const currentData = regSnap.data()
        
        if (currentData.checkedIn) throw new Error("ESTE INGRESSO JÁ FOI UTILIZADO.")
        if (currentData.status === 'cancelled' || currentData.status === 'refunded') throw new Error("INGRESSO INVÁLIDO: Cancelado ou estornado.")

        transaction.update(regRef, {
          checkedIn: true,
          checkedInAt: serverTimestamp(),
          checkedInBy: currentUser.uid,
          status: "Utilizado",
          updatedAt: serverTimestamp()
        })
      })

      await processGamificationEvent(db, ticketData.userId, 'on_checkin', { eventTitle: ticketData.eventTitle }, ticketData.id);
      
      setTicketData({ ...ticketData, checkedIn: true })
      toast({ title: "Check-in realizado com sucesso!" })
    } catch (err: any) { 
      setError(err.message)
      toast({ variant: "destructive", title: "Falha na validação", description: err.message }) 
    }
    finally { setIsValidating(false) }
  }

  const resetScanner = () => { stopCamera(); setMode('idle'); setTicketData(null); setError(null); setManualCode(""); setOccData(null); }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 invisible-scrollbar">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Validação</h1>
        </div>
        <Button variant="outline" size="sm" onClick={resetScanner} className="rounded-full gap-2 font-bold text-xs uppercase"><RefreshCw className="w-4 h-4" /> Reset</Button>
      </div>

      {mode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          <Card className="hover:border-secondary transition-all cursor-pointer group rounded-[2.5rem] bg-white border-none shadow-sm" onClick={startCamera}>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6"><div className="p-8 bg-secondary/10 rounded-full group-hover:bg-secondary group-hover:text-white transition-all"><Camera className="w-12 h-12" /></div><h3 className="font-black text-xl uppercase italic tracking-tighter text-center">Usar Câmera</h3></CardContent>
          </Card>
          <Card className="hover:border-secondary transition-all cursor-pointer group rounded-[2.5rem] bg-white border-none shadow-sm" onClick={() => setMode('manual')}>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6"><div className="p-8 bg-primary/5 rounded-full group-hover:bg-primary group-hover:text-white transition-all"><Keyboard className="w-12 h-12" /></div><h3 className="font-black text-xl uppercase italic tracking-tighter text-center">Entrada Manual</h3></CardContent>
          </Card>
        </div>
      )}

      {mode === 'camera' && (
        <Card className="overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-white mx-4"><div id="reader" className="w-full bg-black aspect-square"></div><Button variant="ghost" className="w-full h-16 font-black uppercase text-muted-foreground" onClick={resetScanner}>Cancelar</Button></Card>
      )}

      {mode === 'manual' && !ticketData && !error && (
        <Card className="mx-4 border-none shadow-sm rounded-[2.5rem] bg-white">
          <CardHeader className="p-8"><CardTitle className="text-xl font-black italic uppercase">Entrada Manual</CardTitle></CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <Input placeholder="CÓDIGO DE 16 DÍGITOS" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} className="font-mono text-xl h-16 text-center rounded-2xl" />
            <Button className="w-full bg-secondary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic" onClick={() => validateTicket(manualCode)} disabled={isValidating}>Validar</Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mx-4 border-destructive bg-destructive/5 rounded-[2.5rem] p-12 flex flex-col items-center text-center gap-6">
          <XCircle className="w-20 h-20 text-destructive" /><h3 className="font-black text-2xl uppercase italic">Erro de Validação</h3><p className="text-sm font-bold text-destructive uppercase">{error}</p>
          <Button variant="outline" onClick={resetScanner} className="rounded-xl border-destructive text-destructive uppercase text-xs font-black">Tentar outro ingresso</Button>
        </Card>
      )}

      {ticketData && (
        <div className="px-4">
           {ticketData.isCancelled && (
             <Card className="border-none shadow-2xl rounded-[3rem] bg-destructive text-white p-12 text-center space-y-6">
                <XCircle className="w-20 h-20 mx-auto opacity-40" />
                <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Ingresso Inválido</h2>
                <p className="font-medium opacity-80">Este ticket foi invalidado por estorno ou cancelamento.</p>
                <Button variant="outline" onClick={resetScanner} className="border-white text-white hover:bg-white hover:text-destructive rounded-xl">Novo Scan</Button>
             </Card>
           )}

           {!ticketData.isCancelled && (
             <Card className={cn("overflow-hidden shadow-2xl rounded-[2.5rem] border-none bg-white", ticketData.checkedIn ? "ring-4 ring-orange-500/20" : "ring-4 ring-green-500/20")}>
               <CardHeader className={cn("p-8", ticketData.checkedIn ? "bg-orange-500 text-white" : "bg-green-500 text-white")}>
                  <CardTitle className="font-black italic uppercase text-2xl flex items-center gap-3">
                     {ticketData.checkedIn ? <ShieldAlert /> : <CheckCircle2 />}
                     {ticketData.checkedIn ? "JÁ UTILIZADO" : "INGRESSO VÁLIDO"}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  {ticketData.invalidTime && !ticketData.checkedIn && (
                     <div className="p-4 bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl flex items-start gap-4">
                        <Clock className="w-6 h-6 text-orange-600 shrink-0 mt-1" />
                        <div className="space-y-1">
                           <p className="font-black uppercase text-[10px] text-orange-800">Fora do Horário Sugerido</p>
                           <p className="text-[10px] font-medium text-orange-700 uppercase">Validade esperada: {ticketData.windowInfo.start?.toLocaleString('pt-BR')} às {ticketData.windowInfo.end?.toLocaleTimeString('pt-BR')}</p>
                        </div>
                     </div>
                  )}

                  <div className="space-y-6">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center"><User className="w-6 h-6 text-secondary" /></div>
                        <div><p className="text-[10px] font-black uppercase opacity-40">Participante</p><p className="font-black text-xl text-primary uppercase italic">{ticketData.userName}</p></div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center"><Calendar className="w-6 h-6 text-secondary" /></div>
                        <div><p className="text-[10px] font-black uppercase opacity-40">Evento</p><p className="font-bold text-sm uppercase">{ticketData.eventTitle}</p></div>
                     </div>
                  </div>
                  {!ticketData.checkedIn && (
                    <Button onClick={handleConfirmCheckIn} disabled={isValidating} className="w-full bg-green-600 hover:bg-green-700 text-white font-black h-24 text-2xl rounded-[2rem] shadow-xl uppercase italic">
                       {isValidating ? <Loader2 className="animate-spin" /> : "LIBERAR ACESSO"}
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full h-12 font-black text-muted-foreground uppercase text-[10px]" onClick={resetScanner}>Voltar / Novo Scan</Button>
               </CardContent>
             </Card>
           )}
        </div>
      )}
    </div>
  )
}
