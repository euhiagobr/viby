"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase"
import { doc, getDoc, collection, query, where, addDoc, deleteDoc, serverTimestamp, getDocs } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Loader2, 
  MapPin, 
  ArrowLeft, 
  Share2, 
  Globe, 
  Star, 
  Edit,
  Users as UsersIcon,
  Ticket,
  Heart,
  Building2,
  Briefcase,
  Link as LinkIcon,
  Instagram,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  Send,
  AlertTriangle,
  Calendar
} from "lucide-react"
import { EventCard } from "@/components/events/EventCard"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Footer from "@/components/layout/Footer"

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 128 128" 
      className={cn("w-5 h-5", className)} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        fill="#0095f6" 
        d="M117.2 60.1l-6.5-6.6 2.3-9c1.1-4.4-1.2-8.9-5.3-10.7l-8.4-3.7-2.3-9c-1.1-4.4-5.2-7.4-9.7-7l-9.2.7-6.5-6.6c-3.2-3.2-8.2-3.2-11.4 0l-6.5 6.6-9.2-.7c-4.5-.4-8.6 2.6-9.7 7l-2.3 9-8.4 3.7c-4.1 1.8-6.4 6.3-5.3 10.7l2.3 9-6.5 6.6c-3.2 3.2-3.2 8.2 0 11.4l6.5 6.6-2.3 9c-1.1-4.4 1.2-8.9-5.3 10.7l8.4 3.7 2.3 9c1.1-4.4 5.2-7.4 9.7 7l9.2-.7 6.5 6.6c1.6 1.6 3.7 2.4 5.7 2.4s4.1-.8 5.7-2.4l6.5-6.6 9.2.7c.4 0 .7.1 1.1.1 4.1 0 7.9-3 8.6-7.1l2.3-9 8.4-3.7c4.1-1.8 6.4-6.3 5.3-10.7l-2.3-9 6.5-6.6c3.2-3.2 3.2-8.2 0-11.4z"
      />
      <path 
        fill="#fff" 
        d="M57.6 86.8c-1.8 0-3.5-.7-4.8-2L38.2 70.2c-2.7-2.7-2.7-7 0-9.6s7-2.7 9.6 0l9.8 9.8 22.8-22.8c2.7-2.7 7-2.7 9.6 0s2.7 7 0 9.6L62.4 84.8c-1.3 1.3-3 2-4.8 2z"
      />
    </svg>
  )
}

export default function PublicProfilePage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user: currentUser } = useUser(auth)
  const username = params.username as string

  const [profile, setProfile] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isFollowing, setIsFollowing] = React.useState(false)
  const [followLoading, setFollowLoading] = React.useState(false)

  // Report state
  const [isReportDialogOpen, setIsReportDialogOpen] = React.useState(false)
  const [reportReason, setReportReason] = React.useState("")
  const [reportDescription, setReportDescription] = React.useState("")
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false)

  const isOwner = React.useMemo(() => {
    return currentUser && profile && currentUser.uid === profile.id
  }, [currentUser, profile])

  React.useEffect(() => {
    if (!db || !username) return

    const fetchProfile = async () => {
      setLoading(true)
      try {
        const normalized = username.toLowerCase().trim()
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
          const data = userSnap.data();
          if (data.status === 'Bloqueado') {
            setError("Esse perfil não está disponível")
          } else {
            setProfile({ ...data, id: userSnap.id })
          }
        } else {
          setError("Dados do perfil não encontrados")
        }
      } catch (err) {
        setError("Erro ao carregar perfil")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [db, username])

  React.useEffect(() => {
    if (!db || !currentUser || !profile?.id) return

    const checkFollow = async () => {
      const q = query(
        collection(db, "follows"),
        where("followerId", "==", currentUser.uid),
        where("followingId", "==", profile.id)
      )
      const snap = await getDocs(q)
      setIsFollowing(!snap.empty)
    }

    checkFollow()
  }, [db, currentUser, profile?.id])

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !profile?.id || profile.accountType !== 'Empresa') return null
    return query(
      collection(db, "events"),
      where("organizerId", "==", profile.id),
      where("status", "==", "Ativo") // Apenas eventos ativos no perfil público
    )
  }, [db, profile?.id, profile?.accountType])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !profile?.id || profile.accountType === 'Empresa') return null
    return query(
      collection(db, "registrations"),
      where("userId", "==", profile.id)
    )
  }, [db, profile?.id, profile?.accountType])

  const { data: registrations, loading: registrationsLoading } = useCollection<any>(registrationsQuery)

  const followersQuery = useMemoFirebase(() => {
    if (!db || !profile?.id) return null
    return query(collection(db, "follows"), where("followingId", "==", profile.id))
  }, [db, profile?.id])
  const { data: followersData } = useCollection<any>(followersQuery)

  const stats = React.useMemo(() => {
    return {
      totalEvents: events?.length || 0,
      totalInterests: registrations?.length || 0,
      followers: followersData?.length || profile?.followersCount || 0,
      rating: profile?.rating || 0
    }
  }, [events, registrations, profile, followersData])

  const handleFollowToggle = async () => {
    if (!auth || !currentUser) {
      toast({ title: "Ação necessária", description: "Você precisa entrar para seguir organizadores." })
      router.push("/login")
      return
    }

    if (!db || !profile?.id || followLoading) return

    setFollowLoading(true)
    try {
      if (isFollowing) {
        const q = query(
          collection(db, "follows"),
          where("followerId", "==", currentUser.uid),
          where("followingId", "==", profile.id)
        )
        const snap = await getDocs(q)
        const deletePromises: Promise<void>[] = []
        snap.forEach((doc) => {
          deletePromises.push(deleteDoc(doc.ref))
        })
        await Promise.all(deletePromises)
        setIsFollowing(false)
        toast({ title: "Você parou de seguir" })
      } else {
        const followData = {
          followerId: currentUser.uid,
          followingId: profile.id,
          timestamp: serverTimestamp()
        }
        await addDoc(collection(db, "follows"), followData).catch(async () => {
          const permissionError = new FirestorePermissionError({
            path: "follows",
            operation: "create",
            requestResourceData: followData
          })
          errorEmitter.emit("permission-error", permissionError)
        })
        setIsFollowing(true)
        toast({ title: `Seguindo ${profile.name}!` })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleSendReport = async () => {
    if (!auth || !currentUser) {
      toast({ title: "Ação necessária", description: "Entre para denunciar o perfil." })
      router.push("/login")
      return
    }

    if (!db || !profile?.id || !reportReason) return

    setIsSubmittingReport(true)
    const reportData = {
      type: "profile",
      targetId: profile.id,
      targetName: profile.name || profile.username || "Sem Nome",
      reporterId: currentUser.uid,
      reporterName: currentUser.displayName || "Denunciante",
      reason: reportReason,
      description: reportDescription,
      timestamp: serverTimestamp(),
      status: "Pendente"
    }

    addDoc(collection(db, "reports"), reportData)
      .then(() => {
        toast({ title: "Denúncia enviada", description: "Nossa equipe analisará o conteúdo em breve." })
        setIsReportDialogOpen(false)
        setReportReason("")
        setReportDescription("")
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "reports",
          operation: "create",
          requestResourceData: reportData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmittingReport(false))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold tracking-tighter">{error || "Perfil não encontrado"}</h2>
        <Button onClick={() => router.push("/")} className="rounded-full">Voltar ao Início</Button>
      </div>
    )
  }

  const locationStr = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");
  const isCompany = profile.accountType === 'Empresa';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Viby</span>
          </Link>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button variant="outline" size="sm" asChild className="hidden sm:flex gap-2 font-bold">
                <Link href="/dashboard/perfil/editar">
                  <Edit className="w-4 h-4" />
                  Editar Perfil
                </Link>
              </Button>
            )}
            <Button variant="ghost" onClick={() => router.back()} className="gap-2 text-sm font-semibold">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </div>
      </nav>

      <div className="h-48 md:h-64 bg-secondary/10 relative overflow-hidden" />

      <div className="container mx-auto px-4 -mt-24 pb-20 relative z-10 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden rounded-[2rem]">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <Avatar className="h-32 w-32 border-4 border-background shadow-2xl">
                  <AvatarImage src={profile.avatar} alt={profile.name} className="object-cover" />
                  <AvatarFallback className="text-4xl font-bold bg-muted">
                    {profile.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="mt-6 space-y-2 w-full">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center justify-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
                      {profile.isVerified && <InstagramVerifiedBadge />}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">
                      {isCompany ? <Building2 className="w-3 h-3 mr-1" /> : <UsersIcon className="w-3 h-3 mr-1" />}
                      {profile.accountType || "Usuário"}
                    </Badge>
                  </div>
                  <p className="text-secondary font-black text-xs uppercase tracking-tighter">@{profile.username}</p>
                  
                  {locationStr && (
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-secondary" />
                      {locationStr}
                    </p>
                  )}
                </div>

                <div className={cn(
                  "grid gap-4 w-full mt-8",
                  isCompany ? "grid-cols-3" : "grid-cols-2"
                )}>
                  <div className="bg-muted/50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Seguidores</p>
                    <p className="text-xl font-black text-foreground">{stats.followers}</p>
                  </div>
                  
                  {isCompany ? (
                    <>
                      <div className="bg-muted/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Avaliação</p>
                        <div className="flex items-center justify-center gap-0.5">
                          <p className="text-xl font-black text-foreground">{stats.rating ? stats.rating.toFixed(1) : "0.0"}</p>
                          <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                        </div>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Eventos</p>
                        <p className="text-xl font-black text-foreground">{stats.totalEvents}</p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-muted/50 p-4 rounded-2xl text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Interesses</p>
                      <p className="text-xl font-black text-foreground">{stats.totalInterests}</p>
                    </div>
                  )}
                </div>

                <div className="w-full mt-8 space-y-3">
                  {isOwner ? (
                    <Button asChild className="w-full bg-secondary text-white hover:bg-secondary/90 font-bold gap-2 py-6 rounded-2xl">
                      <Link href="/dashboard/perfil/editar">
                        <Edit className="w-4 h-4" />
                        Editar Meu Perfil
                      </Link>
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={cn(
                        "w-full font-bold py-6 rounded-2xl shadow-lg uppercase tracking-widest text-xs transition-all",
                        isFollowing ? "bg-green-500 hover:bg-green-600 text-white" : "bg-secondary text-white hover:bg-secondary/90"
                      )}
                    >
                      {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Seguindo</> : "Seguir Organizador"}
                    </Button>
                  )}
                  <Button variant="outline" className="w-full font-bold gap-2 py-6 rounded-2xl border-2" onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    toast({ title: "Link copiado!" })
                  }}>
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </Button>
                  
                  {!isOwner && (
                    <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 font-bold gap-2 rounded-2xl uppercase text-[10px] tracking-widest py-6">
                          <ShieldAlert className="w-4 h-4" /> Denunciar Perfil
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2rem]">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Denunciar este perfil?</DialogTitle>
                          <DialogDescription>Ajude-nos a manter o Viby Club seguro. Selecione o motivo e descreva o problema.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Motivo</Label>
                            <Select value={reportReason} onValueChange={setReportReason}>
                              <SelectTrigger className="rounded-xl border-dashed border-secondary/30 h-12">
                                <SelectValue placeholder="Selecione o motivo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Conteúdo Inadequado">Conteúdo Inadequado</SelectItem>
                                <SelectItem value="Fraude / Golpe">Fraude / Golpe</SelectItem>
                                <SelectItem value="Identidade Falsa">Falsa Identidade / Impersonificação</SelectItem>
                                <SelectItem value="Assédio">Assédio ou Abuso</SelectItem>
                                <SelectItem value="Outro">Outro Motivo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Descrição Detalhada</Label>
                            <Textarea 
                              placeholder="Descreva o que está errado com este perfil..." 
                              value={reportDescription}
                              onChange={(e) => setReportDescription(e.target.value)}
                              className="rounded-xl border-dashed border-secondary/30 min-h-[100px]"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancelar</Button>
                          <Button 
                            onClick={handleSendReport} 
                            disabled={isSubmittingReport || !reportReason} 
                            className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-6"
                          >
                            {isSubmittingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            Enviar Denúncia
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2rem]">
              <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Biografia</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed whitespace-pre-line">
                  {profile.bio || "Nenhuma informação adicional disponível no momento."}
                </p>
              </CardContent>
            </Card>

            {isCompany && (
              <Card className="border-none shadow-sm border-l-4 border-secondary rounded-[2rem]">
                <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Building2 className="w-5 h-5 text-secondary" /> Informações Empresa</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Razão Social</p>
                    <p className="text-sm font-bold">{profile.legalName || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">CNPJ</p>
                    <p className="text-sm font-bold">{profile.cnpj || "Não informado"}</p>
                  </div>
                  {profile.businessCategory && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Segmento</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          <Briefcase className="w-3 h-3 mr-1 text-secondary" />
                          {profile.businessCategory}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(profile.website || profile.instagram || profile.whatsapp || (profile.email && profile.showEmail !== false)) && (
              <Card className="border-none shadow-sm rounded-[2rem]">
                <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Canais Oficiais</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {profile.website && (
                    <a href={profile.website} target="_blank" className="flex items-center gap-3 text-sm font-bold hover:text-secondary transition-colors">
                      <LinkIcon className="w-4 h-4 text-secondary" />
                      Site Oficial
                    </a>
                  )}
                  {profile.instagram && (
                    <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" className="flex items-center gap-3 text-sm font-bold hover:text-secondary transition-colors">
                      <Instagram className="w-4 h-4 text-secondary" />
                      @{profile.instagram.replace('@', '')}
                    </a>
                  )}
                  {profile.whatsapp && (
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <Phone className="w-4 h-4 text-secondary" />
                      {profile.whatsapp}
                    </div>
                  )}
                  {profile.email && profile.showEmail !== false && (
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <Mail className="w-4 h-4 text-secondary" />
                      {profile.email}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-8 space-y-8">
            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3 uppercase">
              {isCompany ? (
                <><Calendar className="w-6 h-6 text-secondary" /> Eventos Publicados</>
              ) : (
                <><Heart className="w-6 h-6 text-secondary" /> Meus Interesses</>
              )}
            </h2>

            {isCompany ? (
              eventsLoading ? (
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
                <div className="p-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border shadow-sm">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum evento publicado ainda.</p>
                </div>
              )
            ) : (
              registrationsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : registrations && registrations.length > 0 ? (
                <div className="p-10 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border shadow-sm space-y-4">
                  <Ticket className="w-12 h-12 mx-auto text-secondary mb-2 opacity-40" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">
                    Usuário interessado em {registrations.length} {registrations.length === 1 ? 'evento' : 'eventos'}.
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium max-w-xs mx-auto">
                    Os interesses são privados, mas o organizador de cada evento foi notificado.
                  </p>
                </div>
              ) : (
                <div className="p-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border shadow-sm">
                  <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Ainda não marcou interesse em eventos.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
