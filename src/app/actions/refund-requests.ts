'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import { approveRefundRequest, rejectRefundRequest } from '@/services/refunds/refund-request-service';

export async function getOrganizerRefundRequests(params: {
  organizationId: string;
  actorId: string;
  statusFilter?: string;
  search?: string;
}) {
  const db = getAdminDb();
  const { organizationId, actorId, statusFilter, search } = params;

  const userSnap = await db.collection('users').doc(actorId).get();
  const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
  const memberSnap = await db.collection('organizations').doc(organizationId).collection('members').doc(actorId).get();
  const memberRole = memberSnap.data()?.role;

  if (!isAdmin && !['owner', 'admin'].includes(memberRole)) {
    throw new Error('Acesso negado.');
  }

  let query: any = db.collection('refund_requests').where('organizerId', '==', organizationId);

  if (statusFilter && statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }

  const snapshot = await query.orderBy('requestedAt', 'desc').get();
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const filtered = items.filter((item: any) => {
    if (!search?.trim()) return true;
    const term = search.toLowerCase();
    return [item.code, item.eventTitle, item.buyerName, item.ticketCode, item.reason].filter(Boolean).join(' ').toLowerCase().includes(term);
  });

  return filtered;
}

export async function approveOrganizerRefundRequest(params: {
  requestId: string;
  actorId: string;
  organizationId: string;
  reason?: string;
}) {
  return approveRefundRequest({
    requestId,
    actorId,
    organizationId,
    reason: params.reason
  });
}

export async function rejectOrganizerRefundRequest(params: {
  requestId: string;
  actorId: string;
  organizationId: string;
  reason: string;
}) {
  return rejectRefundRequest({
    requestId,
    actorId,
    organizationId,
    reason: params.reason
  });
}
