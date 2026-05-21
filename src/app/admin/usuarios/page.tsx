
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  where, 
  writeBatch,
  serverTimestamp 
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
  Calendar
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
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"

const ORG_TYPES = [
  "Produtora de Eventos", "Casa Noturna", "Bar", "Pub", "Restaurante", 
  "Agência de Marketing", "ONG / Instituição", "Artista / Músico", "Outro"
]

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" className={cn("w-5 h-5", className)} xmlns="http://www.w3.org/2000/svg">
      <path fill="#0095f6" d="M117.2 60.1l-6.5-6.6 2.3-9c1.1-4.4-1.2-8.9-5.3-10.7l-8.4-3.7-2.3-9c-1.1-4.4-5.2-7.4-9.7-7l-9.2.7-6.5-6.6c-3.2-3.2-8.2-3.2-11.4 0l-6.5 6.6-9.2-.7c-4.5-.4-8.6 2.6-9.7 7l-2.3 9-8.4 3.7c-4.1 1.8-6.4 6.3-5.3 10.7l2.3 9-6.5 6.6c-3.2 3.2-3.2 8.2 0 11.4l6.5 6.6-2.3 9c-1.1-4.4 1.2-8.9-5.3 10.7l8.4 3.7 2.3 9c1.1-4.4 5.2-7.4 9.7 7l9.2-.7 6.5 6.6c1.6 1.6 3.7 2.4 5.7 2.4s4.1-.8 5.7-2.4l6.5-6.6 9.2.7c.4 0 .7.1 1.1.1 4.1 0 7.9-3 8.6-7.1l2.3-9 8.4-3.7c4.1-1.8 6.3-5.3 10.7-5.3l2.3 9-6.5 6.6c3.2-3.2 3.2-8.2 0-11.4z" />
      <path fill="#fff" d="M57.6 86.8c-1.8 0-3.5-.7-4.8-2L38.2 70.2c-2.7-2.7-2.7-7 0-9.6s7-2.7 9.6 0l9.8 9.8 22.8-22.8c2.7-2.7 7-2.7 9.6 0s2.7 7 0 9.6L62.4 84.8c-1.3 1.3-3 2-4.8 2z" />
    </svg>
  )
}

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])

  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState("usuarios")
  
  // States para Usuários
  const [editingUser, setEditingUser] = React.useState<any>(null)
  const [isEditUserOpen, setIsEditUserOpen] = React.useState(false)

  // States para Páginas (Organizações)
  const [editingOrg, setEditingOrg] = React.useState<any>(null)
  const [isEditOrgOpen, setIsEditOrgOpen] = React.useState(false)
  
  const [isSaving, setIsSaving] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [checkingUsername, setCheckingUsername] = React.useState(false)
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')

  // Consultas
  const usersQuery = useMemoFirebase(() => db ? query(collection(db, "users"), orderBy("createdAt", "desc")) : null, [db])
  const { data: users, loading: loadingUsers } = useCollection<any>(usersQuery)

  const orgsQuery = useMemoFirebase(() => db ? query(collection(db, "organizations"), orderBy("createdAt", "desc")) : null, [db])
  const { data: orgs, loading: loadingOrgs } = useCollection<any>(orgsQuery)

  // Consulta de Eventos para contagem
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

  // Lógica de Username Único
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
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          if (coll === 'users') setEditingUser((p: any) => ({ ...p, [type]: url }))
          else setEditingOrg((p: any) => ({ ...p, [type]: url }))
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
                     <TableCell className="text-center">{user.isVerified && <InstagramVerifiedBadge className="mx-auto" />}</TableCell>
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
                   <TableHead className="font-bold">Tipo</TableHead>
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
                     <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase border-secondary text-secondary">{org.type || 'Página'}</Badge></TableCell>
                     <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-black text-sm">
                           <Calendar className="w-3.5 h-3.5 text-secondary" />
                           {orgEventCounts[org.id] || 0}
                        </div>
                     </TableCell>
                     <TableCell className="text-center">{org.verified && <InstagramVerifiedBadge className="mx-auto" />}</TableCell>
                     <TableCell className="text-right">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => { setEditingOrg(org); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { if(confirm('Excluir página permanentemente?')){ await deleteDoc(doc(db!, "organizations", org.id)); if(org.username) await deleteDoc(doc(db!, "usernames", org.username.toLowerCase())); toast({title:"Página Removida"}); } }}><Trash2 className="w-4 h-4" /></Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
          </TabsContent>
        </Tabs>
      </Card>

      {/* DIALOG EDITAR PÁGINA (ORGANIZAÇÃO) */}
      <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem]">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-secondary/10 rounded-lg"><Building2 className="w-6 h-6 text-secondary" /></div>
                 <div>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Editar Página: {editingOrg?.name}</DialogTitle>
                    <DialogDescription className="font-medium">Gestão administrativa total da marca e identidade visual.</DialogDescription>
                 </div>
              </div>
           </DialogHeader>

           <form onSubmit={handleUpdateOrg} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-8">
                 <div className="space-y-10">
                    {/* Banner e Avatar */}
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Capa e Logotipo</Label>
                       <div className="relative">
                          <div 
                            className="h-48 bg-muted rounded-3xl border-2 border-dashed border-border group cursor-pointer overflow-hidden relative"
                            onClick={() => document.getElementById('admin-org-banner')?.click()}
                          >
                             {editingOrg?.banner ? <img src={editingOrg.banner} className="w-full h-full object-cover" alt="Banner" /> : null}
                             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="text-white w-10 h-10" />
                             </div>
                             <input id="admin-org-banner" type="file" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner', editingOrg.id, 'organizations')} />
                          </div>
                          <div className="absolute -bottom-10 left-8">
                             <div className="relative group">
                                <Avatar className="h-32 w-32 border-4 border-white shadow-2xl">
                                   <AvatarImage src={editingOrg?.avatar} className="object-cover" />
                                   <AvatarFallback className="text-4xl font-bold bg-muted">O</AvatarFallback>
                                </Avatar>
                                <label htmlFor="admin-org-avatar" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                   <Camera className="w-8 h-8" />
                                </label>
                                <input id="admin-org-avatar" type="file" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatar', editingOrg.id, 'organizations')} />
                             </div>
                          </div>
                       </div>
                       <div className="h-10" />
                       {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                             <Info className="w-3.5 h-3.5" /> Informações da Marca
                          </h3>
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <Label>Nome de Exibição</Label>
                                <Input value={editingOrg?.name || ""} onChange={e => setEditingOrg({...editingOrg, name: e.target.value})} className="rounded-xl h-11" required />
                             </div>
                             <div className="space-y-2">
                                <Label>Username exclusivo (@)</Label>
                                <div className="relative">
                                   <Input 
                                      value={editingOrg?.username || ""} 
                                      onChange={e => setEditingOrg({...editingOrg, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} 
                                      className={cn("rounded-xl h-11 pr-10", usernameStatus === 'taken' && "border-destructive")} 
                                   />
                                   <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                      {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin opacity-40" /> : 
                                       usernameStatus === 'taken' ? <X className="w-4 h-4 text-destructive" /> : 
                                       usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : null}
                                   </div>
                                </div>
                             </div>
                             <div className="space-y-2">
                                <Label>Tipo / Segmento</Label>
                                <Select value={editingOrg?.type || ""} onValueChange={v => setEditingOrg({...editingOrg, type: v})}>
                                   <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                   <SelectContent>
                                      {ORG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                             <Globe className="w-3.5 h-3.5" /> Presença e Status
                          </h3>
                          <div className="space-y-4">
                             <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border">
                                <div className="space-y-0.5">
                                   <Label className="font-bold">Selo Verificado</Label>
                                   <p className="text-[10px] text-muted-foreground uppercase font-bold">Atribuir autoridade visual</p>
                                </div>
                                <Switch checked={editingOrg?.verified || false} onCheckedChange={v => setEditingOrg({...editingOrg, verified: v})} />
                             </div>
                             <div className="space-y-2">
                                <Label>Biografia da Marca</Label>
                                <Textarea value={editingOrg?.bio || ""} onChange={e => setEditingOrg({...editingOrg, bio: e.target.value})} className="min-h-[100px] rounded-xl resize-none" />
                             </div>
                          </div>
                       </div>
                    </div>

                    <Separator className="bg-border/60" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <Fingerprint className="w-3.5 h-3.5" /> Dados Legais
                          </h3>
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <Label>Razão Social</Label>
                                <Input value={editingOrg?.legalName || ""} onChange={e => setEditingOrg({...editingOrg, legalName: e.target.value})} className="rounded-xl h-11" />
                             </div>
                             <div className="space-y-2">
                                <Label>CNPJ</Label>
                                <Input value={editingOrg?.cnpj || ""} onChange={e => setEditingOrg({...editingOrg, cnpj: e.target.value})} className="rounded-xl h-11" />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <MapPin className="w-3.5 h-3.5" /> Localização Sede
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><Label>CEP</Label><Input value={editingOrg?.cep || ""} onChange={e => setEditingOrg({...editingOrg, cep: e.target.value})} className="rounded-xl" /></div>
                             <div className="space-y-2"><Label>Cidade</Label><Input value={editingOrg?.city || ""} onChange={e => setEditingOrg({...editingOrg, city: e.target.value})} className="rounded-xl" /></div>
                          </div>
                       </div>
                    </div>

                    <Separator className="bg-border/60" />

                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Settings className="w-3.5 h-3.5" /> Canais de Contato
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-2"><Label className="text-[10px] uppercase font-bold"><Instagram className="w-3 h-3 inline mr-1" /> Instagram</Label><Input value={editingOrg?.instagram || ""} onChange={e => setEditingOrg({...editingOrg, instagram: e.target.value})} className="rounded-xl text-xs h-10" /></div>
                          <div className="space-y-2"><Label className="text-[10px] uppercase font-bold"><Phone className="w-3 h-3 inline mr-1" /> WhatsApp</Label><Input value={editingOrg?.phone || ""} onChange={e => setEditingOrg({...editingOrg, phone: e.target.value})} className="rounded-xl text-xs h-10" /></div>
                          <div className="space-y-2"><Label className="text-[10px] uppercase font-bold"><Mail className="w-3 h-3 inline mr-1" /> E-mail</Label><Input value={editingOrg?.contactEmail || ""} onChange={e => setEditingOrg({...editingOrg, contactEmail: e.target.value})} className="rounded-xl text-xs h-10" /></div>
                          <div className="space-y-2"><Label className="text-[10px] uppercase font-bold"><Globe className="w-3 h-3 inline mr-1" /> Site</Label><Input value={editingOrg?.website || ""} onChange={e => setEditingOrg({...editingOrg, website: e.target.value})} className="rounded-xl text-xs h-10" /></div>
                       </div>
                    </div>
                 </div>
              </ScrollArea>

              <DialogFooter className="p-8 bg-muted/30 border-t gap-3">
                 <Button type="button" variant="ghost" onClick={() => setIsEditOrgOpen(false)} className="rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
                 <Button type="submit" disabled={isSaving || (usernameStatus === 'taken')} className="bg-secondary text-white font-black h-14 rounded-2xl px-12 shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Alterações da Página
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDITAR USUÁRIO PESSOAL */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden rounded-[2.5rem]">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                 <UserIcon className="w-6 h-6 text-primary" /> Editar Usuário: {editingUser?.name}
              </DialogTitle>
           </DialogHeader>
           <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-8">
                 <div className="space-y-8">
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
                       <div className="space-y-2"><Label>Nome Completo</Label><Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl" required /></div>
                       <div className="space-y-2">
                          <Label>Username (@)</Label>
                          <div className="relative">
                             <Input value={editingUser?.username || ""} onChange={e => setEditingUser({...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} className="rounded-xl pr-10" />
                             <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {checkingUsername && <Loader2 className="w-4 h-4 animate-spin opacity-40" />}
                             </div>
                          </div>
                       </div>
                       <div className="space-y-2"><Label>E-mail</Label><Input value={editingUser?.email || ""} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="rounded-xl" required /></div>
                       <div className="space-y-2">
                          <Label>Cargo / Permissão</Label>
                          <Select value={editingUser?.role || "user"} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                             <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                             <SelectContent><SelectItem value="user">Usuário Comum</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border">
                       <Label className="font-bold">Selo de Verificado</Label>
                       <Switch checked={editingUser?.isVerified || false} onCheckedChange={v => setEditingUser({...editingUser, isVerified: v})} />
                    </div>
                 </div>
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
