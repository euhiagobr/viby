"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
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
  X,
  FileText,
  History
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

const MAX_SUPPORT_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default function TicketDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const app = useFirebaseApp()
  const { user } = useUser(auth)
  const ticketId = params.id as string

  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app])
  const ticketRef = React.useMemo(() => db ? doc(db, "support_tickets", ticketId) : null, [db, ticketId])
  const { data: ticket, loading } = useDoc<any>(ticketRef)

  const [newMessage, setNewMessage] = React.useState("")
  const [attachments, setAttachments] = React.useState<string[]>([])
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [isSending, setIsSending] = React.useState(false)

  // Atualização automática de status se o ticket estiver respondido
  React.useEffect(() => {
    if (db && ticket && ticket.status === 'Respondida' && !loading) {
      updateDoc(doc(db, "support_tickets", ticket.id), {
        status: "Em tratamento",
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
  }, [db, ticket, loading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user || !auth) return;

    if (!auth.currentUser) {
       toast({ variant: "destructive", title: "Sincronizando...", description: "Aguarde um instante para que sua sessão seja validada." });
       return;
    }

    if (attachments.length >= MAX_SUPPORT_FILES) {
      toast({ variant: "destructive", title: "Limite atingido", description: `Você pode enviar no máximo ${MAX_SUPPORT_FILES} arquivos.` });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ variant: "destructive", title: "Arquivo muito grande", description: "O limite é de 5MB por arquivo." });
      return;
    }

    setUploadProgress(0)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filePath = `support/${user.uid}/replies/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload Error:", error);
          setUploadProgress(null);
          toast({ variant: "destructive", title: "Erro no upload", description: error.message });
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setAttachments(prev => [...prev, url]);
            setUploadProgress(null);
            toast({ title: "Arquivo anexado!" });
          } catch (urlErr: any) {
             setUploadProgress(null);
          }
        }
      )
    } catch (err: any) {
      setUploadProgress(null);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !ticketRef) return
    if (!newMessage.trim() && attachments.length === 0) return;

    setIsSending(true)
    const messageObj = {
      senderId: user.uid,
      senderName: user.displayName || "Usuário",
      text: newMessage.trim(),
      attachments: attachments,
      timestamp: new Date().toISOString(),
      isAdmin: false
    }

    const updateData = {
      messages: arrayUnion(messageObj),
      updatedAt: serverTimestamp(),
      status: "Em tratamento"
    };

    updateDoc(ticketRef, updateData)
      .then(() => {
        setNewMessage("")
        setAttachments([])
        toast({ title: "Mensagem enviada!" })
      })
      .catch(async (error) => {
        if (error.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ticketRef.path, operation: "update", requestResourceData: updateData }));
        }
      })
      .finally(() => setIsSending(false))
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!ticket) return null

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-black uppercase italic text-primary">Ticket #{ticket.protocol}</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Aberto em {ticket.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || 'agora'}</p>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-8">
           <div className="flex justify-between items-start">
              <CardTitle className="text-xl font-bold tracking-tight">{ticket.subject}</CardTitle>
              <Badge className={cn(
                "font-black uppercase text-[9px] px-3 h-6",
                ticket.status === 'Não lida' ? "bg-orange-50 text-orange-600 border-orange-200" :
                ticket.status === 'Respondida' ? "bg-green-600 text-white" :
                ticket.status === 'Encerrada' ? "bg-muted text-muted-foreground" :
                "bg-blue-600 text-white"
              )}>
                {ticket.status}
              </Badge>
           </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
           {/* Descrição Inicial */}
           <div className="p-6 bg-muted/20 rounded-[1.5rem] border space-y-4">
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{ticket.description}</p>
              {ticket.attachments?.length > 0 && (
                <div className="pt-4 border-t border-dashed border-border/40 flex flex-wrap gap-2">
                  {ticket.attachments.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" className="flex items-center gap-2 p-2.5 bg-white rounded-xl border text-[9px] font-black uppercase hover:bg-muted transition-colors">
                      <Paperclip className="w-3 h-3 text-secondary" /> Anexo #{i+1}
                    </a>
                  ))}
                </div>
              )}
           </div>
           
           {/* Mensagens (Chat) */}
           <div className="space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <History className="w-4 h-4" /> Histórico de Conversa
              </h3>
              
              <div className="space-y-6">
                {ticket.messages?.map((msg: any, i: number) => (
                  <div key={i} className={cn("flex flex-col max-w-[85%] gap-2", msg.isAdmin ? "mr-auto" : "ml-auto items-end")}>
                    <div className={cn(
                      "p-5 rounded-[1.5rem] text-sm shadow-sm",
                      msg.isAdmin ? "bg-muted rounded-tl-none" : "bg-primary text-white rounded-tr-none"
                    )}>
                      <div className="flex items-center gap-2 mb-2 opacity-70 text-[9px] font-black uppercase">
                        {msg.isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        {msg.senderName}
                      </div>
                      <p className="leading-relaxed">{msg.text}</p>
                      {msg.attachments?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                          {msg.attachments.map((url: string, idx: number) => (
                            <a key={idx} href={url} target="_blank" className={cn(
                              "flex items-center gap-1.5 p-2 rounded-xl text-[8px] font-black uppercase border transition-all",
                              msg.isAdmin ? "bg-white border-border text-primary hover:bg-muted" : "bg-white/10 border-white/10 text-white hover:bg-white/20"
                            )}>
                              <Paperclip className="w-3 h-3" /> Ver Anexo
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
           </div>

           {/* Formulário de Resposta */}
           {ticket.status !== 'Encerrada' && (
             <form onSubmit={handleSendMessage} className="pt-8 border-t border-dashed space-y-6">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nova Mensagem</Label>
                 <Textarea 
                   placeholder="Digite sua dúvida ou resposta aqui..." 
                   value={newMessage} 
                   onChange={(e) => setNewMessage(e.target.value)} 
                   className="rounded-[1.5rem] min-h-[120px]" 
                 />
               </div>
               
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Anexos ({attachments.length}/{MAX_SUPPORT_FILES})</Label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl bg-muted border overflow-hidden shadow-sm group">
                        {url.includes('.pdf') ? (
                          <div className="flex items-center justify-center h-full"><FileText className="w-8 h-8 text-secondary" /></div>
                        ) : (
                          <img src={url} className="w-full h-full object-cover" alt="Anexo" />
                        )}
                        <button 
                          type="button" 
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} 
                          className="absolute top-0 right-0 bg-destructive text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {attachments.length < MAX_SUPPORT_FILES && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-secondary/20 flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/5 transition-all text-secondary">
                        <Paperclip className="w-6 h-6 mb-1 opacity-40" />
                        <span className="text-[7px] font-black uppercase">Anexar</span>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploadProgress !== null} />
                      </label>
                    )}
                  </div>
                  {uploadProgress !== null && (
                    <div className="space-y-1.5">
                       <Progress value={uploadProgress} className="h-1" />
                       <p className="text-[8px] font-black uppercase text-secondary">Subindo arquivo: {Math.round(uploadProgress)}%</p>
                    </div>
                  )}
               </div>

               <Button 
                type="submit" 
                disabled={isSending || (newMessage.trim() === "" && attachments.length === 0) || uploadProgress !== null} 
                className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform"
               >
                 {isSending ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                 Enviar Mensagem
               </Button>
             </form>
           )}
        </CardContent>
      </Card>
    </div>
  )
}
