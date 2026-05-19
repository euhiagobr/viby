
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
  ChevronRight
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function SuportePage() {
  const db = useFirestore()
  const auth = useAuth()
  const app = useFirebaseApp()
  const { user } = useUser(auth)
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])

  const ticketsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "support_tickets"), 
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
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
    if (!file || !storage || !user) return

    setUploadProgress(0)
    try {
      const fileName = `support/${user.uid}/${Date.now()}_${file.name}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
          toast({ variant: "destructive", title: "Erro no upload" })
          setUploadProgress(null)
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          setAttachments(prev => [...prev, url])
          setUploadProgress(null)
          toast({ title: "Arquivo anexado!" })
        }
      )
    } catch (err) {
      setUploadProgress(null)
    }
  }

  const handleCreateTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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

    try {
      await addDoc(collection(db, "support_tickets"), ticketData)
      toast({ title: "Ticket criado!", description: `Protocolo: ${ticketData.protocol}` })
      setIsDialogOpen(false)
      setAttachments([])
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar ticket" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Não lida': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Não lida</Badge>
      case 'Em tratamento': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Em tratamento</Badge>
      case 'Respondida': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Respondida</Badge>
      case 'Encerrada': return <Badge variant="secondary" className="opacity-50">Encerrada</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

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
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Seu Nome</Label>
                    <Input value={user?.displayName || ""} disabled className="bg-muted/50 border-none rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Seu E-mail</Label>
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
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Anexos (Fotos ou PDF)</Label>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg bg-muted border border-border overflow-hidden">
                        <img src={url} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl-lg">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-secondary/20 flex items-center justify-center cursor-pointer hover:bg-secondary/5 transition-colors">
                      <Paperclip className="w-5 h-5 text-secondary/40" />
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    </label>
                  </div>
                  {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
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

      {ticketsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <LifeBuoy className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum ticket aberto.</p>
            <p className="text-sm text-muted-foreground">Sempre que precisar de ajuda, abra um ticket aqui.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket: any) => (
            <Link key={ticket.id} href={`/dashboard/suporte/${ticket.id}`}>
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
          ))}
        </div>
      )}
    </div>
  )
}
