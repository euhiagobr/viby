
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
  getDocs
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
  RefreshCcw,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Coins,
  Percent,
  TrendingUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { calculateDetailedVibyBreakdown } from "@/lib/financial-utils"

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

  const handleRecalculateFees = async () => {
    if (!db || !editingOrg || isRecalculating) return

    setIsRecalculating(true)
    try {
      // 1. Buscar configurações globais necessárias para o motor financeiro
      const [feesSnap, stripeSnap, promosSnap] = await Promise.all([
        getDoc(doc(db, "settings", "fees")),
        getDoc(doc(db, "settings", "stripe")),
        getDoc(doc(db, "settings", "promotions"))
      ])

      const globalFees = feesSnap.data()
      const stripeSettings = stripeSnap.data()
      const promotions = promosSnap.data()

      // 2. Buscar ingressos da organização que NÃO foram repassados
      // Assumimos que não foram repassados se não possuem payoutId ou status de repasse concluído
      const regsQuery = query(
        collection(db, "registrations"), 
        where("organizationId", "==", editingOrg.id),
        where("paymentStatus", "in", ["Pago", "Disponível"])
      )
      
      const regsSnap = await getDocs(regsQuery)
      if (regsSnap.empty) {
        toast({ title: "Tudo em dia!", description: "Não há ingressos pendentes de repasse para esta marca." })
        return
      }

      const batch = writeBatch(db)
      let count = 0

      for (const regDoc of regsSnap.docs) {
        const reg = regDoc.data()
        
        // Regra de ouro: Só recalcula o que ainda não foi liquidado
        if (reg.payoutId || reg.payoutStatus === 'Concluído') continue

        // Recalcular usando o novo customFee do editingOrg
        const breakdown = calculateDetailedVibyBreakdown(
          reg.ticketBasePrice || 0,
          1,
          globalFees,
          stripeSettings,
          true, // Assumimos item individual para recalculo
          promotions,
          editingOrg // Passamos os dados da org em edição com a nova taxa
        )

        // Atualizar Registro do Ingresso
        batch.update(regDoc.ref, {
          producerFeeAmount: breakdown.organizerFeeTotal,
          producerNetAmount: breakdown.payoutToProducer,
          updatedAt: serverTimestamp(),
          recalculatedAt: serverTimestamp()
        })

        // Atualizar Registro Fiscal (ERP) correspondente
        const taxQ = query(collection(db, "tax_tickets"), where("registrationId", "==", regDoc.id), limit(1))
        const taxSnap = await getDocs(taxQ)
        if (!taxSnap.empty) {
          batch.update(taxSnap.docs[0].ref, {
             organizerFeeAmount: breakdown.organizerFeeTotal,
             vibyGrossProfit: breakdown.vibyGross,
             taxAmount: breakdown.imposto,
             vibyNetProfit: breakdown.vibyNet,
             payoutToProducer: breakdown.payoutToProducer,
             recalculatedAt: serverTimestamp()
          })
        }
        count++
      }

      if (count > 0) {
        await batch.commit()
        toast({ title: "Recálculo Concluído!", description: `${count} ingressos foram atualizados com as novas taxas.` })
      } else {
        toast({ title: "Nenhuma alteração", description: "Todos os ingressos elegíveis já possuem essas taxas." })
      }
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro no recálculo" })
    } finally {
      setIsRecalculating(false)
    }
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
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                    <Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl h-11" required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Username (@)</Label>
                    <div className="relative">
                       <Input value={editingUser?.username || ""} onChange={e => setEditingUser({...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} className="rounded-xl h-11 pr-10" />
                       <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingUsername && <Loader2 className="w-4 h-4 animate-spin opacity-40" />}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">E-mail</Label>
                    <Input value={editingUser?.email || ""} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="rounded-xl h-11" required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Cargo</Label>
                    <Select value={editingUser?.role || "user"} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                 <div className="space-y-0.5">
                    <p className="font-bold text-sm flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-blue-500" /> Selo Verificado
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Habilita o badge de verificação oficial</p>
                 </div>
                 <Switch 
                   checked={editingUser?.isVerified || false} 
                   onCheckedChange={v => setEditingUser({...editingUser, isVerified: v})} 
                 />
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSaving || (usernameStatus === 'taken')} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Usuário
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDITAR PÁGINA / ORGANIZAÇÃO */}
      <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
        <DialogContent className="max-w-xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Editar Página Comercial</DialogTitle>
              <DialogDescription>Ajuste dados e configure taxas personalizadas para esta marca.</DialogDescription>
           </DialogHeader>
           <form onSubmit={handleUpdateOrg} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome da Marca</Label>
                    <Input value={editingOrg?.name || ""} onChange={e => setEditingOrg({...editingOrg, name: e.target.value})} className="rounded-xl h-11" required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Username (@)</Label>
                    <div className="relative">
                       <Input value={editingOrg?.username || ""} onChange={e => setEditingOrg({...editingOrg, username: e.target.value.toLowerCase().replace(/\s+/g, "")})} className="rounded-xl h-11 pr-10" />
                       <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingUsername && <Loader2 className="w-4 h-4 animate-spin opacity-40" />}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Status de Visibilidade</Label>
                    <Select value={editingOrg?.status || "Ativo"} onValueChange={v => setEditingOrg({...editingOrg, status: v})}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="Ativo">Ativo (No ar)</SelectItem>
                          <SelectItem value="Desativado">Desativado (Oculto)</SelectItem>
                          <SelectItem value="Bloqueado">Bloqueado (Restrito)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">CNPJ</Label>
                    <Input value={editingOrg?.cnpj || ""} onChange={e => setEditingOrg({...editingOrg, cnpj: e.target.value})} className="rounded-xl h-11" />
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                 <div className="space-y-0.5">
                    <p className="font-bold text-sm flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-blue-500" /> Selo de Verificação
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Valida a autenticidade da marca</p>
                 </div>
                 <Switch 
                   checked={editingOrg?.verified || false} 
                   onCheckedChange={v => setEditingOrg({...editingOrg, verified: v})} 
                 />
              </div>

              <Separator className="border-dashed" />

              {/* SEÇÃO DE TAXAS PERSONALIZADAS */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <h3 className="font-black italic uppercase tracking-tighter text-secondary flex items-center gap-2">
                          <Coins className="w-5 h-5" /> Taxas Personalizadas
                       </h3>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase">Sobrescreve taxas globais e campanhas para esta marca.</p>
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
                           <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1.5"><Percent className="w-3 h-3" /> Taxa Produtor (%)</Label>
                           <div className="relative">
                              <Input 
                                 type="number" step="0.1" 
                                 value={editingOrg?.customFeePercent ?? 10} 
                                 onChange={e => setEditingOrg({...editingOrg, customFeePercent: parseFloat(e.target.value) || 0})}
                                 className="rounded-xl h-10 font-black text-secondary pr-8" 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-40">%</span>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Valor Mínimo (R$)</Label>
                           <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] opacity-40">R$</span>
                              <Input 
                                 type="number" step="0.01" 
                                 value={editingOrg?.customMinFee ?? 9.99} 
                                 onChange={e => setEditingOrg({...editingOrg, customMinFee: parseFloat(e.target.value) || 0})}
                                 className="rounded-xl h-10 font-black text-secondary pl-8" 
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1.5"><ArrowDown className="w-3 h-3" /> Valor Máximo (R$)</Label>
                           <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] opacity-40">R$</span>
                              <Input 
                                 type="number" step="0.01" 
                                 value={editingOrg?.customMaxFee ?? 0} 
                                 onChange={e => setEditingOrg({...editingOrg, customMaxFee: parseFloat(e.target.value) || 0})}
                                 className="rounded-xl h-10 font-black text-secondary pl-8" 
                              />
                           </div>
                        </div>
                      </div>

                      <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 space-y-4">
                         <div className="flex items-start gap-4">
                            <RefreshCw className={cn("w-6 h-6 text-secondary shrink-0 mt-1", isRecalculating && "animate-spin")} />
                            <div className="space-y-1">
                               <h4 className="font-black text-xs uppercase italic text-secondary">Sincronizar Vendas Pendentes</h4>
                               <p className="text-[10px] text-muted-foreground leading-relaxed uppercase">
                                  Ao mudar a taxa, você pode recalcular o valor líquido de todos os ingressos vendidos que **ainda não foram repassados** (em custódia).
                               </p>
                            </div>
                         </div>
                         <Button 
                           type="button" 
                           onClick={handleRecalculateFees} 
                           disabled={isRecalculating || !editingOrg?.customFeeActive}
                           className="w-full h-11 rounded-xl bg-white border-2 border-secondary text-secondary font-black uppercase text-[10px] italic shadow-sm hover:bg-secondary hover:text-white transition-all"
                         >
                            {isRecalculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Recalcular Taxas Pendentes
                         </Button>
                      </div>
                   </div>
                 )}
              </div>
           </form>
           <DialogFooter className="p-8 border-t bg-muted/30">
              <Button onClick={handleUpdateOrg} disabled={isSaving || (usernameStatus === 'taken')} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                 Salvar Configurações da Página
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
