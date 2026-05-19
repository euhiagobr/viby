"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore"
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
  Clock
} from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function AdminEventosPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

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
      event.organizer?.name?.toLowerCase().includes(search.toLowerCase())
    )
  }, [events, search])

  const handleDeleteEvent = async (eventId: string) => {
    if (!db) return
    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação removerá o anúncio para todos os usuários.")) return

    deleteDoc(doc(db, "events", eventId))
      .then(() => toast({ title: "Evento removido" }))
      .catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: `events/${eventId}`,
          operation: "delete"
        })
        errorEmitter.emit("permission-error", permissionError)
      })
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR');
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
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Eventos</h1>
        <p className="text-muted-foreground">Controle total sobre todos os eventos publicados na plataforma Viby.</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-secondary" />
                Eventos Ativos
              </CardTitle>
              <CardDescription>Total de {filteredEvents.length} eventos monitorados.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por título, cidade ou organizador..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[300px] font-bold">Evento / Título</TableHead>
                <TableHead className="font-bold">Organizador</TableHead>
                <TableHead className="font-bold">Data / Local</TableHead>
                <TableHead className="font-bold text-center">Status</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <TableRow key={event.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm truncate max-w-[250px]">{event.title}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">{event.categoryName || "Geral"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{event.organizer?.name}</span>
                        <span className="text-[10px] text-muted-foreground">@{event.organizer?.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                          <Clock className="w-3 h-3 text-secondary" /> {formatDate(event.date)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                          <MapPin className="w-3 h-3 text-secondary" /> {event.city || "---"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {event.status || "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" asChild>
                          <Link href={`/${event.organizer?.username || 'evento'}/${event.id}`} target="_blank">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/dashboard/evento/${event.id}/editar`}>
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                    Nenhum evento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}