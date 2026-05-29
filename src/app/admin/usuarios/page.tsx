
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
  writeBatch,
  serverTimestamp,
  deleteField,
  where,
  getDocs,
  limit
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
  Users, 
  Building2, 
  User as UserIcon,
  Trash2,
  Edit,
  Save,
  BadgeCheck,
  X,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Coins,
  Lock,
  Globe,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Instagram,
  MapPin,
  Fingerprint,
  ArrowRightLeft,
  ShieldAlert,
  ShieldBan,
  AtSign
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  
  const [transferOrg, setTransferOrg] = React.useState<any>(null)
  const [isTransferOpen, setIsTransferOpen] = React.useState(false)
  const [newOwnerUsername, setNewOwnerUsername] = React.useState("")
  
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRecalculating, setIsRecalculating] = React.useState(false)
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
      (o.name?.toLowerCase() || "").includes(search.toLowerCase()) || 
      (o.username?.toLowerCase() || "").includes(search.toLowerCase())
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

    const regex = /^[a-zA-Z0-9._]+$/
    if (normalized.length < 5 || !regex.test(normalized)) {
      setUsernameStatus('invalid')
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

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingUser || isSaving) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const original = users?.find(u => u.id === editingUser.id)
      
      if (editingUser.username !== original?.username) {
        if (original?.username) {
          batch.delete(doc(db, "usernames", original.username.toLowerCase()))
        }
        batch.set(doc(db, "usernames", editingUser.username.toLowerCase()), { 
          uid: editingUser.id, 
          type: 'user',
          updatedAt: serverTimestamp()
        })
      }

      const { id, ...data } = editingUser
      batch.update(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() })
      
      await batch.commit()
      toast({ title: "Usuário atualizado!" })
      setIsEditUserOpen(false)
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro ao salvar" }) 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleToggleBlock = async (id: string, currentStatus: string, type: 'users' | 'organizations') => {
    if (!db) return
    const isBlocked = currentStatus === 'Bloqueado'
    const newStatus = isBlocked ? 'Ativo' : 'Bloqueado'
    
    try {
      const batch = writeBatch(db);
      
      // 1. Atualizar o alvo principal
      batch.update(doc(db, type, id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        moderatedAt: serverTimestamp(),
        moderatedBy: "Admin"
      });

      // 2. Se for um usuário sendo bloqueado, bloqueia também suas organizações
      if (type === 'users' && !isBlocked) {
        const orgsQ = query(collection(db, "organizations"), where("createdBy", "==", id));
        const orgsSnap = await getDocs(orgsQ);
        orgsSnap.forEach(orgDoc => {
          batch.update(orgDoc.ref, {
            status: 'Bloqueado',
            updatedAt: serverTimestamp(),
            moderatedAt: serverTimestamp(),
            moderatedBy: "Admin",
            blockReason: "Proprietário da conta bloqueado."
          });
        });
      }

      await batch.commit();
      toast({ 
        title: isBlocked ? "Perfil Desbloqueado" : "Perfil Bloqueado", 
        description: isBlocked 
          ? `O ${type === 'users' ? 'usuário' : 'perfil da marca'} agora está ativo.` 
          : `Bloqueio aplicado${type === 'users' ? ' e estendido às suas marcas.' : '.'}` 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na moderação" })
    }
  }

  const handleTransferOwnership = async () => {
    if (!db || !transferOrg || !newOwnerUsername) return
    setIsSaving(true)
    
    try {
      const cleanUser = newOwnerUsername.toLowerCase().trim().replace('@', '')
      const uSnap = await getDoc(doc(db, "usernames", cleanUser))
      
      if (!uSnap.exists() || uSnap.data().type !== 'user') {
        throw new Error("Usuário de destino não encontrado ou inválido.")
      }

      const newOwnerUid = uSnap.data().uid
      const batch = writeBatch(db)

      // 1. Localizar antigo dono para rebaixar
      const membersQ = query(collection(db, "organizations", transferOrg.id, "members"), where("role", "==", "owner"), limit(1))
      const membersSnap = await getDocs(membersQ)
      
      if (!membersSnap.empty) {
        batch.update(membersSnap.docs[0].ref, { role: 'admin', updatedAt: serverTimestamp() })
      }

      // 2. Definir novo dono
      const newMemberRef = doc(db, "organizations", transferOrg.id, "members", newOwnerUid)
      batch.set(newMemberRef, {
        userId: newOwnerUid,
        role: 'owner',
        status: 'accepted',
        transferredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true })

      // 3. Atualizar documento da org
      batch.update(doc(db, "organizations", transferOrg.id), {
        updatedAt: serverTimestamp(),
        lastOwnerTransferAt: serverTimestamp()
      })

      await batch.commit()
      toast({ title: "Titularidade Transferida!", description: `O controle de ${transferOrg.name} agora pertence a @${cleanUser}.` })
      setIsTransferOpen(false)
      setNewOwnerUsername("")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na transferência", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingOrg || isSaving) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const original = orgs?.find(o => o.id === editingOrg.id)
      
      if (editingOrg.username !== original?.username) {
        if (original?.username) {
          batch.delete(doc(db, "usernames", original.username.toLowerCase()))
        }
        batch.set(doc(db, "usernames", editingOrg.username.toLowerCase()), { 
          uid: editingOrg.id, 
          type: 'organization',
          updatedAt: serverTimestamp()
        })
      }

      const { id, ...data } = editingOrg
      batch.update(doc(db, "organizations", id), { ...data, updatedAt: serverTimestamp() })
      
      await batch.commit()
      toast({ title: "Página atualizada!" })
      setIsEditOrgOpen(false)
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro ao salvar" }) 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleDeleteProfile = async (id: string, type: 'user' | 'organization', username: string) => {
    if (!db) return
    if (!confirm(`Excluir permanentemente este ${type === 'user' ? 'usuário' : 'perfil de marca'}?`)) return

    try {
      const batch = writeBatch(db)
      if (username) {
        batch.delete(doc(db, "usernames", username.toLowerCase()))
      }
      batch.delete(doc(db, type === 'user' ? "users" : "organizations", id))
      
      const followsQ = query(collection(db, "follows"), where(type === 'user' ? "followerId" : "followingId", "==", id))
      const followsSnap = await getDocs(followsQ)
      followsSnap.forEach(d => batch.delete(d.ref))

      await batch.commit()
      toast({ title: "Perfil removido com sucesso" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  const handleRecalculateFees = async () => {
    if (!db || !editingOrg || isRecalculating) return
    setIsRecalculating(true)
    try {
      const [stripeSnap, feesSnap] = await Promise.all([
        getDoc(doc(db, "settings", "stripe")),
        getDoc(doc(db, "settings", "fees"))
      ])

      const stripeSettings = stripeSnap.data()
      const globalFees = feesSnap.data()

      const regsQuery = query(
        collection(db, "registrations"), 
        where("organizationId", "==", editingOrg.id),
        where("paymentStatus", "in", ["Pago", "Disponível"])
      )
      
      const regsSnap = await getDocs(regsQuery)
      if (regsSnap.empty) {
        toast({ title: "Tudo em dia!", description: "Não há vendas pendentes de repasse." })
        return
      }

      const batch = writeBatch(db)
      let count = 0

      for (const regDoc of regsSnap.docs) {
        const reg = regDoc.data()
        if (reg.payoutId || reg.payoutStatus === 'Concluído' || reg.payoutStatus === 'Bloqueado') continue

        const facePrice = reg.ticketBasePrice || 0;
        const buyerFeeAmount = reg.administrativeFeeAmount || 0;
        const totalPaidByCustomer = reg.price || (facePrice + buyerFeeAmount);

        const oPercentVal = editingOrg.customFeeActive ? (editingOrg.customFeePercent ?? 10) : (globalFees?.organizerFeePercent ?? 10);
        const oMinVal = editingOrg.customFeeActive ? (editingOrg.customMinFee ?? 9.99) : (globalFees?.organizerMinFee ?? 9.99);
        const oMaxVal = editingOrg.customFeeActive ? (editingOrg.customMaxFee ?? 0) : 0;

        const calculatedPercentFee = Number((facePrice * (oPercentVal / 100)).toFixed(2));
        let newProducerFee = Math.max(calculatedPercentFee, oMinVal);
        if (oMaxVal > 0) newProducerFee = Math.min(newProducerFee, oMaxVal);

        const newProducerNet = Number((facePrice - newProducerFee).toFixed(2));

        const stripePercent = (stripeSettings?.feePercent ?? 3.99) / 100;
        const stripeFixed = stripeSettings?.feeFixed ?? 0.39;
        const stripeFeeTotal = Number(((totalPaidByCustomer * stripePercent) + stripeFixed).toFixed(2));

        const newVibyGross = Number((buyerFeeAmount + newProducerFee).toFixed(2));
        const newTaxAmount = Number((newVibyGross * 0.11).toFixed(2));
        const newVibyNet = Number((newVibyGross - stripeFeeTotal - newTaxAmount).toFixed(2));

        batch.update(regDoc.ref, {
          producerFeeAmount: newProducerFee,
          producerNetAmount: newProducerNet,
          updatedAt: serverTimestamp(),
          recalculatedAt: serverTimestamp()
        })

        const taxQ = query(collection(db, "tax_tickets"), where("registrationId", "==", regDoc.id), limit(1))
        const taxSnap = await getDocs(taxQ)
        if (!taxSnap.empty) {
          batch.update(taxSnap.docs[0].ref, {
             organizerFeeAmount: newProducerFee,
             vibyGrossProfit: newVibyGross,
             taxAmount: newTaxAmount,
             vibyNetProfit: newVibyNet,
             payoutToProducer: newProducerNet,
             updatedAt: serverTimestamp()
          })
        }
        count++
      }

      if (count > 0) {
        await batch.commit()
        toast({ title: "Recálculo Concluído!", description: `${count} vendas atualizadas.` })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no processamento" })
    } finally {
      setIsRecalculating(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
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
            <TabsTrigger value="usuarios" className="rounded-lg px-6 font-bold gap-2"><UserIcon className="w-4 h-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="paginas" className="rounded-lg px-6 font-bold gap-2"><Building2 className="w-4 h-4" /> Páginas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">{activeTab === 'usuarios' ? 'Usuário' : 'Marca'}</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">{activeTab === 'usuarios' ? 'Cargo' : 'Status'}</TableHead>
              <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Verificado</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeTab === 'usuarios' ? (
              loadingUsers ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
              ) : filteredUsers.map(user => (
                <TableRow key={user.id} className={cn("hover:bg-muted/5 transition-colors", user.status === 'Bloqueado' && "bg-destructive/[0.02] opacity-75")}>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={user.avatar} className="object-cover" />
                        <AvatarFallback className="font-black uppercase">{user.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{user.name}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-secondary font-bold">@{user.username}</span>
                           {user.status === 'Bloqueado' && <Badge variant="destructive" className="h-3 px-1.5 text-[7px] font-black uppercase">Bloqueado</Badge>}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase border-primary/20 text-primary">{user.role || 'user'}</Badge></TableCell>
                  <TableCell className="text-center">{user.isVerified && <VerifiedBadge className="mx-auto" />}</TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingUser(user); setIsEditUserOpen(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-8 w-8 rounded-lg", user.status === 'Bloqueado' ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50")}
                        onClick={() => handleToggleBlock(user.id, user.status, 'users')}
                        title={user.status === 'Bloqueado' ? "Desbloquear" : "Bloquear"}
                      >
                         {user.status === 'Bloqueado' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldBan className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-lg hover:bg-destructive/10" onClick={() => handleDeleteProfile(user.id, 'user', user.username)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              loadingOrgs ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
              ) : filteredOrgs.map(org => (
                <TableRow key={org.id} className={cn("hover:bg-muted/5 transition-colors", org.status === 'Bloqueado' && "bg-destructive/[0.02] opacity-75")}>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={org.avatar} className="object-cover" />
                        <AvatarFallback className="font-black uppercase">{org.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{org.name}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-secondary font-bold">@{org.username}</span>
                           {org.status === 'Bloqueado' && <Badge variant="destructive" className="h-3 px-1.5 text-[7px] font-black uppercase">Bloqueado</Badge>}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary">{org.status || 'Ativo'}</Badge></TableCell>
                  <TableCell className="text-center">{org.verified && <VerifiedBadge className="mx-auto" />}</TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingOrg(org); setIsEditOrgOpen(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary rounded-lg hover:bg-primary/5" 
                        onClick={() => { setTransferOrg(org); setIsTransferOpen(true); }}
                        title="Transferir Titularidade"
                      >
                         <ArrowRightLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-8 w-8 rounded-lg", org.status === 'Bloqueado' ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50")}
                        onClick={() => handleToggleBlock(org.id, org.status, 'organizations')}
                        title={org.status === 'Bloqueado' ? "Desbloquear" : "Bloquear"}
                      >
                         {org.status === 'Bloqueado' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldBan className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-lg hover:bg-destructive/10" onClick={() => handleDeleteProfile(org.id, 'organization', org.username)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* DIALOG TRANSFERÊNCIA DE TITULARIDADE */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem]">
           <DialogHeader>
              <div className="mx-auto w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mb-2 text-primary shadow-inner">
                 <ArrowRightLeft className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Transferir Titularidade</DialogTitle>
              <DialogDescription className="text-center font-medium">Você está alterando o proprietário legal da marca <strong>{transferOrg?.name}</strong>.</DialogDescription>
           </DialogHeader>
           <div className="space-y-6 py-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><AtSign className="w-3 h-3" /> Username do Novo Dono</Label>
                 <Input 
                   placeholder="Ex: @novo_dono" 
                   value={newOwnerUsername}
                   onChange={e => setNewOwnerUsername(e.target.value)}
                   className="h-12 rounded-xl"
                 />
                 <p className="text-[9px] text-muted-foreground font-medium italic">O usuário deve estar cadastrado na Viby como perfil pessoal.</p>
              </div>

              <div className="p-4 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex gap-3">
                 <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-orange-800 font-bold uppercase leading-relaxed">O antigo dono será automaticamente rebaixado para o cargo de Administrador.</p>
              </div>
           </div>
           <DialogFooter>
              <Button onClick={handleTransferOwnership} disabled={isSaving || !newOwnerUsername} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Confirmar Transferência"}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-xl rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Editar Perfil Pessoal</DialogTitle>
           </DialogHeader>
           <form onSubmit={handleUpdateUser} className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                    <Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl h-11" required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Username (@)</Label>
                    <div className="relative">
                       <Input 
                         value={editingUser?.username || ""} 
                         onChange={e => setEditingUser({...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} 
                         className={cn(
                           "rounded-xl h-11", 
                           usernameStatus === 'valid' ? 'border-green-500 pr-10' : 
                           usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10'
                         )} 
                       />
                       <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin opacity-40" /> : 
                           usernameStatus === 'taken' ? <X className="w-4 h-4 text-destructive" /> : 
                           usernameStatus === 'valid' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : null}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                 <div className="space-y-0.5">
                    <p className="font-bold text-sm flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-blue-500" /> Selo de Verificação
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Habilita o badge oficial no perfil</p>
                 </div>
                 <Switch 
                   checked={editingUser?.isVerified || false} 
                   onCheckedChange={v => setEditingUser({...editingUser, isVerified: v})} 
                 />
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSaving || usernameStatus === 'taken'} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic shadow-lg">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Confirmar Alterações
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Gestão de Marca: {editingOrg?.name}</DialogTitle>
              <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Moderação total de itens e visibilidade.</DialogDescription>
           </DialogHeader>
           
           <form onSubmit={handleUpdateOrg} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-8">
                 <div className="space-y-10 pb-10">
                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> Dados de Identidade
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase opacity-60">Nome da Marca</Label>
                                <VisibilityToggleSwitch checked={editingOrg?.showName ?? true} onChange={v => setEditingOrg({...editingOrg, showName: v})} />
                             </div>
                             <Input value={editingOrg?.name || ""} onChange={e => setEditingOrg({...editingOrg, name: e.target.value})} className="rounded-xl h-11" required />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Username (@)</Label>
                             <div className="relative">
                                <Input 
                                  value={editingOrg?.username || ""} 
                                  onChange={e => setEditingOrg({...editingOrg, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} 
                                  className={cn(
                                    "rounded-xl h-11 pr-10",
                                    usernameStatus === 'valid' ? 'border-green-500' : usernameStatus === 'taken' ? 'border-destructive' : ''
                                  )} 
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                   {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin opacity-40" /> : 
                                    usernameStatus === 'taken' ? <X className="w-4 h-4 text-destructive" /> : 
                                    usernameStatus === 'valid' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : null}
                                </div>
                             </div>
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase opacity-60">Tipo/Segmento</Label>
                                <VisibilityToggleSwitch checked={editingOrg?.showType ?? true} onChange={v => setEditingOrg({...editingOrg, showType: v})} />
                             </div>
                             <Input value={editingOrg?.type || ""} onChange={e => setEditingOrg({...editingOrg, type: e.target.value})} className="rounded-xl" />
                          </div>
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase opacity-60">Bio / Manifesto</Label>
                                <VisibilityToggleSwitch checked={editingOrg?.showBio ?? true} onChange={v => setEditingOrg({...editingOrg, showBio: v})} />
                             </div>
                             <Textarea value={editingOrg?.bio || ""} onChange={e => setEditingOrg({...editingOrg, bio: e.target.value})} className="rounded-xl h-10 min-h-[40px] resize-none" />
                          </div>
                       </div>
                    </div>

                    <Separator className="border-dashed" />

                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                          <Fingerprint className="w-4 h-4" /> Dados Fiscais
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase opacity-60">Razão Social</Label>
                                <VisibilityToggleSwitch checked={editingOrg?.showLegalName ?? true} onChange={v => setEditingOrg({...editingOrg, showLegalName: v})} />
                             </div>
                             <Input value={editingOrg?.legalName || ""} onChange={e => setEditingOrg({...editingOrg, legalName: e.target.value})} className="rounded-xl" />
                          </div>
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase opacity-60">CNPJ</Label>
                                <VisibilityToggleSwitch checked={editingOrg?.showCnpj ?? true} onChange={v => setEditingOrg({...editingOrg, showCnpj: v})} />
                             </div>
                             <Input value={editingOrg?.cnpj || ""} onChange={e => setEditingOrg({...editingOrg, cnpj: e.target.value})} className="rounded-xl" />
                          </div>
                       </div>
                    </div>

                    <Separator className="border-dashed" />

                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> Endereço e Localização
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <VisibilityToggle 
                            label="Endereço Completo (Rua/Nº)" 
                            icon={MapPin} 
                            checked={editingOrg?.showAddress ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showAddress: v})} 
                          />
                          <VisibilityToggle 
                            label="Bairro" 
                            icon={MapPin} 
                            checked={editingOrg?.showNeighborhood ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showNeighborhood: v})} 
                          />
                          <VisibilityToggle 
                            label="Cidade e Estado" 
                            icon={Globe} 
                            checked={editingOrg?.showState ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showState: v})} 
                          />
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-2"><Label className="text-[9px] uppercase opacity-40">CEP</Label><Input value={editingOrg?.cep || ""} onChange={e => setEditingOrg({...editingOrg, cep: e.target.value})} className="h-9 text-xs" /></div>
                          <div className="md:col-span-2 space-y-2"><Label className="text-[9px] uppercase opacity-40">Rua/Logradouro</Label><Input value={editingOrg?.street || ""} onChange={e => setEditingOrg({...editingOrg, street: e.target.value})} className="h-9 text-xs" /></div>
                          <div className="space-y-2"><Label className="text-[9px] uppercase opacity-40">Nº</Label><Input value={editingOrg?.number || ""} onChange={e => setEditingOrg({...editingOrg, number: e.target.value})} className="h-9 text-xs" /></div>
                       </div>
                    </div>

                    <Separator className="border-dashed" />

                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                          <Eye className="w-4 h-4" /> Canais de Contato
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <VisibilityToggle 
                            label="Telefone / WhatsApp" 
                            icon={Phone} 
                            checked={editingOrg?.showPhone ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showPhone: v})} 
                          />
                          <VisibilityToggle 
                            label="E-mail de Contato" 
                            icon={Mail} 
                            checked={editingOrg?.showEmail ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showEmail: v})} 
                          />
                          <VisibilityToggle 
                            label="Site Oficial" 
                            icon={Globe} 
                            checked={editingOrg?.showWebsite ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showWebsite: v})} 
                          />
                          <VisibilityToggle 
                            label="Instagram" 
                            icon={Instagram} 
                            checked={editingOrg?.showInstagram ?? true} 
                            onChange={v => setEditingOrg({...editingOrg, showInstagram: v})} 
                          />
                       </div>
                    </div>

                    <Separator className="border-dashed" />

                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="space-y-1">
                             <h3 className="font-black italic uppercase tracking-tighter text-secondary flex items-center gap-2">
                                <Coins className="w-5 h-5" /> Acordo Comercial
                             </h3>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase">Configure as taxas que esta marca pagará.</p>
                          </div>
                          <Switch 
                             checked={editingOrg?.customFeeActive || false} 
                             onCheckedChange={v => setEditingOrg({...editingOrg, customFeeActive: v})} 
                          />
                       </div>

                       {editingOrg?.customFeeActive && (
                         <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                 <Label className="text-[9px] font-black uppercase opacity-60">Taxa Produtor (%)</Label>
                                 <Input type="number" value={editingOrg?.customFeePercent ?? 10} onChange={e => setEditingOrg({...editingOrg, customFeePercent: parseFloat(e.target.value) || 0})} className="rounded-xl" />
                              </div>
                              <div className="space-y-2">
                                 <Label className="text-[9px] font-black uppercase opacity-60">Mínimo (R$)</Label>
                                 <Input type="number" value={editingOrg?.customMinFee ?? 9.99} onChange={e => setEditingOrg({...editingOrg, customMinFee: parseFloat(e.target.value) || 0})} className="rounded-xl" />
                              </div>
                              <div className="space-y-2">
                                 <Label className="text-[9px] font-black uppercase opacity-60">Máximo (R$)</Label>
                                 <Input type="number" value={editingOrg?.customMaxFee ?? 0} onChange={e => setEditingOrg({...editingOrg, customMaxFee: parseFloat(e.target.value) || 0})} className="rounded-xl" />
                              </div>
                            </div>

                            <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 space-y-4">
                               <div className="flex items-start gap-4">
                                  <RefreshCw className={cn("w-6 h-6 text-secondary shrink-0 mt-1", isRecalculating && "animate-spin")} />
                                  <div className="space-y-1">
                                     <h4 className="font-black text-xs uppercase italic text-secondary">Sincronizar Vendas Pendentes</h4>
                                     <p className="text-[10px] text-muted-foreground leading-relaxed uppercase">Recalcular o líquido de vendas em custódia com as novas taxas.</p>
                                  </div>
                               </div>
                               <Button type="button" onClick={handleRecalculateFees} disabled={isRecalculating} className="w-full h-11 rounded-xl bg-white border-2 border-secondary text-secondary font-black uppercase text-[10px] shadow-sm">
                                  Confirmar Recálculo Retroativo
                                </Button>
                            </div>
                         </div>
                       )}
                    </div>

                    <div className="p-4 bg-muted/50 rounded-2xl border border-dashed flex items-center justify-between">
                       <div className="space-y-0.5">
                          <p className="text-sm font-bold flex items-center gap-2">
                             <ShieldCheck className="w-4 h-4 text-blue-500" /> Selo de Verificada
                          </p>
                          <p className="text-[9px] text-muted-foreground uppercase font-black">Valida a autenticidade oficial da marca</p>
                       </div>
                       <Switch 
                         checked={editingOrg?.verified || false} 
                         onCheckedChange={v => setEditingOrg({...editingOrg, verified: v})} 
                       />
                    </div>
                 </div>
              </ScrollArea>
           </form>
           
           <DialogFooter className="p-8 border-t bg-muted/30">
              <Button onClick={handleUpdateOrg} disabled={isSaving || usernameStatus === 'taken'} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                 Salvar Configurações da Marca
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VisibilityToggle({ label, icon: Icon, checked, onChange }: { label: string, icon: any, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className={cn(
      "p-3 rounded-2xl border flex items-center justify-between transition-all",
      checked ? "bg-white border-border shadow-sm" : "bg-muted/50 border-transparent opacity-60 grayscale-[0.5]"
    )}>
       <div className="flex items-center gap-3">
          <div className={cn("p-1.5 rounded-lg", checked ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground")}>
             <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
       </div>
       <VisibilityToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )
}

function VisibilityToggleSwitch({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      {checked ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75 origin-right" />
    </div>
  )
}
