'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { sendCampaignEmailAction } from './email';

/**
 * @fileOverview Server Actions para CRM e Fluxo de Aprovação de IA.
 * 
 * Atualizado para suportar mapeamento de públicos reais (Audit v4).
 */

export async function createCrmCampaignAction(data: any, creatorUid: string) {
  const db = getAdminDb();
  try {
    const campaignRef = db.collection('crm_campaigns').doc();
    const campaignData = {
      ...data,
      id: campaignRef.id,
      status: 'rascunho',
      metrics: { sent: 0, delivered: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0 },
      createdBy: creatorUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await campaignRef.set(campaignData);
    return { success: true, id: campaignRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendTestEmailAction(campaignId: string) {
  const db = getAdminDb();
  const testAddress = "viby@viby.club";
  
  try {
    const campaignSnap = await db.collection('crm_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) throw new Error("Campanha não encontrada.");
    const campaign = campaignSnap.data()!;

    await sendCampaignEmailAction({
      to: testAddress,
      subject: `[TESTE] ${campaign.subject}`,
      html: campaign.contentHtml
    });

    await db.collection('crm_campaigns').doc(campaignId).update({
      status: 'teste_enviado',
      testEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function approveCrmCampaignAction(campaignId: string, adminUid: string) {
  const db = getAdminDb();
  try {
    await db.collection('crm_campaigns').doc(campaignId).update({
      status: 'aprovado',
      approvedBy: adminUid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * DISPARO REAL DA CAMPANHA
 * Localiza os usuários da base filtrada e envia os e-mails individualizados.
 */
export async function dispatchCrmCampaignAction(campaignId: string, adminUid: string) {
  const db = getAdminDb();
  try {
    const campaignRef = db.collection('crm_campaigns').doc(campaignId);
    const campaignSnap = await campaignRef.get();
    
    if (!campaignSnap.exists) throw new Error("Campanha não localizada.");
    const campaign = campaignSnap.data()!;

    if (campaign.status !== 'aprovado') {
      throw new Error("A campanha precisa estar aprovada para ser disparada.");
    }

    // 1. Identificar Público Alvo conforme Auditoria
    let targetCollection = 'users';
    let filterField = 'email';

    switch (campaign.basePublic) {
      case 'organizers':
        targetCollection = 'organizations';
        filterField = 'contactEmail';
        break;
      case 'leads':
        targetCollection = 'organizer_leads';
        filterField = 'email';
        break;
      case 'buyers':
      case 'attendees':
        targetCollection = 'registrations';
        filterField = 'userEmail';
        break;
      default:
        targetCollection = 'users';
        filterField = 'email';
    }

    let query: admin.firestore.Query = db.collection(targetCollection);

    // Filtros de Localização - Correção de campo por coleção
    if (campaign.filters?.city && campaign.filters.city !== 'all') {
      let cityField = 'city';
      if (campaign.basePublic === 'leads') cityField = 'cidade';
      if (campaign.basePublic === 'buyers' || campaign.basePublic === 'attendees') cityField = 'eventCity';
      
      query = query.where(cityField, '==', campaign.filters.city);
    }

    const targetSnap = await query.limit(1000).get(); 
    
    // Extração de destinatários únicos
    const emailSet = new Set<string>();
    const targets = targetSnap.docs.map(d => {
      const data = d.data();
      // Verificação de segurança para capturar e-mails em diferentes estruturas de documento
      const email = data[filterField] || data.email || data.contactEmail || data.userEmail;
      
      if (email && typeof email === 'string' && !emailSet.has(email.toLowerCase().trim())) {
        const cleanEmail = email.toLowerCase().trim();
        emailSet.add(cleanEmail);
        return {
          id: d.id,
          email: cleanEmail,
          name: data.name || data.nome || data.userName || "Membro Viby"
        };
      }
      return null;
    }).filter(t => t !== null) as { id: string, email: string, name: string }[];

    if (targets.length === 0) {
      throw new Error("Nenhum destinatário localizado com os filtros aplicados.");
    }

    // 2. Marcar como "Enviando"
    await campaignRef.update({
      status: 'enviando',
      dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
      dispatchedBy: adminUid,
      targetCount: targets.length
    });

    // 3. Processar Envio em Lote (Iterativo para MVP)
    let sentCount = 0;
    for (const target of targets) {
      try {
        // Injeção de Contexto de Personalização
        const personalizedHtml = campaign.contentHtml.replace(/@\[username\]/g, `@${target.name.split(' ')[0].toLowerCase()}`);
        
        await sendCampaignEmailAction({
          to: target.email,
          subject: campaign.subject,
          html: personalizedHtml
        });
        sentCount++;
      } catch (sendError) {
        console.error(`[CRM Dispatch] Failed for ${target.email}:`, sendError);
      }
    }

    // 4. Finalizar Campanha
    await campaignRef.update({
      status: 'concluido',
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      'metrics.sent': sentCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, sentCount };
  } catch (e: any) {
    console.error("[CRM Action Error]", e.message);
    return { success: false, error: e.message };
  }
}
