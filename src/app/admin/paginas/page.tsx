
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  getDoc, 
  writeBatch,
  serverTimestamp,
  deleteField,
  where,
  getDocs,
  limit,
  setDoc,
  deleteDoc
} from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  Search, 
  Building2, 
  Trash2,
  Edit,
  Save,
  BadgeCheck,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Eye,
  EyeOff,
  ShieldBan,
  AtSign,
  AlertTriangle,
  Users,
  ArrowRightLeft,
  Calendar,
  Layers,
  ChevronRight,
  UserX,
  Handshake,
  TrendingUp,
  Plus,
  Layout,
  X,
  User
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

const ORG_ROLES = [
  { value: 'owner', label: 'Proprietário' },
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'moderador', label: 'Moderador' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'suporte', label: 'Suporte' },
];

export default function AdminPaginasPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [activeTypeFilter, setActiveTypeFilter] = React.useState("all")
  
  const [editingOrg, setEditingOrg] = React.useState<any>(null)
  const [isEditOrgOpen, setIsEditOrgOpen] = React.useState(false)
  
  const [transferOrg, setTransferOrg] = React.useState<any>(null)
  const [isTransferOpen, setIsTransferOpen] = React.useState(false)
  const [newOwnerUsername, setNewOwnerUsername] = React.useState("")
  
  const [isSaving, setIsSaving] = React.useState(false)

  const orgsQuery = useMemoFirebase(() => db ? query(collection(db, "organizations"), orderBy("createdAt", "desc")) : null, [db])
  const { data: orgs, loading: loadingOrgs } = useCollection<any>(orgsQuery)

  const [enrichedOrgs, setEnrichedOrgs] = React.useState<any[]>([])

  // Efeito para buscar usernames dos proprietários
  React.useEffect(() => {
    if (!orgs || !db) return;

    const fetchOwners = async () => {
      const ownersToFetch = Array.from(new Set(orgs.map(o => o.ownerId).filter(Boolean)));
      const ownerMap: Record<string, any> = {};

      await Promise.all(ownersToFetch.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid as string));
          if (snap.exists()) ownerMap[uid as string] = snap.data();
        } catch (e) {}
      }));

      setEnrichedOrgs(orgs.map(o => ({
        ...o,
        ownerProfile: o.ownerId ? ownerMap[o.ownerId] : null
      })));
    };

    fetchOwners();
  }, [orgs, db]);

  const filteredOrgs = React.useMemo(() => {
    const list = enrichedOrgs.length > 0 ? enrichedOrgs : (orgs || []);
    return list.filter(o => {
      const matchSearch = (o.name?.toLowerCase() || "").includes(search.toLowerCase()) || 
                          (o.username?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (o.ownerProfile?.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (o.ownerProfile?.username?.toLowerCase() || "").includes(search.toLowerCase());
      const matchType = activeTypeFilter === 'all' || o.type === activeTypeFilter;
      return matchSearch && matchType && o.status !== 'Excluído';
    })
  }, [enrichedOrgs, orgs, search, activeTypeFilter])

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingOrg || isSaving) return
    setIsSaving(true)
    try {
      const { id, ownerProfile, ...data } = editingOrg
      await updateDoc(doc(db, "organizations", id), { ...data, updatedAt: serverTimestamp() })
      toast({ title: "Página atualizada!" })
      setIsEditOrgOpen(false)
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro ao salvar" }) 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleToggleBlock = async (id: string, currentStatus: string) => {
    if (!db) return
    const isBlocked = currentStatus === 'Bloqueado'
    const newStatus = isBlocked ? 'Ativo' : 'Bloqueado'
    try {
      await updateDoc(doc(db, "organizations", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        blockReason: newStatus === 'Bloqueado' ? "Suspensão Administrativa." : deleteField()
      });
      toast({ title: isBlocked ? "Página Ativada" : "Página Suspensa" });
    } catch (e) { toast({ variant: "destructive", title: "Erro ao atualizar" }) }
  }

  const handleSoftDelete = async (id: string, name: string) => {
    if (!db || !confirm(`Remover permanentemente a marca "${name}"?`)) return
    try {
      await updateDoc(doc(db, "organizations", id), { status: 'Excluído', updatedAt: serverTimestamp() });
      toast({ title: "Página removida da listagem." });
    } catch (e) { toast({ variant: "destructive", title: "Erro ao excluir" }) }
  }

  const handleTransferOwnership = async () => {
    if (!db || !transferOrg || !newOwnerUsername) return
    setIsSaving(true)
    try {
      const cleanUser = newOwnerUsername.toLowerCase().trim().replace('@', '')
      const uSnap = await getDoc(doc(db, "usernames", cleanUser))
      if (!uSnap.exists() || uSnap.data().type !== 'user') throw new Error("Usuário não encontrado.")

      const newOwnerUid = uSnap.data().uid
      const batch = writeBatch(db)

      const membersQ = query(collection(db, "organizations", transferOrg.id, "members"), where("role", "==", "owner"), limit(1))
      const membersSnap = await getDocs(membersQ)
      if (!membersSnap.empty) batch.update(membersSnap.docs[0].ref, { role: 'admin', updatedAt: serverTimestamp() })

      batch.set(doc(db, "organizations", transferOrg.id, "members", newOwnerUid), {
        userId: newOwnerUid, role: 'owner', status: 'accepted', updatedAt: serverTimestamp()
      }, { merge: true })

      batch.update(doc(db, "organizations", transferOrg.id), { ownerId: newOwnerUid, updatedAt: serverTimestamp() })
      await batch.commit()
      toast({ title: "Titularidade Transferida!" })
      setIsTransferOpen(false)
    } catch (e: any) { toast({ variant: "destructive", title: "Falha", description: e.message }) }
    finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Building2 className="w-8 h-8 text-secondary" /> Gestão de Páginas
        </h1>
        <p className="text-muted-foreground font-medium">Controle total sobre marcas, organizações e co-realizadores.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Nome, @username ou slug..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl h-11" />
        </div>
        <Select value={activeTypeFilter} onValueChange={setActiveTypeFilter}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent className="rounded-xl">
             <SelectItem value="all">Todas as Categorias</SelectItem>
             <SelectItem value="Produtora de Eventos">Produtoras</SelectItem>
             <SelectItem value="ONG">ONGs / Social</SelectItem>
             <SelectItem value="Artista">Artistas / DJs</SelectItem>
             <SelectItem value="Empresa">Empresas</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center justify-center bg-muted/50 rounded-xl border text-[10px] font-black uppercase text-muted-foreground">
          {filteredOrgs.length} Páginas Ativas
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[9px] tracking-widest p-6">Marca / Identidade</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Proprietário</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Categoria</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[9px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingOrgs ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredOrgs.map(org => (
              <TableRow key={org.id} className={cn("hover:bg-muted/5 transition-colors", org.status === 'Bloqueado' && "bg-destructive/[0.02]")}>
                <TableCell className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={org.avatar} className="object-cover" /><AvatarFallback className="font-black">{org.name?.charAt(0)}</AvatarFallback></Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5"><span className="font-bold text-sm uppercase italic text-primary">{org.name}</span>{org.verified && <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white" />}</div>
                      <span className="text-[10px] text-secondary font-black uppercase tracking-tight">@{org.username}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col">
                      <span className="text-xs font-bold text-primary">{org.ownerProfile?.name || "N/A"}</span>
                      <span className="text-[10px] text-muted-foreground">@{org.ownerProfile?.username || "---"}</span>
                   </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary">{org.type || 'Geral'}</Badge></TableCell>
                <TableCell className="text-center">
                   <Badge className={cn("text-[8px] font-black uppercase h-5", org.status === 'Bloqueado' ? "bg-red-500" : "bg-green-500")}>{org.status || 'Ativo'}</Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => { setEditingOrg(org); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setTransferOrg(org); setIsTransferOpen(true); }} title="Transferir Titularidade"><ArrowRightLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8", org.status === 'Bloqueado' ? "text-green-600" : "text-orange-500")} onClick={() => handleToggleBlock(org.id, org.status)} title="Suspender/Ativar"><ShieldBan className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleSoftDelete(org.id, org.name)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* DIALOG EDIÇÃO COMPLETA */}
      <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Painel de Moderação: {editingOrg?.name}</DialogTitle>
              <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Controle total sobre dados, visibilidade e equipe.</DialogDescription>
           </DialogHeader>
           <form onSubmit={handleUpdateOrg} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-8">
                 <div className="space-y-10 pb-10">
                    <section className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Globe className="w-4 h-4" /> Dados de Acesso e URL</h3>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Username (@)</Label><Input value={editingOrg?.username || ""} onChange={e => setEditingOrg({...editingOrg, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} className="rounded-xl h-11" /></div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Slug (URL)</Label><Input value={editingOrg?.slug || ""} onChange={e => setEditingOrg({...editingOrg, slug: e.target.value.toLowerCase().replace(/\s+/g, "-")})} className="rounded-xl h-11" /></div>
                       </div>
                    </section>
                    <Separator className="border-dashed" />
                    <section className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layout className="w-4 h-4" /> Visibilidade e Status</h3>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Selo Verificado</Label><div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-dashed"><ShieldCheck className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold uppercase flex-1">Oficial</span><Switch checked={editingOrg?.verified || false} onCheckedChange={v => setEditingOrg({...editingOrg, verified: v})} /></div></div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Status de Rede</Label><Select value={editingOrg?.status || "Ativo"} onValueChange={v => setEditingOrg({...editingOrg, status: v})}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="Ativo">Ativo / Público</SelectItem><SelectItem value="Privado">Privado (Invisível Busca)</SelectItem><SelectItem value="Bloqueado">Suspenso</SelectItem></SelectContent></Select></div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Analytics Público</Label><div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-dashed"><TrendingUp className="w-5 h-5 text-secondary" /><span className="text-xs font-bold uppercase flex-1">Exibir métricas</span><Switch checked={editingOrg?.showStats ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showStats: v})} /></div></div>
                       </div>
                    </section>
                    <Separator className="border-dashed" />
                    <section className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Equipe Vinculada</h3>
                       <OrgMembersList orgId={editingOrg?.id} />
                    </section>
                 </div>
              </ScrollArea>
              <DialogFooter className="p-8 border-t bg-muted/30"><Button type="submit" disabled={isSaving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">{isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Todas as Alterações</Button></DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG TRANSFERÊNCIA */}
      <Dialog open={!!isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem]">
           <DialogHeader><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Transferir Titularidade</DialogTitle></DialogHeader>
           <div className="space-y-6 py-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Username do Novo Owner (@)</Label><Input placeholder="Ex: @joaosilva" value={newOwnerUsername} onChange={e => setNewOwnerUsername(e.target.value)} className="h-12 rounded-xl" /></div>
              <div className="p-4 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 text-[10px] text-orange-800 font-bold uppercase leading-relaxed italic">O proprietário atual será rebaixado para Administrador e o novo titular terá controle total sobre finanças e equipe.</div>
           </div>
           <DialogFooter><Button onClick={handleTransferOwnership} disabled={isSaving || !newOwnerUsername} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">{isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Transferência"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrgMembersList({ orgId }: { orgId: string }) {
  const db = useFirestore()
  const [newMemberUser, setNewMemberUser] = React.useState("")
  const [adding, setAdding] = React.useState(false)

  const membersQuery = useMemoFirebase(() => orgId && db ? collection(db, "organizations", orgId, "members") : null, [db, orgId])
  const { data: members, loading } = useCollection<any>(membersQuery)
  
  const [membersWithProfiles, setMembersWithProfiles] = React.useState<any[]>([])
  
  React.useEffect(() => {
    if (!members || !db) return
    const fetch = async () => {
      const results = await Promise.all(members.map(async (m) => {
        try {
          const uSnap = await getDoc(doc(db, "users", m.userId))
          return { ...m, profile: uSnap.exists() ? uSnap.data() : null }
        } catch (e) {
          return { ...m, profile: null }
        }
      }))
      setMembersWithProfiles(results)
    }
    fetch()
  }, [members, db])

  const handleAdd = async () => {
    if (!db || !orgId || !newMemberUser) return
    setAdding(true)
    try {
      const cleanUser = newMemberUser.toLowerCase().trim().replace('@', '')
      const uSnap = await getDoc(doc(db, "usernames", cleanUser))
      if (!uSnap.exists()) throw new Error("Usuário não encontrado.")
      await setDoc(doc(db, "organizations", orgId, "members", uSnap.data().uid), { userId: uSnap.data().uid, role: 'editor', status: 'accepted', updatedAt: serverTimestamp() })
      setNewMemberUser(""); toast({ title: "Membro adicionado!" })
    } catch (e: any) { toast({ variant: "destructive", title: "Erro", description: e.message }) }
    finally { setAdding(false) }
  }

  const handleRemove = async (uid: string) => {
    if (!db || !orgId || !confirm("Remover acesso?")) return
    await deleteDoc(doc(db, "organizations", orgId, "members", uid))
    toast({ title: "Acesso removido" })
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-secondary" /></div>

  return (
    <div className="space-y-4">
       <div className="flex gap-2">
          <Input placeholder="Vincular @username..." value={newMemberUser} onChange={e => setNewMemberUser(e.target.value)} className="rounded-xl h-10" />
          <Button type="button" size="sm" onClick={handleAdd} disabled={adding} className="bg-secondary text-white font-bold h-10 px-4 rounded-xl uppercase text-[10px]">Adicionar</Button>
       </div>
       <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {membersWithProfiles.map(m => (
            <div key={m.userId} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
               <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border border-background shadow-sm">
                    <AvatarImage src={m.profile?.avatar} className="object-cover" />
                    <AvatarFallback className="text-[10px] font-bold bg-muted">{m.profile?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                     <span className="text-xs font-bold text-primary truncate max-w-[120px]">{m.profile?.name || "Usuário"}</span>
                     <span className="text-[10px] text-muted-foreground font-medium">@{m.profile?.username || m.userId.slice(0, 8)}</span>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[8px] font-black uppercase">{m.role}</Badge>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemove(m.userId)}><X className="w-3 h-3" /></Button>
               </div>
            </div>
          ))}
       </div>
    </div>
  )
}
