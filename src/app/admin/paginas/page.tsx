
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
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
  deleteDoc,
  runTransaction
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
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
  Plus,
  Layout,
  X,
  User,
  Camera,
  Upload,
  Phone,
  Mail,
  Instagram,
  Fingerprint,
  MapPin,
  TrendingUp,
  RefreshCw
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { sendVerificationStatusEmail } from "@/app/actions/email"

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
  const app = useFirebaseApp()
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app])

  const [search, setSearch] = React.useState("")
  const [activeTypeFilter, setActiveTypeFilter] = React.useState("all")
  
  const [editingOrg, setEditingOrg] = React.useState<any>(null)
  const [originalOrg, setOriginalOrg] = React.useState<any>(null)
  const [originalUsername, setOriginalUsername] = React.useState<string | null>(null)
  const [isEditOrgOpen, setIsEditOrgOpen] = React.useState(false)
  
  const [transferOrg, setTransferOrg] = React.useState<any>(null)
  const [isTransferOpen, setIsTransferOpen] = React.useState(false)
  const [newOwnerUsername, setNewOwnerUsername] = React.useState("")
  
  const [isSaving, setIsSaving] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [ownerProfilesCache, setOwnerProfilesCache] = React.useState<Record<string, any>>({})

  const orgsQuery = useMemoFirebase(() => db ? query(collection(db, "organizations"), orderBy("createdAt", "desc")) : null, [db])
  const { data: orgs, loading: loadingOrgs } = useCollection<any>(orgsQuery)

  const ownerIds = React.useMemo(() => {
    if (!orgs) return [];
    return Array.from(new Set(orgs.map(o => o.ownerId).filter(Boolean)));
  }, [orgs]);

  const ownerIdsString = ownerIds.sort().join(',');

  React.useEffect(() => {
    if (!db || !ownerIds.length) return;

    const fetchNewOwners = async () => {
      const missingIds = ownerIds.filter(id => !ownerProfilesCache[id]);
      if (missingIds.length === 0) return;

      const newBatch: Record<string, any> = {};
      await Promise.all(missingIds.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "users", id as string));
          if (snap.exists()) {
            newBatch[id as string] = snap.data();
          }
        } catch (e) {
          console.warn(`[Owner Fetch Error] UID: ${id}`, e);
        }
      }));

      if (Object.keys(newBatch).length > 0) {
        setOwnerProfilesCache(prev => ({ ...prev, ...newBatch }));
      }
    };

    fetchNewOwners();
  }, [db, ownerIdsString]);

  const filteredOrgs = React.useMemo(() => {
    if (!orgs) return [];
    return orgs
      .filter(o => o.status !== 'Excluído')
      .map(o => ({
        ...o,
        ownerProfile: o.ownerId ? ownerProfilesCache[o.ownerId] : null
      }))
      .filter(o => {
        const nameMatch = (o.name || "").toLowerCase().includes(search.toLowerCase());
        const userMatch = (o.username || "").toLowerCase().includes(search.toLowerCase());
        const ownerMatch = (o.ownerProfile?.name || "").toLowerCase().includes(search.toLowerCase());
        const ownerUserMatch = (o.ownerProfile?.username || "").toLowerCase().includes(search.toLowerCase());
        
        const matchSearch = !search || nameMatch || userMatch || ownerMatch || ownerUserMatch;
        const matchType = activeTypeFilter === 'all' || o.type === activeTypeFilter;
        
        return matchSearch && matchType;
      });
  }, [orgs, ownerProfilesCache, search, activeTypeFilter]);

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingOrg || isSaving) return
    
    const newUsername = editingOrg.username?.toLowerCase().trim();
    const oldUsername = originalUsername?.toLowerCase().trim();
    const usernameChanged = oldUsername && newUsername && oldUsername !== newUsername;

    setIsSaving(true)
    try {
      await runTransaction(db, async (transaction) => {
        if (usernameChanged) {
          const newIdxRef = doc(db, "usernames", newUsername);
          const newIdxSnap = await transaction.get(newIdxRef);
          
          if (newIdxSnap.exists()) {
            throw new Error("Este nome de usuário já está em uso.");
          }

          if (oldUsername) {
            transaction.delete(doc(db, "usernames", oldUsername));
          }
          transaction.set(newIdxRef, { 
            uid: editingOrg.id, 
            type: 'organization',
            username: newUsername
          });
        } else if (newUsername) {
          transaction.set(doc(db, "usernames", newUsername), { 
            uid: editingOrg.id, 
            type: 'organization',
            username: newUsername
          }, { merge: true });
        }

        const { id, ownerProfile, ...data } = editingOrg
        transaction.update(doc(db, "organizations", id), { ...data, updatedAt: serverTimestamp() });
      });

      // Gatilho de e-mail exclusivo para o PROPRIETÁRIO se o status de verificação mudou
      if (editingOrg.verified !== originalOrg?.verified && editingOrg.ownerProfile?.email) {
         sendVerificationStatusEmail({
            to: editingOrg.ownerProfile.email,
            userName: editingOrg.ownerProfile.name || editingOrg.ownerProfile.displayName || "Proprietário",
            targetName: editingOrg.name,
            targetUsername: editingOrg.username,
            type: 'organization',
            status: editingOrg.verified ? 'approved' : 'removed'
         }).catch(err => console.warn("Falha ao notificar proprietário da marca", err));
      }

      toast({ title: "Página atualizada!", description: "Dados sincronizados com sucesso." })
      setIsEditOrgOpen(false)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message }) 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0]
    if (!file || !storage || !editingOrg) return

    setUploadProgress(0)
    try {
      const fileName = `organizations/${editingOrg.id}/${type}_${Date.now()}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }) },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setEditingOrg((prev: any) => ({ ...prev, [type]: downloadURL }))
          setUploadProgress(null)
          toast({ title: `${type === 'avatar' ? 'Logo' : 'Capa'} atualizada!` })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleCepBlur = async () => {
    if (!editingOrg?.cep) return;
    const cleanCep = editingOrg.cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setEditingOrg((prev: any) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state
        }));
      }
    } catch (e) {}
  };

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
      const uSnap = await getDocs(query(collection(db, "users"), where("username", "==", cleanUser), limit(1)))
      
      if (uSnap.empty) throw new Error("Usuário não encontrado.")
      
      const newOwnerUid = uSnap.docs[0].id
      const newOwnerData = uSnap.docs[0].data()
      const batch = writeBatch(db)

      const membersQ = query(collection(db, "organizations", transferOrg.id, "members"), where("role", "==", "owner"), limit(1))
      const membersSnap = await getDocs(membersQ)
      if (!membersSnap.empty) {
        batch.update(membersSnap.docs[0].ref, { role: 'admin', updatedAt: serverTimestamp() })
      }

      batch.set(doc(db, "organizations", transferOrg.id, "members", newOwnerUid), {
        userId: newOwnerUid, role: 'owner', status: 'accepted', updatedAt: serverTimestamp()
      }, { merge: true })

      batch.update(doc(db, "organizations", transferOrg.id), { ownerId: newOwnerUid, updatedAt: serverTimestamp() })
      
      await batch.commit()
      setOwnerProfilesCache(prev => ({ ...prev, [newOwnerUid]: newOwnerData }));
      
      toast({ title: "Titularidade Transferida!" })
      setIsTransferOpen(false)
      setNewOwnerUsername("")
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Falha", description: e.message }) 
    } finally { 
      setIsSaving(false) 
    }
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
          <Input placeholder="Nome, @username ou dono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl h-11" />
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
          {filteredOrgs.length} Páginas Encontradas
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[9px] tracking-widest p-6">Marca / Identidade</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Proprietário</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Categoria</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[9px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingOrgs ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredOrgs.map(org => (
              <TableRow key={org.id} className={cn("hover:bg-muted/5 transition-colors", org.status === 'Bloqueado' && "bg-destructive/[0.02] opacity-75")}>
                <TableCell className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shadow-sm rounded-full overflow-hidden">
                      <AvatarImage src={org.avatar} className="object-cover" />
                      <AvatarFallback className="font-black">{org.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
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
                   <Badge className={cn("text-[8px] font-black uppercase h-5", org.status === 'Bloqueado' ? "bg-red-500 text-white" : "bg-green-500 text-white")}>{org.status || 'Ativo'}</Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingOrg(org); setOriginalOrg(org); setOriginalUsername(org.username); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setTransferOrg(org); setIsTransferOpen(true); }} title="Transferir Titularidade"><ArrowRightLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8", org.status === 'Bloqueado' ? "text-green-600" : "text-orange-500")} onClick={() => handleToggleBlock(org.id, org.status)} title="Suspender/Ativar"><ShieldBan className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-lg hover:bg-destructive/10" onClick={() => handleSoftDelete(org.id, org.name)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <div className="flex justify-between items-start">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border shadow-md rounded-full overflow-hidden">
                      <AvatarImage src={editingOrg?.avatar} className="object-cover" />
                      <AvatarFallback className="font-black">{editingOrg?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                       <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">{editingOrg?.name}</DialogTitle>
                       <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Painel Administrativo de Organização</DialogDescription>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" asChild className="rounded-xl h-9 px-4 gap-2 font-black uppercase text-[9px] border-secondary text-secondary">
                        <Link href={`/${editingOrg?.username}`} target="_blank"><Globe className="w-3.5 h-3.5" /> Ver Perfil</Link>
                    </Button>
                    <Badge className={cn("uppercase text-[10px] font-black h-6", editingOrg?.status === 'Bloqueado' ? "bg-red-500 text-white" : "bg-green-500 text-white")}>{editingOrg?.status || 'Ativo'}</Badge>
                 </div>
              </div>
           </DialogHeader>
           
           <form onSubmit={handleUpdateOrg} className="flex-1 overflow-hidden flex flex-col">
              <Tabs defaultValue="geral" className="flex-1 flex flex-col overflow-hidden">
                 <div className="px-8 bg-muted/10 border-b">
                    <TabsList className="bg-transparent p-0 h-14 w-full justify-start gap-8">
                       <TabsTrigger value="geral" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Informações</TabsTrigger>
                       <TabsTrigger value="visual" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Identidade</TabsTrigger>
                       <TabsTrigger value="fiscal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Fiscais</TabsTrigger>
                       <TabsTrigger value="endereco" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Localização</TabsTrigger>
                       <TabsTrigger value="social" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Contatos</TabsTrigger>
                       <TabsTrigger value="membros" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Equipe</TabsTrigger>
                    </TabsList>
                 </div>

                 <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                       <div className="p-8 pb-20">
                          <TabsContent value="geral" className="space-y-8 mt-0">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome de Exibição</Label><Input value={editingOrg?.name || ""} onChange={e => setEditingOrg({...editingOrg, name: e.target.value})} className="rounded-xl h-11" required /></div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase opacity-60 flex items-center justify-between">Username exclusivo (@) <span className="text-[8px] text-secondary font-black italic">ALTERAÇÃO ADMIN</span></Label>
                                   <Input value={editingOrg?.username || ""} onChange={e => setEditingOrg({...editingOrg, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")})} className="rounded-xl h-11 border-dashed border-secondary/40 font-bold" />
                                </div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Slug (URL)</Label><Input value={editingOrg?.slug || ""} onChange={e => setEditingOrg({...editingOrg, slug: e.target.value.toLowerCase().replace(/\s+/g, "-")})} className="rounded-xl h-11" /></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label><Input value={editingOrg?.type || ""} onChange={e => setEditingOrg({...editingOrg, type: e.target.value})} className="rounded-xl h-11" /></div>
                             </div>
                             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bio / Descrição</Label><Textarea value={editingOrg?.bio || ""} onChange={e => setEditingOrg({...editingOrg, bio: e.target.value})} className="min-h-[100px] rounded-xl resize-none" /></div>
                             <Separator className="border-dashed" />
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Selo Verificado</Label><div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-dashed"><ShieldCheck className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold uppercase flex-1">Oficial</span><Switch checked={editingOrg?.verified || false} onCheckedChange={v => setEditingOrg({...editingOrg, verified: v})} /></div></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Analytics Público</Label><div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-dashed"><TrendingUp className="w-5 h-5 text-secondary" /><span className="text-xs font-bold uppercase flex-1">Exibir métricas</span><Switch checked={editingOrg?.showStats ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showStats: v})} /></div></div>
                             </div>
                          </TabsContent>

                          <TabsContent value="visual" className="space-y-8 mt-0">
                             <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase opacity-60">Logo da Marca</Label>
                                <div className="flex items-center gap-6">
                                   <div className="relative group">
                                      <Avatar className="h-32 w-32 border-4 border-background shadow-xl rounded-[2rem] overflow-hidden">
                                         <AvatarImage src={editingOrg?.avatar} className="object-cover" />
                                         <AvatarFallback className="text-4xl font-black bg-muted">{editingOrg?.name?.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <label htmlFor="admin-edit-logo" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera className="w-8 h-8" /></label>
                                      <input id="admin-edit-logo" type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'avatar')} />
                                   </div>
                                   <div className="flex-1 space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground">Formatos: JPG, PNG, WEBP.</p>
                                      <Input value={editingOrg?.avatar || ""} onChange={e => setEditingOrg({...editingOrg, avatar: e.target.value})} className="rounded-xl h-10 text-xs" placeholder="URL da Logo" />
                                   </div>
                                </div>

                                <Label className="text-[10px] font-black uppercase opacity-60 block mt-10">Banner / Capa</Label>
                                <div className="relative h-48 bg-muted rounded-[2rem] overflow-hidden border-2 border-dashed group">
                                   {editingOrg?.banner ? <img src={editingOrg.banner} className="w-full h-full object-cover" /> : null}
                                   <label htmlFor="admin-edit-banner" className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                      <Upload className="w-10 h-10 mb-2" /><span className="text-[10px] font-black uppercase tracking-widest">Trocar Capa</span>
                                   </label>
                                   <input id="admin-edit-banner" type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'banner')} />
                                </div>
                                {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
                             </div>
                          </TabsContent>

                          <TabsContent value="fiscal" className="space-y-8 mt-0">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Razão Social</Label><Input value={editingOrg?.legalName || ""} onChange={e => setEditingOrg({...editingOrg, legalName: e.target.value})} className="rounded-xl h-11" /></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">CNPJ</Label><Input value={editingOrg?.cnpj || ""} onChange={e => setEditingOrg({...editingOrg, cnpj: e.target.value})} className="rounded-xl h-11" placeholder="00.000.000/0000-00" /></div>
                             </div>
                          </TabsContent>

                          <TabsContent value="endereco" className="space-y-8 mt-0">
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">CEP</Label><Input value={editingOrg?.cep || ""} onChange={e => setEditingOrg({...editingOrg, cep: e.target.value})} onBlur={handleCepBlur} className="rounded-xl h-11" /></div>
                                <div className="md:col-span-3 space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Rua / Logradouro</Label><Input value={editingOrg?.street || ""} onChange={e => setEditingOrg({...editingOrg, street: e.target.value})} className="rounded-xl h-11" /></div>
                             </div>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nº</Label><Input value={editingOrg?.number || ""} onChange={e => setEditingOrg({...editingOrg, number: e.target.value})} className="rounded-xl h-11" /></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={editingOrg?.neighborhood || ""} onChange={e => setEditingOrg({...editingOrg, neighborhood: e.target.value})} className="rounded-xl h-11" /></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade / UF</Label><div className="flex gap-2"><Input value={editingOrg?.city || ""} readOnly className="rounded-xl h-11 bg-muted/30" /><Input value={editingOrg?.state || ""} readOnly className="rounded-xl h-11 bg-muted/30 w-14" /></div></div>
                             </div>
                          </TabsContent>

                          <TabsContent value="social" className="space-y-8 mt-0">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp</Label><Input value={editingOrg?.phone || ""} onChange={e => setEditingOrg({...editingOrg, phone: e.target.value})} className="rounded-xl h-11" /></div>
                                <div className="space-y-3"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Mail className="w-3 h-3" /> E-mail Público</Label><Input value={editingOrg?.contactEmail || ""} onChange={e => setEditingOrg({...editingOrg, contactEmail: e.target.value})} className="rounded-xl h-11" /></div>
                                <div className="space-y-3"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Globe className="w-3 h-3" /> Site</Label><Input value={editingOrg?.website || ""} onChange={e => setEditingOrg({...editingOrg, website: e.target.value})} className="rounded-xl h-11" /></div>
                                <div className="space-y-3"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Instagram className="w-3 h-3" /> Instagram</Label><Input value={editingOrg?.instagram || ""} onChange={e => setEditingOrg({...editingOrg, instagram: e.target.value})} className="rounded-xl h-11" /></div>
                             </div>
                          </TabsContent>

                          <TabsContent value="membros" className="space-y-8 mt-0">
                             <OrgMembersList orgId={editingOrg?.id} />
                          </TabsContent>
                       </div>
                    </ScrollArea>
                 </div>
              </Tabs>
              
              <DialogFooter className="p-8 border-t bg-muted/30">
                 <Button type="submit" disabled={isSaving || uploadProgress !== null} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Todas as Alterações
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
           <DialogHeader><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Transferir Titularidade</DialogTitle></DialogHeader>
           <div className="space-y-6 py-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Username do Novo Dono (@)</Label><AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" /><Input placeholder="Ex: joaosilva" value={newOwnerUsername} onChange={e => setNewOwnerUsername(e.target.value)} className="h-12 rounded-xl pl-9" /></div>
              <div className="p-4 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 text-[10px] text-orange-800 font-bold uppercase leading-relaxed italic">O dono antigo será rebaixado para administrador.</div>
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
  const [memberToDecline, setMemberToDecline] = React.useState<any>(null)

  const membersQuery = useMemoFirebase(() => orgId && db ? collection(db, "organizations", orgId, "members") : null, [db, orgId])
  const { data: members, loading } = useCollection<any>(membersQuery)
  
  const [membersWithProfiles, setMembersWithProfiles] = React.useState<any[]>([])
  const membersIdsString = React.useMemo(() => members?.map(m => m.userId).sort().join(',') || '', [members]);
  
  React.useEffect(() => {
    if (!members || !db || !membersIdsString) {
      setMembersWithProfiles([]);
      return;
    }
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
  }, [membersIdsString, db])

  const handleAdd = async () => {
    if (!db || !orgId || !newMemberUser) return
    setAdding(true)
    try {
      const cleanUser = newMemberUser.toLowerCase().trim().replace('@', '')
      const uSnap = await getDocs(query(collection(db, "usernames"), where("username", "==", cleanUser), limit(1)))
      if (uSnap.empty) throw new Error("Usuário não encontrado.")
      const uid = uSnap.docs[0].id
      await setDoc(doc(db, "organizations", orgId, "members", uid), { userId: uid, role: 'editor', status: 'accepted', updatedAt: serverTimestamp() })
      setNewMemberUser(""); toast({ title: "Membro adicionado!" })
    } catch (e: any) { toast({ variant: "destructive", title: "Erro", description: e.message }) }
    finally { setAdding(false) }
  }

  const handleUpdateRole = async (uid: string, role: string) => {
    if (!db || !orgId) return
    try {
       await updateDoc(doc(db, "organizations", orgId, "members", uid), { role, updatedAt: serverTimestamp() })
       toast({ title: "Cargo atualizado!" })
    } catch (e) { toast({ variant: "destructive", title: "Erro" }) }
  }

  const handleRemove = async () => {
    if (!db || !orgId || !memberToDecline) return
    try {
       await deleteDoc(doc(db, "organizations", orgId, "members", memberToDecline.userId))
       toast({ title: "Membro removido." })
       setMemberToDecline(null)
    } catch (e) { toast({ variant: "destructive", title: "Erro" }) }
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-secondary" /></div>

  return (
    <div className="space-y-6">
       <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Vincular Colaborador</Label>
          <div className="flex gap-2">
             <div className="relative flex-1">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <Input placeholder="username" value={newMemberUser} onChange={e => setNewMemberUser(e.target.value)} className="rounded-xl h-11 pl-9 border-dashed border-secondary/30" />
             </div>
             <Button type="button" onClick={handleAdd} disabled={adding} className="bg-secondary text-white font-black h-11 px-6 rounded-xl uppercase text-[10px] italic shadow-lg">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vincular"}
             </Button>
          </div>
       </div>

       <div className="space-y-3">
          {membersWithProfiles.map(m => (
            <div key={m.userId} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border group hover:bg-white hover:shadow-sm transition-all">
               <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-background shadow-sm rounded-full overflow-hidden">
                    <AvatarImage src={m.profile?.avatar} className="object-cover" />
                    <AvatarFallback className="font-black bg-muted">{m.profile?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                     <span className="text-sm font-bold text-primary truncate max-w-[150px]">{m.profile?.name || "Usuário"}</span>
                     <span className="text-[10px] text-secondary font-black uppercase">@{m.profile?.username}</span>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <Select value={m.role} onValueChange={(v) => handleUpdateRole(m.userId, v)}>
                     <SelectTrigger className="h-8 rounded-lg text-[9px] font-black uppercase w-28 border-secondary/20 text-secondary bg-secondary/5"><SelectValue /></SelectTrigger>
                     <SelectContent className="rounded-xl">
                        {ORG_ROLES.map(role => <SelectItem key={role.value} value={role.value} className="text-[10px] font-bold uppercase">{role.label}</SelectItem>)}
                     </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50 rounded-lg" onClick={() => setMemberToDecline(m)}>
                     <Trash2 className="w-4 h-4" />
                  </Button>
               </div>
            </div>
          ))}
       </div>

       <AlertDialog open={!!memberToDecline} onOpenChange={(o) => !o && setMemberToDecline(null)}>
          <AlertDialogContent className="rounded-[2.5rem]">
             <AlertDialogHeader>
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2 text-destructive"><UserX className="w-8 h-8" /></div>
                <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter text-center">Remover Membro?</AlertDialogTitle>
                <AlertDialogDescription className="text-center font-medium">
                   Tem certeza que deseja revogar o acesso de <strong>{memberToDecline?.profile?.name}</strong>? Ele não poderá mais gerenciar esta marca.
                </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">Confirmar Remoção</AlertDialogAction>
             </AlertDialogFooter>
          </AlertDialogContent>
       </AlertDialog>
    </div>
  )
}
