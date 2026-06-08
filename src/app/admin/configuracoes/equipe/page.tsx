'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, where, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Users, 
  Plus, 
  Loader2, 
  Search, 
  ShieldCheck, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  UserPlus,
  Key,
  Smartphone,
  Mail,
  Zap,
  Lock,
  ArrowLeft,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/hooks/use-toast';
import { AdminRole, AdminPermission, SystemAdmin } from '@/types/admin';
import { ALL_PERMISSIONS, getDefaultPermissionsForRole } from '@/lib/admin/permissions';
import { createAdminAction, updateAdminAction, deleteAdminAction } from '@/app/actions/admin-team';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminEquipePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { isSuperAdmin, adminProfile, loading: permsLoading } = useAdminPermissions();

  const [search, setSearch] = React.useState("");
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingAdmin, setEditingAdmin] = React.useState<SystemAdmin | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const teamQuery = useMemoFirebase(() => 
    db ? query(collection(db, "system_admins"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: team, loading } = useCollection<SystemAdmin>(teamQuery);

  const filteredTeam = React.useMemo(() => {
    if (!team) return [];
    return team.filter(a => 
      a.nome.toLowerCase().includes(search.toLowerCase()) || 
      a.sobrenome.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [team, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const emailInput = formData.get('email') as string;

    try {
      const q = query(collection(db!, "users"), where("email", "==", emailInput), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error("Não foi localizado nenhum usuário da plataforma com este e-mail.");
      
      const targetUid = snap.docs[0].id;

      const res = await createAdminAction({
        uid: targetUid,
        nome: formData.get('nome') as string,
        sobrenome: formData.get('sobrenome') as string,
        email: emailInput,
        telefone: formData.get('telefone') as string,
        cargo: formData.get('cargo') as AdminRole,
        executorUid: user.uid
      });

      if (res.success) {
        toast({ title: "Administrador criado!" });
        setIsInviteOpen(false);
      } else throw new Error(res.error);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!user || !editingAdmin || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await updateAdminAction({
        uid: editingAdmin.uid,
        data: editingAdmin,
        executorUid: user.uid
      });
      if (res.success) {
        toast({ title: "Perfil atualizado!" });
        setIsEditOpen(false);
      } else throw new Error(res.error);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!user || !confirm("Remover permanentemente este administrador?")) return;
    try {
      const res = await deleteAdminAction(uid, user.uid);
      if (res.success) toast({ title: "Removido com sucesso." });
      else throw new Error(res.error);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    }
  };

  if (permsLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-secondary" />
          Equipe Administrativa
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de acessos internos, cargos e permissões do console Viby.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
        </div>
        {isSuperAdmin && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic">
                <UserPlus className="w-5 h-5" /> Novo Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[2.5rem]">
              <form onSubmit={handleCreate} className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Conceder Acesso</DialogTitle>
                  <DialogDescription>O usuário deve estar previamente cadastrado na plataforma Viby.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nome</Label><Input name="nome" required className="rounded-xl h-10" /></div>
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Sobrenome</Label><Input name="sobrenome" required className="rounded-xl h-10" /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">E-mail de Cadastro</Label><Input name="email" type="email" required className="rounded-xl h-10" /></div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase">Cargo Inicial</Label>
                   <Select name="cargo" defaultValue="support">
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="admin">Operacional (Admin)</SelectItem>
                        <SelectItem value="support">Suporte</SelectItem>
                        <SelectItem value="financial">Financeiro</SelectItem>
                        <SelectItem value="moderator">Moderador</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic">{isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar Nomeação"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] p-6">Nome / E-mail</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Cargo</TableHead>
              <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeam.map(admin => (
              <TableRow key={admin.uid} className={cn("hover:bg-muted/10", admin.status === 'Desativado' && "opacity-50")}>
                <TableCell className="p-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm uppercase italic text-primary">{admin.nome} {admin.sobrenome}</span>
                    <span className="text-[10px] text-muted-foreground">{admin.email}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase border-secondary/20 text-secondary">{admin.cargo.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-center">
                  <Badge className={cn("text-[8px] font-black uppercase", admin.status === 'Ativo' ? "bg-green-600" : "bg-red-500")}>{admin.status}</Badge>
                </TableCell>
                <TableCell className="p-6 text-right">
                  {isSuperAdmin && admin.uid !== user?.uid && (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingAdmin(admin); setIsEditOpen(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(admin.uid)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* MODAL DE EDIÇÃO DE PERMISSÕES */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
           <DialogHeader className="p-8 border-b bg-muted/30">
              <div className="flex justify-between items-start">
                 <div className="space-y-1">
                   <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Editar Membro: {editingAdmin?.nome}</DialogTitle>
                   <DialogDescription className="font-bold text-secondary uppercase text-[10px]">Ajuste de cargo e permissões granulares.</DialogDescription>
                 </div>
                 <Badge className="bg-primary text-white font-black uppercase text-[10px]">{editingAdmin?.cargo}</Badge>
              </div>
           </DialogHeader>
           
           <ScrollArea className="flex-1 p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                 <div className="md:col-span-4 space-y-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Status</Label>
                       <Select value={editingAdmin?.status} onValueChange={v => setEditingAdmin(prev => prev ? ({...prev, status: v as any}) : null)}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="Ativo">Habilitado</SelectItem>
                             <SelectItem value="Desativado">Suspenso</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Alterar Cargo</Label>
                       <Select value={editingAdmin?.cargo} onValueChange={v => {
                         const role = v as AdminRole;
                         setEditingAdmin(prev => prev ? ({
                           ...prev, 
                           cargo: role,
                           permissions: getDefaultPermissionsForRole(role)
                         }) : null);
                       }}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {['super_admin', 'admin', 'support', 'financial', 'moderator', 'marketing'].map(r => (
                              <SelectItem key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="md:col-span-8 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                       <Lock className="w-4 h-4 text-secondary" />
                       <h3 className="text-xs font-black uppercase tracking-widest text-primary">Acessos Granulares</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {ALL_PERMISSIONS.map(perm => (
                         <div key={perm} className="flex items-center space-x-3 p-3 bg-muted/20 rounded-xl border border-border/50">
                            <Checkbox 
                              id={`perm-${perm}`} 
                              checked={editingAdmin?.permissions?.[perm]} 
                              onCheckedChange={(checked) => {
                                setEditingAdmin(prev => prev ? ({
                                  ...prev,
                                  permissions: { ...prev.permissions, [perm]: !!checked }
                                }) : null);
                              }}
                            />
                            <Label htmlFor={`perm-${perm}`} className="text-[10px] font-bold uppercase cursor-pointer flex-1 leading-none">{perm.replace('.', ': ')}</Label>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </ScrollArea>

           <DialogFooter className="p-8 border-t bg-muted/10">
              <Button onClick={handleUpdate} disabled={isSubmitting} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg">
                 {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Alterações
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
