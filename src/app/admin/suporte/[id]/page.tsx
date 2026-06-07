
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useAuth, useUser, useFirebaseApp } from "@/firebase"
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
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
  History,
  X,
  FileText
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { sendSupportTicketResponseEmail } from "@/app/actions/email"

const MAX_SUPPORT_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default function AdminTicketResponsePage() {
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

  const [response, setResponse] = React.useState("")
  const [attachments, setAttachments] = React.useState<string[]>([])
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user || !auth) return;

    if (!auth.currentUser) {
       toast({ variant: "destructive", title: "Erro de Sessão", description: "Sua sessão de autenticação não foi reconhecida pelo Storage. Tente recarregar a página." });
       return;
    }

    if (attachments.length >= MAX_SUPPORT_FILES) {
      toast({ variant: "destructive", title: "Limite atingido", description: `Máximo de ${MAX_SUPPORT_FILES} arquivos permitidos.` });
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
          toast({ variant: "destructive", title: "Erro no upload", description: `Falha: ${error.code}` });
          setUploadProgress(null);
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

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !ticketRef || !ticket) return
    if (!response.trim() && attachments.length === 0) return;

    setIsSubmitting(true)
    const messageObj = {
      senderId: user.uid,
      senderName: "Suporte Viby",
      text: response.trim(),
      attachments: attachments,
      timestamp: new Date().toISOString(),
      isAdmin: true
    }

    const updateData = {
      messages: arrayUnion(messageObj),
      updatedAt: serverTimestamp(),
      status: "Respondida"
    }

    updateDoc(ticketRef, updateData)
      .then(async () => {
        // Envio de E-mail de Resposta para o usuário dono do ticket
        if (ticket.userEmail) {
          sendSupportTicketResponseEmail({
            to: ticket.userEmail,
            userName: ticket.userName || "Usuário",
            ticketNumber: ticket.protocol,
            lastReply: messageObj.text,
            ticketUrl: `https://viby.club/suporte/${ticket.id}`
          }).catch(err => console.warn("[Email Support] Failed to send reply notification", err));
        }

        setResponse("")
        setAttachments([])
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
    const updateData = { status: "Encerrada", updatedAt: serverTimestamp() }
    updateDoc(ticketRef, updateData)
      .then(() => toast({ title: "Ticket encerrado!" }))
      .catch(async (error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({ path: ticketRef.path, operation: "update", requestResourceData: updateData }))
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleSetInProgress = () => {
    if (!db || !ticketRef) return
    setIsSubmitting(true)
    const updateData = { status: "Em tratamento", updatedAt: serverTimestamp() }
    updateDoc(ticketRef, updateData)
      .then(() => toast({ title: "Status atualizado." }))
      .catch(async (error) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({ path: ticketRef.path, operation: "update", requestResourceData: updateData }))
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
                 <Button variant="outline" size="sm" onClick={handleSetInProgress} className="rounded-full font-bold text-xs" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
                   Mover para Análise
                 </Button>
               )}
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                   <Button variant="destructive" size="sm" className="rounded-full gap-2 font-bold text-xs" disabled={isSubmitting}>
                     {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                     Encerrar Chamado
                   </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent className="rounded-[2rem]">
                   <AlertDialogHeader>
                     <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Encerrar este ticket?</AlertDialogTitle>
                     <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
                     <AlertDialogAction onClick={handleCloseTicket} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px]">Confirmar Encerramento</AlertDialogAction>
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
             <Badge className={cn("font-black uppercase text-[10px] px-3 py-1", ticket.status === 'Não lida' ? "bg-orange-50 text-orange-600" : "bg-green-500 text-white")}>
               {ticket.status}
             </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="p-6 bg-muted/20 rounded-[1.5rem] border">
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-dashed flex flex-wrap gap-2">
                {ticket.attachments.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" className="flex items-center gap-2 p-3 bg-white rounded-xl border text-[10px] font-black uppercase">
                    <Paperclip className="w-3.5 h-3.5 text-secondary" /> Anexo #{i+1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><History className="w-4 h-4" /> Histórico</h3>
            <div className="space-y-6">
              {ticket.messages?.map((msg: any, i: number) => (
                <div key={i} className={cn("flex flex-col max-w-[85%] gap-2", msg.isAdmin ? "ml-auto items-end" : "mr-auto")}>
                  <div className={cn("p-5 rounded-[1.5rem] text-sm shadow-sm", msg.isAdmin ? "bg-secondary text-white rounded-tr-none" : "bg-muted rounded-tl-none")}>
                    <div className="flex items-center gap-2 mb-2 opacity-70 text-[10px] font-black uppercase">
                      {msg.isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      {msg.senderName}
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                    {msg.attachments?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.attachments.map((url: string, idx: number) => (
                          <a key={idx} href={url} target="_blank" className="flex items-center gap-1.5 p-2 bg-black/10 rounded-xl text-[9px] font-black uppercase border border-white/10 hover:bg-black/20">
                            <Paperclip className="w-3.5 h-3.5" /> Anexo
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {ticket.status !== 'Encerrada' && (
            <form onSubmit={handleSendResponse} className="pt-8 border-t border-dashed space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resposta Oficial</Label>
                <Textarea placeholder="Digite a resposta..." value={response} onChange={(e) => setResponse(e.target.value)} className="rounded-[1.5rem] min-h-[150px]" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Anexos ({attachments.length}/{MAX_SUPPORT_FILES})</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl bg-muted border overflow-hidden">
                      {url.includes('.pdf') ? <FileText className="m-auto w-8 h-8 text-secondary" /> : <img src={url} className="w-full h-full object-cover" />}
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-destructive text-white p-1"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {attachments.length < MAX_SUPPORT_FILES && (
                    <label className="flex items-center gap-2 px-4 py-2 bg-muted rounded-xl cursor-pointer hover:bg-muted/80 text-[9px] font-black uppercase">
                      <Paperclip className="w-3.5 h-3.5 text-secondary" /> Incluir Arquivo
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
                {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
              </div>
              <Button type="submit" disabled={isSubmitting || (response.trim() === "" && attachments.length === 0) || uploadProgress !== null} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Enviar Resposta
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
