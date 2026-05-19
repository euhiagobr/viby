
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
  AlertCircle,
  MessageCircle,
  Paperclip,
  FileText
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function TicketDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const ticketId = params.id as string

  const ticketRef = React.useMemo(() => db ? doc(db, "support_tickets", ticketId) : null, [db, ticketId])
  const { data: ticket, loading } = useDoc<any>(ticketRef)

  const [newMessage, setNewMessage] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !ticketRef || !newMessage.trim()) return

    setIsSending(true)
    const messageObj = {
      senderId: user.uid,
      senderName: user.displayName || "Usuário",
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isAdmin: false
    }

    try {
      await updateDoc(ticketRef, {
        messages: arrayUnion(messageObj),
        updatedAt: serverTimestamp(),
        status: "Em tratamento" // Opcional: mudar status ao usuário responder
      })
      setNewMessage("")
      toast({ title: "Mensagem enviada!" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao enviar" })
    } finally {
      setIsSending(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!ticket) return null

  // Regras de negócio solicitadas
  const isLocked = ticket.status === 'Não lida'
  const isClosed = ticket.status === 'Encerrada'
  const canReply = ticket.status === 'Respondida' || ticket.status === 'Em tratamento'

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Não lida': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Aguardando Visualização</Badge>
      case 'Em tratamento': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Em Análise</Badge>
      case 'Respondida': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Aguardando sua Resposta</Badge>
      case 'Encerrada': return <Badge variant="secondary" className="opacity-50">Finalizado</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase italic text-primary">Ticket #{ticket.protocol}</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Status: {ticket.status}</p>
        </div>
        <div className="ml-auto">
          {getStatusBadge(ticket.status)}
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-xl font-bold">{ticket.subject}</CardTitle>
          <CardDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Aberto em {ticket.createdAt?.toDate?.()?.toLocaleString('pt-BR')}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="p-4 bg-muted/20 rounded-2xl border border-border/50">
            <p className="text-sm leading-relaxed whitespace-pre-line">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed border-border/50 flex flex-wrap gap-2">
                {ticket.attachments.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border hover:border-secondary transition-colors text-[10px] font-bold uppercase">
                    <Paperclip className="w-3 h-3 text-secondary" /> Anexo #{i+1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Histórico de Mensagens
            </h3>
            
            <div className="space-y-4">
              {ticket.messages?.length > 0 ? (
                ticket.messages.map((msg: any, i: number) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[80%] gap-1",
                    msg.isAdmin ? "mr-auto" : "ml-auto items-end"
                  )}>
                    <div className={cn(
                      "p-4 rounded-2xl text-sm",
                      msg.isAdmin ? "bg-secondary/10 text-foreground rounded-tl-none" : "bg-primary text-white rounded-tr-none"
                    )}>
                      <div className="flex items-center gap-2 mb-1.5 opacity-60 text-[10px] font-black uppercase">
                        {msg.isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {msg.senderName}
                      </div>
                      {msg.text}
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">
                      {new Date(msg.timestamp).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 opacity-30">
                  <p className="text-xs font-bold uppercase tracking-widest">Nenhuma interação registrada ainda.</p>
                </div>
              )}
            </div>
          </div>

          {canReply && !isClosed && (
            <form onSubmit={handleSendMessage} className="pt-6 border-t border-dashed border-border space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Sua Resposta</Label>
                <Textarea 
                  placeholder="Digite sua mensagem aqui..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="rounded-2xl border-secondary/20 min-h-[100px]"
                  required
                />
              </div>
              <Button type="submit" disabled={isSending || !newMessage.trim()} className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-lg uppercase italic">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar Resposta
              </Button>
            </form>
          )}

          {isLocked && (
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <p className="text-xs font-medium text-orange-800">Aguarde a primeira resposta da nossa equipe para poder enviar novas mensagens.</p>
            </div>
          )}

          {isClosed && (
            <div className="p-4 bg-muted border border-border/50 rounded-2xl flex items-center justify-center gap-3 grayscale">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Este ticket foi encerrado e não permite novas respostas.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
