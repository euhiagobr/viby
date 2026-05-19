
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
  Lock
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const [isSending, setIsSending] = React.useState(false)

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !ticketRef || !response.trim()) return

    setIsSending(true)
    const messageObj = {
      senderId: user.uid,
      senderName: "Suporte Viby",
      text: response.trim(),
      timestamp: new Date().toISOString(),
      isAdmin: true
    }

    try {
      await updateDoc(ticketRef, {
        messages: arrayUnion(messageObj),
        updatedAt: serverTimestamp(),
        status: "Respondida"
      })
      setResponse("")
      toast({ title: "Resposta enviada!" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao responder" })
    } finally {
      setIsSending(false)
    }
  }

  const handleCloseTicket = async () => {
    if (!db || !ticketRef) return
    if (!confirm("Tem certeza que deseja encerrar este ticket? O usuário não poderá mais responder.")) return

    try {
      await updateDoc(ticketRef, {
        status: "Encerrada",
        updatedAt: serverTimestamp()
      })
      toast({ title: "Ticket encerrado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao encerrar" })
    }
  }

  const handleSetInProgress = async () => {
    if (!db || !ticketRef) return
    await updateDoc(ticketRef, { status: "Em tratamento" })
    toast({ title: "Status atualizado" })
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!ticket) return null

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Ticket #{ticket.protocol}</h1>
            <p className="text-sm text-muted-foreground">Usuário: {ticket.userName} ({ticket.userEmail})</p>
          </div>
        </div>
        <div className="flex gap-2">
          {ticket.status !== 'Encerrada' && (
             <>
               {ticket.status !== 'Em tratamento' && (
                 <Button variant="outline" size="sm" onClick={handleSetInProgress} className="rounded-full">Mover para Análise</Button>
               )}
               <Button variant="destructive" size="sm" onClick={handleCloseTicket} className="rounded-full gap-2">
                 <Lock className="w-3.5 h-3.5" /> Encerrar
               </Button>
             </>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex justify-between items-start">
             <CardTitle className="text-xl font-bold">{ticket.subject}</CardTitle>
             <Badge className={cn(
               ticket.status === 'Não lida' ? "bg-orange-500" :
               ticket.status === 'Respondida' ? "bg-green-500" : "bg-muted"
             )}>
               {ticket.status}
             </Badge>
          </div>
          <CardDescription>Aberto em {ticket.createdAt?.toDate?.()?.toLocaleString('pt-BR')}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="p-4 bg-muted/20 rounded-xl border">
            <p className="text-sm leading-relaxed whitespace-pre-line">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed flex flex-wrap gap-2">
                {ticket.attachments.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" className="flex items-center gap-2 p-2 bg-white rounded-lg border text-[10px] font-bold">
                    <Paperclip className="w-3 h-3" /> Ver Anexo {i+1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Histórico de Interação
            </h3>
            
            <div className="space-y-4">
              {ticket.messages?.map((msg: any, i: number) => (
                <div key={i} className={cn(
                  "flex flex-col max-w-[80%] gap-1",
                  msg.isAdmin ? "ml-auto items-end" : "mr-auto"
                )}>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm",
                    msg.isAdmin ? "bg-secondary text-white rounded-tr-none" : "bg-muted rounded-tl-none"
                  )}>
                    <div className="flex items-center gap-2 mb-1.5 opacity-60 text-[10px] font-black">
                      {msg.isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {msg.senderName}
                    </div>
                    {msg.text}
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{new Date(msg.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {ticket.status !== 'Encerrada' && (
            <form onSubmit={handleSendResponse} className="pt-6 border-t space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Resposta Oficial</Label>
              <Textarea 
                placeholder="Responda ao usuário..." 
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="rounded-xl min-h-[120px]"
                required
              />
              <Button type="submit" disabled={isSending || !response.trim()} className="w-full bg-secondary text-white font-bold h-12 rounded-xl">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar Resposta para Usuário
              </Button>
            </form>
          )}

          {ticket.status === 'Encerrada' && (
             <div className="p-8 text-center bg-muted/50 rounded-2xl border-2 border-dashed">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ticket Encerrado. Nenhuma ação adicional necessária.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
