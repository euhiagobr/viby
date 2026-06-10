
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { headers } from 'next/headers';
import { recordAuditLog } from './audit';

async function getClientIp() {
  const head = await headers();
  return head.get('x-forwarded-for')?.split(',')[0] || 
         head.get('x-real-ip') || 
         '0.0.0.0';
}

export async function submitOwnershipRequestAction(params: {
  eventId: string;
  eventTitle: string;
  requesterUid: string;
  orgId: string;
  justification?: string;
}) {
  const db = getAdminDb();
  const ip = await getClientIp();

  try {
    const docRef = db.collection('admin').doc('solicitacoes_propriedade').collection('pedidos').doc();
    
    const requestData = {
      ...params,
      id: docRef.id,
      status: 'pendente',
      ip,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(requestData);

    await recordAuditLog({
      userId: params.requesterUid,
      eventId: params.eventId,
      action: 'admin_access',
      category: 'event',
      success: true,
      metadata: { type: 'ownership_request', requestId: docRef.id }
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function submitReportAction(params: {
  eventId: string;
  eventTitle: string;
  reporterUid?: string | null;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  reason: string;
}) {
  const db = getAdminDb();
  const ip = await getClientIp();

  try {
    const docRef = db.collection('reports').doc();
    
    const reportData = {
      ...params,
      id: docRef.id,
      status: 'Pendente',
      ip,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(reportData);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function submitRemovalRequestAction(params: {
  eventId: string;
  eventTitle: string;
  requesterUid: string;
  fullName: string;
  taxId: string;
  legalName?: string;
  email: string;
  phone: string;
  justification: string;
  proofUrls: string[];
}) {
  const db = getAdminDb();
  const ip = await getClientIp();

  try {
    const docRef = db.collection('admin').doc('solicitacoes_remocao').collection('pedidos').doc();
    
    const requestData = {
      ...params,
      id: docRef.id,
      status: 'pendente',
      ip,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(requestData);

    await recordAuditLog({
      userId: params.requesterUid,
      eventId: params.eventId,
      action: 'event_delete',
      category: 'event',
      success: true,
      metadata: { type: 'removal_request', requestId: docRef.id }
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
