"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp, useDoc } from "@/firebase"
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
  runTransaction,
  Timestamp
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
  Globe,
  ShieldBan,
  ShieldCheck,
  AtSign,
  ArrowRightLeft,
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
  RefreshCw,
  Lock,
  Coins,
  Info,
  Percent,
  Handshake,
  ChevronRight,
  UserX,
  Clock,
  AlertTriangle,
  Calculator,
  Ticket,
  Sparkles,
  ArrowUpRight,
  Settings,
  Zap
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
import { cn, validateCPF, validateCNPJ, safeParseDate } from "@/lib/utils"
import Link from "next/link"
import { sendVerificationStatusEmail } from "@/app/actions/email"
import { AffiliateCode } from "@/types/affiliate"
import { formatCurrency, calculateVibyOfficialSplit, isTemporalActive } from "@/lib/financial-utils"
import { useAdminPermissions } from "@/hooks/use-admin-permissions"

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
  const { adminProfile } = useAdminPermissions()

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
  const [avatarProgress, setAvatarProgress] = React.useState<number | null>(null)
  const [bannerProgress, setBannerProgress] = React.useState<number | null>(null)
  const [ownerProfilesCache, setOwnerProfilesCache] = React.useState<Record<string, any>>({})

  // Estado para Simulação de Taxas
  const [testPrice, setTestPrice] = React.useState("100.00")
  const [testProductType, setTestProductType] = React.useState<'event' | 'experience'>('event')

  const adminUid = adminProfile?.uid;

  const orgsQuery = useMemoFirebase(() => 
    (db && adminUid) ? query(collection(db, "organizations"), orderBy("createdAt", "desc")) : null, 
    [db, adminUid]
  )
  const { data: orgs, loading: loadingOrgs } = useCollection<any>(orgsQuery)

  const affiliatesQuery = useMemoFirebase(() => 
    (db && adminUid) ? query(collection(db, "affiliateCodes"), where("active", "==", true)) : null, 
    [db, adminUid]
  )
  const { data: affiliates } = useCollection<AffiliateCode>(affiliatesQuery)

  const globalFeesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db]);
  const { data: globalFees } = useDoc<any>(globalFeesRef);

  const promosRef = React.useMemo(() => db ? doc(db, 'settings', 'promotions') : null, [db]);
  const { data: promotions } = useDoc<any>(promosRef);

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
        
        if (data.financialOverrides) {
           ['event', 'experience'].forEach(type => {
              const ov = data.financialOverrides[type];
              if (ov) {
                if (ov.validFrom && typeof ov.validFrom === 'string') ov.validFrom = Timestamp.fromDate(new Date(ov.validFrom));
                if (ov.validTo && typeof ov.validTo === 'string') ov.validTo = Timestamp.fromDate(new Date(ov.validTo));
              }
           });
        }

        transaction.update(doc(db, "organizations", id), { ...data, updatedAt: serverTimestamp() });
      });

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

    const setProgress = type === 'avatar' ? setAvatarProgress : setBannerProgress;
    setProgress(0);

    try {
      const fileName = `organizations/${editingOrg.id}/${type}_${Date.now()}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setProgress(null); toast({ variant: "destructive", title: "Erro no upload" }) },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setEditingOrg((prev: any) => ({ ...prev, [type]: downloadURL }))
          setProgress(null)
          toast({ title: `${type === 'avatar' ? 'Logo' : 'Capa'} atualizada!` })
        }
      )
    } catch (err) { setProgress(null) }
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

  const handleAffiliateLink = (affCode: string) => {
    if (!affCode || affCode === 'none') {
      setEditingOrg({
        ...editingOrg,
        affiliateUserId: deleteField(),
        affiliateCode: deleteField(),
        affiliateStartDate: deleteField(),
        affiliateEndDate: deleteField()
      })
      return
    }

    const aff = affiliates?.find(a => a.code === affCode)
    if (!aff) return

    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(startDate.getDate() + 90)

    setEditingOrg({
      ...editingOrg,
      affiliateUserId: aff.userId,
      affiliateCode: aff.code,
      affiliateStartDate: startDate.toISOString(),
      affiliateEndDate: endDate.toISOString()
    })
  }

  const formatTimestampForInput = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().slice(0, 16);
  };

  const updateOverrideField = (product: 'event' | 'experience', field: string, value: any) => {
     setEditingOrg((prev: any) => ({
        ...prev,
        financialOverrides: {
           ...prev.financialOverrides,
           [product]: {
              ...prev.financialOverrides?.[product],
              [field]: value
           }
        }
     }));
  };

  const testPriceNum = parseFloat(testPrice) || 0;
  const simulation = calculateVibyOfficialSplit(testPriceNum, 'BRL', {}, editingOrg, globalFees, promotions, testProductType);

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
          <Input placeholder="Nome, @username ou dono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
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
        <div className="flex items-center justify-center bg-muted/50 rounded-xl border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingOrg({...org}); setOriginalOrg(org); setOriginalUsername(org.username); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
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
        <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
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
                       <TabsTrigger value="taxas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Governança Financeira</TabsTrigger>
                       <TabsTrigger value="afiliados" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Afiliado</TabsTrigger>
                       <TabsTrigger value="fiscal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Fiscais</TabsTrigger>
                       <TabsTrigger value="endereco" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Localização</TabsTrigger>
                       <TabsTrigger value="membros" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent font-black uppercase text-[10px] h-full px-0">Equipe</TabsTrigger>
                    </TabsList>
                 </div>

                 <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                       <div className="p-8 pb-20">
                          <TabsContent value="geral" className="space-y-8 mt-0">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase opacity-60">Nome de Exibição</Label>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[8px] font-bold uppercase opacity-40">Público</span>
                                      <Switch checked={editingOrg?.showName ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showName: v})} />
                                    </div>
                                  </div>
                                  <Input value={editingOrg?.name || ""} onChange={e => setEditingOrg({...editingOrg, name: e.target.value})} className="rounded-xl h-11" required />
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase opacity-60 flex items-center justify-between">Username exclusivo (@) <span className="text-[8px] text-secondary font-black italic">ALTERAÇÃO ADMIN</span></Label>
                                   <Input value={editingOrg?.username || ""} onChange={e => setEditingOrg({...editingOrg, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")})} className="rounded-xl h-11 border-dashed border-secondary/40 font-bold" />
                                </div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Slug (URL)</Label><Input value={editingOrg?.slug || ""} onChange={e => setEditingOrg({...editingOrg, slug: e.target.value.toLowerCase().replace(/\s+/g, "-")})} className="rounded-xl h-11" /></div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[8px] font-bold uppercase opacity-40">Público</span>
                                      <Switch checked={editingOrg?.showType ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showType: v})} />
                                    </div>
                                  </div>
                                  <Input value={editingOrg?.type || ""} onChange={e => setEditingOrg({...editingOrg, type: e.target.value})} className="rounded-xl h-11" />
                                </div>
                             </div>
                             <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] font-black uppercase opacity-60">Bio / Descrição</Label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold uppercase opacity-40">Público</span>
                                    <Switch checked={editingOrg?.showBio ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showBio: v})} />
                                  </div>
                                </div>
                                <Textarea value={editingOrg?.bio || ""} onChange={e => setEditingOrg({...editingOrg, bio: e.target.value})} className="min-h-[100px] rounded-xl resize-none" />
                             </div>
                             <Separator className="border-dashed" />
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Selo Verificado</Label><div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-dashed"><ShieldCheck className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold uppercase flex-1">Oficial</span><Switch checked={editingOrg?.verified || false} onCheckedChange={v => setEditingOrg({...editingOrg, verified: v})} /></div></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Analytics Público</Label><div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-dashed"><TrendingUp className="w-5 h-5 text-secondary" /><span className="text-xs font-bold uppercase flex-1">Exibir métricas</span><Switch checked={editingOrg?.showStats ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showStats: v})} /></div></div>
                             </div>
                          </TabsContent>

                          <TabsContent value="taxas" className="space-y-12 mt-0">
                             <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                <div className="lg:col-span-7 space-y-10">
                                   <div className="p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 flex items-start gap-4">
                                      <Zap className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                                      <div className="space-y-1">
                                         <h4 className="font-black uppercase text-xs italic text-primary">Controle Financeiro v2</h4>
                                         <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
                                            Overrides financeiros agora são segmentados por tipo de produto e possuem janela de vigência automática.
                                         </p>
                                      </div>
                                   </div>

                                   <section className="space-y-6">
                                      <div className="flex items-center gap-3 px-1">
                                         <Ticket className="w-5 h-5 text-primary" />
                                         <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Regras para Eventos</h3>
                                      </div>
                                      <div className="grid grid-cols-1 gap-6 p-8 bg-white rounded-[2rem] border shadow-sm">
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40">Markup Comprador (%)</Label>
                                               <div className="relative">
                                                  <Input type="number" step="0.1" value={editingOrg?.financialOverrides?.event?.markupBuyerPercent ?? ""} onChange={e => updateOverrideField('event', 'markupBuyerPercent', e.target.value ? parseFloat(e.target.value) : null)} className="rounded-xl h-11 pr-10 font-bold" placeholder="15.0" />
                                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">%</span>
                                               </div>
                                            </div>
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40">Comissão Produtor (%)</Label>
                                               <div className="relative">
                                                  <Input type="number" step="0.1" value={editingOrg?.financialOverrides?.event?.commissionPercent ?? ""} onChange={e => updateOverrideField('event', 'commissionPercent', e.target.value ? parseFloat(e.target.value) : null)} className="rounded-xl h-11 pr-10 font-bold" placeholder="10.0" />
                                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">%</span>
                                               </div>
                                            </div>
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40">Valor Mínimo (R$)</Label>
                                               <div className="relative">
                                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">R$</span>
                                                  <Input type="number" step="0.01" value={editingOrg?.financialOverrides?.event?.minValue ?? ""} onChange={e => updateOverrideField('event', 'minValue', e.target.value ? parseFloat(e.target.value) : null)} className="rounded-xl h-11 pl-10 font-bold" placeholder="3.99" />
                                               </div>
                                            </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-6 border-t border-dashed pt-6">
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40 flex items-center gap-2"><Clock className="w-3 h-3" /> Início Vigência</Label>
                                               <Input type="datetime-local" value={formatTimestampForInput(editingOrg?.financialOverrides?.event?.validFrom)} onChange={e => updateOverrideField('event', 'validFrom', e.target.value)} className="rounded-xl h-11 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40 flex items-center gap-2"><Clock className="w-3 h-3 text-red-500" /> Fim Vigência</Label>
                                               <Input type="datetime-local" value={formatTimestampForInput(editingOrg?.financialOverrides?.event?.validTo)} onChange={e => updateOverrideField('event', 'validTo', e.target.value)} className="rounded-xl h-11 text-xs" />
                                            </div>
                                         </div>
                                      </div>
                                   </section>

                                   <section className="space-y-6">
                                      <div className="flex items-center gap-3 px-1">
                                         <Sparkles className="w-5 h-5 text-secondary" />
                                         <h3 className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Regras para Experiências</h3>
                                      </div>
                                      <div className="grid grid-cols-1 gap-6 p-8 bg-white rounded-[2rem] border shadow-sm ring-1 ring-secondary/10">
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40">Markup Comprador (%)</Label>
                                               <div className="relative">
                                                  <Input type="number" step="0.1" value={editingOrg?.financialOverrides?.experience?.markupBuyerPercent ?? ""} onChange={e => updateOverrideField('experience', 'markupBuyerPercent', e.target.value ? parseFloat(e.target.value) : null)} className="rounded-xl h-11 pr-10 font-bold border-secondary/20" placeholder="10.0" />
                                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">%</span>
                                               </div>
                                            </div>
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40">Comissão Produtor (%)</Label>
                                               <div className="relative">
                                                  <Input type="number" step="0.1" value={editingOrg?.financialOverrides?.experience?.commissionPercent ?? ""} onChange={e => updateOverrideField('experience', 'commissionPercent', e.target.value ? parseFloat(e.target.value) : null)} className="rounded-xl h-11 pr-10 font-bold border-secondary/20" placeholder="15.0" />
                                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">%</span>
                                               </div>
                                            </div>
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40">Valor Mínimo (R$)</Label>
                                               <div className="relative">
                                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">R$</span>
                                                  <Input type="number" step="0.01" value={editingOrg?.financialOverrides?.experience?.minValue ?? ""} onChange={e => updateOverrideField('experience', 'minValue', e.target.value ? parseFloat(e.target.value) : null)} className="rounded-xl h-11 pl-10 font-bold border-secondary/20" placeholder="4.99" />
                                               </div>
                                            </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-6 border-t border-dashed pt-6">
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40 flex items-center gap-2"><Clock className="w-3 h-3" /> Início Vigência</Label>
                                               <Input type="datetime-local" value={formatTimestampForInput(editingOrg?.financialOverrides?.experience?.validFrom)} onChange={e => updateOverrideField('experience', 'validFrom', e.target.value)} className="rounded-xl h-11 text-xs border-secondary/20" />
                                            </div>
                                            <div className="space-y-2">
                                               <Label className="text-[9px] font-black uppercase opacity-40 flex items-center gap-2"><Clock className="w-3 h-3 text-red-500" /> Fim Vigência</Label>
                                               <Input type="datetime-local" value={formatTimestampForInput(editingOrg?.financialOverrides?.experience?.validTo)} onChange={e => updateOverrideField('experience', 'validTo', e.target.value)} className="rounded-xl h-11 text-xs border-secondary/20" />
                                            </div>
                                         </div>
                                      </div>
                                   </section>
                                </div>

                                <div className="lg:col-span-5 space-y-8">
                                   <div className="flex items-center justify-between px-1">
                                      <div className="flex items-center gap-2">
                                         <Calculator className="w-5 h-5 text-secondary" />
                                         <h3 className="text-sm font-black uppercase tracking-widest text-primary">Simulador v2</h3>
                                      </div>
                                   </div>

                                   <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border">
                                      <CardHeader className="bg-muted/30 p-8 border-b space-y-4">
                                         <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase opacity-40">Valor para Teste</Label>
                                            <div className="relative">
                                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-30">R$</span>
                                               <Input value={testPrice} onChange={e => setTestPrice(e.target.value)} className="h-12 pl-10 rounded-xl text-lg font-black text-secondary border-secondary/20" />
                                            </div>
                                         </div>
                                         <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase opacity-40">Tipo de Produto</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                               <Button type="button" variant={testProductType === 'event' ? 'secondary' : 'outline'} className="h-10 text-[9px] font-black uppercase rounded-lg" onClick={() => setTestProductType('event')}>Evento</Button>
                                               <Button type="button" variant={testProductType === 'experience' ? 'secondary' : 'outline'} className="h-10 text-[9px] font-black uppercase rounded-lg" onClick={() => setTestProductType('experience')}>Experiência</Button>
                                            </div>
                                         </div>
                                      </CardHeader>
                                      <CardContent className="p-8 space-y-6">
                                         <div className="space-y-4">
                                            <div className="flex justify-between items-center text-sm font-bold">
                                               <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                                                  <User className="w-3.5 h-3.5" /> Cliente Paga
                                               </span>
                                               <span className="text-primary">{formatCurrency(simulation.totalCharged)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold">
                                               <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                                                  <Percent className="w-3.5 h-3.5" /> Comissão Viby
                                               </span>
                                               <div className="flex flex-col items-end">
                                                  <span className={cn(simulation.organizerFee > 0 ? "text-red-500" : "text-green-600")}>
                                                    {simulation.organizerFee > 0 ? `-${formatCurrency(simulation.organizerFee)}` : "ISENTO"}
                                                  </span>
                                               </div>
                                            </div>
                                            <Separator className="border-dashed" />
                                            <div className="flex justify-between items-center bg-green-50 p-6 rounded-2xl border-2 border-dashed border-green-200">
                                               <div className="space-y-0.5">
                                                  <span className="text-[10px] font-black uppercase italic text-green-800">Repasse Produtor</span>
                                                  <p className="text-[8px] font-bold uppercase text-green-600 opacity-60">Valor líquido estimado</p>
                                               </div>
                                               <span className="text-2xl font-black text-green-600">{formatCurrency(simulation.organizerNet)}</span>
                                            </div>
                                         </div>

                                         <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                                            <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                                            <p className="text-[9px] text-secondary font-bold leading-relaxed uppercase">
                                               O simulador detecta automaticamente se os overrides acima estão vigentes para a data de hoje.
                                            </p>
                                         </div>
                                      </CardContent>
                                   </Card>

                                   <div className="p-6 bg-primary text-white rounded-[2rem] shadow-2xl relative overflow-hidden">
                                      <div className="relative z-10 space-y-2">
                                         <p className="text-[10px] font-black uppercase opacity-40">Status do Override</p>
                                         <div className="flex items-center gap-2">
                                            {isTemporalActive(editingOrg?.financialOverrides?.[testProductType]?.validFrom, editingOrg?.financialOverrides?.[testProductType]?.validTo) ? (
                                              <Badge className="bg-green-500 text-white font-black uppercase text-[8px] h-5">VIGENTE AGORA</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-white/40 border-white/20 font-black uppercase text-[8px] h-5">INATIVO / EXPIRADO</Badge>
                                            )}
                                         </div>
                                      </div>
                                      <ArrowUpRight className="absolute -bottom-2 -right-2 w-20 h-20 opacity-10 rotate-12" />
                                   </div>
                                </div>
                             </div>
                          </TabsContent>

                          <TabsContent value="afiliados" className="space-y-8 mt-0">
                             <Card className="border-none shadow-sm rounded-[2rem] bg-muted/20 border-2 border-dashed">
                                <CardContent className="p-8 space-y-6">
                                   <div className="flex items-center gap-4">
                                      <div className="p-3 bg-secondary/10 rounded-2xl text-secondary"><Handshake className="w-6 h-6" /></div>
                                      <div>
                                         <h3 className="text-lg font-black uppercase italic text-primary tracking-tighter">Programa de Afiliados</h3>
                                         <p className="text-[10px] font-bold uppercase text-muted-foreground">Vincular esta marca a um parceiro estratégico.</p>
                                      </div>
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="space-y-2">
                                         <Label className="text-[10px] font-black uppercase opacity-60">Afiliado Responsável</Label>
                                         <Select value={editingOrg?.affiliateCode || "none"} onValueChange={handleAffiliateLink}>
                                            <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Sem Afiliado" /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                               <SelectItem value="none">Nenhum / Remover</SelectItem>
                                               {affiliates?.map(a => <SelectItem key={a.id} value={a.code}>{a.userName} ({a.code})</SelectItem>)}
                                            </SelectContent>
                                         </Select>
                                      </div>
                                      {editingOrg?.affiliateCode && (
                                        <div className="space-y-2">
                                           <Label className="text-[10px] font-black uppercase opacity-60">Data Final da Campanha</Label>
                                           <Input 
                                             type="date" 
                                             value={editingOrg.affiliateEndDate?.split('T')[0] || ""} 
                                             onChange={e => setEditingOrg({...editingOrg, affiliateEndDate: new Date(e.target.value).toISOString()})}
                                             className="rounded-xl h-11"
                                           />
                                        </div>
                                      )}
                                   </div>
                                </CardContent>
                             </Card>
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
                             </div>
                          </TabsContent>

                          <TabsContent value="fiscal" className="space-y-8 mt-0">
                             <div className="space-y-6">
                               <div className="space-y-2">
                                 <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Organização</Label>
                                 <Select value={editingOrg?.tipoOrganizacao || "individual"} onValueChange={v => setEditingOrg({...editingOrg, tipoOrganizacao: v})}>
                                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                       <SelectItem value="individual">Pessoa Física</SelectItem>
                                       <SelectItem value="company">Pessoa Jurídica</SelectItem>
                                    </SelectContent>
                                 </Select>
                               </div>

                               {editingOrg?.tipoOrganizacao === 'individual' ? (
                                 <div className="space-y-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5" /> CPF (Titular)</Label>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-bold uppercase opacity-40">Público</span>
                                          <Switch checked={editingOrg?.showCpf ?? false} onCheckedChange={v => setEditingOrg({...editingOrg, showCpf: v})} />
                                        </div>
                                      </div>
                                      <Input value={editingOrg?.cpf || ""} onChange={e => setEditingOrg({...editingOrg, cpf: e.target.value})} className="rounded-xl h-11 font-mono" placeholder="000.000.000-00" />
                                    </div>
                                 </div>
                               ) : (
                                 <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                       <div className="space-y-2">
                                         <div className="flex items-center justify-between">
                                           <Label className="text-[10px] font-black uppercase opacity-60">Razão Social</Label>
                                           <div className="flex items-center gap-2">
                                              <span className="text-[8px] font-bold uppercase opacity-40">Público</span>
                                              <Switch checked={editingOrg?.showLegalName ?? false} onCheckedChange={v => setEditingOrg({...editingOrg, showLegalName: v})} />
                                           </div>
                                         </div>
                                         <Input value={editingOrg?.razaoSocial || editingOrg?.legalName || ""} onChange={e => setEditingOrg({...editingOrg, razaoSocial: e.target.value})} className="rounded-xl h-11" />
                                       </div>
                                       <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase opacity-60">CNPJ</Label>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[8px] font-bold uppercase opacity-40">Público</span>
                                              <Switch checked={editingOrg?.showCnpj ?? false} onCheckedChange={v => setEditingOrg({...editingOrg, showCnpj: v})} />
                                            </div>
                                          </div>
                                          <Input value={editingOrg?.cnpj || ""} onChange={e => setEditingOrg({...editingOrg, cnpj: e.target.value})} className="rounded-xl h-11 font-mono" placeholder="00.000.000/0000-00" />
                                       </div>
                                    </div>
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome Fantasia</Label><Input value={editingOrg?.nomeFantasia || editingOrg?.name || ""} onChange={e => setEditingOrg({...editingOrg, nomeFantasia: e.target.value})} className="rounded-xl h-11" /></div>
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Lock className="w-3 h-3" /> CPF do Representante Legal (Privado)</Label><Input value={editingOrg?.representanteLegalCpf || ""} onChange={e => setEditingOrg({...editingOrg, representanteLegalCpf: e.target.value})} className="rounded-xl h-11 font-mono" placeholder="000.000.000-00" /></div>
                                 </div>
                               )}
                             </div>
                          </TabsContent>

                          <TabsContent value="endereco" className="space-y-8 mt-0">
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">CEP</Label><Input value={editingOrg?.cep || ""} onChange={e => setEditingOrg({...editingOrg, cep: e.target.value})} onBlur={handleCepBlur} className="rounded-xl h-11" /></div>
                                <div className="md:col-span-3 space-y-2">
                                   <div className="flex items-center justify-between">
                                     <Label className="text-[10px] font-black uppercase opacity-60">Rua / Logradouro</Label>
                                     <div className="flex items-center gap-2">
                                       <span className="text-[8px] font-bold uppercase opacity-40">{editingOrg?.showAddress ?? true ? 'Público' : 'Oculto'}</span>
                                       <Switch checked={editingOrg?.showAddress ?? true} onCheckedChange={v => setEditingOrg({...editingOrg, showAddress: v})} />
                                     </div>
                                   </div>
                                   <Input value={editingOrg?.street || ""} onChange={e => setEditingOrg({...editingOrg, street: e.target.value})} className="rounded-xl h-11" />
                                </div>
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
                 <Button type="submit" disabled={isSaving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Todas as Alterações
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
  const [membersWithProfiles, setMembersWithProfiles] = React.useState<any[]>([])

  const membersQuery = useMemoFirebase(() => (orgId && db) ? collection(db, "organizations", orgId, "members") : null, [db, orgId])
  const { data: members, loading } = useCollection<any>(membersQuery)
  
  const membersIdsString = React.useMemo(() => members?.map(m => m.userId).sort().join(',') || '', [members]);
  
  React.useEffect(() => {
    if (!members || !db || !membersIdsString) {
      setMembersWithProfiles([]);
      return;
    }
    let isSubscribed = true;
    const fetch = async () => {
      const results = await Promise.all(members.map(async (m) => {
        try {
          const uSnap = await getDoc(doc(db, "users", m.userId))
          return { ...m, profile: uSnap.exists() ? uSnap.data() : null }
        } catch (e) {
          return { ...m, profile: null }
        }
      }))
      if (isSubscribed) setMembersWithProfiles(results)
    }
    fetch()
    return () => { isSubscribed = false; }
  }, [membersIdsString, db])

  const handleAdd = async () => {
    if (!db || !orgId || !newMemberUser) return
    setAdding(true)
    try {
      const cleanUser = newMemberUser.toLowerCase().trim().replace('@', '')
      const uSnap = await getDocs(query(collection(db, "usernames"), where("__name__", "==", cleanUser), limit(1)))
      if (uSnap.empty) throw new Error("Usuário não encontrado.")
      const uid = uSnap.docs[0].data().uid
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
                     <span className="font-bold text-sm font-primary truncate max-w-[150px]">{m.profile?.name || "Usuário"}</span>
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
