'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useAuth, useUser } from '@/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  UserCheck, 
  Check, 
  X, 
  Loader2, 
  Building2, 
  ShieldCheck,
  AlertCircle,
  Clock,
  Megaphone,
  Handshake
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { sendTeamInvitationStatusEmail } from '@/app/actions/email';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  finance: 'Financeiro',
  checkin: 'Check-in'
};

export default function SolicitacoesPage() {
  const { pendingInvitations, pendingPartnerships, loading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const handleAcceptMember = async (invite: any) => {
    if (!db || !user || !invite.id) return;
    
    if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
      toast({ variant: "destructive", title: "Convite expirado" });
      return;
    }

    setActionLoadingId(invite.id);
    const memberRef = doc(db, 'organizations', invite.id, 'members', user.uid);
    const updateData = { status: 'accepted', acceptedAt: serverTimestamp() };

    updateDoc(memberRef, updateData)
      .then(async () => {
        if (invite.inviterEmail) {
          await sendTeamInvitationStatusEmail({ 
            to: invite.inviterEmail, 
            userName: invite.inviteeName || "O colaborador", 
            orgName: invite.orgName, 
            status: 'accepted' 
          });
        }
        toast({ title: "Convite aceito!", description: `Agora você faz parte da equipe de ${invite.orgName}.` });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: memberRef.path,
          operation: 'update',
          requestResourceData: updateData
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setActionLoadingId(null));
  };

  const handleDeclineMember = async (invite: any) => {
    if (!db || !user || !invite.id) return;
    
    setActionLoadingId(invite.id);
    const memberRef = doc(db, 'organizations', invite.id, 'members', user.uid);

    deleteDoc(memberRef)
      .then(async () => {
        if (invite.inviterEmail) {
          await sendTeamInvitationStatusEmail({ 
            to: invite.inviterEmail, 
            userName: invite.inviteeName || "O colaborador", 
            orgName: invite.orgName, 
            status: 'declined' 
          });
        }
        toast({ title: "Convite recusado" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: memberRef.path,
          operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setActionLoadingId(null));
  };

  const handleAcceptPartner = async (partnerInvite: any) => {
    if (!db || !partnerInvite.eventId || !partnerInvite.orgId) return;
    
    if (partnerInvite.expiresAt && new Date() > new Date(partnerInvite.expiresAt)) {
      toast({ variant: "destructive", title: "Convite expirado" });
      return;
    }

    setActionLoadingId(partnerInvite.id);
    const partnerRef = doc(db, 'events', partnerInvite.eventId, 'partners', partnerInvite.orgId);
    const updateData = { status: 'accepted', acceptedAt: serverTimestamp() };

    updateDoc(partnerRef, updateData)
      .then(() => {
        toast({ title: "Parceria confirmada!", description: "O evento agora será exibido no seu perfil." });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: partnerRef.path,
          operation: 'update',
          requestResourceData: updateData
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setActionLoadingId(null));
  };

  const handleDeclinePartner = async (partnerInvite: any) => {
    if (!db || !partnerInvite.eventId || !partnerInvite.orgId) return;
    
    setActionLoadingId(partnerInvite.id);
    const partnerRef = doc(db, 'events', partnerInvite.eventId, 'partners', partnerInvite.orgId);

    deleteDoc(partnerRef)
      .then(() => {
        toast({ title: "Convite removido" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: partnerRef.path,
          operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setActionLoadingId(null));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  const hasRequests = pendingInvitations.length > 0 || pendingPartnerships.length > 0;

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-secondary" />
          Solicitações
        </h1>
        <p className="text-muted-foreground font-medium">Convites para equipes e parcerias em eventos.</p>
      </div>

      {/* SEÇÃO DE CONVITES DE EQUIPE */}
      {pendingInvitations.length > 0 && (
        <div className="space-y-6">
           <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
             <Building2 className="w-4 h-4" /> Convites de Equipe ({pendingInvitations.length})
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingInvitations.map((invite) => {
                const isExpired = invite.expiresAt && new Date() > new Date(invite.expiresAt);
                return (
                  <Card key={invite.id} className={cn("border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group", isExpired && "opacity-50 grayscale")}>
                    <CardHeader className="bg-muted/30 pb-6">
                      <div className="flex justify-between items-start">
                         <div className="p-3 bg-secondary/10 rounded-2xl group-hover:bg-secondary group-hover:text-white transition-colors"><Building2 className="w-6 h-6" /></div>
                         <Badge className="bg-secondary text-white font-black uppercase text-[9px] px-3">Equipe</Badge>
                      </div>
                      <div className="mt-4">
                        <CardTitle className="text-xl font-black italic uppercase tracking-tighter">{invite.orgName}</CardTitle>
                        <CardDescription className="font-bold flex items-center gap-1.5 text-secondary mt-1"><ShieldCheck className="w-4 h-4" /> Cargo: {roleLabels[invite.role] || invite.role}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed"><strong>{invite.inviterName}</strong> convidou você para colaborar na gestão de <strong>{invite.orgName}</strong>.</p>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 rounded-xl h-11 text-destructive border-destructive" onClick={() => handleDeclineMember(invite)} disabled={actionLoadingId === invite.id}><X className="w-4 h-4 mr-2" /> {isExpired ? 'Remover' : 'Recusar'}</Button>
                        {!isExpired && <Button className="flex-1 rounded-xl font-black bg-green-600 text-white h-11" onClick={() => handleAcceptMember(invite)} disabled={actionLoadingId === invite.id}>{actionLoadingId === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Aceitar</Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
           </div>
        </div>
      )}

      {/* SEÇÃO DE CONVITES DE PARCERIA EM EVENTOS */}
      {pendingPartnerships.length > 0 && (
        <div className="space-y-6">
           <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
             <Handshake className="w-4 h-4" /> Convites de Parceria ({pendingPartnerships.length})
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingPartnerships.map((partner) => {
                const isExpired = partner.expiresAt && new Date() > new Date(partner.expiresAt);
                return (
                  <Card key={partner.id} className={cn("border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group", isExpired && "opacity-50 grayscale")}>
                    <CardHeader className="bg-muted/30 pb-6">
                      <div className="flex justify-between items-start">
                         <div className="p-3 bg-primary/10 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors"><Megaphone className="w-6 h-6" /></div>
                         <Badge className="bg-primary text-white font-black uppercase text-[9px] px-3">Parceria</Badge>
                      </div>
                      <div className="mt-4">
                        <CardTitle className="text-xl font-black italic uppercase tracking-tighter line-clamp-1">{partner.eventTitle}</CardTitle>
                        <CardDescription className="font-bold text-secondary mt-1">Convidado por: {partner.inviterOrgName}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">A marca <strong>{partner.inviterOrgName}</strong> deseja que sua organização <strong>{partner.orgName}</strong> figure como co-realizadora do evento acima.</p>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 rounded-xl h-11 text-destructive border-destructive" onClick={() => handleDeclinePartner(partner)} disabled={actionLoadingId === partner.id}><X className="w-4 h-4 mr-2" /> Recusar</Button>
                        {!isExpired && <Button className="flex-1 rounded-xl font-black bg-secondary text-white h-11" onClick={() => handleAcceptPartner(partner)} disabled={actionLoadingId === partner.id}>{actionLoadingId === partner.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Aceitar</Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
           </div>
        </div>
      )}

      {!hasRequests && (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 shadow-inner">
           <UserCheck className="w-12 h-12 text-muted-foreground opacity-10" />
           <p className="text-muted-foreground font-bold italic">Nenhuma solicitação pendente no momento.</p>
        </div>
      )}

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <AlertCircle className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Nota de Segurança</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">Convites de equipe dão acesso a ferramentas de gestão. Convites de parceria apenas exibem sua marca no evento. Ambas expiram em 24h caso não aceitas.</p>
         </div>
      </div>
    </div>
  );
}