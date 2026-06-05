
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase"
import { 
  collection, 
  query, 
  where, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  serverTimestamp,
  limit,
  orderBy
} from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  Handshake, 
  Plus, 
  Search, 
  Loader2, 
  X, 
  CheckCircle2, 
  Clock, 
  UserMinus,
  Building2,
  BadgeCheck,
  ArrowRight,
  Inbox
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface EventCoOrganizersProps {
  eventId: string
  currentOrgId: string
  isPublic?: boolean
  className?: string
}

function PartnerItem({ partner }: { partner: any }) {
  const db = useFirestore();
  const orgRef = React.useMemo(() => db ? doc(db, "organizations", partner.orgId) : null, [db, partner.orgId]);
  const { data: organization, loading } = useDoc<any>(orgRef);

  if (loading) return (
    <div className="flex items-center gap-4 p-3 animate-pulse">
      <div className="h-14 w-14 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    </div>
  );
  
  if (!organization) return null;

  return (
    <Link 
      href={`/${organization.username || partner.orgUsername}`} 
      className="group flex items-center gap-4 hover:bg-muted/30 p-3 rounded-2xl transition-all border border-transparent hover:border-border"
    >
      <Avatar className="h-14 w-14 border-2 border-secondary/10 shrink-0 overflow-hidden">
         <AvatarImage src={organization.avatar} className="object-cover" />
         <AvatarFallback className="font-black bg-muted uppercase">
           {organization.name?.charAt(0)}
         </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
         <p className="font-black text-sm uppercase italic text-primary flex items-center gap-1.5 leading-tight flex-wrap">
            {organization.name}
            {(organization.verified || organization.isVerified) && <BadgeCheck className="w-4 h-4 fill-blue-500 text-white shrink-0" />}
         </p>
         <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-1 group-hover:underline">
           Ver Perfil da Marca
         </p>
      </div>
    </Link>
  );
}

export function EventCoOrganizers({ eventId, currentOrgId, isPublic, className }: EventCoOrganizersProps) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<any[]>([])
  const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null)

  const partnersQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return collection(db, "events", eventId, "partners")
  }, [db, eventId])

  const { data: partners, loading: partnersLoading } = useCollection<any>(partnersQuery)

  const handleSearch = async () => {
    if (!db || !searchTerm.trim() || isSearching) return
    setIsSearching(true)
    try {
      const cleanTerm = searchTerm.toLowerCase().replace('@', '').trim()
      
      // Busca 1: Via Índice de Usernames (Usando __name__ para prefixo em IDs)
      const qIndex = query(
        collection(db, "usernames"), 
        where("__name__", ">=", cleanTerm),
        where("__name__", "<=", cleanTerm + "\uf8ff"),
        limit(10)
      )
      const snapIndex = await getDocs(qIndex)
      
      let results = await Promise.all(snapIndex.docs.map(async (d) => {
        const data = d.data()
        if (data.type !== 'organization' || data.uid === currentOrgId) return null
        const orgSnap = await getDoc(doc(db, "organizations", data.uid))
        return orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data() } : null
      }))

      let finalResults = results.filter(Boolean)

      // Busca 2 (Fallback): Se não achou no índice, tenta busca direta na coleção de organizações
      if (finalResults.length === 0) {
        const qDirect = query(
          collection(db, "organizations"),
          where("username", ">=", cleanTerm),
          where("username", "<=", cleanTerm + "\uf8ff"),
          limit(5)
        )
        const snapDirect = await getDocs(qDirect)
        finalResults = snapDirect.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(o => o.id !== currentOrgId)
      }

      setSearchResults(finalResults)
      
      if (finalResults.length === 0) {
        toast({ title: "Nenhuma marca localizada", description: "Verifique o @username e tente novamente." })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na busca", description: "Não foi possível consultar os perfis." })
    } finally {
      setIsSearching(false)
    }
  }

  const handleInvite = async (org: any) => {
    if (!db || !eventId || !user) return
    setIsActionLoading(org.id)
    
    const partnerRef = doc(db, "events", eventId, "partners", org.id)
    const inviteData = {
      orgId: org.id,
      orgName: org.name,
      orgUsername: org.username,
      orgAvatar: org.avatar || "",
      status: 'pending',
      invitedAt: serverTimestamp(),
      invitedBy: user.uid,
      inviterOrgId: currentOrgId
    }

    try {
      await setDoc(partnerRef, inviteData)
      toast({ title: "Convite enviado!", description: `${org.name} foi convidado para a co-realização.` })
      setSearchResults([])
      setSearchTerm("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao convidar" })
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleRemove = async (partnerId: string) => {
    if (!db || !eventId) return
    if (!confirm("Remover este parceiro do evento?")) return

    setIsActionLoading(partnerId)
    try {
      await deleteDoc(doc(db, "events", eventId, "partners", partnerId))
      toast({ title: "Parceria removida" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    } finally {
      setIsActionLoading(null)
    }
  }

  if (isPublic) {
    const acceptedPartners = partners?.filter(p => p.status === 'accepted') || []
    if (acceptedPartners.length === 0) return null

    return (
      <Card className={cn("border-none shadow-sm rounded-[2rem] bg-white p-8", className)}>
        <h3 className="text-xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-3 text-primary border-b border-dashed pb-4">
          <Handshake className="w-5 h-5 text-secondary" /> Co-realização
        </h3>
        <div className="grid grid-cols-1 gap-4">
           {acceptedPartners.map(p => (
             <PartnerItem key={p.id} partner={p} />
           ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white", className)}>
      <CardHeader className="bg-muted/30 border-b p-8">
        <div className="flex justify-between items-center">
           <div className="space-y-1">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                <Handshake className="w-5 h-5 text-secondary" /> Co-organizadores
              </CardTitle>
              <CardDescription className="font-medium">Convide outras marcas para aparecerem no anúncio do evento.</CardDescription>
           </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
         <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Buscar por @username</Label>
            <div className="flex gap-2">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Ex: @vibe_night" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-xl h-11 border-dashed border-secondary/30"
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
               </div>
               <Button variant="secondary" onClick={handleSearch} disabled={isSearching} className="h-11 rounded-xl px-6 font-bold">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
               </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-2 p-2 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-top-2">
                 {searchResults.map(org => (
                   <div key={org.id} className="flex items-center justify-between p-3 hover:bg-white rounded-xl transition-all">
                      <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10 border shadow-sm overflow-hidden">
                            <AvatarImage src={org.avatar} className="object-cover" />
                            <AvatarFallback className="font-bold">{org.name?.charAt(0)}</AvatarFallback>
                         </Avatar>
                         <div className="flex flex-col">
                            <span className="text-sm font-bold">{org.name}</span>
                            <span className="text-[10px] text-secondary font-black uppercase">@{org.username}</span>
                         </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleInvite(org)} 
                        disabled={isActionLoading === org.id || partners?.some(p => p.orgId === org.id)}
                        className="h-8 rounded-lg bg-secondary text-white font-black text-[9px] uppercase gap-1.5 shadow-lg"
                      >
                         {isActionLoading === org.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                         Convidar
                      </Button>
                   </div>
                 ))}
              </div>
            )}
         </div>

         <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Integrantes do Projeto</h4>
            {partnersLoading ? <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div> : 
             partners && partners.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {partners.map(p => (
                    <div key={p.id} className={cn(
                      "p-4 rounded-2xl border flex items-center justify-between transition-all",
                      p.status === 'accepted' ? "bg-green-50/20 border-green-100" : "bg-muted/10 border-border/50"
                    )}>
                       <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 overflow-hidden">
                             <AvatarImage src={p.orgAvatar} className="object-cover" />
                             <AvatarFallback className="font-bold uppercase">{p.orgName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                             <span className="text-sm font-bold leading-tight line-clamp-1">{p.orgName}</span>
                             <div className="flex items-center gap-2">
                                <span className="text-[9px] text-muted-foreground font-black uppercase">@{p.orgUsername}</span>
                                {p.status === 'pending' ? (
                                  <Badge variant="outline" className="text-[7px] h-4 font-black uppercase text-orange-500 bg-orange-50 border-orange-200">Aguardando</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[7px] h-4 font-black uppercase text-green-600 bg-green-50 border-green-200">Parceiro</Badge>
                                )}
                             </div>
                          </div>
                       </div>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-8 w-8 text-destructive hover:bg-red-50 rounded-full" 
                         onClick={() => handleRemove(p.id)}
                         disabled={isActionLoading === p.id}
                       >
                          <X className="w-4 h-4" />
                       </Button>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="py-10 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed">
                  <Building2 className="w-10 h-10 mx-auto text-muted-foreground opacity-10 mb-2" />
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sem parceiros vinculados</p>
               </div>
             )}
         </div>
      </CardContent>
    </Card>
  )
}
