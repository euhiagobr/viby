"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  ArrowLeft, 
  Loader2, 
  Send, 
  Clock, 
  User, 
  ShieldCheck, 
  MessageCircle,
  Paperclip,
  CheckCircle2,
  Lock,
  History
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function AdminTicketResponsePage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const ticketId = params.id as string

  const ticketRef = React.useMemo(() => db ? doc(db, "support_tickets", ticketId) : null, [db, ticketId])
  const { data: ticket, loading } = useDoc<any>(ticketRef)

  const [response, setResponse] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !ticketRef || !response.trim()) return

    setIsSubmitting(true)
    const messageObj = {
      senderId: user.uid,
      senderName: "Suporte Viby",
      text: response.trim(),
      timestamp: new Date().toISOString(),
      isAdmin: true
    }

    const updateData = {
      messages: arrayUnion(messageObj),
      updatedAt: serverTimestamp(),
      status: "Respondida"
    }

    updateDoc(ticketRef, updateData)
      .then(() => {
        setResponse("")
        toast({ title: "Resposta enviada!" })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: ticketRef.path,
          operation: "update",
          requestResourceData: updateData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleCloseTicket = async () => {
    if (!db || !ticketRef) return

    setIsSubmitting(true)
    const updateData = {
      status: "Encerrada",
      updatedAt: serverTimestamp()
    }

    updateDoc(ticketRef, updateData)
      .then(() => {
        toast({ title: "Ticket encerrado com sucesso!" })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: ticketRef.path,
          operation: "update",
          requestResourceData: updateData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleSetInProgress = () => {
    if (!db || !ticketRef) return
    
    setIsSubmitting(true)
    const updateData = { 
      status: "Em tratamento",
      updatedAt: serverTimestamp()
    }

    updateDoc(ticketRef, updateData)
      .then(() => {
        toast({ title: "Status atualizado para análise." })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: ticketRef.path,
          operation: "update",
          requestResourceData: updateData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!ticket) return null

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Ticket #{ticket.protocol}</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              Usuário: {ticket.userName} ({ticket.userEmail})
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {ticket.status !== 'Encerrada' && (
             <>
               {ticket.status !== 'Em tratamento' && (
                 <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={handleSetInProgress} 
                   className="rounded-full font-bold text-xs"
                   disabled={isSubmitting}
                 >
                   {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
                   Mover para Análise
                 </Button>
               )}
               
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                   <Button 
                     variant="destructive" 
                     size="sm" 
                     className="rounded-full gap-2 font-bold text-xs"
                     disabled={isSubmitting}
                   >
                     {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                     Encerrar Chamado
                   </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent className="rounded-[2rem]">
                   <AlertDialogHeader>
                     <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Encerrar este ticket?</AlertDialogTitle>
                     <AlertDialogDescription>
                       Esta ação é irreversível. O usuário não poderá mais enviar mensagens neste protocolo e o histórico será arquivado.
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancelar</AlertDialogCancel>
                     <AlertDialogAction 
                       onClick={handleCloseTicket}
                       className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-destructive/90"
                     >
                       Confirmar Encerramento
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
             </>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 border-b p-8">
          <div className="flex justify-between items-start">
             <CardTitle className="text-2xl font-bold tracking-tight">{ticket.subject}</CardTitle>
             <Badge className={cn(
               "font-black uppercase text-[10px] px-3 py-1",
               ticket.status === 'Não lida' ? "bg-orange-50 text-orange-600 border-orange-200" :
               ticket.status === 'Respondida' ? "bg-green-500 text-white border-none" : "bg-muted"
             )}>
               {ticket.status}
             </Badge>
          </div>
          <CardDescription className="font-medium">
            Aberto em {ticket.createdAt?.toDate?.()?.toLocaleString('pt-BR')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="p-6 bg-muted/20 rounded-[1.5rem] border border-border/50">
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-dashed border-border/50 flex flex-wrap gap-2">
                {ticket.attachments.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-border hover:border-secondary transition-colors text-[10px] font-black uppercase tracking-tighter">
                    <Paperclip className="w-3.5 h-3.5 text-secondary" /> Ver Anexo #{i+1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4" /> Histórico de Interação
            </h3>
            
            <div className="space-y-6">
              {ticket.messages?.length > 0 ? (
                ticket.messages.map((msg: any, i: number) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[85%] gap-2",
                    msg.isAdmin ? "ml-auto items-end" : "mr-auto"
                  )}>
                    <div className={cn(
                      "p-5 rounded-[1.5rem] text-sm shadow-sm",
                      msg.isAdmin ? "bg-secondary text-white rounded-tr-none" : "bg-muted rounded-tl-none"
                    )}>
                      <div className="flex items-center gap-2 mb-2 opacity-70 text-[10px] font-black uppercase tracking-wider">
                        {msg.isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        {msg.senderName}
                      </div>
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2">
                      {new Date(msg.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center border-2 border-dashed border-border rounded-2xl opacity-40">
                  <p className="text-xs font-bold uppercase tracking-widest">Nenhuma resposta enviada ainda.</p>
                </div>
              )}
            </div>
          </div>

          {ticket.status !== 'Encerrada' && (
            <form onSubmit={handleSendResponse} className="pt-8 border-t border-dashed border-border space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resposta Oficial do Suporte</Label>
              <Textarea 
                placeholder="Digite a resposta que o usuário receberá..." 
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="rounded-[1.5rem] min-h-[150px] border-secondary/20 focus-visible:ring-secondary/30"
                required
              />
              <Button type="submit" disabled={isSubmitting || !response.trim()} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic tracking-tighter">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Enviar Resposta ao Usuário
              </Button>
            </form>
          )}

          {ticket.status === 'Encerrada' && (
             <div className="p-10 text-center bg-muted/30 rounded-[2rem] border-2 border-dashed border-border/50">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-4 opacity-50" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ticket Encerrado com Sucesso.</p>
                <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 uppercase">O histórico está arquivado para consultas futuras.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
