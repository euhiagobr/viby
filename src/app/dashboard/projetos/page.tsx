
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, where } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Plus, MoreHorizontal, Eye, Globe, Loader2, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function MeusEventosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const myEventsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "events"), where("organizerId", "==", user.uid))
  }, [db, user])

  const { data: events, loading } = useCollection<any>(myEventsQuery)

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const eventData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
      location: formData.get("location") as string,
      city: formData.get("city") as string,
      type: formData.get("type") as string,
      status: "A fazer",
      image: `https://picsum.photos/seed/${Math.random()}/600/400`,
      organizerId: user.uid,
      organizer: {
        name: user.displayName || "Organizador",
        avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
        isVerified: false,
        totalEvents: (events?.length || 0) + 1
      },
      createdAt: serverTimestamp()
    }

    addDoc(collection(db, "events"), eventData)
      .then(() => {
        toast({ title: "Sucesso!", description: "Evento anunciado com sucesso." })
        setIsDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "events",
          operation: "create",
          requestResourceData: eventData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Eventos</h1>
          <p className="text-muted-foreground">Gerencie seus anúncios e veja quem está interessado.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-secondary text-white hover:bg-secondary/90">
              <Plus className="w-4 h-4" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreateEvent}>
              <DialogHeader>
                <DialogTitle>Novo Anúncio</DialogTitle>
                <DialogDescription>Preencha os dados do evento para começar a divulgação.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título do Evento</Label>
                  <Input id="title" name="title" placeholder="Ex: Festival de Verão" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date">Data</Label>
                    <Input id="date" name="date" type="datetime-local" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select name="type" defaultValue="Público">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Público">Público</SelectItem>
                        <SelectItem value="Privado">Privado</SelectItem>
                        <SelectItem value="Governo">Governo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" name="city" placeholder="Ex: São Paulo" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location">Local</Label>
                    <Input id="location" name="location" placeholder="Ex: Arena Viby" required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição Curta</Label>
                  <Textarea id="description" name="description" placeholder="Descreva o que torna seu evento único..." required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-secondary text-white" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Publicar Agora
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event: any) => (
            <Card key={event.id} className="overflow-hidden border-border hover:border-secondary/50 transition-all group shadow-sm">
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <Badge variant={event.status === 'Concluído' ? 'secondary' : 'default'} className="rounded-full">
                    {event.status}
                  </Badge>
                  <button className="text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-bold text-lg leading-tight group-hover:text-secondary transition-colors">{event.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                </div>

                <div className="flex items-center gap-4 py-2 border-y border-border">
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <CalendarIcon className="w-3.5 h-3.5 text-secondary" />
                    <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <Globe className="w-3.5 h-3.5 text-secondary" />
                    <span>{event.city}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" className="text-xs h-8">Editar Anúncio</Button>
                  <Button variant="secondary" size="sm" className="text-xs h-8">Ver Público</Button>
                </div>
              </div>
            </Card>
          ))}

          <button 
            onClick={() => setIsDialogOpen(true)}
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-secondary/50 hover:text-secondary transition-all"
          >
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold">Novo Evento</span>
          </button>
        </div>
      )}
    </div>
  )
}
