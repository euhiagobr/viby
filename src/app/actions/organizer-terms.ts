'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { headers } from 'next/headers';
import { CURRENT_TERMS_VERSION } from '@/lib/terms-version';

/**
 * Registra a aceitação dos termos dentro do documento do evento
 */
export async function recordEventWithTermsAcceptance(params: {
  eventId: string;
  userId: string;
  eventData: any;
}) {
  try {
    const db = getAdminDb();
    const { eventId, userId, eventData } = params;

    // Obter IP do usuário
    let userIp = 'unknown';
    try {
      const headersList = await headers();
      userIp = headersList.get('x-forwarded-for')?.split(',')[0].trim() || 
               headersList.get('x-real-ip') ||
               headersList.get('cf-connecting-ip') ||
               'unknown';
    } catch (e) {
      console.warn('Could not retrieve user IP:', e);
    }

    // Adicionar termsAcceptance ao documento
    const dataToSave = {
      ...eventData,
      termsAcceptance: {
        accepted: true,
        version: CURRENT_TERMS_VERSION,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        ip: userIp,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      },
    };

    // Salvar evento com dados de aceite
    await db.collection('events').doc(eventId).set(dataToSave, { merge: true });

    return {
      success: true,
      message: 'Evento criado com aceite dos termos',
    };
  } catch (error: any) {
    console.error('[recordEventWithTermsAcceptance] Erro:', error);
    return {
      success: false,
      error: error.message || 'Erro ao salvar evento',
    };
  }
}

