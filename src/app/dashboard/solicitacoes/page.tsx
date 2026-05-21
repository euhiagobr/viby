
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
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { sendTeamInvitationStatusEmail } from '@/app/actions/email';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  finance: 'Financeiro',
  checkin: 'Check-in'
};

export default function SolicitacoesPage() {
  const { pendingInvitations, loading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const handleAccept = async (invite: any) => {
    if (!db || !user) return;

    // Verificar expiração
    if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
      toast({ variant: "destructive", title: "Convite expirado", description: "O prazo de 24h para aceitar este convite terminou." });
      return;
    }

    setActionLoadingId(invite.id);
    try {
      const memberRef = doc(db, 'organizations', invite.id, 'members', user.uid);
      await updateDoc(memberRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });

      // Envia e-mail de confirmação para o inviter
      if (invite.inviterEmail) {
        await sendTeamInvitationStatusEmail({
          to: invite.inviterEmail,
          userName: invite.inviteeName || "O colaborador",
          orgName: invite.orgName,
          status: 'accepted'
        });
      }

      toast({ title: "Convite aceito!", description: `Agora você faz parte da equipe de ${invite.orgName}.` });
    } catch (e: any) {
      console.error("Erro ao aceitar convite:", e);
      toast({ variant: "destructive", title: "Erro ao aceitar", description: "Verifique suas permissões ou tente novamente." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (invite: any) => {
    if (!db || !user) return;
    setActionLoadingId(invite.id);
    try {
      const memberRef = doc(db, 'organizations', invite.id, 'members', user.uid);
      await deleteDoc(memberRef);

      // Envia e-mail de recusa para o inviter
      if (invite.inviterEmail) {
        await sendTeamInvitationStatusEmail({
          to: invite.inviterEmail,
          userName: invite.inviteeName || "O colaborador",
          orgName: invite.orgName,
          status: 'declined'
        });
      }

      toast({ title: "Convite recusado" });
    } catch (e: any) {
      console.error("Erro ao recusar convite:", e);
      toast({ variant: "destructive", title: "Erro ao recusar" });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-secondary" />
          Solicitações
        </h1>
        <p className="text-muted-foreground font-medium">Convites para participar da equipe de marcas e produtoras.</p>
      </div>

      {pendingInvitations.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 shadow-inner">
           <UserCheck className="w-12 h-12 text-muted-foreground opacity-10" />
           <p className="text-muted-foreground font-bold italic">Nenhuma solicitação pendente no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {pendingInvitations.map((invite) => {
             const isExpired = invite.expiresAt && new Date() > new Date(invite.expiresAt);
             
             return (
               <Card key={invite.id} className={cn(
                 "border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group",
                 isExpired && "opacity-50 grayscale"
               )}>
                  <CardHeader className="bg-muted/30 pb-6">
                     <div className="flex justify-between items-start">
                        <div className="p-3 bg-secondary/10 rounded-2xl group-hover:bg-secondary group-hover:text-white transition-colors">
                           <Building2 className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className="bg-secondary text-white font-black uppercase text-[9px] px-3">Novo Convite</Badge>
                          {isExpired && <Badge variant="destructive" className="uppercase text-[8px] font-black h-4 px-2">Expirado</Badge>}
                        </div>
                     </div>
                     <div className="mt-4">
                        <CardTitle className="text-xl font-black italic uppercase tracking-tighter">{invite.orgName}</CardTitle>
                        <CardDescription className="font-bold flex items-center gap-1.5 text-secondary mt-1">
                           <ShieldCheck className="w-4 h-4" />
                           Cargo proposto: {roleLabels[invite.role] || invite.role}
                        </CardDescription>
                     </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                     <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                        <strong>{invite.inviterName}</strong> convidou você para colaborar na gestão de <strong>{invite.orgName}</strong>. 
                        Este convite é nominal e vinculado à sua conta.
                     </p>

                     <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <p className="text-[10px] text-orange-800 font-bold uppercase">
                           Prazo de aceite: 24 horas (Expira em: {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString('pt-BR') : '---'})
                        </p>
                     </div>

                     <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          className="flex-1 rounded-xl font-bold h-12 border-destructive text-destructive hover:bg-destructive/5"
                          onClick={() => handleDecline(invite)}
                          disabled={actionLoadingId === invite.id}
                        >
                           <X className="w-4 h-4 mr-2" /> {isExpired ? 'Remover' : 'Recusar'}
                        </Button>
                        {!isExpired && (
                          <Button 
                            className="flex-1 rounded-xl font-black bg-green-600 text-white h-12 shadow-lg shadow-green-500/20 uppercase italic transition-all hover:scale-[1.02]"
                            onClick={() => handleAccept(invite)}
                            disabled={actionLoadingId === invite.id}
                          >
                             {actionLoadingId === invite.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                             Aceitar
                          </Button>
                        )}
                     </div>
                  </CardContent>
               </Card>
             );
           })}
        </div>
      )}

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <AlertCircle className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Segurança de Dados</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
               A Viby utiliza seu identificador exclusivo para garantir que convites de equipe sejam direcionados à pessoa correta. Convites não aceitos em 24h são automaticamente invalidados.
            </p>
         </div>
      </div>
    </div>
  );
}
