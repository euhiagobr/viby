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
  Camera,
  Calendar,
  BadgeCheck,
  X,
  RefreshCcw
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
                   <TableHead className="text-center font-bold">Verificado</TableHead>
                   <TableHead className="text-right font-bold">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {loadingUsers ? (
                   <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                 ) : filteredUsers.map(user => (
                   <TableRow key={user.id} className="hover:bg-muted/10">
                     <TableCell>
                       <div className="flex items-center gap-3">
                         <Avatar className="h-9 w-9"><AvatarImage src={user.avatar} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                         <div className="flex flex-col"><span className="font-bold text-sm">{user.name}</span><span className="text-[10px] text-muted-foreground">@{user.username}</span></div>
                       </div>
                     </TableCell>
                     <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase">{user.role}</Badge></TableCell>
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
                   <TableHead className="text-center font-bold">Verificado</TableHead>
                   <TableHead className="text-right font-bold">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {loadingOrgs ? (
                   <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                 ) : filteredOrgs.map(org => (
                   <TableRow key={org.id} className="hover:bg-muted/10">
                     <TableCell>
                       <div className="flex items-center gap-3">
                         <Avatar className="h-9 w-9"><AvatarImage src={org.avatar} className="object-cover" /><AvatarFallback>{org.name?.charAt(0)}</AvatarFallback></Avatar>
                         <div className="flex flex-col"><span className="font-bold text-sm">{org.name}</span><span className="text-[10px] text-secondary font-bold">@{org.username}</span></div>
                       </div>
                     </TableCell>
                     <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase">{org.status || 'Ativo'}</Badge></TableCell>
                     <TableCell className="text-center">{org.verified && <VerifiedBadge className="mx-auto" />}</TableCell>
                     <TableCell className="text-right">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => { setEditingOrg(org); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { if(confirm('Excluir página?')){ await deleteDoc(doc(db!, "organizations", org.id)); if(org.username) await deleteDoc(doc(db!, "usernames", org.username.toLowerCase())); toast({title:"Página Removida"}); } }}><Trash2 className="w-4 h-4" /></Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
          </TabsContent>
        </Tabs>
      </Card>

      {/* DIALOG EDITAR USUÁRIO */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-xl rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Editar Usuário</DialogTitle>
           </DialogHeader>
           <form onSubmit={handleUpdateUser} className="space-y-6">
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
                    <Label>Cargo</Label>
                    <Select value={editingUser?.role || "user"} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                       <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl"><SelectItem value="user">Usuário</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
                    </Select>
                 </div>
              </div>
              <DialogFooter>
                 <Button type="submit" disabled={isSaving || (usernameStatus === 'taken')} className="w-full bg-primary text-white font-black h-12 rounded-xl">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Usuário
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
