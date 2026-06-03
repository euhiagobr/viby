"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from "firebase/firestore"
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
  Clock,
  ShieldAlert,
  Lock,
  Search,
  Inbox
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { processGamificationEvent } from "@/lib/gamification-service"

/**
 * Utilitário robusto para converter inputs de data/hora em objeto Date LOCAL.
 */
function parseToLocalDate(dateInput: any, timeInput?: string) {
  if (!dateInput) return new Date();
  if (dateInput?.toDate) return dateInput.toDate();
  if (dateInput instanceof Date) return dateInput;

  const dateStr = String(dateInput);
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    const finalTime = timeInput || "00:00";
    const [hours, minutes] = finalTime.split(':').map(Number);
    const d = new Date(year, month - 1, day, hours, minutes);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date(dateStr);
}

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

  const stopCamera = React.useCallback(async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try { 
        await scannerInstance.current.stop(); 
        scannerInstance.current.clear(); 
        scannerInstance.current = null; 
      } catch (e) {
        console.warn("Erro ao parar câmera:", e);
      }
    }
  }, []);

  const startCamera = async () => {
    setMode('camera');
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerInstance.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 15, qrbox: { width: 250, height: 250 } }, 
          (decodedText) => {
            stopCamera();
            processScanResult(decodedText);
          }, 
          () => {} 
        );
      } catch (err) {
        console.error("Câmera erro:", err);
        toast({ variant: "destructive", title: "Câmera bloqueada", description: "Verifique as permissões do seu navegador." });
        setMode('idle');
      }
    }, 100);
  }

  const validateTicket = async (input: string) => {
    if (!db || !input) return
    
    setIsValidating(true); 
    setError(null); 
    setTicketData(null);
    setMode('manual');

    const cleanInput = input.trim().toUpperCase();

    try {
      // BUSCA PELO CAMPO ticketCode (Regra: Busca por query indexada em ticketCode)
      const q = query(collection(db, "registrations"), where("ticketCode", "==", cleanInput));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("Ingresso inválido");
      } else {
        const targetDoc = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

        // VALIDAÇÕES DE STATUS
        if (targetDoc.status === 'cancelled' || targetDoc.status === 'refunded' || targetDoc.status === 'Cancelado') {
           setError("Ingresso cancelado");
        } else if (targetDoc.status === 'used' || targetDoc.checkedIn === true) {
           setTicketData({ ...targetDoc, alreadyUsed: true });
        } else {
           // Validar Janela de Horário (2h antes)
           const now = new Date();
           const eventStart = parseToLocalDate(targetDoc.eventDate, targetDoc.startTime || "00:00");
           const windowStart = new Date(eventStart.getTime() - (2 * 60 * 60 * 1000));
           
           if (now < windowStart) {
             setTicketData({ ...targetDoc, outsideWindow: true, windowStart });
           } else {
             setTicketData(targetDoc);
           }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Falha técnica na consulta. Tente novamente.");
    } finally { 
      setIsValidating(false); 
    }
  }

  const processScanResult = (decodedText: string) => {
    // O QR Code agora deve conter APENAS o ticketCode string
    validateTicket(decodedText);
  };

  const handleConfirmCheckIn = async () => {
    if (!db || !ticketData || !currentUser || isValidating) return
    setIsValidating(true)
    
    try {
      const regRef = doc(db, "registrations", ticketData.id)
      const nowLocal = new Date()

      await runTransaction(db, async (transaction) => {
        const regSnap = await transaction.get(regRef)
        if (!regSnap.exists()) throw new Error("Ingresso inválido")
        const currentData = regSnap.data()
        
        if (currentData.checkedIn || currentData.status === 'used') throw new Error("Ingresso já utilizado")
        if (currentData.status === 'cancelled' || currentData.status === 'refunded') throw new Error("Ingresso cancelado")

        transaction.update(regRef, {
          checkedIn: true,
          checkedInAt: serverTimestamp(),
          checkedInBy: currentUser.uid,
          status: "used", // Novo padrão solicitado
          updatedAt: serverTimestamp()
        })
      })

      processGamificationEvent(db, ticketData.userId, 'on_checkin', { eventTitle: ticketData.eventTitle }, ticketData.id);
      
      setTicketData({ ...ticketData, status: 'used', checkedIn: true, checkedInAt: nowLocal })
      toast({ title: "Acesso Liberado!", description: "Check-in realizado para " + ticketData.userName });
    } catch (err: any) { 
      setError(err.message)
    }
    finally { 
      setIsValidating(false) 
    }
  }

  const resetScanner = () => { 
    stopCamera(); 
    setMode('idle'); 
    setTicketData(null); 
    setError(null); 
    setManualCode(""); 
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 pt-10 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/admin"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Validar Acesso</h1>
        </div>
        <Button variant="outline" size="sm" onClick={resetScanner} className="rounded-full gap-2 font-bold text-[10px] uppercase border-secondary text-secondary">
           <RefreshCw className="w-3.5 h-3.5" /> Reiniciar
        </Button>
      </div>

      {mode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:border-secondary transition-all cursor-pointer group rounded-[2.5rem] bg-white border-none shadow-sm" onClick={startCamera}>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6"><div className="p-8 bg-secondary/10 rounded-full group-hover:bg-secondary group-hover:text-white transition-all"><Camera className="w-12 h-12" /></div><h3 className="font-black text-xl uppercase italic tracking-tighter text-center">Usar Câmera</h3></CardContent>
          </Card>
          <Card className="hover:border-secondary transition-all cursor-pointer group rounded-[2.5rem] bg-white border-none shadow-sm" onClick={() => setMode('manual')}>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6"><div className="p-8 bg-primary/5 rounded-full group-hover:bg-primary group-hover:text-white transition-all"><Keyboard className="w-12 h-12" /></div><h3 className="font-black text-xl uppercase italic tracking-tighter text-center">Entrada Manual</h3></CardContent>
          </Card>
        </div>
      )}

      {mode === 'camera' && (
        <Card className="overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-white">
          <div id="reader" className="w-full bg-black aspect-square"></div>
          <Button variant="ghost" className="w-full h-16 font-black uppercase text-muted-foreground" onClick={resetScanner}>Cancelar Leitura</Button>
        </Card>
      )}

      {mode === 'manual' && !ticketData && !error && (
        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white">
          <CardHeader className="p-8"><CardTitle className="text-xl font-black italic uppercase">Consulta de Código</CardTitle></CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <Input 
              placeholder="XXXX-XXXX-XXXX-XXXX" 
              value={manualCode} 
              onChange={(e) => setManualCode(e.target.value.toUpperCase())} 
              className="font-mono text-xl h-16 text-center rounded-2xl border-dashed border-secondary/30" 
              onKeyDown={(e) => e.key === 'Enter' && validateTicket(manualCode)}
            />
            <Button className="w-full bg-secondary text-white font-black h-16 rounded-2xl shadow-xl uppercase italic" onClick={() => validateTicket(manualCode)} disabled={isValidating}>
              {isValidating ? <Loader2 className="animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
              Localizar Ingresso
            </Button>
          </CardContent>
        </Card>
      )}

      {isValidating && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <Loader2 className="w-12 h-12 animate-spin text-secondary" />
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando com a rede...</p>
        </div>
      )}

      {error && (
        <Card className="border-destructive bg-red-50/50 rounded-[2.5rem] p-12 flex flex-col items-center text-center gap-6 animate-in zoom-in-95">
          <XCircle className="w-20 h-20 text-destructive" />
          <h3 className="font-black text-2xl uppercase italic text-destructive">ERRO: {error}</h3>
          <Button variant="outline" onClick={resetScanner} className="rounded-xl border-destructive text-destructive uppercase text-xs font-black h-12 px-8">Tentar Novamente</Button>
        </Card>
      )}

      {ticketData && (
        <div className="animate-in zoom-in-95 duration-300">
           {ticketData.alreadyUsed ? (
             <Card className="border-none shadow-2xl rounded-[3rem] bg-orange-500 text-white p-12 text-center space-y-6">
                <ShieldAlert className="w-20 h-20 mx-auto opacity-40" />
                <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Acesso Negado</h2>
                <p className="font-bold text-xs uppercase">Ingresso já utilizado anteriormente.</p>
                <div className="bg-white/10 p-4 rounded-2xl text-[10px] font-black uppercase">
                   Validado em: {new Date(ticketData.checkedInAt?.toDate?.() || ticketData.checkedInAt).toLocaleString('pt-BR')}
                </div>
                <Button variant="outline" onClick={resetScanner} className="border-white text-white hover:bg-white hover:text-orange-500 rounded-xl h-12 px-8 font-black uppercase">Voltar</Button>
             </Card>
           ) : (
             <Card className={cn(
               "overflow-hidden shadow-2xl rounded-[2.5rem] border-none bg-white",
               ticketData.status === 'used' ? "ring-4 ring-orange-500/20" : "ring-4 ring-green-500/20"
             )}>
               <CardHeader className={cn("p-8", ticketData.status === 'used' ? "bg-orange-500 text-white" : "bg-green-600 text-white")}>
                  <CardTitle className="font-black italic uppercase text-2xl flex items-center gap-3">
                     {ticketData.status === 'used' ? <ShieldAlert /> : <CheckCircle2 />}
                     {ticketData.status === 'used' ? "JÁ UTILIZADO" : "INGRESSO ATIVO"}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-10 space-y-8">
                  {ticketData.outsideWindow && (
                     <div className="p-4 bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl flex items-start gap-4">
                        <Clock className="w-6 h-6 text-orange-600 shrink-0 mt-1" />
                        <div className="space-y-1">
                           <p className="font-black uppercase text-[10px] text-orange-800">Fora da Janela Oficial</p>
                           <p className="text-[9px] font-medium text-orange-700 uppercase">Check-in disponível a partir de: {ticketData.windowStart?.toLocaleString('pt-BR')}</p>
                        </div>
                     </div>
                  )}

                  <div className="space-y-6">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-secondary"><User className="w-6 h-6" /></div>
                        <div><p className="text-[10px] font-black uppercase opacity-40">Participante</p><p className="font-black text-xl text-primary uppercase italic truncate max-w-[300px]">{ticketData.userName}</p></div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-secondary"><Calendar className="w-6 h-6" /></div>
                        <div><p className="text-[10px] font-black uppercase opacity-40">Experiência / Lote</p><p className="font-bold text-sm uppercase truncate max-w-[300px]">{ticketData.eventTitle} <span className="text-secondary opacity-60">({ticketData.batchName})</span></p></div>
                     </div>
                  </div>

                  {ticketData.status !== 'used' ? (
                    <Button onClick={handleConfirmCheckIn} disabled={isValidating} className="w-full bg-green-600 hover:bg-green-700 text-white font-black h-24 text-2xl rounded-[2rem] shadow-xl uppercase italic transition-all active:scale-95">
                       {isValidating ? <Loader2 className="animate-spin" /> : "LIBERAR ENTRADA"}
                    </Button>
                  ) : (
                    <div className="p-6 bg-muted/30 rounded-2xl border-2 border-dashed border-border/60 text-center space-y-2">
                       <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Check-in realizado em</p>
                       <p className="font-bold text-sm text-primary">{new Date(ticketData.checkedInAt).toLocaleString('pt-BR')}</p>
                       <Separator className="border-dashed" />
                       <p className="text-[8px] font-black uppercase text-orange-600 italic tracking-widest">NÃO PODE SER USADO NOVAMENTE</p>
                    </div>
                  )}
                  <Button variant="ghost" className="w-full h-12 font-black text-muted-foreground uppercase text-[10px] hover:bg-muted/50 rounded-xl" onClick={resetScanner}>Voltar / Novo Scan</Button>
               </CardContent>
             </Card>
           )}
        </div>
      )}
    </div>
  )
}
