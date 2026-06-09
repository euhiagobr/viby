'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  getDocs, 
  getDoc,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Loader2, 
  Trash2, 
  UserPlus,
  Clock,
  Check,
  AtSign,
  ShieldCheck,
  AlertTriangle,
  UserX
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from "@/lib/utils";
import { sendTeamInvitationEmail, sendTeamInvitationStatusEmail } from '@/app/actions/email';

const ROLES = [
  { value: 'owner', label: 'Proprietário', desc: 'Acesso total e gestão financeira.' },
  { value: 'admin', label: 'Administrador', desc: 'Gere eventos e membros.' },
  { value: 'editor', label: 'Editor', desc: 'Pode criar e editar eventos.' },
  { value: 'finance', label: 'Financeiro', desc: 'Acesso a relatórios de vendas.' },
  { value: 'checkin', label: 'Check-in', desc: 'Apenas validação de ingressos.' },
];

export default function OrganizationMembersPage() {
  const { currentOrg, userRole } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user: currentUser } = useUser(auth);

  const membersQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return collection(db, 'organizations', currentOrg.id, 'members');
  }, [db, currentOrg?.id]);

  const { data: rawMembers, loading } = useCollection<any>(membersQuery);
  const [membersWithProfiles, setMembersWithProfiles] = React.useState<any[]>([]);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteLoading, setInviteLoading] = React.useState(false);
  
  const [pendingRoleChange, setPendingRoleChange] = React.useState<{ userId: string, userName: string, newRole: string } | null>(null);
  const [memberToDelete, setMemberToDelete] = React.useState<{ userId: string, userName: string, isInvite: boolean } | null>(null);
  const [roleActionLoading, setRoleActionLoading] = React.useState(false);
  const [deleteActionLoading, setDeleteActionLoading] = React.useState(false);

  React.useEffect(() => {
    if (!rawMembers || !db) return;

    const fetchProfiles = async () => {
      const promises = rawMembers.map(async (m) => {
        const userSnap = await getDoc(doc(db, 'users', m.userId));
        return {
          ...m,
          profile: userSnap.exists() ? userSnap.data() : null
        };
      });
      const results = await Promise.all(promises);
      setMembersWithProfiles(results);
    };

    fetchProfiles();
  }, [rawMembers, db]);

  const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !currentOrg || !currentUser) return;

    setInviteLoading(true);
    const formData = new FormData(e.currentTarget);
    const inputRaw = (formData.get('username') as string).toLowerCase().trim();
    const role = formData.get('role') as string;

    try {
      if (!inputRaw) throw new Error("Informe o @username ou e-mail.");

      let targetUid = null;
      const cleanUsername = inputRaw.replace('@', '');

      // 1. Tentar localizar via índice de usernames (Busca por ID de documento)
      const usernameRef = doc(db, "usernames", cleanUsername);
      const usernameSnap = await getDoc(usernameRef);

      if (usernameSnap.exists()) {
        const uData = usernameSnap.data();
        if (uData.type === 'user') {
          targetUid = uData.uid;
        }
      }

      // 2. Fallback: Tentar localizar via e-mail se não achou por username
      if (!targetUid) {
        const emailQ = query(collection(db, "users"), where("email", "==", inputRaw), limit(1));
        const emailSnap = await getDocs(emailQ);
        if (!emailSnap.empty) {
          targetUid = emailSnap.docs[0].id;
        }
      }

      if (!targetUid) {
        throw new Error("Usuário não encontrado na plataforma Viby.");
      }

      const memberRef = doc(db, 'organizations', currentOrg.id, 'members', targetUid);
      const existingSnap = await getDoc(memberRef);
      if (existingSnap.exists() && existingSnap.data().status === 'accepted') {
        throw new Error("Este usuário já faz parte da equipe.");
      }

      const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
      if (!targetUserSnap.exists()) throw new Error("Dados do perfil não localizados.");
      const targetUser = targetUserSnap.data();

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const inviteData = {
        userId: targetUid,
        role,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString(),
        inviterUid: currentUser.uid,
        inviterName: currentUser.displayName || "Administrador",
        inviterEmail: currentUser.email || "",
        inviteeName: targetUser.name || targetUser.displayName || "Colaborador",
        inviteeEmail: targetUser.email || "",
        orgName: currentOrg.name
      };

      await setDoc(memberRef, inviteData);

      if (inviteData.inviteeEmail) {
        await sendTeamInvitationEmail({
          to: inviteData.inviteeEmail,
          orgName: currentOrg.name,
          role: ROLES.find(r => r.value === role)?.label || role,
          inviterName: inviteData.inviterName
        });
      }

      toast({ title: "Convite enviado!", description: "O colaborador recebeu um e-mail com as instruções." });
      setIsInviteOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao convidar", description: error.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!db || !currentOrg || !pendingRoleChange) return;

    setRoleActionLoading(true);
    try {
      const memberRef = doc(db, 'organizations', currentOrg.id, 'members', pendingRoleChange.userId);
      await updateDoc(memberRef, {
        role: pendingRoleChange.newRole,
        updatedAt: serverTimestamp()
      });

      toast({ 
        title: "Cargo atualizado!", 
        description: `${pendingRoleChange.userName} agora é ${ROLES.find(r => r.value === pendingRoleChange.newRole)?.label}.` 
      });
      setPendingRoleChange(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao alterar cargo" });
    } finally {
      setRoleActionLoading(false);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!db || !currentOrg || !memberToDelete) return;

    setDeleteActionLoading(true);
    try {
      await deleteDoc(doc(db, 'organizations', currentOrg.id, 'members', memberToDelete.userId));
      toast({ 
        title: memberToDelete.isInvite ? "Convite removido" : "Membro removido", 
        description: `${memberToDelete.userName} não faz mais parte da equipe.` 
      });
      setMemberToDelete(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    } finally {
      setDeleteActionLoading(false);
    }
  };

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Users className="w-8 h-8 text-secondary" />
            Equipe da Marca
          </h1>
          <p className="text-muted-foreground font-medium">Gerencie quem pode administrar esta organização.</p>
        </div>
        
        {isOwnerOrAdmin && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2">
                <Plus className="w-5 h-5" />
                Novo Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[2rem]">
              <form onSubmit={handleInviteMember} className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Adicionar Colaborador</DialogTitle>
                  <DialogDescription>Digite o @username ou e-mail de quem deseja convidar.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                      <AtSign className="w-3.5 h-3.5 text-secondary" />
                      Identificador
                    </Label>
                    <Input 
                      name="username" 
                      placeholder="username ou e-mail" 
                      required 
                      className="rounded-xl h-11" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Papel / Função</Label>
                    <Select name="role" defaultValue="editor">
                       <SelectTrigger className="rounded-xl h-11">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {ROLES.filter(r => r.value !== 'owner').map(role => (
                            <SelectItem key={role.value} value={role.value}>
                               <div className="flex flex-col text-left">
                                  <span className="font-bold">{role.label}</span>
                                  <span className="text-[9px] text-muted-foreground">{role.desc}</span>
                               </div>
                            </SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                   <Button type="submit" disabled={inviteLoading} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                      {inviteLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
                      Enviar Convite
                   </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
           <TableHeader className="bg-muted/30">
              <TableRow>
                 <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Colaborador</TableHead>
                 <TableHead className="font-black uppercase text-[10px] tracking-widest">Cargo</TableHead>
                 <TableHead className="font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                 <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
              </TableRow>
           </TableHeader>
           <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" /></TableCell></TableRow>
              ) : membersWithProfiles.map((member) => (
                <TableRow key={member.userId} className={cn("hover:bg-muted/10 transition-colors", member.status === 'pending' && "bg-orange-50/10")}>
                   <TableCell className="p-6">
                      <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10 border border-muted">
                            <AvatarImage src={member.profile?.avatar} className="object-cover" />
                            <AvatarFallback className="font-bold bg-secondary text-white">{member.profile?.name?.charAt(0) || member.profile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                         </Avatar>
                         <div className="flex flex-col">
                            <span className="font-bold text-sm">{member.profile?.name || member.profile?.displayName || member.inviteeName || 'Usuário'}</span>
                            <span className="text-[10px] text-muted-foreground">@{member.profile?.username || "convidado"}</span>
                         </div>
                      </div>
                   </TableCell>
                   <TableCell>
                      {isOwnerOrAdmin && member.role !== 'owner' && member.userId !== currentUser?.uid && member.status !== 'pending' ? (
                        <Select 
                          value={member.role} 
                          onValueChange={(val) => setPendingRoleChange({ 
                            userId: member.userId, 
                            userName: member.profile?.name || member.profile?.displayName || "Colaborador", 
                            newRole: val 
                          })}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-[9px] font-black uppercase w-[150px] border-secondary/20 text-secondary bg-secondary/5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {ROLES.filter(r => r.value !== 'owner').map(role => (
                              <SelectItem key={role.value} value={role.value} className="text-[10px] font-bold uppercase">
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={cn(
                          "uppercase text-[9px] font-black px-2 h-6",
                          member.role === 'owner' ? 'bg-primary text-white border-none' : 'border-secondary text-secondary'
                        )}>
                          {ROLES.find(r => r.value === member.role)?.label || member.role}
                        </Badge>
                      )}
                   </TableCell>
                   <TableCell>
                      {member.status === 'pending' ? (
                        <div className="flex flex-col">
                           <div className="flex items-center gap-1.5 text-orange-500 font-black text-[10px] uppercase">
                             <Clock className="w-3 h-3" /> Pendente
                           </div>
                        </div>
                      ) : (member.status === 'accepted' || !member.status) ? (
                        <div className="flex items-center gap-1.5 text-green-600 font-black text-[10px] uppercase">
                          <Check className="w-3 h-3" /> Ativo
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground opacity-30 uppercase italic">Verificando...</span>
                      )}
                   </TableCell>
                   <TableCell className="p-6 text-right">
                      {isOwnerOrAdmin && member.role !== 'owner' && member.userId !== currentUser?.uid && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => setMemberToDelete({ 
                            userId: member.userId, 
                            userName: member.profile?.name || member.profile?.displayName || member.inviteeName || "Colaborador",
                            isInvite: member.status === 'pending'
                          })}
                        >
                           <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                   </TableCell>
                </TableRow>
              ))}
           </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!pendingRoleChange} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <ShieldCheck className="w-6 h-6" />
               </div>
               <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Alterar Cargo?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium text-foreground/80 leading-relaxed">
              Você está alterando o cargo de <strong>{pendingRoleChange?.userName}</strong> para <strong>{ROLES.find(r => r.value === pendingRoleChange?.newRole)?.label}</strong>. 
              Isso mudará as permissões de acesso deste colaborador imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-none bg-muted hover:bg-muted/80">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRoleChange}
              disabled={roleActionLoading}
              className="bg-secondary text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-secondary/20 h-11 px-8"
            >
              {roleActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar Alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
                  <UserX className="w-6 h-6" />
               </div>
               <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">
                 {memberToDelete?.isInvite ? "Cancelar Convite?" : "Remover Membro?"}
               </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium text-foreground/80 leading-relaxed">
              {memberToDelete?.isInvite ? (
                <>Você está removendo o convite pendente para <strong>{memberToDelete?.userName}</strong>. Ele não poderá mais aceitar o acesso.</>
              ) : (
                <>Tem certeza que deseja remover <strong>{memberToDelete?.userName}</strong> da equipe? O acesso dele às ferramentas de gestão será revogado instantaneamente.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-none bg-muted hover:bg-muted/80">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRemoveMember}
              disabled={deleteActionLoading}
              className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-secondary/20 h-11 px-8"
            >
              {deleteActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
