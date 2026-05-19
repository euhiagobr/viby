
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, MoreHorizontal, Globe, Loader2, Calendar as CalendarIcon, MapPin, Clock, Building2, AlertCircle, Edit2, Eye, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function MeusEventosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const myEventsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "events"), where("organizerId", "==", user.uid))
  }, [db, user])

  const { data: events, loading: eventsLoading } = useCollection<any>(myEventsQuery)

  const isCompany = profile?.accountType === 'Empresa'

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }
      return isNaN(d.getTime()) ? "A definir" : d.toLocaleDateString('pt-BR');
    } catch (e) {
      return "A definir";
    }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Eventos</h1>
          <p className="text-muted-foreground">Gerencie seus anúncios e veja quem está interessado.</p>
        </div>
        
        {isCompany && (
          <Button asChild className="gap-2 bg-secondary text-white hover:bg-secondary/90 font-bold rounded-full px-6">
            <Link href="/dashboard/projetos/novo">
              <Plus className="w-4 h-4" />
              Novo Evento
            </Link>
          </Button>
        )}
      </div>

      {!isCompany && (
        <Alert className="bg-secondary/10 border-secondary/20">
          <Building2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="font-bold text-secondary">Conta de Usuário</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Sua conta está configurada como perfil pessoal. Para criar e publicar eventos, você precisa atualizar seu tipo de conta para <strong>Empresa</strong> em seu perfil.
            <div className="mt-3">
              <Button asChild variant="outline" size="sm" className="border-secondary text-secondary hover:bg-secondary hover:text-white font-bold">
                <Link href="/dashboard/perfil/editar">Mudar para Empresa</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {eventsLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event: any) => {
            const time = formatTime(event.date);
            const username = event.organizer?.username || "evento";
            const eventLink = `/${username}/${event.id}`;
            
            return (
              <Card key={event.id} className="overflow-hidden border-border hover:border-secondary/50 transition-all group shadow-sm rounded-2xl">
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <Badge variant={event.status === 'Concluído' ? 'secondary' : 'default'} className="rounded-full px-3">
                      {event.status || "Ativo"}
                    </Badge>
                    <button className="text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg leading-tight group-hover:text-secondary transition-colors line-clamp-1">{event.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{event.shortDescription || event.description}</p>
                  </div>
                  <div className="space-y-1.5 py-3 border-y border-border">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                      <CalendarIcon className="w-3.5 h-3.5 text-secondary" />
                      <span>{formatDate(event.date)}</span>
                      {time && (
                        <><span className="mx-1 opacity-30">|</span><Clock className="w-3.5 h-3.5 text-secondary" /><span>{time}</span></>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                      <MapPin className="w-3.5 h-3.5 text-secondary" />
                      <span className="line-clamp-1">{event.city || "Local não definido"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase h-8 rounded-lg gap-1.5" asChild>
                      <Link href={eventLink}><Eye className="w-3 h-3" />Ver</Link>
                    </Button>
                    <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase h-8 rounded-lg gap-1.5 border-secondary text-secondary hover:bg-secondary hover:text-white" asChild>
                      <Link href={`/dashboard/evento/${event.id}/editar`}><Edit2 className="w-3 h-3" />Editar</Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="col-span-2 text-[10px] font-bold uppercase h-8 rounded-lg gap-1.5">
                      <Users className="w-3 h-3" />Ver Público
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {isCompany ? (
            <Link 
              href="/dashboard/projetos/novo"
              className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-secondary/50 hover:text-secondary hover:bg-muted/30 transition-all min-h-[250px]"
            >
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center shadow-inner"><Plus className="w-6 h-6" /></div>
              <span className="font-bold uppercase text-xs tracking-widest">Publicar Novo Evento</span>
            </Link>
          ) : (
            <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground/50 bg-muted/20 grayscale min-h-[250px]">
              <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
              <span className="font-bold text-center text-xs uppercase tracking-widest">Disponível para Empresa</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
