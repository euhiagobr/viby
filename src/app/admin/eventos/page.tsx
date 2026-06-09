"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs, limit, serverTimestamp, writeBatch } from "firebase/firestore"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, 
  Search, 
  CalendarDays, 
  ExternalLink, 
  Trash2,
  Edit2,
  MapPin,
  Clock,
  RefreshCw,
  Link as LinkIcon,
  CheckCircle2,
  Save,
  Globe,
  Info
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"
import { updateEventSlugAction } from "@/app/actions/events"
import { slugify } from "@/lib/slug-utils"

export default function AdminEventosPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [isProcessing, setIsProcessing] = React.useState(false)
  
  // Estados para Edição de Slug
  const [slugTarget, setSlugTarget] = React.useState<any>(null)
  const [newSlugValue, setNewSlugValue] = React.useState("")
  const [isSlugDialogOpen, setIsSlugDialogOpen] = React.useState(false)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events"), orderBy("createdAt", "desc"))
  }, [db])

  const { data: events, loading } = useCollection<any>(eventsQuery)

  const filteredEvents = React.useMemo(() => {
    if (!events) return []
    return events.filter(event => 
      event.title?.toLowerCase().includes(search.toLowerCase()) ||
      event.city?.toLowerCase().includes(search.toLowerCase()) ||
      event.organizer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      event.slug?.toLowerCase().includes(search.toLowerCase())
    )
  }, [events, search])

  const handleOpenSlugDialog = (event: any) => {
    setSlugTarget(event)
    setNewSlugValue(event.slug || slugify(event.title))
    setIsSlugDialogOpen(true)
  }

  const handleUpdateSlug = async () => {
    if (!slugTarget || !newSlugValue || isProcessing) return
    setIsProcessing(true)
    try {
      const result = await updateEventSlugAction({
        eventId: slugTarget.id,
        orgId: slugTarget.organizationId,
        manualSlug: newSlugValue
      })

      if (result.success) {
        toast({ title: "URL Atualizada!", description: `Nova URL: /${slugTarget.organizer?.username}/${result.slug}` })
        setIsSlugDialogOpen(false)
      } else {
        throw new Error(result.error)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na URL", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (!db) return
    if (!confirm(`Tem certeza que deseja remover "${title}"? Se existirem vendas, o evento será apenas ocultado.`)) return

    setIsProcessing(true)
    try {
      const salesQuery = query(
        collection(db, "registrations"),
        where("eventId", "==", eventId),
        where("paymentStatus", "in", ["Pago", "Disponível"]),
        limit(1)
      );
      const salesSnap = await getDocs(salesQuery);
      const eventRef = doc(db, "events", eventId);

      if (!salesSnap.empty) {
        await updateDoc(eventRef, { status: "Oculto", updatedAt: serverTimestamp() });
        toast({ title: "Evento Ocultado", description: "Vendas detectadas. O evento saiu do ar mas os ingressos continuam válidos." });
      } else {
        const batch = writeBatch(db);
        batch.update(eventRef, { status: "Excluído", updatedAt: serverTimestamp() });
        
        const regsQuery = query(collection(db, "registrations"), where("eventId", "==", eventId));
        const regsSnap = await getDocs(regsQuery);
        regsSnap.forEach((regDoc) => batch.delete(regDoc.ref));
        
        await batch.commit();
        toast({ title: "Evento removido permanentemente" });
      }
    } catch (error: any) {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `events/${eventId}`,
        operation: "update",
      }))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestoreEvent = async (eventId: string) => {
    if (!db) return
    updateDoc(doc(db, "events", eventId), { status: "Ativo" })
      .then(() => toast({ title: "Evento restaurado!", description: "O anúncio voltou a ficar visível." }))
      .catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: `events/${eventId}`,
          operation: "update",
          requestResourceData: { status: "Ativo" }
        })
        errorEmitter.emit("permission-error", permissionError)
      })
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return "---"; }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Gestão de Eventos</h1>
        <p className="text-muted-foreground font-medium">Controle total sobre todos os eventos publicados na plataforma Viby.</p>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="bg-white border-b pb-6 px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-secondary" />
                Monitoramento Global
              </CardTitle>
              <CardDescription>Total de {filteredEvents.length} eventos registrados.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Título, @username ou URL..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl h-11"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[300px] font-black uppercase text-[10px] p-6">Evento / URL</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Organizador</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Data / Local</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <TableRow 
                    key={event.id} 
                    className={cn("hover:bg-muted/5", event.status === 'Excluído' && "bg-destructive/[0.02] opacity-75")}
                  >
                    <TableCell className="p-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-primary truncate max-w-[250px]">{event.title}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                           <Globe className="w-3 h-3 text-secondary" />
                           <span className="text-[10px] font-mono text-muted-foreground">/{event.organizer?.username || '...'}/{event.slug || event.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase">{event.organizer?.name}</span>
                        <span className="text-[10px] text-muted-foreground">@{event.organizer?.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                          <Clock className="w-3 h-3 text-secondary" /> {formatDate(event.date)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                          <MapPin className="w-3 h-3 text-secondary" /> {event.city || "---"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={event.status === 'Excluído' ? 'destructive' : (event.status === 'Oculto' ? 'secondary' : 'outline')} 
                        className="text-[9px] font-black uppercase px-2"
                      >
                        {event.status || "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(event.status === 'Excluído' || event.status === 'Oculto') && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            onClick={() => handleRestoreEvent(event.id)}
                            title="Restaurar Evento"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-secondary hover:bg-secondary/10" 
                          onClick={() => handleOpenSlugDialog(event)}
                          title="Editar URL (Slug)"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild>
                          <Link href={`/${event.organizer?.username || 'evento'}/${event.slug || event.id}`} target="_blank">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteEvent(event.id, event.title)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center opacity-30 italic">
                    Nenhum evento localizado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG DE EDIÇÃO DE SLUG */}
      <Dialog open={isSlugDialogOpen} onOpenChange={setIsSlugDialogOpen}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <DialogHeader>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Gerenciar URL</DialogTitle>
               <DialogDescription className="font-medium text-xs">Defina o endereço amigável deste evento na rede Viby.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
               <div className="p-4 bg-muted/30 rounded-2xl border border-dashed text-[10px] font-bold uppercase space-y-1">
                  <p className="opacity-40">Título Atual:</p>
                  <p className="text-primary truncate">{slugTarget?.title}</p>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Slug Personalizado</Label>
                  <div className="relative">
                     <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 text-secondary" />
                     <Input 
                       value={newSlugValue} 
                       onChange={e => setNewSlugValue(slugify(e.target.value))}
                       className="pl-10 h-12 rounded-xl font-mono text-sm border-secondary/20"
                     />
                  </div>
               </div>
               <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-secondary/10">
                  <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-secondary font-bold leading-relaxed uppercase">
                    Caso o slug já exista para este organizador, o sistema adicionará um sufixo numérico automático para garantir a unicidade.
                  </p>
               </div>
            </div>
            <DialogFooter>
               <Button 
                onClick={handleUpdateSlug} 
                disabled={isProcessing || !newSlugValue}
                className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg"
               >
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
                  Atualizar Endereço
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  )
}
