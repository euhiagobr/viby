'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useAuth, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Search, CheckCircle2, XCircle, Clock3, ShieldAlert, Ticket, User, CalendarRange, DollarSign, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { approveOrganizerRefundRequest, getOrganizerRefundRequests, rejectOrganizerRefundRequest } from '@/app/actions/refund-requests';

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'processing', label: 'Em processamento' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
  { value: 'refunded', label: 'Reembolsado' },
  { value: 'failed', label: 'Falhou' }
];

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-amber-700 border-amber-200">Pendente</Badge>;
    case 'processing':
      return <Badge variant="outline" className="text-blue-700 border-blue-200">Em processamento</Badge>;
    case 'approved':
      return <Badge variant="outline" className="text-emerald-700 border-emerald-200">Aprovado</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="text-rose-700 border-rose-200">Rejeitado</Badge>;
    case 'refunded':
      return <Badge variant="outline" className="text-emerald-700 border-emerald-200">Reembolsado</Badge>;
    case 'failed':
      return <Badge variant="outline" className="text-red-700 border-red-200">Falhou</Badge>;
    default:
      return <Badge variant="outline">Desconhecido</Badge>;
  }
}

export default function OrganizerRefundRequestsPage() {
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const [requests, setRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(null);
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const refreshRequests = React.useCallback(async () => {
    if (!currentOrg?.id || !user?.uid) return;
    setLoading(true);
    try {
      const result = await getOrganizerRefundRequests({ organizationId: currentOrg.id, actorId: user.uid, statusFilter, search });
      setRequests(result as any[]);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, user?.uid, statusFilter, search]);

  React.useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  const handleDecision = async () => {
    if (!selectedRequest || !currentOrg?.id || !user?.uid) return;
    setSubmitting(true);
    try {
      if (decision === 'reject') {
        const result = await rejectOrganizerRefundRequest({ requestId: selectedRequest.id, actorId: user.uid, organizationId: currentOrg.id, reason });
        if (!result.success) throw new Error(result.message);
        toast({ title: 'Solicitação rejeitada', description: result.message });
      } else {
        const result = await approveOrganizerRefundRequest({ requestId: selectedRequest.id, actorId: user.uid, organizationId: currentOrg.id, reason });
        if (!result.success) throw new Error(result.message);
        toast({ title: 'Solicitação aprovada', description: result.message });
      }
      setSelectedRequest(null);
      setDecision(null);
      setReason('');
      await refreshRequests();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const canManage = ['owner', 'admin'].includes(userRole || '');

  if (orgLoading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de reembolso</CardTitle>
          <CardDescription>Gerencie solicitações recebidas pelos seus eventos e tome decisão sobre cada reembolso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por evento, comprador, código ou motivo" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refreshRequests()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 pr-3">Solicitação</th>
                  <th className="py-3 pr-3">Evento</th>
                  <th className="py-3 pr-3">Comprador</th>
                  <th className="py-3 pr-3">Valor</th>
                  <th className="py-3 pr-3">Solicitação</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma solicitação encontrada.</td></tr>
                ) : requests.map((request) => (
                  <tr key={request.id} className="border-b">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{request.code}</div>
                      <div className="text-xs text-muted-foreground">{request.ticketCode || request.registrationId}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{request.eventTitle || 'Evento'}</div>
                      <div className="text-xs text-muted-foreground">{request.eventId}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{request.buyerName || 'Comprador'}</div>
                      <div className="text-xs text-muted-foreground">{request.buyerEmail}</div>
                    </td>
                    <td className="py-3 pr-3">{formatCurrency((request.paidAmount || 0) / 100)}</td>
                    <td className="py-3 pr-3">
                      <div className="text-xs text-muted-foreground">{request.requestedAt?.toDate ? new Date(request.requestedAt.toDate()).toLocaleString('pt-BR') : '—'}</div>
                    </td>
                    <td className="py-3 pr-3">{statusBadge(request.status)}</td>
                    <td className="py-3 pr-3">
                      {canManage && ['pending', 'processing'].includes(request.status) ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(request); setDecision('approve'); setReason(''); }}>Aprovar</Button>
                          <Button size="sm" variant="destructive" onClick={() => { setSelectedRequest(request); setDecision('reject'); setReason(''); }}>Rejeitar</Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem ações</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => { if (!open) { setSelectedRequest(null); setDecision(null); setReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === 'approve' ? 'Aprovar reembolso' : 'Rejeitar reembolso'}</DialogTitle>
            <DialogDescription>{selectedRequest?.code} — {selectedRequest?.eventTitle || 'Evento'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={decision === 'approve' ? 'Descreva o motivo da aprovação' : 'Descreva o motivo da rejeição'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setDecision(null); setReason(''); }}>Cancelar</Button>
            <Button disabled={submitting || !reason.trim()} onClick={handleDecision}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{decision === 'approve' ? 'Confirmar aprovação' : 'Confirmar rejeição'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
