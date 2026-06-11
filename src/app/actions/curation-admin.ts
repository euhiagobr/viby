
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { headers } from 'next/headers';

async function getClientContext() {
  const head = await headers();
  return {
    ip: head.get('x-forwarded-for')?.split(',')[0] || head.get('x-real-ip') || '0.0.0.0',
    userAgent: head.get('user-agent') || 'unknown'
  };
}

async function recordAdminAudit(params: {
  adminId: string;
  adminName: string;
  eventId?: string;
  action: string;
  reason: string;
  metadata?: any;
}) {
  const db = getAdminDb();
  const context = await getClientContext();
  await db.collection('admin_audit_logs').add({
    ...params,
    ip: context.ip,
    userAgent: context.userAgent,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function notifyUser(userId: string, senderId: string, message: string, type: string, link?: string) {
  const db = getAdminDb();
  await db.collection('notifications').add({
    targetUid: userId,
    senderId,
    senderName: "Viby Moderação",
    type,
    message,
    link,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * PROCESSA SOLICITAÇÃO DE PROPRIEDADE
 */
export async function processOwnershipAction(params: {
  requestId: string;
  status: 'aprovado' | 'rejeitado';
  reason: string;
  adminId: string;
  adminName: string;
}) {
  const db = getAdminDb();
  try {
    const requestRef = db.collection('admin').doc('solicitacoes_propriedade').collection('pedidos').doc(params.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) throw new Error("Solicitação não encontrada.");
    const request = requestSnap.data()!;

    if (params.status === 'aprovado') {
      const eventRef = db.collection('events').doc(request.eventId);
      const orgRef = db.collection('organizations').doc(request.orgId);
      const orgSnap = await orgRef.get();
      const orgData = orgSnap.data();

      if (!orgSnap.exists) throw new Error("Organização destino não localizada.");

      await eventRef.update({
        organizationId: request.orgId,
        organizerId: request.requesterUid,
        organizer: {
          id: request.orgId,
          name: orgData?.name,
          username: orgData?.username,
          avatar: orgData?.avatar || ""
        },
        curationType: admin.firestore.FieldValue.delete(), // Remove flag de curadoria ao assumir
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await notifyUser(
        request.requesterUid, 
        params.adminId, 
        `Sua solicitação de propriedade do evento "${request.eventTitle}" foi APROVADA.`,
        'system',
        `/dashboard/organizacoes/${orgData?.username}/events`
      );
    } else {
      await notifyUser(
        request.requesterUid, 
        params.adminId, 
        `Sua solicitação de propriedade do evento "${request.eventTitle}" foi rejeitada. Motivo: ${params.reason}`,
        'system'
      );
    }

    await requestRef.update({
      status: params.status,
      adminNotes: params.reason,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: params.adminId
    });

    await recordAdminAudit({
      adminId: params.adminId,
      adminName: params.adminName,
      eventId: request.eventId,
      action: params.status === 'aprovado' ? 'approve_ownership' : 'reject_ownership',
      reason: params.reason,
      metadata: { requestId: params.requestId, orgId: request.orgId }
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * PROCESSA DENÚNCIA
 */
export async function processReportAction(params: {
  reportId: string;
  action: 'arquivado' | 'em_analise' | 'ocultado' | 'excluido';
  reason: string;
  adminId: string;
  adminName: string;
}) {
  const db = getAdminDb();
  try {
    const reportRef = db.collection('reports').doc(params.reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) throw new Error("Denúncia não encontrada.");
    const report = reportSnap.data()!;
    const eventRef = db.collection('events').doc(report.eventId);
    const eventSnap = await eventRef.get();
    const eventData = eventSnap.data();

    switch (params.action) {
      case 'em_analise':
        await eventRef.update({ underReview: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        break;
      case 'ocultado':
        await eventRef.update({ status: 'Oculto', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        break;
      case 'excluido':
        await eventRef.update({ 
          status: 'Excluído', 
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          deletedBy: params.adminId,
          deleteReason: params.reason
        });
        if (eventData?.organizerId) {
          await notifyUser(
            eventData.organizerId,
            params.adminId,
            `O evento "${eventData.title}" foi removido pela moderação devido a denúncias.`,
            'system'
          );
        }
        break;
    }

    await reportRef.update({
      status: params.action === 'arquivado' ? 'Arquivada' : 'Analisada',
      adminAction: params.action,
      adminNotes: params.reason,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: params.adminId
    });

    await recordAdminAudit({
      adminId: params.adminId,
      adminName: params.adminName,
      eventId: report.eventId,
      action: `report_${params.action}`,
      reason: params.reason,
      metadata: { reportId: params.reportId }
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * PROCESSA REMOÇÃO JURÍDICA
 */
export async function processRemovalAction(params: {
  requestId: string;
  status: 'concluido' | 'rejeitado';
  reason: string;
  adminId: string;
  adminName: string;
}) {
  const db = getAdminDb();
  try {
    const requestRef = db.collection('admin').doc('solicitacoes_remocao').collection('pedidos').doc(params.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) throw new Error("Pedido de remoção não encontrado.");
    const request = requestSnap.data()!;

    if (params.status === 'concluido') {
      const eventRef = db.collection('events').doc(request.eventId);
      const eventSnap = await eventRef.get();
      const eventData = eventSnap.data();

      await eventRef.update({
        status: 'Excluído',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedBy: params.adminId,
        deleteReason: `Remoção Jurídica: ${params.reason}`
      });

      if (eventData?.organizerId) {
        await notifyUser(
          eventData.organizerId,
          params.adminId,
          `O evento "${eventData.title}" foi removido permanentemente por solicitação jurídica de terceiros.`,
          'system'
        );
      }
    }

    await requestRef.update({
      status: params.status,
      adminNotes: params.reason,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: params.adminId
    });

    await recordAdminAudit({
      adminId: params.adminId,
      adminName: params.adminName,
      eventId: request.eventId,
      action: params.status === 'concluido' ? 'approve_removal' : 'reject_removal',
      reason: params.reason,
      metadata: { requestId: params.requestId }
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * RESTAURA EVENTO DA LIXEIRA
 */
export async function restoreEventAction(eventId: string, adminId: string, adminName: string) {
  const db = getAdminDb();
  try {
    await db.collection('events').doc(eventId).update({
      status: 'Ativo',
      underReview: admin.firestore.FieldValue.delete(),
      deletedAt: admin.firestore.FieldValue.delete(),
      deletedBy: admin.firestore.FieldValue.delete(),
      deleteReason: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await recordAdminAudit({
      adminId,
      adminName,
      eventId,
      action: 'restore_event',
      reason: 'Restauração administrativa da lixeira.'
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * EXCLUI PERMANENTEMENTE
 */
export async function permanentDeleteEventAction(eventId: string, adminId: string, adminName: string) {
  const db = getAdminDb();
  try {
    // 1. Limpar subcoleções críticas antes de deletar o documento pai
    const subcolls = ['interests', 'partners', 'comments', 'setores'];
    for (const sub of subcolls) {
      const snap = await db.collection('events').doc(eventId).collection(sub).get();
      const batch = db.batch();
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    await db.collection('events').doc(eventId).delete();

    await recordAdminAudit({
      adminId,
      adminName,
      eventId,
      action: 'hard_delete',
      reason: 'Exclusão definitiva do banco de dados.'
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
