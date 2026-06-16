
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { revalidatePath } from 'next/cache';
import { sendManualMarketingEmail } from './email';

export async function createCrmCampaignAction(data: any, creatorUid: string) {
  const db = getAdminDb();
  try {
    const campaignRef = db.collection('crm_campaigns').doc();
    const campaignData = {
      ...data,
      id: campaignRef.id,
      status: 'rascunho',
      metrics: { sent: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0, conversions: 0, revenue: 0 },
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

export async function sendTestEmailAction(campaignId: string, adminUid: string) {
  const db = getAdminDb();
  const testAddress = "viby@viby.club";
  
  try {
    const campaignSnap = await db.collection('crm_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) throw new Error("Campanha não encontrada.");
    const campaign = campaignSnap.data()!;

    await sendManualMarketingEmail({
      to: testAddress,
      subject: `[TESTE] ${campaign.subject}`,
      content: campaign.contentHtml
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

export async function createCrmSegmentAction(data: any) {
  const db = getAdminDb();
  try {
    const segmentRef = db.collection('crm_segmentos').doc();
    await segmentRef.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function toggleAutomationAction(ruleId: string, active: boolean) {
  const db = getAdminDb();
  try {
    await db.collection('crm_automation_rules').doc(ruleId).update({
      active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
