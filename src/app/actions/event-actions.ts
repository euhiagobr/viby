
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { headers } from 'next/headers';
import { recordAuditLog } from './audit';

async function getClientContext() {
  const head = await headers();
  return {
    ip: head.get('x-forwarded-for')?.split(',')[0] || head.get('x-real-ip') || '0.0.0.0',
    userAgent: head.get('user-agent') || 'unknown'
  };
}

export async function submitOwnershipRequestAction(params: {
  eventId: string;
  eventTitle: string;
  requesterUid: string;
  orgId: string;
  justification?: string;
}) {
  const db = getAdminDb();
  const context = await getClientContext();

  try {
    // ANTI-SPAM: Verifica se já existe uma solicitação pendente do mesmo usuário para este evento
    const existing = await db.collection('admin').doc('solicitacoes_propriedade').collection('pedidos')
      .where('eventId', '==', params.eventId)
      .where('requesterUid', '==', params.requesterUid)
      .where('status', '==', 'pendente')
      .limit(1)
      .get();
    
    if (!existing.empty) {
      throw new Error("Você já possui uma solicitação em análise para este evento.");
    }

    const docRef = db.collection('admin').doc('solicitacoes_propriedade').collection('pedidos').doc();
    
    const requestData = {
      ...params,
      id: docRef.id,
      status: 'pendente',
      ip: context.ip,
      userAgent: context.userAgent,
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
  const context = await getClientContext();

  try {
    // ANTI-SPAM: Limite de 1 denúncia por usuário por evento a cada 24h
    if (params.reporterUid) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const recent = await db.collection('reports')
        .where('eventId', '==', params.eventId)
        .where('reporterUid', '==', params.reporterUid)
        .where('timestamp', '>', admin.firestore.Timestamp.fromDate(yesterday))
        .limit(1)
        .get();

      if (!recent.empty) {
        throw new Error("Você já enviou uma denúncia para este evento recentemente. Nossa equipe está analisando.");
      }
    }

    const docRef = db.collection('reports').doc();
    
    const reportData = {
      ...params,
      id: docRef.id,
      status: 'Pendente',
      ip: context.ip,
      userAgent: context.userAgent,
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
  const context = await getClientContext();

  try {
    const docRef = db.collection('admin').doc('solicitacoes_remocao').collection('pedidos').doc();
    
    const requestData = {
      ...params,
      id: docRef.id,
      status: 'pendente',
      ip: context.ip,
      userAgent: context.userAgent,
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
