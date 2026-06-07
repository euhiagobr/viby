
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
  FileText
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user || !auth) return;

    // AUDITORIA FINAL - ESTADO DO TOKEN
    console.group('AUDITORIA FINAL - STORAGE UPLOAD (USUÁRIO)');
    console.log('Auth Instance App:', auth.app.name);
    console.log('Storage Instance App:', storage.app.name);
    console.log('Current User (Hook):', user.uid);
    console.log('Current User (Auth SDK):', auth.currentUser?.uid || 'NULL');
    console.groupEnd();

    if (!auth.currentUser) {
       toast({ variant: "destructive", title: "Sincronizando...", description: "Aguarde um instante para que sua sessão seja validada." });
       return;
    }

    if (attachments.length >= MAX_SUPPORT_FILES) {
      toast({ variant: "destructive", title: "Limite atingido", description: `Máximo ${MAX_SUPPORT_FILES} arquivos.` });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ variant: "destructive", title: "Arquivo grande", description: "O limite é 5MB." });
      return;
    }

    setUploadProgress(0)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filePath = `support/${user.uid}/replies/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, filePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
          console.error('ETAPA 4: ERRO UPLOAD (USUÁRIO)', error);
          setUploadProgress(null);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setAttachments(prev => [...prev, url]);
          setUploadProgress(null);
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-2xl font-black uppercase italic text-primary">Ticket #{ticket.protocol}</h1>
      </div>

      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
           <CardTitle>{ticket.subject}</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
           <div className="p-4 bg-muted/20 rounded-2xl border">
              <p className="text-sm leading-relaxed">{ticket.description}</p>
           </div>
           
           <div className="space-y-4">
              {ticket.messages?.map((msg: any, i: number) => (
                <div key={i} className={cn("flex flex-col max-w-[80%] gap-1", msg.isAdmin ? "mr-auto" : "ml-auto items-end")}>
                  <div className={cn("p-4 rounded-2xl text-sm", msg.isAdmin ? "bg-secondary/10" : "bg-primary text-white")}>
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
           </div>

           {ticket.status !== 'Encerrada' && (
             <form onSubmit={handleSendMessage} className="pt-6 border-t border-dashed space-y-4">
               <Textarea placeholder="Sua resposta..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="rounded-2xl" />
               <div className="flex flex-wrap gap-2">
                  {attachments.map((url, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg bg-muted border overflow-hidden">
                      {url.includes('.pdf') ? <FileText className="m-auto w-6 h-6" /> : <img src={url} className="w-full h-full object-cover" />}
                    </div>
                  ))}
                  {attachments.length < MAX_SUPPORT_FILES && (
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl cursor-pointer text-[9px] font-black uppercase">
                      <Paperclip className="w-3 h-3 text-secondary" /> Anexar
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    </label>
                  )}
               </div>
               {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
               <Button type="submit" disabled={isSending || uploadProgress !== null} className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic">
                 {isSending ? <Loader2 className="animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Enviar
               </Button>
             </form>
           )}
        </CardContent>
      </Card>
    </div>
  )
}
