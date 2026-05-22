
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp, useDoc } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  writeBatch,
  serverTimestamp,
  deleteField
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, 
  Search, 
  Users, 
  Building2, 
  User as UserIcon,
  Trash2,
  Edit,
  Save,
  Upload,
  Info,
  Check,
  X,
  Star,
  Globe,
  Camera,
  MapPin,
  Fingerprint,
  Instagram,
  Settings,
  Mail,
  Phone,
  Calendar,
  Trophy,
  Percent,
  Coins,
  Ticket,
  CalendarDays,
  BadgeCheck,
  EyeOff,
  Clock,
  RefreshCcw
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const ORG_TYPES = [
  "Produtora de Eventos", "Casa Noturna", "Bar", "Pub", "Restaurante", 
  "Agência de Marketing", "ONG / Instituição", "Artista / Músico", "Outro"
]

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])

  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState("usuarios")
  
  const [editingUser, setEditingUser] = React.useState<any>(null)
  const [isEditUserOpen, setIsEditUserOpen] = React.useState(false)

  const [editingOrg, setEditingOrg] = React.useState<any>(null)
  const [isEditOrgOpen, setIsEditOrgOpen] = React.useState(false)
  
  const [isSaving, setIsSaving] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [checkingUsername, setCheckingUsername] = React.useState(false)
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')

  const usersQuery = useMemoFirebase(() => db ? query(collection(db, "users"), orderBy("createdAt", "desc")) : null, [db])
  const { data: users, loading: loadingUsers } = useCollection<any>(usersQuery)

  const orgsQuery = useMemoFirebase(() => db ? query(collection(db, "organizations"), orderBy("createdAt", "desc")) : null, [db])
  const { data: orgs, loading: loadingOrgs } = useCollection<any>(orgsQuery)

  const plansRef = React.useMemo(() => db ? doc(db, 'settings', 'plans') : null, [db])
  const { data: plansSettings } = useDoc<any>(plansRef)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: allEvents } = useCollection<any>(eventsQuery)

  const orgEventCounts = React.useMemo(() => {
    if (!allEvents) return {}
    const counts: Record<string, number> = {}
    allEvents.forEach((e: any) => {
      if (e.organizationId && e.status !== 'Excluído') {
        counts[e.organizationId] = (counts[e.organizationId] || 0) + 1
      }
    })
    return counts
  }, [allEvents])

  const filteredUsers = React.useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      u.name?.toLowerCase().includes(search.toLowerCase()) || 
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    )
  }, [users, search])

  const filteredOrgs = React.useMemo(() => {
    if (!orgs) return []
    return orgs.filter(o => 
      o.name?.toLowerCase().includes(search.toLowerCase()) || 
      o.username?.toLowerCase().includes(search.toLowerCase())
    )
  }, [orgs, search])

  React.useEffect(() => {
    if (!db) return
    const target = activeTab === 'usuarios' ? editingUser : editingOrg
    if (!target?.username) return

    const normalized = target.username.toLowerCase().trim()
    const original = (activeTab === 'usuarios' ? users?.find(u => u.id === target.id) : orgs?.find(o => o.id === target.id))?.username

    if (normalized === original) {
      setUsernameStatus('idle')
      return
    }

    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", normalized)
        const usernameSnap = await getDoc(usernameRef)
        setUsernameStatus(usernameSnap.exists() ? 'taken' : 'valid')
      } catch (e) {
        console.error(e)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [editingUser?.username, editingOrg?.username, activeTab, db, users, orgs])

  const handleImageUpload = async (file: File, type: 'avatar' | 'banner', targetId: string, coll: 'users' | 'organizations') => {
    if (!storage) return
    setUploadProgress(0)
    try {
      const path = `${coll}/${targetId}/${type}_${Date.now()}`
      const storageRef = ref(storage, path)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', 
        (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }) },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          if (coll === 'users') setEditingUser((p: any) => ({ ...p, [type]: downloadURL }))
          else setEditingOrg((p: any) => ({ ...p, [type]: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (e) { setUploadProgress(null) }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingUser || isSaving) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const original = users?.find(u => u.id === editingUser.id)
      if (editingUser.username !== original?.username) {
        if (original?.username) batch.delete(doc(db, "usernames", original.username))
        batch.set(doc(db, "usernames", editingUser.username.toLowerCase()), { uid: editingUser.id, type: 'user' })
      }
      const { id, ...data } = editingUser
      batch.update(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() })
      await batch.commit()
      toast({ title: "Usuário atualizado!" })
      setIsEditUserOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Erro ao salvar" }) }
    finally { setIsSaving(false) }
  }

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingOrg || isSaving) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const original = orgs?.find(o => o.id === editingOrg.id)
      if (editingOrg.username !== original?.username) {
        if (original?.username) batch.delete(doc(db, "usernames", original.username))
        batch.set(doc(db, "usernames", editingOrg.username.toLowerCase()), { uid: editingOrg.id, type: 'organization' })
      }
      const { id, ...data } = editingOrg
      batch.update(doc(db, "organizations", id), { ...data, updatedAt: serverTimestamp() })
      await batch.commit()
      toast({ title: "Página atualizada!" })
      setIsEditOrgOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Erro ao salvar" }) }
    finally { setIsSaving(false) }
  }

  const handleOverrideField = (field: string, value: any) => {
    setEditingUser((prev: any) => ({
      ...prev,
      planOverride: {
        ...(prev.planOverride || {}),
        [field]: value
      }
    }))
  }

  const handlePlanChange = (newPlan: string) => {
    if (!editingUser || !plansSettings) return;
    const planKey = newPlan.toLowerCase();
    const defaults = plansSettings[planKey] || {};
    setEditingUser((prev: any) => ({
      ...prev,
      plan: newPlan,
      planOverride: {
        maxOrganizations: defaults.maxOrganizations ?? 1,
        maxActiveEvents: defaults.maxActiveEvents ?? 1,
        maxTicketsPerEvent: defaults.maxTicketsPerEvent ?? 30,
        feePercent: defaults.feePercent ?? 16,
        minFeeAmount: defaults.minFeeAmount ?? 9.99,
        hasReports: defaults.hasReports ?? false
      }
    }));
  }

  const handleReactivateOrg = async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'organizations', id), {
        status: 'Ativo',
        deletionScheduledAt: deleteField(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Marca reativada!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao reativar" });
    }
  };

  const safeNumberValue = (val: any) => {
    if (val === undefined || val === null || Number.isNaN(val)) return ""
    return val.toString()
  }

  const getOrgStatusBadge = (status: string, deletionDate?: string) => {
    if (status === 'Exclusão Programada') {
      const remaining = deletionDate ? Math.ceil((new Date(deletionDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[9px] font-black uppercase flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> Exclui em {remaining}d
        </Badge>
      );
    }
    if (status === 'Desativado') return <Badge variant="secondary" className="text-[9px] font-black uppercase opacity-60">Oculta</Badge>;
    if (status === 'Bloqueado') return <Badge variant="destructive" className="text-[9px] font-black uppercase">Bloqueada</Badge>;
    return <Badge className="bg-green-500 text-white text-[9px] font-black uppercase h-5">Ativa</Badge>;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Gestão de Identidades</h1>
        <p className="text-muted-foreground font-medium">Controle administrativo sobre usuários e páginas de marcas.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, e-mail ou @..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-11"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-11">
            <TabsTrigger value="usuarios" className="rounded-lg px-6 font-bold gap-2"><Users className="w-4 h-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="paginas" className="rounded-lg px-6 font-bold gap-2"><Building2 className="w-4 h-4" /> Páginas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="usuarios" className="m-0">
             <Table>
               <TableHeader className="bg-muted/30">
                 <TableRow>
                   <TableHead className="font-bold">Usuário</TableHead>
                   <TableHead className="font-bold">Cargo</TableHead>
                   <TableHead className="font-bold text-center">Plano</TableHead>
                   <TableHead className="text-center font-bold">Verificado</TableHead>
                   <TableHead className="text-right font-bold">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {loadingUsers ? (
                   <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                 ) : filteredUsers.map(user => (
                   <TableRow key={user.id} className="hover:bg-muted/10">
                     <TableCell>
                       <div className="flex items-center gap-3">
                         <Avatar className="h-9 w-9"><AvatarImage src={user.avatar} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                         <div className="flex flex-col"><span className="font-bold text-sm">{user.name}</span><span className="text-[10px] text-muted-foreground">@{user.username}</span></div>
                       </div>
                     </TableCell>
                     <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase">{user.role}</Badge></TableCell>
                     <TableCell className="text-center"><Badge className="text-[9px] font-black uppercase bg-primary">{user.plan || 'START'}</Badge></TableCell>
                     <TableCell className="text-center">{user.isVerified && <VerifiedBadge className="mx-auto" />}</TableCell>
                     <TableCell className="text-right">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => { setEditingUser(user); setIsEditUserOpen(true); }}><Edit className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { if(confirm('Excluir usuário?')){ await deleteDoc(doc(db!, "users", user.id)); if(user.username) await deleteDoc(doc(db!, "usernames", user.username.toLowerCase())); toast({title:"Excluído"}); } }}><Trash2 className="w-4 h-4" /></Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
          </TabsContent>

          <TabsContent value="paginas" className="m-0">
             <Table>
               <TableHeader className="bg-muted/30">
                 <TableRow>
                   <TableHead className="font-bold">Página / Marca</TableHead>
                   <TableHead className="font-bold">Status Visibilidade</TableHead>
                   <TableHead className="font-bold text-center">Eventos</TableHead>
                   <TableHead className="text-center font-bold">Verificado</TableHead>
                   <TableHead className="text-right font-bold">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {loadingOrgs ? (
                   <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                 ) : filteredOrgs.map(org => (
                   <TableRow key={org.id} className="hover:bg-muted/10">
                     <TableCell>
                       <div className="flex items-center gap-3">
                         <Avatar className="h-9 w-9"><AvatarImage src={org.avatar} className="object-cover" /><AvatarFallback>{org.name?.charAt(0)}</AvatarFallback></Avatar>
                         <div className="flex flex-col"><span className="font-bold text-sm">{org.name}</span><span className="text-[10px] text-secondary font-bold">@{org.username}</span></div>
                       </div>
                     </TableCell>
                     <TableCell>{getOrgStatusBadge(org.status || 'Ativo', org.deletionScheduledAt)}</TableCell>
                     <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-black text-sm">
                           <Calendar className="w-3.5 h-3.5 text-secondary" />
                           {orgEventCounts[org.id] || 0}
                        </div>
                     </TableCell>
                     <TableCell className="text-center">{org.verified && <VerifiedBadge className="mx-auto" />}</TableCell>
                     <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1">
                          {(org.status === 'Desativado' || org.status === 'Exclusão Programada') && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleReactivateOrg(org.id)} title="Reativar Manualmente">
                               <RefreshCcw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => { setEditingOrg(org); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { if(confirm('Excluir página permanentemente?')){ await deleteDoc(doc(db!, "organizations", org.id)); if(org.username) await deleteDoc(doc(db!, "usernames", org.username.toLowerCase())); toast({title:"Página Removida"}); } }}><Trash2 className="w-4 h-4" /></Button>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
          </TabsContent>
        </Tabs>
      </Card>

      {/* DIALOG EDITAR USUÁRIO PESSOAL */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem]">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><UserIcon className="w-6 h-6 text-primary" /></div>
                <div>
                   <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Gerenciar Usuário: {editingUser?.name}</DialogTitle>
                   <DialogDescription className="font-medium">Gestão de perfil, permissões e limites de plano.</DialogDescription>
                </div>
              </div>
           </DialogHeader>

           <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                 <Tabs defaultValue="perfil" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b h-14 bg-transparent px-8 gap-8">
                       <TabsTrigger value="perfil" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold uppercase text-[10px] tracking-widest">Identidade</TabsTrigger>
                       <TabsTrigger value="plano" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><Trophy className="w-3 h-3" /> Plano e Limites</TabsTrigger>
                    </TabsList>

                    <TabsContent value="perfil" className="p-8 space-y-8">
                       <div className="flex flex-col items-center gap-4">
                          <div className="relative group">
                             <Avatar className="h-28 w-28 border-4 border-white shadow-xl">
                                <AvatarImage src={editingUser?.avatar} />
                                <AvatarFallback>{editingUser?.name?.charAt(0)}</AvatarFallback>
                             </Avatar>
                             <label htmlFor="adm-user-avatar" className="absolute inset-0 bg-black/30 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"><Camera className="w-6 h-6" /></label>
                             <input id="adm-user-avatar" type="file" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatar', editingUser.id, 'users')} />
                          </div>
                          {uploadProgress !== null && <Progress value={uploadProgress} className="w-full max-w-xs h-1" />}
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2"><Label>Nome Completo</Label><Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl h-11" required /></div>
                          <div className="space-y-2">
                             <Label>Username (@)</Label>
                             <div className="relative">
                                <Input value={editingUser?.username || ""} onChange={e => setEditingUser({...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} className="rounded-xl h-11 pr-10" />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                   {checkingUsername && <Loader2 className="w-4 h-4 animate-spin opacity-40" />}
                                </div>
                             </div>
                          </div>
                          <div className="space-y-2"><Label>E-mail</Label><Input value={editingUser?.email || ""} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="rounded-xl h-11" required /></div>
                          <div className="space-y-2">
                             <Label>Cargo / Permissão</Label>
                             <Select value={editingUser?.role || "user"} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl"><SelectItem value="user">Usuário Comum</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
                             </Select>
                          </div>
                       </div>
                    </TabsContent>

                    <TabsContent value="plano" className="p-8 space-y-10">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                             <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Trophy className="w-4 h-4" /> Assinatura Base
                             </h3>
                             <div className="space-y-2">
                                <Label>Alterar Plano Ativo</Label>
                                <Select value={editingUser?.plan || "START"} onValueChange={handlePlanChange}>
                                   <SelectTrigger className="rounded-xl h-12 bg-muted/30 border-none font-black uppercase italic"><SelectValue /></SelectTrigger>
                                   <SelectContent className="rounded-xl">
                                      <SelectItem value="START" className="font-bold uppercase">Viby Start</SelectItem>
                                      <SelectItem value="PRO" className="font-bold uppercase">Viby Pro</SelectItem>
                                      <SelectItem value="TOP" className="font-bold uppercase">Viby Top</SelectItem>
                                   </SelectContent>
                                </Select>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/10 p-8 rounded-[2rem] border-2 border-dashed">
                          <div className="space-y-6">
                             <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Máx. Organizações</Label>
                                <Input 
                                  type="number" 
                                  value={safeNumberValue(editingUser?.planOverride?.maxOrganizations)} 
                                  onChange={e => handleOverrideField('maxOrganizations', e.target.value === "" ? 0 : parseInt(e.target.value))} 
                                  className="rounded-xl" 
                                />
                             </div>
                             <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" /> Máx. Eventos Ativos</Label>
                                <Input 
                                  type="number" 
                                  value={safeNumberValue(editingUser?.planOverride?.maxActiveEvents)} 
                                  onChange={e => handleOverrideField('maxActiveEvents', e.target.value === "" ? 0 : parseInt(e.target.value))} 
                                  className="rounded-xl" 
                                />
                             </div>
                          </div>

                          <div className="space-y-6">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Percent className="w-3.5 h-3.5" /> Taxa %</Label>
                                   <Input 
                                      type="number" 
                                      step="0.1" 
                                      value={safeNumberValue(editingUser?.planOverride?.feePercent)} 
                                      onChange={e => handleOverrideField('feePercent', e.target.value === "" ? 0 : parseFloat(e.target.value))} 
                                      className="rounded-xl" 
                                   />
                                </div>
                                <div className="space-y-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Coins className="w-3.5 h-3.5" /> Mín (R$)</Label>
                                   <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={safeNumberValue(editingUser?.planOverride?.minFeeAmount)} 
                                      onChange={e => handleOverrideField('minFeeAmount', e.target.value === "" ? 0 : parseFloat(e.target.value))} 
                                      className="rounded-xl" 
                                   />
                                </div>
                             </div>
                          </div>
                       </div>
                    </TabsContent>
                 </Tabs>
              </ScrollArea>
              
              <DialogFooter className="p-8 bg-muted/30 border-t gap-3">
                 <Button type="button" variant="ghost" onClick={() => setIsEditUserOpen(false)} className="rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
                 <Button type="submit" disabled={isSaving || (usernameStatus === 'taken')} className="bg-primary text-white font-black h-14 rounded-2xl px-12 shadow-xl uppercase italic">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Alterações
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
