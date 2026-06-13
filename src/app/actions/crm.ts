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
    if (!oldSnap.exists) throw new Error("Lead não encontrado.");
    
    const oldData = oldSnap.data()!;

    await leadRef.update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Auditoria automática de alterações para o histórico
    const fieldsToMonitor = [
      { key: 'status', label: 'Status' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'prioridade', label: 'Prioridade' },
      { key: 'potencial', label: 'Potencial' },
      { key: 'origem', label: 'Origem' },
      { key: 'interessePrincipal', label: 'Interesse' }
    ];

    for (const field of fieldsToMonitor) {
      if (data[field.key] !== undefined && data[field.key] !== oldData[field.key]) {
        await addLeadHistory({
          leadId,
          tipo: 'alteracao',
          descricao: `${field.label} alterado de "${oldData[field.key] || 'Vazio'}" para "${data[field.key]}"`,
          usuarioResponsavel: adminName
        });
      }
    }

    if (data.observacoesInternas && data.observacoesInternas !== oldData.observacoesInternas) {
      await addLeadHistory({
        leadId,
        tipo: 'nota',
        descricao: `Anotação interna atualizada.`,
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
