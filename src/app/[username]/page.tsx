
"use client"

import * as React from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { 
  Loader2, 
  AlertTriangle, 
  MapPin, 
  Globe, 
  Instagram, 
  Calendar,
  Users,
  Grid,
  Heart,
  Share2,
  ExternalLink,
  Building2,
  Bell,
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { EventCard } from "@/components/events/EventCard"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { OrganizationProvider, useCurrentOrganization } from "@/contexts/OrganizationContext"
import Footer from "@/components/layout/Footer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

function ProfileHeader() {
  const { currentOrg, organizations, setCurrentOrg } = useCurrentOrganization()
  const auth = useAuth()
  const { user } = useUser(auth)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <SidebarTrigger />
      
      <div className="flex items-center gap-4">
        {user && organizations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl h-10 border-dashed border-secondary/40 hover:border-secondary transition-all">
                <Building2 className="w-4 h-4 text-secondary" />
                <span className="font-bold text-xs uppercase tracking-tight">
                  {currentOrg?.name || "Selecionar Organização"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl" align="start">
              <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Minhas Organizações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem 
                  key={org.id} 
                  onClick={() => setCurrentOrg(org)}
                  className={currentOrg?.id === org.id ? "bg-secondary/10 font-bold" : ""}
                >
                  {org.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/organizations/new" className="flex items-center gap-2 text-secondary font-bold">
                  <Plus className="w-4 h-4" />
                  Nova Organização
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      <div className="flex items-center gap-3 ml-auto">
        {!user ? (
          <>
            <Button asChild variant="ghost" className="font-semibold text-sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-secondary text-white font-bold px-6 rounded-full h-9 text-xs">
              <Link href="/cadastro">Cadastrar-se</Link>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-background" />
            </Button>
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold border border-border shadow-sm overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs uppercase">{user.displayName?.charAt(0) || 'U'}</span>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function UniversalProfileContent() {
  const params = useParams()
  const db = useFirestore()
  const username = (params.username as string).toLowerCase()

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<any>(null)
  const [type, setType] = React.useState<'user' | 'organization' | null>(null)

  // Resolvedor robusto de username com fallback
  React.useEffect(() => {
    if (!db || !username) return

    const resolveUsername = async () => {
      setLoading(true)
      setData(null)
      setType(null)

      try {
        const usernameRef = doc(db, "usernames", username)
        const usernameSnap = await getDoc(usernameRef)

        let targetUid = null
        let resolvedType: 'user' | 'organization' | null = null

        if (usernameSnap.exists()) {
          const uData = usernameSnap.data()
          targetUid = uData.uid
          resolvedType = uData.type || 'user'
        } else {
          // Fallback: busca direta nas coleções caso usernames esteja desatualizado
          const usersQuery = query(collection(db, "users"), where("username", "==", username), limit(1))
          const usersSnap = await getDocs(usersQuery)
          if (!usersSnap.empty) {
            targetUid = usersSnap.docs[0].id
            resolvedType = 'user'
          } else {
            const orgsQuery = query(collection(db, "organizations"), where("username", "==", username), limit(1))
            const orgsSnap = await getDocs(orgsQuery)
            if (!orgsSnap.empty) {
              targetUid = orgsSnap.docs[0].id
              resolvedType = 'organization'
            }
          }
        }

        if (targetUid && resolvedType) {
          setType(resolvedType)
          const targetColl = resolvedType === 'user' ? 'users' : 'organizations'
          const dataSnap = await getDoc(doc(db, targetColl, targetUid))
          
          if (dataSnap.exists()) {
            setData({ id: dataSnap.id, ...dataSnap.data() })
          }
        }
      } catch (err) {
        console.error("Erro ao resolver perfil:", err)
      } finally {
        setLoading(false)
      }
    }

    resolveUsername()
  }, [db, username])

  // Busca eventos se for uma organização
  const eventsQuery = useMemoFirebase(() => {
    if (!db || !data?.id || type !== 'organization') return null
    return query(
      collection(db, "events"), 
      where("organizationId", "==", data.id),
      where("status", "==", "Ativo"),
      orderBy("startDate", "asc")
    )
  }, [db, data?.id, type])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
        <AlertTriangle className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">Perfil não encontrado</h2>
        <p className="text-muted-foreground max-w-xs">O link que você seguiu pode estar quebrado ou o perfil foi removido.</p>
        <Button asChild className="rounded-full px-8 bg-secondary text-white">
          <Link href="/dashboard">Voltar ao Início</Link>
        </Button>
      </div>
    )
  }

  const isOrg = type === 'organization'
  const displayName = isOrg ? data.name : data.name || data.displayName
  const avatar = data.avatar || `https://picsum.photos/seed/${data.id}/200/200`

  return (
    <div className="flex-1">
       {/* Banner Superior (Apenas Org) */}
       {isOrg && data.banner && (
         <div className="h-48 md:h-64 w-full relative overflow-hidden">
            <img src={data.banner} className="w-full h-full object-cover" alt="Banner" />
            <div className="absolute inset-0 bg-black/20" />
         </div>
       )}

       <div className={cn(
         "container mx-auto px-4 pb-20",
         isOrg && data.banner ? "-mt-16 relative z-10" : "pt-12 md:pt-20"
       )}>
          <div className="max-w-4xl mx-auto">
             {/* Header Estilo Instagram */}
             <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-12">
                <div className="shrink-0">
                   <div className="p-1 rounded-full bg-gradient-to-tr from-secondary to-primary shadow-xl">
                      <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background">
                         <AvatarImage src={avatar} className="object-cover" />
                         <AvatarFallback className="text-4xl font-bold bg-muted">
                            {displayName?.charAt(0)}
                         </AvatarFallback>
                      </Avatar>
                   </div>
                </div>

                <div className="flex-1 space-y-6 text-center md:text-left">
                   <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                        {data.isVerified && <InstagramVerifiedBadge />}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Button className="bg-secondary text-white hover:bg-secondary/90 font-bold rounded-lg h-9 px-6 text-sm">
                           Seguir
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
                           <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                   </div>

                   <div className="flex justify-center md:justify-start gap-8">
                      <div className="flex flex-col md:flex-row items-center gap-1">
                         <span className="font-bold text-lg">{isOrg ? events?.length || 0 : 0}</span>
                         <span className="text-sm text-muted-foreground">{isOrg ? 'Eventos' : 'Publicações'}</span>
                      </div>
                      <div className="flex flex-col md:flex-row items-center gap-1">
                         <span className="font-bold text-lg">0</span>
                         <span className="text-sm text-muted-foreground">Seguidores</span>
                      </div>
                      <div className="flex flex-col md:flex-row items-center gap-1">
                         <span className="font-bold text-lg">0</span>
                         <span className="text-sm text-muted-foreground">Seguindo</span>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <p className="text-sm font-bold text-secondary">@{data.username}</p>
                      {isOrg && data.type && (
                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{data.type}</p>
                      )}
                      {!isOrg && (
                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Participante</p>
                      )}
                      <p className="text-sm font-medium leading-relaxed max-w-lg mx-auto md:mx-0">
                         {data.bio || "Nenhuma biografia disponível."}
                      </p>
                      
                      <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                         {data.website && (
                           <a href={data.website} target="_blank" className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" />
                              {data.website.replace(/^https?:\/\//, '')}
                           </a>
                         )}
                         {data.instagram && (
                           <a href={`https://instagram.com/${data.instagram}`} target="_blank" className="flex items-center gap-1.5 text-sm font-bold hover:text-pink-600">
                              <Instagram className="w-3.5 h-3.5" />
                              @{data.instagram}
                           </a>
                         )}
                         {data.city && (
                           <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5" />
                              {data.city}, {data.state}
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>

             <Separator className="mb-0" />

             {/* Grade de Conteúdo Estilo Instagram */}
             <Tabs defaultValue="events" className="w-full">
                <div className="flex justify-center border-t border-transparent">
                  <TabsList className="bg-transparent h-auto p-0 gap-12">
                    <TabsTrigger 
                      value="events" 
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:border-t-2 data-[state=active]:border-foreground rounded-none px-0 py-4 font-bold uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100 transition-all"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      {isOrg ? 'Eventos' : 'Publicações'}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="about" 
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:border-t-2 data-[state=active]:border-foreground rounded-none px-0 py-4 font-bold uppercase text-[11px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100 transition-all"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Sobre
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="events" className="pt-8">
                   {eventsLoading ? (
                     <div className="py-20 flex justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                     </div>
                   ) : events && events.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event: any) => (
                           <EventCard key={event.id} event={event} />
                        ))}
                     </div>
                   ) : (
                     <div className="py-32 text-center space-y-4">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
                           <Calendar className="w-10 h-10" />
                        </div>
                        <p className="text-muted-foreground font-medium italic">Nenhum evento ativo no momento.</p>
                     </div>
                   )}
                </TabsContent>

                <TabsContent value="about" className="pt-8">
                   <div className="max-w-2xl mx-auto bg-muted/30 p-8 rounded-3xl border space-y-6">
                      <h3 className="font-bold text-lg">Informações Detalhadas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tipo</p>
                               <p className="font-bold">{isOrg ? (data.type || "Não informado") : "Perfil de Usuário"}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Desde</p>
                               <p className="font-bold">{data.createdAt ? new Date(data.createdAt.seconds * 1000).getFullYear() : '---'}</p>
                            </div>
                         </div>
                         <div className="space-y-4">
                            {isOrg && data.legalName && (
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Razão Social</p>
                                 <p className="font-bold">{data.legalName}</p>
                              </div>
                            )}
                            {isOrg && data.cnpj && (
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Documento</p>
                                 <p className="font-mono text-sm">{data.cnpj}</p>
                              </div>
                            )}
                         </div>
                      </div>
                      
                      <div className="pt-6 border-t border-dashed">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Descrição Completa</p>
                        <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
                           {data.bio || "Nenhuma descrição adicional informada."}
                        </p>
                      </div>
                   </div>
                </TabsContent>
             </Tabs>
          </div>
       </div>
    </div>
  )
}

export default function UniversalProfilePage() {
  return (
    <OrganizationProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-[#f8fafc]">
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-y-auto">
            <ProfileHeader />
            <UniversalProfileContent />
            <Footer />
          </main>
        </div>
      </SidebarProvider>
    </OrganizationProvider>
  )
}
