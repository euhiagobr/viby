
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase"
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  limit, 
  orderBy
} from "firebase/firestore"
import { 
  Loader2, 
  MapPin, 
  Globe, 
  Instagram, 
  Calendar,
  Users,
  Heart,
  Share2,
  ExternalLink,
  Building2,
  BadgeCheck,
  Phone,
  Mail,
  ShieldCheck,
  Trophy,
  Zap,
  Award,
  Sparkles,
  ChevronRight,
  LayoutGrid
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { EventCard } from "@/components/events/EventCard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { cn } from "@/lib/utils"
import Footer from "@/components/layout/Footer"
import { toast } from "@/hooks/use-toast"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

export default function ProfilePageClient({ username }: { username: string }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<any>(null)
  const [type, setType] = React.useState<'user' | 'organization' | null>(null)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !data?.id || type !== 'organization') return null
    return query(
      collection(db, "events"), 
      where("organizationId", "==", data.id),
      where("status", "==", "Ativo"),
      orderBy("date", "asc")
    )
  }, [db, data?.id, type])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  React.useEffect(() => {
    if (!db || !username) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const uRef = doc(db, "usernames", username.toLowerCase());
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          const { uid, type: resType } = uSnap.data();
          setType(resType);
          const dataSnap = await getDoc(doc(db, resType === 'user' ? 'users' : 'organizations', uid));
          if (dataSnap.exists()) {
            setData({ id: dataSnap.id, ...dataSnap.data() });
          }
        }
      } catch (e) {
        console.error("Erro ao buscar perfil:", e);
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [db, username])

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      toast({ title: "Link copiado!", description: "Compartilhe este perfil com seus amigos." })
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 className="w-10 h-10 animate-spin text-secondary" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#f8fafc] text-center gap-6">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
        <Users className="w-10 h-10 text-muted-foreground opacity-20" />
      </div>
      <div className="space-y-2">
         <h1 className="text-2xl font-black uppercase italic tracking-tighter">Perfil não encontrado</h1>
         <p className="text-muted-foreground">O username <strong>@{username}</strong> não está vinculado a nenhuma conta ativa.</p>
      </div>
      <Button asChild variant="outline" className="rounded-xl px-8 h-12 font-bold uppercase text-[10px] tracking-widest">
        <Link href="/">Voltar ao Início</Link>
      </Button>
    </div>
  )

  const isVerified = data.verified || data.isVerified;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header Público */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-xl font-bold tracking-tight italic uppercase">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild variant="ghost" className="font-bold uppercase text-[10px] tracking-widest">
                <Link href="/dashboard">Meu Painel</Link>
              </Button>
            ) : (
              <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/20">
                <Link href="/login">Entrar</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="relative h-64 md:h-80 bg-primary overflow-hidden">
        {data.banner && (
          <img src={data.banner} className="w-full h-full object-cover opacity-60" alt="Banner" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Profile Info */}
      <div className="container mx-auto px-4 relative">
        <div className="max-w-6xl mx-auto -mt-20 space-y-8">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
                 <Avatar className="h-40 w-40 border-8 border-[#f8fafc] shadow-2xl rounded-[3rem]">
                    <AvatarImage src={data.avatar} className="object-cover" />
                    <AvatarFallback className="text-4xl font-black bg-muted text-muted-foreground">
                       {data.name?.charAt(0) || data.displayName?.charAt(0)}
                    </AvatarFallback>
                 </Avatar>
                 <div className="pb-4 space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                       <h1 className="text-4xl font-black uppercase italic tracking-tighter text-primary">
                         {data.name || data.displayName}
                       </h1>
                       {isVerified && <VerifiedBadge />}
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                       <Badge variant="outline" className="rounded-lg font-black uppercase text-[9px] tracking-widest px-3 h-6 border-secondary text-secondary bg-secondary/5">
                          @{username}
                       </Badge>
                       <Badge variant="secondary" className="rounded-lg font-black uppercase text-[9px] tracking-widest px-3 h-6">
                          {type === 'organization' ? (data.type || 'Organização') : 'Usuário'}
                       </Badge>
                    </div>
                 </div>
              </div>
              
              <div className="flex items-center justify-center gap-3 pb-4">
                 <Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-2" onClick={handleShare}>
                    <Share2 className="w-5 h-5" />
                 </Button>
                 {type === 'organization' ? (
                   <Button className="bg-secondary text-white font-black h-12 px-8 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105 gap-2">
                      <Heart className="w-4 h-4 fill-current" /> Seguir Marca
                   </Button>
                 ) : (
                   <Button className="bg-primary text-white font-black h-12 px-8 rounded-2xl shadow-xl uppercase italic transition-all hover:scale-105">
                      Seguir
                   </Button>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Sidebar Info */}
              <div className="lg:col-span-4 space-y-8">
                 <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader><CardTitle className="text-lg">Sobre</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                       <p className="text-sm text-muted-foreground leading-relaxed font-medium italic">
                          "{data.bio || (type === 'organization' ? 'Esta marca ainda não adicionou uma biografia.' : 'Este usuário prefere manter o mistério.')}"
                       </p>
                       
                       <Separator className="border-dashed" />

                       <div className="space-y-4">
                          {data.city && (
                            <div className="flex items-center gap-3 text-xs font-bold text-primary">
                               <MapPin className="w-4 h-4 text-secondary" />
                               {data.city}, {data.state}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs font-bold text-primary">
                             <Calendar className="w-4 h-4 text-secondary" />
                             Membro desde {data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('pt-BR') : '2024'}
                          </div>
                          {data.instagram && (
                             <a href={`https://instagram.com/${data.instagram.replace('@','')}`} target="_blank" className="flex items-center gap-3 text-xs font-bold text-primary hover:text-secondary transition-colors">
                                <Instagram className="w-4 h-4 text-secondary" />
                                @{data.instagram.replace('@','')}
                             </a>
                          )}
                          {data.website && (
                             <a href={data.website} target="_blank" className="flex items-center gap-3 text-xs font-bold text-primary hover:text-secondary transition-colors">
                                <Globe className="w-4 h-4 text-secondary" />
                                Website Oficial
                             </a>
                          )}
                       </div>
                    </CardContent>
                 </Card>

                 {type === 'organization' && (
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
                       <CardContent className="p-8 space-y-4 relative z-10">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Transparência</p>
                          <div className="space-y-1">
                             <h4 className="text-xl font-black italic uppercase tracking-tighter">Marca Verificada</h4>
                             <p className="text-xs opacity-70 leading-relaxed">Esta organização passou pelos critérios de validação da Viby e possui reputação positiva na plataforma.</p>
                          </div>
                          <div className="pt-2">
                             <Badge className="bg-secondary text-white border-none text-[9px] font-black uppercase px-3 h-6">Viby Verified</Badge>
                          </div>
                       </CardContent>
                       <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
                    </Card>
                 )}
              </div>

              {/* Main Content */}
              <div className="lg:col-span-8 space-y-8">
                 <Tabs defaultValue="events" className="w-full">
                    <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 mb-8">
                       <TabsTrigger value="events" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                          <LayoutGrid className="w-4 h-4" /> 
                          {type === 'organization' ? 'Bilheteria Ativa' : 'Interesses'}
                       </TabsTrigger>
                       <TabsTrigger value="history" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                          <Award className="w-4 h-4" /> Conquistas
                       </TabsTrigger>
                    </TabsList>

                    <TabsContent value="events" className="animate-in fade-in duration-500">
                       {type === 'organization' ? (
                          <div className="space-y-8">
                             <div className="flex flex-col gap-1">
                                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Próximas Experiências</h2>
                                <p className="text-muted-foreground text-sm font-medium">Confira o calendário oficial de {data.name}.</p>
                             </div>

                             {eventsLoading ? (
                               <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                             ) : events && events.length > 0 ? (
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  {events.map((event: any) => (
                                    <EventCard key={event.id} event={event} />
                                  ))}
                               </div>
                             ) : (
                               <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner flex flex-col items-center gap-4">
                                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                                     <Sparkles className="w-8 h-8 text-muted-foreground opacity-20" />
                                  </div>
                                  <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Nenhum evento com vendas abertas no momento.</p>
                               </div>
                             )}
                          </div>
                       ) : (
                          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner">
                             <p className="text-muted-foreground font-bold italic">O histórico de eventos deste usuário é privado.</p>
                          </div>
                       )}
                    </TabsContent>

                    <TabsContent value="history" className="animate-in fade-in duration-500">
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          {/* Placeholder para Gamificação Futura */}
                          {[1,2,3].map(i => (
                            <Card key={i} className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col items-center text-center gap-3 grayscale opacity-30">
                               <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                  <Award className="w-8 h-8 text-muted-foreground" />
                               </div>
                               <div className="space-y-1">
                                  <p className="font-black text-[10px] uppercase tracking-widest">Em Breve</p>
                                  <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight">Medalha de participação em eventos culturais.</p>
                               </div>
                            </Card>
                          ))}
                       </div>
                    </TabsContent>
                 </Tabs>
              </div>
           </div>
        </div>
      </div>

      <div className="mt-20">
        <Footer />
      </div>
    </div>
  )
}
