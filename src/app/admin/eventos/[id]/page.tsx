"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, getDocs, updateDoc, serverTimestamp, orderBy } from "firebase/firestore"
import { Loader2, ExternalLink, Search, CalendarDays, Trash2, Edit2, MapPin, Clock, RefreshCcw, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"

// Placeholder for EventCouponsSection
const EventCouponsSection = ({ eventId }: { eventId: string }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cupons do Evento</CardTitle>
        <CardDescription>Gerencie os cupons de desconto para este evento.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <p className="text-muted-foreground">Seção de cupons ainda em desenvolvimento.</p>
          <p className="text-sm text-secondary">Evento ID: {eventId}</p>
          <Button asChild>
            <Link href={`/admin/eventos/${eventId}/cupons`}>
              Gerenciar Cupons
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const EventTicketsSection = ({ eventId }: { eventId: string }) => {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [isProcessingRefund, setIsProcessingRefund] = React.useState(false)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(
      collection(db, "registrations"),
      where("eventId", "==", eventId),
      where("paymentStatus", "in", ["Pago", "Disponível"]),
      orderBy("createdAt", "desc")
    )
  }, [db, eventId])

  const { data: registrations, loading: isLoadingRegistrations } = useCollection<any>(registrationsQuery)

  const filteredRegistrations = React.useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      (reg.buyerName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.buyerEmail?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.ticketTypeName?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [registrations, search])

  const handleRefund = async (registrationId: string, buyerName: string) => {
    if (!db) return
    if (!confirm(`Tem certeza que deseja estornar a compra de ${buyerName}? Esta ação não pode ser desfeita.`)) return

    setIsProcessingRefund(true)
    try {
      const registrationRef = doc(db, "registrations", registrationId)
      await updateDoc(registrationRef, {
        paymentStatus: "Estornado",
        updatedAt: serverTimestamp()
      })
      toast({ title: "Estorno processado com sucesso!", description: `A compra de ${buyerName} foi marcada como estornada.` })
    } catch (error: any) {
      console.error("Error processing refund:", error)
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `registrations/${registrationId}`,
        operation: "update",
        requestResourceData: { paymentStatus: "Estornado" }
      }))
      toast({ title: "Erro ao processar estorno", description: "Houve um problema ao tentar estornar a compra. Por favor, tente novamente." })
    } finally {
      setIsProcessingRefund(false)
    }
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  }

  if (isLoadingRegistrations) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="bg-white border-b pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-secondary" />
              Vendas do Evento
            </CardTitle>
            <CardDescription>Total de {registrations?.length || 0} ingressos vendidos/confirmados.</CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por comprador ou e-mail..." 
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
              <TableHead className="w-[250px] font-bold">Comprador</TableHead>
              <TableHead className="font-bold">Tipo de Ingresso</TableHead>
              <TableHead className="font-bold text-center">Data da Compra</TableHead>
              <TableHead className="font-bold text-center">Status</TableHead>
              <TableHead className="text-right font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegistrations.length > 0 ? (
              filteredRegistrations.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{reg.buyerName || reg.userName}</span>
                      <span className="text-[10px] text-muted-foreground">{reg.buyerEmail || reg.userEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{reg.ticketTypeName || "Geral"}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{formatDate(reg.createdAt || reg.timestamp)}</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={reg.paymentStatus === 'Estornado' ? 'destructive' : reg.paymentStatus === 'Pago' ? 'outline' : 'secondary'} 
                      className={cn("text-[10px] font-bold uppercase", reg.paymentStatus === 'Pago' && "bg-green-600 hover:bg-green-700 text-white")}
                    >
                      {reg.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {reg.paymentStatus === 'Pago' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          disabled={isProcessingRefund}
                          onClick={() => handleRefund(reg.id, reg.userName)}
                          title="Estornar Compra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                  Nenhum ingresso vendido ou confirmado para este evento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}


export default function AdminEventoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const db = useFirestore()

  const eventRef = React.useMemo(() => {
    if (!db || !id) return null
    return doc(db, "events", id)
  }, [db, id])

  const { data: event, loading } = useDoc<any>(eventRef)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <p className="text-muted-foreground">Evento não encontrado.</p>
      </div>
    )
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          Detalhes do Evento: {event.title}
          <Badge 
            variant={event.status === 'Excluído' ? 'destructive' : (event.status === 'Oculto' ? 'secondary' : 'outline')} 
            className="text-[10px] font-bold uppercase"
          >
            {event.status || "Ativo"}
          </Badge>
        </h1>
        <p className="text-muted-foreground">
          Gerencie ingressos, cupons e outras informações relevantes para o evento: "{event.title}".
        </p>
      </div>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="tickets">Ingressos</TabsTrigger>
          <TabsTrigger value="coupons">Cupons</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tickets">
          <EventTicketsSection eventId={id} />
        </TabsContent>
        
        <TabsContent value="coupons">
          <EventCouponsSection eventId={id} />
        </TabsContent>
      </Tabs>
      
      {/* Basic Event Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais do Evento</CardTitle>
          <CardDescription>Detalhes básicos do evento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Título</p>
              <p className="text-muted-foreground">{event.title}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Organizador</p>
              <p className="text-muted-foreground">{event.organizer?.name} (@{event.organizer?.username})</p>
            </div>
            <div>
              <p className="text-sm font-medium">Data</p>
              <p className="text-muted-foreground">{formatDate(event.date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Local</p>
              <p className="text-muted-foreground">{event.city || "---"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Categoria</p>
              <p className="text-muted-foreground">{event.categoryName || "---"}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Link do Evento</p>
              <Button variant="outline" size="sm" asChild className="w-fit">
                <Link href={`/${event.organizer?.username || 'evento'}/${event.id}`} target="_blank">
                  Ver Evento <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
