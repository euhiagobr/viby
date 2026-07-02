
'use server';

import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export type RefundType = 'shared' | 'platform_absorbed';

export async function processStripeRefund(params: {
  registrationId: string;
  executorUid: string;
  role: 'admin' | 'organizer';
  refundType: RefundType;
}) {
  const { registrationId, executorUid, role, refundType } = params;
  const db = getAdminDb();

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) throw new Error('Ingresso não localizado.');
    const regData = regSnap.data()!;

    if (!regData.stripeSessionId) throw new Error('ID de transação Stripe ausente.');

    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(regData.stripeSessionId);
    const paymentIntentId = session.payment_intent as string;

    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: refundType === 'shared',
      refund_application_fee: true,
    });

    const batch = db.batch();
    
    // Reverter Uso de Cupom de Usuário
    if (regData.userCouponId) {
      batch.update(db.collection('user_coupons').doc(regData.userCouponId), {
        uses: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.update(regRef, {
      status: 'refunded',
      paymentStatus: 'Estornado',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
