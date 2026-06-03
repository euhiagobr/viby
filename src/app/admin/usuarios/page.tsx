
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
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
  Plus,
  UserPlus
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { sendVerificationStatusEmail } from "@/app/actions/email"

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  
  const [editingUser, setEditingUser] = React.useState<any>(null)
  const [originalUser, setOriginalUser] = React.useState<any>(null)
  const [isEditUserOpen, setIsEditUserOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const usersQuery = useMemoFirebase(() => db ? query(collection(db, "users"), orderBy("createdAt", "desc")) : null, [db])
  const { data: users, loading: loadingUsers } = useCollection<any>(usersQuery)

  const filteredUsers = React.useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      u.name?.toLowerCase().includes(search.toLowerCase()) || 
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    )
  }, [users, search])

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingUser || isSaving) return
    setIsSaving(true)
    try {
      const { id, ...data } = editingUser
      await updateDoc(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() })
      
      // Gatilho de e-mail exclusivo para o usuário se o status de verificação mudou
      if (editingUser.isVerified !== originalUser?.isVerified) {
        sendVerificationStatusEmail({
           to: editingUser.email,
           userName: editingUser.name || editingUser.displayName || "Usuário",
           targetName: `@${editingUser.username}`,
           type: 'user',
           status: editingUser.isVerified ? 'approved' : 'removed'
        }).catch(err => console.warn("Falha ao enviar e-mail de verificação para o usuário", err));
      }

      toast({ title: "Usuário atualizado!" })
      setIsEditUserOpen(false)
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro ao salvar" }) 
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

      const ownedOrgsQ = query(collection(db, "organizations"), where("ownerId", "==", id));
      const ownedOrgsSnap = await getDocs(ownedOrgsQ);
      
      ownedOrgsSnap.forEach(orgDoc => {
        batch.update(orgDoc.ref, {
          status: newStatus,
          updatedAt: serverTimestamp(),
          moderatedAt: serverTimestamp(),
          moderatedBy: "Admin",
          blockReason: newStatus === 'Bloqueado' ? "Titular da conta bloqueado." : deleteField()
        });
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
          <Input 
            placeholder="Buscar por nome, @username ou e-mail..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-11"
          />
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
              <TableHead className="font-black uppercase text-[10px] tracking-widest">E-mail</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Cargo</TableHead>
              <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">Status</TableHead>
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
                         {user.isVerified && <BadgeCheck className="w-3 h-3 fill-blue-500 text-white" />}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">{user.email}</TableCell>
                <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase border-primary/20 text-primary">{user.role || 'user'}</Badge></TableCell>
                <TableCell className="text-center">
                  <Badge variant={user.status === 'Bloqueado' ? 'destructive' : 'outline'} className="text-[8px] font-black uppercase h-5">
                    {user.status || 'Ativo'}
                  </Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-lg" onClick={() => { setEditingUser(user); setOriginalUser(user); setIsEditUserOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-8 w-8 rounded-lg", user.status === 'Bloqueado' ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50")}
                      onClick={() => handleToggleBlock(user.id, user.status)}
                      title={user.status === 'Bloqueado' ? "Desbloquear Usuário" : "Bloquear Usuário"}
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
        <DialogContent className="max-w-xl rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Editar Usuário</DialogTitle>
              <DialogDescription>Ajuste permissões e dados básicos do perfil pessoal.</DialogDescription>
           </DialogHeader>
           <form onSubmit={handleUpdateUser} className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                    <Input value={editingUser?.name || ""} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl h-11" required />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Cargo de Sistema</Label>
                    <Select value={editingUser?.role || "user"} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="user">Usuário Comum</SelectItem>
                          <SelectItem value="admin">Administrador Global</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                 <div className="space-y-0.5">
                    <p className="font-bold text-sm flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-blue-500" /> Selo Verificado
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Identidade confirmada pela Viby</p>
                 </div>
                 <Switch 
                   checked={editingUser?.isVerified || false} 
                   onCheckedChange={v => setEditingUser({...editingUser, isVerified: v})} 
                 />
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSaving} className="w-full bg-primary text-white font-black h-12 rounded-xl shadow-lg uppercase italic">
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
