"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
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
  X,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ShieldBan,
  AtSign,
  AlertTriangle,
  Globe,
  MapPin,
  Trophy,
  Coins,
  Languages,
  Mail
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { sendVerificationStatusEmail } from "@/app/actions/email"
import { useAdminPermissions } from "@/hooks/use-admin-permissions"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { adminProfile } = useAdminPermissions()
  const [search, setSearch] = React.useState("")
  
  const [editingUser, setEditingUser] = React.useState<any>(null)
  const [originalUser, setOriginalUser] = React.useState<any>(null)
  const [isEditUserOpen, setIsEditUserOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  // Trava de segurança para consulta
  const usersQuery = useMemoFirebase(() => 
    (db && user && adminProfile) ? query(collection(db, "users"), orderBy("createdAt", "desc")) : null, 
    [db, user, adminProfile]
  )
  const { data: users, loading: loadingUsers } = useCollection<any>(usersQuery)

  const filteredUsers = React.useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      (u.name || "").toLowerCase().includes(search.toLowerCase()) || 
      (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
    )
  }, [users, search])

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingUser || isSaving) return
    
    const newUsername = editingUser.username?.toLowerCase().trim();
    const oldUsername = originalUser?.username?.toLowerCase().trim();
    const usernameChanged = oldUsername && newUsername && oldUsername !== newUsername;

    setIsSaving(true)
    try {
      await runTransaction(db, async (transaction) => {
        if (usernameChanged) {
          const newIdxRef = doc(db, "usernames", newUsername);
          const newIdxSnap = await transaction.get(newIdxRef);
          
          if (newIdxSnap.exists()) {
            throw new Error("Este @username já está sendo usado por outra conta.");
          }

          if (oldUsername) {
            transaction.delete(doc(db, "usernames", oldUsername));
          }
          transaction.set(newIdxRef, { 
            uid: editingUser.id, 
            type: 'user',
            email: editingUser.email,
            username: newUsername
          });
        }

        const { id, ...data } = editingUser;
        transaction.update(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() });
      });
      
      if (editingUser.isVerified !== originalUser?.isVerified) {
        sendVerificationStatusEmail({
           to: editingUser.email,
           userName: editingUser.name || editingUser.displayName || "Usuário",
           targetName: editingUser.name || `@${editingUser.username}`,
           targetUsername: editingUser.username,
           type: 'user',
           status: editingUser.isVerified ? 'approved' : 'removed'
        }).catch(err => console.warn("Falha ao enviar e-mail de verificação para o usuário", err));
      }

      toast({ title: "Usuário atualizado!", description: "Os dados foram sincronizados com sucesso." })
      setIsEditUserOpen(false)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message }) 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleDeleteUser = async (id: string, username: string) => {
    if (!db || !confirm(`Tem certeza que deseja excluir permanentemente o usuário @${username}?`)) return
    
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, "users", id))
      if (username) {
        batch.delete(doc(db, "usernames", username.toLowerCase()))
      }
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
    const isBlocked = currentStatus === 'Bloqueado'
    const newStatus = isBlocked ? 'Ativo' : 'Bloqueado'
    
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        moderatedAt: serverTimestamp(),
        moderatedBy: "Admin",
        blockReason: newStatus === 'Bloqueado' ? "Titular da conta bloqueado por moderação." : deleteField()
      });
      await batch.commit();
      toast({ title: isBlocked ? "Usuário Ativado" : "Usuário Bloqueado" });
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
          <Input placeholder="Buscar por nome, @username ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl h-11" />
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
            ) : filteredUsers.map(user => (
              <TableRow key={user.id} className={cn("hover:bg-muted/5 transition-colors", user.status === 'Bloqueado' && "bg-destructive/[0.02] opacity-75")}>
                <TableCell className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shadow-sm">
                      <AvatarImage src={user.avatar} className="object-cover" />
                      <AvatarFallback className="font-black uppercase">{user.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{user.name}</span>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] text-secondary font-bold">@{user.username}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit text-[8px] font-black uppercase border-primary/20 text-primary">{user.plan || 'free'}</Badge>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">{user.status || 'Ativo'}</span>
                   </div>
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground uppercase">{user.city || "---"}</TableCell>
                <TableCell className="text-center">
                  {user.isVerified ? (
                    <BadgeCheck className="w-5 h-5 fill-blue-500 text-white mx-auto" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/30 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="p-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingUser({...user}); setOriginalUser(user); setIsEditUserOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-8 w-8 rounded-lg", user.status === 'Bloqueado' ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50")}
                      onClick={() => handleToggleBlock(user.id, user.status)}
                    >
                       {user.status === 'Bloqueado' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldBan className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-lg hover:bg-destructive/10" onClick={() => handleDeleteUser(user.id, user.username)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
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
                 <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-6 font-black uppercase text-[10px] border-secondary text-secondary">{editingUser?.plan || 'free'}</Badge>
                    <Badge className={cn("uppercase text-[10px] font-black h-6", editingUser?.status === 'Bloqueado' ? "bg-red-500 text-white" : "bg-green-500 text-white")}>{editingUser?.status || 'Ativo'}</Badge>
                 </div>
              </div>
           </DialogHeader>

           <form onSubmit={handleUpdateUser} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                 <div className="p-8 space-y-8 pb-12">
                    {/* Identidade */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                          <Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl h-11" required />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60 flex items-center justify-between">Username (@) <span className="text-[8px] text-secondary font-black italic">ALTERAÇÃO ADMIN</span></Label>
                          <div className="relative">
                             <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                             <Input 
                               value={editingUser?.username || ""} 
                               onChange={e => setEditingUser({...editingUser, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "")})} 
                               className="rounded-xl h-11 pl-9 border-dashed border-secondary/40 font-bold" 
                               required
                             />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Bio / Descrição</Label>
                       <Textarea 
                         value={editingUser?.bio || ""} 
                         onChange={e => setEditingUser({...editingUser, bio: e.target.value})} 
                         className="min-h-[100px] rounded-xl resize-none" 
                       />
                    </div>

                    <Separator className="border-dashed" />

                    {/* Classificação e Planos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Cargo de Sistema</Label>
                          <Select value={editingUser?.role || "user"} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                             <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                <SelectItem value="user">Usuário Comum</SelectItem>
                                <SelectItem value="admin">Administrador Global</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Plano de Assinatura</Label>
                          <Select value={editingUser?.plan || "free"} onValueChange={v => setEditingUser({...editingUser, plan: v})}>
                             <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                <SelectItem value="free">Free (Básico)</SelectItem>
                                <SelectItem value="pro">Pro (Intermediário)</SelectItem>
                                <SelectItem value="top">Top (Premium)</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Gênero</Label>
                          <Select value={editingUser?.gender || ""} onValueChange={v => setEditingUser({...editingUser, gender: v})}>
                             <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                <SelectItem value="masculino">Masculino</SelectItem>
                                <SelectItem value="feminino">Feminino</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <Separator className="border-dashed" />

                    {/* Localização e Preferências */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={editingUser?.city || ""} onChange={e => setEditingUser({...editingUser, city: e.target.value})} className="rounded-xl h-11" /></div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Estado</Label><Input value={editingUser?.state || ""} onChange={e => setEditingUser({...editingUser, state: e.target.value})} className="rounded-xl h-11 uppercase" maxLength={2} /></div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Moeda</Label>
                             <Select value={editingUser?.preferredCurrency || "BRL"} onValueChange={v => setEditingUser({...editingUser, preferredCurrency: v})}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   <SelectItem value="BRL">BRL (R$)</SelectItem>
                                   <SelectItem value="USD">USD ($)</SelectItem>
                                   <SelectItem value="EUR">EUR (€)</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Idioma</Label>
                             <Select value={editingUser?.language || "pt-BR"} onValueChange={v => setEditingUser({...editingUser, language: v})}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   <SelectItem value="pt-BR">Português</SelectItem>
                                   <SelectItem value="en-US">Inglês</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                       </div>
                    </div>

                    {/* Segurança e Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                       <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                          <div className="space-y-0.5">
                             <p className="font-bold text-sm flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-blue-500" /> Selo Verificado
                             </p>
                             <p className="text-[10px] text-muted-foreground uppercase font-black">Identidade confirmada</p>
                          </div>
                          <Switch 
                            checked={editingUser?.isVerified || false} 
                            onCheckedChange={v => setEditingUser({...editingUser, isVerified: v})} 
                          />
                       </div>
                       <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                          <div className="space-y-0.5">
                             <p className="font-bold text-sm flex items-center gap-2 text-primary">
                                <Mail className="w-4 h-4" /> E-mail Público
                             </p>
                             <p className="text-[10px] text-muted-foreground uppercase font-black">Exibir no perfil</p>
                          </div>
                          <Switch 
                            checked={editingUser?.showEmail ?? true} 
                            onCheckedChange={v => setEditingUser({...editingUser, showEmail: v})} 
                          />
                       </div>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-4">
                       <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                       <div className="space-y-1">
                          <h4 className="font-black uppercase text-xs italic text-orange-800">Privacidade dos Dados</h4>
                          <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                            Alterações em campos críticos como @username ou selos de verificação impactam a indexação global. O CPF e dados bancários não são editáveis por este formulário por questões de compliance.
                          </p>
                       </div>
                    </div>
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
