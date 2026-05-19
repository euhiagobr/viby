"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { doc, getDoc, collection, query, where, orderBy } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShieldCheck, Calendar, MapPin, ArrowLeft, Share2, Globe, Star } from "lucide-react"
import { EventCard } from "@/components/events/EventCard"
import Link from "next/link"

export default function PublicProfilePage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const username = params.username as string

  const [profile, setProfile] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Buscar o perfil resolvendo o username
  React.useEffect(() => {
    if (!db || !username) return

    const fetchProfile = async () => {
      setLoading(true)
      try {
        const normalized = username.toLowerCase()
        const usernameRef = doc(db, "usernames", normalized)
        const usernameSnap = await getDoc(usernameRef)

        if (!usernameSnap.exists()) {
          setError("Perfil não encontrado")
          setLoading(false)
          return
        }

        const uid = usernameSnap.data().uid
        const userRef = doc(db, "users", uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          setProfile({ ...userSnap.data(), id: userSnap.id })
        } else {
          setError("Dados do perfil não encontrados")
        }
      } catch (err) {
        console.error(err)
        setError("Erro ao carregar perfil")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [db, username])

  // Buscar eventos deste organizador
  const eventsQuery = useMemoFirebase(() => {
    if (!db || !profile?.id) return null
    return query(
      collection(db, "events"),
      where("organizerId", "==", profile.id),
      orderBy("createdAt", "desc")
    )
  }, [db, profile?.id])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <Globe className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">{error || "Perfil não encontrado"}</h2>
        <Button onClick={() => router.push("/")}>Voltar ao Início</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header simplificado */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Viby</span>
          </Link>
          <Button variant="ghost" onClick={() => router.back()} className="gap-2 text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>
      </nav>

      {/* Perfil Cover */}
      <div className="h-48 md:h-64 bg-secondary/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5" />
      </div>

      <div className="container mx-auto px-4 -mt-24 pb-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar de Perfil */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <Avatar className="h-32 w-32 border-4 border-background shadow-2xl">
                  <AvatarImage src={profile.avatar} alt={profile.name} />
                  <AvatarFallback className="text-4xl font-bold bg-muted">
                    {profile.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="mt-6 space-y-2 w-full">
                  <div className="flex items-center justify-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
                    {profile.isVerified && <ShieldCheck className="w-6 h-6 text-secondary fill-secondary/5" />}
                  </div>
                  <p className="text-secondary font-medium text-sm">@{profile.username}</p>
                  
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <Badge variant="secondary" className="bg-secondary/10 text-secondary border-none px-3 py-1">
                      Promotor Verificado
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-8">
                  <div className="bg-muted/50 p-4 rounded-2xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Eventos</p>
                    <p className="text-2xl font-black text-foreground">{profile.totalEvents || 0}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Avaliação</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-2xl font-black text-foreground">4.9</p>
                      <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                    </div>
                  </div>
                </div>

                <div className="w-full mt-8 space-y-3">
                  <Button className="w-full bg-secondary text-white hover:bg-secondary/90 font-bold gap-2 py-6 rounded-2xl">
                    Seguir Organizador
                  </Button>
                  <Button variant="outline" className="w-full font-bold gap-2 py-6 rounded-2xl border-2" onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    alert("Link do perfil copiado!")
                  }}>
                    <Share2 className="w-4 h-4" />
                    Compartilhar Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Membro desde {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR') : 'Recentemente'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">São Paulo, Brasil</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conteúdo Principal */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Eventos Publicados</h2>
              <Badge variant="outline" className="border-secondary text-secondary font-bold">
                {events?.length || 0} Ativos
              </Badge>
            </div>

            {eventsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : events && events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map((event: any) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-border shadow-sm">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">Nenhum evento ativo no momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
