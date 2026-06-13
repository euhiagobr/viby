
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

export async function addLeadHistory(params: {
  leadId: string;
  tipo: string;
  descricao: string;
  canal?: string;
  resultado?: string;
  usuarioResponsavel: string;
}) {
  const db = getAdminDb();
  try {
    const historyRef = db.collection('crm_lead_history').doc();
    await historyRef.set({
      ...params,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateLeadAction(leadId: string, data: any, adminName: string) {
  const db = getAdminDb();
  try {
    const leadRef = db.collection('organizer_leads').doc(leadId);
    const oldSnap = await leadRef.get();
    const oldData = oldSnap.data();

    await leadRef.update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Detectar mudanças para o histórico
    if (data.status && data.status !== oldData?.status) {
      await addLeadHistory({
        leadId,
        tipo: 'status',
        descricao: `Status alterado de ${oldData?.status} para ${data.status}`,
        usuarioResponsavel: adminName
      });
    }

    if (data.responsavel && data.responsavel !== oldData?.responsavel) {
      await addLeadHistory({
        leadId,
        tipo: 'responsavel',
        descricao: `Responsável alterado de ${oldData?.responsavel || 'Ninguém'} para ${data.responsavel}`,
        usuarioResponsavel: adminName
      });
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function registerContactAction(params: {
  leadId: string;
  canal: string;
  resultado: string;
  descricao: string;
  adminName: string;
}) {
  const db = getAdminDb();
  try {
    await addLeadHistory({
      leadId: params.leadId,
      tipo: 'contato',
      descricao: params.descricao,
      canal: params.canal,
      resultado: params.resultado,
      usuarioResponsavel: params.adminName
    });

    await db.collection('organizer_leads').doc(params.leadId).update({
      ultimoContato: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function scheduleFollowUpAction(params: {
  leadId: string;
  date: string;
  time: string;
  observation: string;
  adminName: string;
}) {
  const db = getAdminDb();
  try {
    const followUpDate = new Date(`${params.date}T${params.time}:00`);
    
    await db.collection('organizer_leads').doc(params.leadId).update({
      proximoFollowUp: admin.firestore.Timestamp.fromDate(followUpDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await addLeadHistory({
      leadId: params.leadId,
      tipo: 'follow_up',
      descricao: `Follow-up agendado para ${params.date} às ${params.time}. Nota: ${params.observation}`,
      usuarioResponsavel: params.adminName
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function convertLeadAction(params: {
  leadId: string;
  adminName: string;
  stripeStatus: string;
  firstEventDate?: string;
  publishedCount: number;
}) {
  const db = getAdminDb();
  try {
    await db.collection('organizer_leads').doc(params.leadId).update({
      status: 'convertido',
      dataConversao: admin.firestore.FieldValue.serverTimestamp(),
      stripeStatus: params.stripeStatus,
      eventosPublicados: params.publishedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await addLeadHistory({
      leadId: params.leadId,
      tipo: 'conversao',
      descricao: `Lead convertido com sucesso! Stripe: ${params.stripeStatus}, Eventos: ${params.publishedCount}`,
      usuarioResponsavel: params.adminName
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
