
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  Handshake,
  SendHorizontal,
  FileText,
  CheckCircle2,
  Inbox
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { sendTeamInvitationStatusEmail } from '@/app/actions/email';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { formatCurrency } from '@/lib/financial-utils';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  finance: 'Financeiro',
  checkin: 'Check-in'
};

export default function SolicitacoesPage() {
  const { pendingInvitations, pendingPartnerships, loading: contextLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const payoutRequestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "payout_requests"), where("userId", "==", user.uid));
  }, [db, user]);
  
  const { data: saques, loading: saquesLoading } = useCollection<any>(payoutRequestsQuery);

  const handleAcceptMember = async (invite: any) => {
    if (!db || !user || !invite.id) return;
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
        toast({ title: "Convite aceito!" });
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: memberRef.path, operation: 'update', requestResourceData: updateData
        }));
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
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: memberRef.path, operation: 'delete' }));
      })
      .finally(() => setActionLoadingId(null));
  };

  const handleAcceptPartner = async (partnerInvite: any) => {
    if (!db || !partnerInvite.eventId || !partnerInvite.orgId) return;
    setActionLoadingId(partnerInvite.id);
    const partnerRef = doc(db, 'events', partnerInvite.eventId, 'partners', partnerInvite.orgId);
    const updateData = { status: 'accepted', acceptedAt: serverTimestamp() };

    updateDoc(partnerRef, updateData)
      .then(() => toast({ title: "Parceria confirmada!" }))
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: partnerRef.path, operation: 'update', requestResourceData: updateData }));
      })
      .finally(() => setActionLoadingId(null));
  };

  const handleDeclinePartner = async (partnerInvite: any) => {
    if (!db || !partnerInvite.eventId || !partnerInvite.orgId) return;
    setActionLoadingId(partnerInvite.id);
    const partnerRef = doc(db, 'events', partnerInvite.eventId, 'partners', partnerInvite.orgId);
    deleteDoc(partnerRef)
      .then(() => toast({ title: "Convite recusado" }))
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: partnerRef.path, operation: 'delete' }));
      })
      .finally(() => setActionLoadingId(null));
  };

  if (contextLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  const hasInvites = pendingInvitations.length > 0 || pendingPartnerships.length > 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-secondary" /> Solicitações
        </h1>
        <p className="text-muted-foreground font-medium">Acompanhe convites de equipe e seus pedidos de saque.</p>
      </div>

      <Tabs defaultValue="invites" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="invites" className="rounded-lg px-8 font-bold gap-2">
             <Building2 className="w-4 h-4" /> Convites ({pendingInvitations.length + pendingPartnerships.length})
          </TabsTrigger>
          <TabsTrigger value="payouts" className="rounded-lg px-8 font-bold gap-2">
             <SendHorizontal className="w-4 h-4" /> Meus Saques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invites" className="space-y-12">
          {!hasInvites ? (
            <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-4">
               <Inbox className="w-12 h-12 text-muted-foreground opacity-10" />
               <p className="text-muted-foreground font-bold italic">Nenhum convite pendente por aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {pendingInvitations.map((invite) => (
                 <Card key={invite.id} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group">
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
                   <CardContent className="p-6 flex gap-3">
                      <Button variant="outline" className="flex-1 rounded-xl h-11 text-destructive border-destructive font-bold text-[10px] uppercase" onClick={() => handleDeclineMember(invite)} disabled={actionLoadingId === invite.id}><X className="w-4 h-4 mr-2" /> Recusar</Button>
                      <Button className="flex-1 rounded-xl font-black bg-green-600 text-white h-11 uppercase text-[10px] italic shadow-lg" onClick={() => handleAcceptMember(invite)} disabled={actionLoadingId === invite.id}>{actionLoadingId === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Aceitar</Button>
                   </CardContent>
                 </Card>
               ))}
               {pendingPartnerships.map((partner) => (
                 <Card key={partner.id} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group">
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
                    <CardContent className="p-6 flex gap-3">
                       <Button variant="outline" className="flex-1 rounded-xl h-11 text-destructive border-destructive font-bold text-[10px] uppercase" onClick={() => handleDeclinePartner(partner)} disabled={actionLoadingId === partner.id}><X className="w-4 h-4 mr-2" /> Recusar</Button>
                       <Button className="flex-1 rounded-xl font-black bg-secondary text-white h-11 uppercase text-[10px] italic shadow-lg" onClick={() => handleAcceptPartner(partner)} disabled={actionLoadingId === partner.id}>{actionLoadingId === partner.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Aceitar</Button>
                    </CardContent>
                 </Card>
               ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payouts">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {saquesLoading ? (
                 <div className="col-span-full py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
              ) : saques && saques.length > 0 ? (
                 saques.map((saque: any) => (
                    <Card key={saque.id} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                       <CardHeader className="bg-muted/30 pb-4">
                          <div className="flex justify-between items-start">
                             <div className={cn("p-2.5 rounded-xl text-white", saque.status === 'Concluído' ? "bg-green-500" : "bg-orange-500")}>
                                {saque.status === 'Concluído' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                             </div>
                             <Badge variant="outline" className="uppercase text-[9px] font-black h-5 px-2">{saque.status}</Badge>
                          </div>
                       </CardHeader>
                       <CardContent className="p-6 space-y-4">
                          <div className="space-y-1">
                             <p className="text-[9px] font-black uppercase text-muted-foreground">Protocolo #{saque.id.slice(-8)}</p>
                             <h3 className="text-lg font-black text-primary">{formatCurrency(saque.amount)}</h3>
                             <p className="text-[10px] font-bold text-secondary uppercase">{saque.organizationName}</p>
                          </div>
                          {saque.status === 'Concluído' && saque.proofUrl && (
                             <Button variant="outline" size="sm" asChild className="w-full h-10 rounded-xl bg-green-50 border-green-200 text-green-600 font-bold uppercase text-[9px] gap-2">
                                <a href={saque.proofUrl} target="_blank" rel="noopener noreferrer"><FileText className="w-3.5 h-3.5" /> Ver Comprovante</a>
                             </Button>
                          )}
                       </CardContent>
                    </Card>
                 ))
              ) : (
                <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-4">
                   <SendHorizontal className="w-12 h-12 text-muted-foreground opacity-10" />
                   <p className="text-muted-foreground font-bold italic">Nenhum saque solicitado.</p>
                </div>
              )}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
