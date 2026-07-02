
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  serverTimestamp,
  deleteField,
  where,
  getDocs,
  limit,
  runTransaction
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
  Users, 
  User as UserIcon,
  Trash2,
  Edit,
  Save,
  BadgeCheck,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ShieldBan,
  AtSign,
  AlertTriangle,
  Fingerprint,
  Mail,
  TicketPercent,
  Building2,
  Calendar,
  Zap,
  TrendingUp
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { cn, validateCPF } from "@/lib/utils"
import { sendVerificationStatusEmail } from "@/app/actions/email"
import { useAdminPermissions } from "@/hooks/use-admin-permissions"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { updateUserCPF } from "@/app/actions/user"
import { upsertUserCoupon, deleteUserCoupon } from "@/app/actions/user-coupons"
import { calculateUserCouponPoints } from "@/lib/coupon-utils"

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { adminProfile, isSuperAdmin } = useAdminPermissions()
  const [search, setSearch] = React.useState("")
  
  const [editingUser, setEditingUser] = React.useState<any>(null)
  const [originalUser, setOriginalUser] = React.useState<any>(null)
  const [isEditUserOpen, setIsEditUserOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [tempCPF, setTempCPF] = React.useState("")

  // Estados para o Cupom
  const [hasCoupon, setHasCoupon] = React.useState(false)
  const [couponData, setCouponData] = React.useState<any>(null)
  const [selectedOrgId, setSelectedOrgId] = React.useState("")
  const [selectedEventId, setSelectedEventId] = React.useState("")
  const [discountValue, setDiscountValue] = React.useState("0.00")
  const [manualEventId, setManualEventId] = React.useState("")

  const adminUid = adminProfile?.uid;

  const usersQuery = useMemoFirebase(() => 
    (db && adminUid) ? query(collection(db, "users"), orderBy("createdAt", "desc")) : null, 
    [db, adminUid]
  )
  const { data: users, loading: loadingUsers } = useCollection<any>(usersQuery)

  // Consultas Auxiliares para o Cupom
  const orgsQuery = useMemoFirebase(() => (db && isEditUserOpen) ? query(collection(db, "organizations"), orderBy("name", "asc")) : null, [db, isEditUserOpen]);
  const { data: organizations } = useCollection<any>(orgsQuery);

  const eventsQuery = useMemoFirebase(() => 
    (db && selectedOrgId) ? query(collection(db, "events"), where("organizationId", "==", selectedOrgId), where("status", "==", "Ativo")) : null, 
    [db, selectedOrgId]
  );
  const { data: events } = useCollection<any>(eventsQuery);

  const filteredUsers = React.useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      (u.name || "").toLowerCase().includes(search.toLowerCase()) || 
      (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
    )
  }, [users, search])

  // Busca dados do cupom quando abre edição
  React.useEffect(() => {
    if (editingUser?.id && isEditUserOpen && db) {
      getDocs(query(collection(db, "user_coupons"), where("userId", "==", editingUser.id), limit(1))).then(snap => {
        if (!snap.empty) {
          const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
          setCouponData(data);
          setHasCoupon(data.status === 'active');
          setDiscountValue(data.discountValue?.toString() || "0.00");
          setManualEventId(data.eventId || "");
          setSelectedEventId(data.eventId || "");
        } else {
          setCouponData(null);
          setHasCoupon(false);
          setDiscountValue("0.00");
          setManualEventId("");
          setSelectedEventId("");
        }
      });
    }
  }, [editingUser?.id, isEditUserOpen, db]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingUser || isSaving) return
    
    const newUsername = editingUser.username?.toLowerCase().trim();
    const oldUsername = originalUser?.username?.toLowerCase().trim();
    const usernameChanged = oldUsername && newUsername && oldUsername !== newUsername;

    setIsSaving(true)
    try {
      // 1. Processar CPF se Super Admin alterou
      if (isSuperAdmin && tempCPF && tempCPF !== (originalUser?.cpfMasked || originalUser?.cpf)) {
        const cleanCPF = tempCPF.replace(/\D/g, "");
        if (!validateCPF(cleanCPF)) throw new Error("CPF informado é inválido.");
        const cpfRes = await updateUserCPF(editingUser.id, cleanCPF);
        if (!cpfRes.success) throw new Error(cpfRes.error);
      }

      // 2. Processar Cupom de Desconto
      if (hasCoupon) {
        const targetEvent = manualEventId || selectedEventId;
        if (!targetEvent) throw new Error("Informe o evento do cupom.");
        
        await upsertUserCoupon({
          userId: editingUser.id,
          username: editingUser.username,
          eventId: targetEvent,
          discountValue: parseFloat(discountValue),
          active: hasCoupon
        });
      } else if (originalUser?.hasUserCoupon) {
        await deleteUserCoupon(editingUser.id);
      }

      // 3. Atualizar Dados do Usuário
      await runTransaction(db, async (transaction) => {
        if (usernameChanged) {
          const newIdxRef = doc(db, "usernames", newUsername);
          const newIdxSnap = await transaction.get(newIdxRef);
          if (newIdxSnap.exists()) throw new Error("Este @username já está sendo usado.");

          if (oldUsername) transaction.delete(doc(db, "usernames", oldUsername));
          transaction.set(newIdxRef, { uid: editingUser.id, type: 'user', email: editingUser.email, username: newUsername });
        }

        const { id, cpf, cpfHash, cpfMasked, ...data } = editingUser;
        transaction.update(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() });
      });
      
      toast({ title: "Usuário atualizado!" })
      setIsEditUserOpen(false)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message }) 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleDeleteUser = async (id: string, username: string) => {
    if (!db || !confirm(`Tem certeza que deseja excluir @${username}?`)) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, "users", id))
      if (username) batch.delete(doc(db, "usernames", username.toLowerCase()))
      await batch.commit()
      toast({ title: "Usuário removido" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na exclusão" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBlock = async (id: string, currentStatus: string) => {
    if (!db) return
    const newStatus = currentStatus === 'Bloqueado' ? 'Ativo' : 'Bloqueado'
    try {
      await updateDoc(doc(db, "users", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        blockReason: newStatus === 'Bloqueado' ? "Titular da conta bloqueado por moderação." : deleteField()
      });
      toast({ title: newStatus === 'Bloqueado' ? "Usuário Bloqueado" : "Usuário Ativado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na moderação" })
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Users className="w-8 h-8 text-secondary" /> Gestão de Usuários
        </h1>
        <p className="text-muted-foreground font-medium">Controle administrativo sobre perfis pessoais da plataforma.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, @username ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
        </div>
        <div className="px-4 py-2 bg-muted/50 rounded-xl border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {filteredUsers.length} Usuários Encontrados
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Usuário</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Plano / Status</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Cidade</TableHead>
              <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Selo</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingUsers ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredUsers.map(u => (
              <TableRow key={u.id} className={cn("hover:bg-muted/5 transition-colors", u.status === 'Bloqueado' && "bg-destructive/[0.02] opacity-75")}>
                <TableCell className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shadow-sm">
                      <AvatarImage src={u.avatar} className="object-cover" />
                      <AvatarFallback className="font-black uppercase">{u.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{u.name}</span>
                        {u.hasUserCoupon && <TicketPercent className="w-3.5 h-3.5 text-secondary animate-pulse" title="Possui Cupom Ativo" />}
                      </div>
                      <span className="text-[10px] text-secondary font-bold">@{u.username}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit text-[8px] font-black uppercase border-primary/20 text-primary">{u.plan || 'free'}</Badge>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">{u.status || 'Ativo'}</span>
                   </div>
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground uppercase">{u.city || "---"}</TableCell>
                <TableCell className="text-center">
                  {u.isVerified ? <BadgeCheck className="w-5 h-5 fill-blue-500 text-white mx-auto" /> : <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/30 mx-auto" />}
                </TableCell>
                <TableCell className="p-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingUser({...u}); setOriginalUser(u); setTempCPF(u.cpfMasked || u.cpf || ""); setIsEditUserOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", u.status === 'Bloqueado' ? "text-green-600" : "text-orange-500")} onClick={() => handleToggleBlock(u.id, u.status)}><ShieldBan className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-lg hover:bg-destructive/10" onClick={() => handleDeleteUser(u.id, u.username)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <div className="flex justify-between items-start">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border shadow-md">
                      <AvatarImage src={editingUser?.avatar} className="object-cover" />
                      <AvatarFallback className="font-black">{editingUser?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                       <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Editar Membro</DialogTitle>
                       <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Gestão de Perfil Pessoal e Acessos</DialogDescription>
                    </div>
                 </div>
              </div>
           </DialogHeader>

           <form onSubmit={handleUpdateUser} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-8 space-y-10">
                 {/* DADOS BÁSICOS */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                       <Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl h-11" required />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Username (@)</Label>
                       <Input value={editingUser?.username || ""} readOnly className="rounded-xl h-11 bg-muted/50 cursor-not-allowed font-bold" />
                    </div>
                 </div>

                 <Separator className="border-dashed" />

                 {/* SEÇÃO CUPOM DE DESCONTO */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-secondary/5 border-2 border-dashed border-secondary/20 rounded-[2rem]">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-secondary/10 rounded-2xl text-secondary"><TicketPercent className="w-6 h-6" /></div>
                          <div>
                             <p className="font-black uppercase italic text-primary">Cupom de Desconto Exclusivo</p>
                             <p className="text-[10px] text-muted-foreground uppercase font-bold">O código do cupom será: <span className="text-secondary">{editingUser?.username?.toUpperCase()}</span></p>
                          </div>
                       </div>
                       <Switch checked={hasCoupon} onCheckedChange={setHasCoupon} />
                    </div>

                    {hasCoupon && (
                      <div className="grid grid-cols-1 gap-6 p-8 bg-white border rounded-[2rem] shadow-sm animate-in slide-in-from-top-2">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <Label className="text-[10px] font-black uppercase opacity-60">Evento Vinculado</Label>
                               <div className="space-y-3">
                                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                                     <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="1. Selecione a Marca" /></SelectTrigger>
                                     <SelectContent className="rounded-xl">
                                        {organizations?.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                                     </SelectContent>
                                  </Select>

                                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                                     <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="2. Selecione o Evento" /></SelectTrigger>
                                     <SelectContent className="rounded-xl">
                                        {events?.map(ev => <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>)}
                                     </SelectContent>
                                  </Select>
                               </div>
                            </div>

                            <div className="space-y-4">
                               <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase opacity-60">OU Digite o UID do Evento</Label>
                                  <Input value={manualEventId} onChange={e => setManualEventId(e.target.value)} placeholder="UID do Firestore" className="rounded-xl h-11 font-mono text-xs" />
                               </div>
                               <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase opacity-60">Valor do Desconto (R$)</Label>
                                  <div className="relative">
                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                                     <Input type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="rounded-xl h-12 pl-9 font-black text-primary text-lg" />
                                  </div>
                               </div>
                            </div>
                         </div>

                         {couponData && (
                           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-dashed pt-8">
                              <StatCard label="Ingressos Vendidos" value={couponData.uses || 0} icon={Users} />
                              <StatCard label="Pontuação" value={calculateUserCouponPoints(couponData.uses || 0)} icon={Zap} />
                              <StatCard label="Criação" value={new Date(couponData.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')} icon={Calendar} />
                              <StatCard label="Último Uso" value={couponData.lastUsedAt ? new Date(couponData.lastUsedAt?.seconds * 1000).toLocaleDateString('pt-BR') : "---"} icon={Clock} />
                           </div>
                         )}
                      </div>
                    )}
                 </div>

                 <Separator className="border-dashed" />

                 <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-4">
                    <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-orange-700 font-bold uppercase leading-relaxed">
                       Cuidado: Alterações em cupons e permissões impactam diretamente o faturamento e a validade de compras externas.
                    </p>
                 </div>
              </ScrollArea>

              <DialogFooter className="p-8 border-t bg-muted/30">
                 <Button type="submit" disabled={isSaving} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Todas as Alterações
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <div className="p-4 bg-muted/30 rounded-2xl border text-center">
       <div className="p-1.5 bg-white rounded-lg w-fit mx-auto mb-2 shadow-sm text-secondary"><Icon className="w-3.5 h-3.5" /></div>
       <p className="text-[8px] font-black uppercase text-muted-foreground mb-0.5">{label}</p>
       <p className="text-sm font-black text-primary italic">{value}</p>
    </div>
  )
}
