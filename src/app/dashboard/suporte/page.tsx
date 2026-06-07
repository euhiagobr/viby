
"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  LifeBuoy, 
  Plus, 
  Loader2, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Paperclip,
  FileText,
  X,
  ChevronRight,
  Inbox,
  Archive,
  HelpCircle
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

const MAX_SUPPORT_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default function SuportePage() {
  const db = useFirestore()
  const auth = useAuth()
  const app = useFirebaseApp()
  const { user } = useUser(auth)
  
  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
  }, [app]);

  const ticketsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "support_tickets"), 
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    )
  }, [db, user])

  const { data: tickets, loading: ticketsLoading } = useCollection<any>(ticketsQuery)

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [attachments, setAttachments] = React.useState<string[]>([])
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)

  const generateProtocol = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      console.warn('ETAPA 1: Seleção (Criação) - Nenhum arquivo.');
      return;
    }

    console.log('ETAPA 1: Seleção do arquivo (Criação)', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    });

    if (!storage || !user) {
      console.error('ETAPA 3: Preparação (Criação) - Contexto nulo', { storage: !!storage, user: !!user });
      return;
    }

    // ETAPA 2: Validação
    if (attachments.length >= MAX_SUPPORT_FILES) {
      console.warn('ETAPA 2: Rejeição (Criação) - Máximo 3 arquivos');
      toast({ variant: "destructive", title: "Limite atingido", description: `Você pode enviar no máximo ${MAX_SUPPORT_FILES} arquivos.` });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      console.warn('ETAPA 2: Rejeição (Criação) - Máximo 5MB');
      toast({ variant: "destructive", title: "Arquivo muito grande", description: "O limite é de 5MB por arquivo." });
      return;
    }

    console.log('ETAPA 2: Validação OK (Criação)');

    setUploadProgress(0)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filePath = `support/${user.uid}/tickets/${Date.now()}_${safeName}`;
      
      console.log('ETAPA 3: Preparação (Criação)', { path: filePath });

      const storageRef = ref(storage, filePath);
      console.log('ETAPA 4: Start Storage (Criação)');
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`ETAPA 4: Progresso (Criação) - ${progress.toFixed(2)}%`);
          setUploadProgress(progress);
        },
        (error) => {
          console.error('ETAPA 4: ERRO STORAGE (Criação)', {
            code: error.code,
            message: error.message,
            error
          });
          setUploadProgress(null);
        },
        async () => {
          console.log('ETAPA 4: Sucesso Storage (Criação)');
          try {
            console.log('ETAPA 5: URL Request (Criação)');
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('ETAPA 5: URL OK (Criação)', { url });
            setAttachments(prev => [...prev, url]);
            setUploadProgress(null);
            toast({ title: "Arquivo anexado!" });
          } catch (urlErr: any) {
             console.error('ETAPA 5: ERRO URL (Criação)', { message: urlErr.message });
          }
        }
      )
    } catch (err: any) {
      console.error('UPLOAD ERROR (CREATION/TRY)', { error: err });
      setUploadProgress(null);
    }
  }

  const handleCreateTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('ETAPA 6: Preparando Ticket');
    if (!db || !user) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const ticketData = {
      protocol: generateProtocol(),
      userId: user.uid,
      userName: user.displayName || "Usuário",
      userEmail: user.email,
      subject: formData.get("subject") as string,
      description: formData.get("description") as string,
      status: "Não lida",
      attachments: attachments,
      messages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    console.log('ETAPA 6: Payload Ticket pronto', { payload: ticketData });

    console.log('ETAPA 7: Firestore ADD (Criação)');
    addDoc(collection(db, "support_tickets"), ticketData)
      .then(() => {
        console.log('ETAPA 7: Firestore Sucesso (Criação)');
        toast({ title: "Ticket criado!", description: `Protocolo: ${ticketData.protocol}` })
        setIsDialogOpen(false)
        setAttachments([])
      })
      .catch(async (serverError) => {
        console.error('ETAPA 7: ERRO FIRESTORE (Criação)', { error: serverError });
        if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: "support_tickets",
            operation: "create",
            requestResourceData: ticketData
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          toast({ variant: "destructive", title: "Erro ao criar ticket" })
        }
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Não lida': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Aguardando Visualização</Badge>
      case 'Em tratamento': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Em Análise</Badge>
      case 'Respondida': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Aguardando sua Resposta</Badge>
      case 'Encerrada': return <Badge variant="secondary" className="opacity-50">Finalizado</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const openTickets = tickets?.filter((t: any) => t.status !== 'Encerrada') || []
  const closedTickets = tickets?.filter((t: any) => t.status === 'Encerrada') || []

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <LifeBuoy className="w-8 h-8 text-secondary" />
            Central de Suporte
          </h1>
          <p className="text-muted-foreground font-medium">Estamos aqui para ajudar você com qualquer dúvida ou problema.</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" asChild className="rounded-full h-12 px-6 font-bold gap-2 text-xs uppercase border-secondary/20 text-secondary hover:bg-secondary/5">
             <Link href="/dashboard/suporte/faq"><HelpCircle className="w-4 h-4" /> Perguntas Frequentes</Link>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-6 h-12 shadow-lg hover:scale-105 transition-transform gap-2">
                <Plus className="w-5 h-5" />
                Novo Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[2rem]">
              <form onSubmit={handleCreateTicket} className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Abrir Chamado</DialogTitle>
                  <DialogDescription>Preencha os detalhes abaixo para que nossa equipe possa ajudar.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Seu Nome</Label>
                      <Input value={user?.displayName || ""} disabled className="bg-muted/50 border-none rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Seu E-mail</Label>
                      <Input value={user?.email || ""} disabled className="bg-muted/50 border-none rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-[10px] font-black uppercase tracking-widest opacity-60">Assunto</Label>
                    <Input id="subject" name="subject" placeholder="Ex: Problema com ingresso" required className="rounded-xl border-dashed border-secondary/30" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest opacity-60">Descrição do Problema</Label>
                    <Textarea id="description" name="description" placeholder="Descreva detalhadamente..." required className="rounded-xl border-dashed border-secondary/30 min-h-[120px]" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Anexos (Máx 3 de 5MB)</Label>
                       <span className="text-[8px] font-bold uppercase opacity-40">{attachments.length}/{MAX_SUPPORT_FILES} arquivos</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((url, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-lg bg-muted border border-border overflow-hidden">
                          <img src={url} className="w-full h-full object-cover" alt="Anexo" />
                          <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl-lg">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {attachments.length < MAX_SUPPORT_FILES && (
                        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-secondary/20 flex items-center justify-center cursor-pointer hover:bg-secondary/5 transition-colors">
                          <Paperclip className="w-5 h-5 text-secondary/40" />
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploadProgress !== null} />
                        </label>
                      )}
                    </div>
                    {uploadProgress !== null && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-1" />
                        <p className="text-[8px] font-black uppercase text-secondary">Enviando: {Math.round(uploadProgress)}%</p>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || uploadProgress !== null} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <MessageSquare className="w-5 h-5 mr-2" />}
                    Enviar Chamado
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="active" className="rounded-lg px-8 font-bold gap-2">
            <Inbox className="w-4 h-4" />
            Em Aberto ({openTickets.length})
          </TabsTrigger>
          <TabsTrigger value="closed" className="rounded-lg px-8 font-bold gap-2">
            <Archive className="w-4 h-4" />
            Encerrados ({closedTickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {ticketsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : openTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                <LifeBuoy className="w-10 h-10 text-muted-foreground opacity-30" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold">Nenhum ticket em aberto.</p>
                <p className="text-sm text-muted-foreground">Sempre que precisar de ajuda, abra um ticket aqui.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {openTickets.map((ticket: any) => (
                <TicketCard key={ticket.id} ticket={ticket} getStatusBadge={getStatusBadge} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {ticketsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : closedTickets.length === 0 ? (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-muted/20">
              <Archive className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium italic">Nenhum ticket encerrado no histórico.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {closedTickets.map((ticket: any) => (
                <TicketCard key={ticket.id} ticket={ticket} getStatusBadge={getStatusBadge} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TicketCard({ ticket, getStatusBadge }: { ticket: any, getStatusBadge: (status: string) => React.ReactNode }) {
  return (
    <Link href={`/dashboard/suporte/${ticket.id}`}>
      <Card className="hover:border-secondary/50 transition-all group rounded-2xl shadow-sm border-border bg-white overflow-hidden">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-xl group-hover:bg-secondary group-hover:text-white transition-colors">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">#{ticket.protocol}</span>
                {getStatusBadge(ticket.status)}
              </div>
              <h3 className="font-bold text-lg leading-tight line-clamp-1">{ticket.subject}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Aberto em {ticket.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || 'agora'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </CardContent>
      </Card>
    </Link>
  )
}
