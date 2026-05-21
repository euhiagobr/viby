'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  ShieldCheck, 
  Loader2, 
  Trash2, 
  Fingerprint,
  UserPlus
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
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from "@/lib/utils";
import { encryptDeterministic } from '@/lib/crypto-utils';

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

  const membersQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return collection(db, 'organizations', currentOrg.id, 'members');
  }, [db, currentOrg?.id]);

  const { data: rawMembers, loading } = useCollection<any>(membersQuery);
  const [membersWithProfiles, setMembersWithProfiles] = React.useState<any[]>([]);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteLoading, setInviteLoading] = React.useState(false);

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

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
  }

  const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !currentOrg) return;

    setInviteLoading(true);
    const formData = new FormData(e.currentTarget);
    const cpfInput = (formData.get('cpf') as string).replace(/\D/g, "");
    const role = formData.get('role') as string;

    try {
      if (cpfInput.length !== 11) {
        throw new Error("CPF inválido.");
      }

      const encryptedCpf = encryptDeterministic(cpfInput);
      const q = query(collection(db, 'users'), where('cpf', '==', encryptedCpf));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("Usuário não encontrado com este CPF.");
      }

      const targetUid = snap.docs[0].id;
      const memberRef = doc(db, 'organizations', currentOrg.id, 'members', targetUid);
      
      await setDoc(memberRef, {
        userId: targetUid,
        role,
        createdAt: serverTimestamp()
      });

      toast({ title: "Membro adicionado!", description: "O colaborador já tem acesso à gestão." });
      setIsInviteOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao convidar", description: error.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!db || !currentOrg) return;
    if (!confirm("Tem certeza que deseja remover este membro?")) return;

    try {
      await deleteDoc(doc(db, 'organizations', currentOrg.id, 'members', userId));
      toast({ title: "Membro removido" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
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
                  <DialogDescription>O usuário deve estar cadastrado na Viby. Buscamos pelo CPF por segurança.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                      <Fingerprint className="w-3.5 h-3.5 text-secondary" />
                      CPF do Usuário
                    </Label>
                    <Input 
                      name="cpf" 
                      placeholder="000.000.000-00" 
                      onChange={(e) => e.target.value = formatCPF(e.target.value)}
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
                      Confirmar Acesso
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
                 <TableHead className="font-black uppercase text-[10px] tracking-widest">Colaborador</TableHead>
                 <TableHead className="font-black uppercase text-[10px] tracking-widest">Cargo</TableHead>
                 <TableHead className="font-black uppercase text-[10px] tracking-widest">Acesso desde</TableHead>
                 <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Ações</TableHead>
              </TableRow>
           </TableHeader>
           <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" /></TableCell></TableRow>
              ) : membersWithProfiles.map((member) => (
                <TableRow key={member.userId} className="hover:bg-muted/10 transition-colors">
                   <TableCell>
                      <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10 border border-muted">
                            <AvatarImage src={member.profile?.avatar} />
                            <AvatarFallback className="font-bold bg-secondary text-white">{member.profile?.name?.charAt(0) || 'U'}</AvatarFallback>
                         </Avatar>
                         <div className="flex flex-col">
                            <span className="font-bold text-sm">{member.profile?.name || 'Usuário'}</span>
                            <span className="text-[10px] text-muted-foreground">@{member.profile?.username}</span>
                         </div>
                      </div>
                   </TableCell>
                   <TableCell>
                      <Badge variant="outline" className={cn(
                        "uppercase text-[9px] font-black px-2",
                        member.role === 'owner' ? 'bg-primary text-white border-none' : 'border-secondary text-secondary'
                      )}>
                        {ROLES.find(r => r.value === member.role)?.label || member.role}
                      </Badge>
                   </TableCell>
                   <TableCell>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{member.createdAt?.seconds ? new Date(member.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : '---'}</span>
                   </TableCell>
                   <TableCell className="text-right">
                      {isOwnerOrAdmin && member.role !== 'owner' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => handleRemoveMember(member.userId)}
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
    </div>
  );
}
