
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { sendTicketEmail } from '@/app/actions/email';
import {
  recordChargeback,
  updateChargebackStatus,
  markRegistrationAsDisputed,
  closeChargebackDispute,
  findRegistrationByChargeId,
  auditChargebackEvent
} from '@/app/actions/chargeback';

export const dynamic = 'force-dynamic';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error("Stripe Secret Key not found.");
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function POST(req: Request) {
  const db = getAdminDb();
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    const stripe = await getStripeInstance(db);
    const stripeSettingsSnap = await db.collection('settings').doc('stripe').get();
    const webhookSecret = stripeSettingsSnap.data()?.webhookSecret;
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } else {
      event = JSON.parse(payload);
    }
  } catch (err: any) {
    console.error("[Webhook Parse Error]", err);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log(`[Webhook Received] Type: ${event.type}, ID: ${event.id}`);

  const eventLogRef = db.collection('stripe_processed_events').doc(event.id);
  const emailsToSend: any[] = [];

  try {
    await db.runTransaction(async (transaction) => {
      const eventLogSnap = await transaction.get(eventLogRef);
      if (eventLogSnap.exists) throw new Error("ALREADY_PROCESSED");

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[Webhook Session] metadata:`, session.metadata);
        
        if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
          const orderId = session.metadata.orderId;
          console.log(`[Webhook Processing] OrderID: ${orderId}`);
          
          const orderRef = db.collection("orders").doc(orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (!orderSnap.exists) {
            console.error(`[Webhook Error] Order not found: ${orderId}`);
            return;
          }
          
          const orderData = orderSnap.data()!;
          console.log(`[Webhook Order] Status: ${orderData.status}, Items: ${orderData.items?.length || 0}`);
          
          if (orderData.status === 'paid') {
            console.log(`[Webhook Skip] Order already paid: ${orderId}`);
            return;
          }

          // Processamento de Cupom de Usuário
          const userCouponId = session.metadata.userCouponId || orderData.userCouponId;
          if (userCouponId) {
            const couponRef = db.collection('user_coupons').doc(userCouponId);
            const totalTickets = orderData.items.reduce((acc: number, i: any) => acc + (i.discountAmount > 0 ? i.quantity : 0), 0);
            if (totalTickets > 0) {
              transaction.update(couponRef, {
                uses: admin.firestore.FieldValue.increment(totalTickets),
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }

          const items = orderData.items || [];
          console.log(`[Webhook Creating Tickets] Total items: ${items.length}`);
          
          for (const item of items) {
            const sourceColl = item.productType === 'experience' ? "experiences" : "events";
            const eventRef = db.collection(sourceColl).doc(item.eventId);
            
            if (item.productType === 'experience' && item.occurrenceId) {
              const slotRef = db.collection("experiences").doc(item.eventId).collection("slots").doc(item.occurrenceId);
              transaction.update(slotRef, { sold: admin.firestore.FieldValue.increment(item.quantity) });
              transaction.update(eventRef, { salesCount: admin.firestore.FieldValue.increment(item.quantity) });
            } else {
              transaction.update(eventRef, { ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity) });
            }

            console.log(`[Webhook Item] Title: ${item.eventTitle}, Quantity: ${item.quantity}`);
            
            for (let j = 0; j < item.quantity; j++) {
              const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              const regRef = db.collection("registrations").doc();
              transaction.set(regRef, {
                ...item,
                userId: orderData.userId,
                userName: orderData.userName,
                userEmail: orderData.userEmail,
                paymentStatus: "Pago",
                status: "active",
                ticketCode,
                orderId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              });

              // ✅ Adiciona email à fila (será disparado fora da transação)
              emailsToSend.push({
                to: orderData.userEmail,
                userName: orderData.userName,
                eventTitle: item.eventTitle,
                ticketCode,
                eventDate: item.eventDate?.toDate ? item.eventDate.toDate().toLocaleString('pt-BR') : new Date(item.eventDate).toLocaleString('pt-BR'),
                eventCity: item.eventCity,
                voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`,
                usagePolicy: String(item.usagePolicy || "").trim(),
                additionalInfo: String(item.additionalInfo || "").trim(),
                description: item.description || "",
                inclusions: item.inclusions || [],
                exclusions: item.exclusions || [],
                rules: item.rules || []
              });
            }
          }
          transaction.update(orderRef, { status: 'paid', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      }

      // ===== DISPUTE WEBHOOK HANDLERS =====
      else if (event.type === 'charge.dispute.created') {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = dispute.charge as string;
        
        // Buscar registration associada ao charge
        const registration = await findRegistrationByChargeId(chargeId);
        
        // Registrar chargeback no Firestore
        await recordChargeback({
          stripeDisputeId: dispute.id,
          chargeId,
          organizationId: registration?.organizationId || 'unknown',
          registrationId: registration?.id,
          eventId: registration?.eventId,
          amount: dispute.amount || 0,
          currency: dispute.currency?.toUpperCase() || 'BRL',
          reason: dispute.reason || 'unknown',
          reasonCode: dispute.reason || 'unknown',
          status: 'warning_needs_response',
          evidenceDueBy: dispute.evidence_due_by ? new Date(dispute.evidence_due_by * 1000) : undefined,
          balanceTransaction: dispute.balance_transactions?.[0]?.id
        });

        // Marcar registration como em disputa
        if (registration?.id) {
          await markRegistrationAsDisputed(registration.id, dispute.id);
        }

        // Auditoria
        await auditChargebackEvent({
          stripeDisputeId: dispute.id,
          organizationId: registration?.organizationId || 'unknown',
          registrationId: registration?.id,
          eventId: registration?.eventId,
          amount: dispute.amount || 0,
          action: 'chargeback_created',
          reason: dispute.reason || 'unknown',
          reasonCode: dispute.reason || 'unknown',
          status: 'warning_needs_response'
        });
      }

      else if (event.type === 'charge.dispute.updated') {
        const dispute = event.data.object as Stripe.Dispute;
        
        // Buscar chargeback existente
        const chargebackRef = db.collection('chargebacks').doc(dispute.id);
        const chargebackSnap = await transaction.get(chargebackRef);
        
        if (chargebackSnap.exists) {
          // Atualizar status
          await updateChargebackStatus(dispute.id, (dispute.status as any) || 'under_review', {
            reason: dispute.reason,
            reasonCode: dispute.reason,
            evidenceDueBy: dispute.evidence_due_by ? new Date(dispute.evidence_due_by * 1000) : undefined
          });

          // Auditoria
          const chargebackData = chargebackSnap.data();
          await auditChargebackEvent({
            stripeDisputeId: dispute.id,
            organizationId: chargebackData?.organizationId || 'unknown',
            registrationId: chargebackData?.registrationId,
            eventId: chargebackData?.eventId,
            amount: dispute.amount || 0,
            action: 'chargeback_updated',
            reason: dispute.reason || 'unknown',
            reasonCode: dispute.reason || 'unknown',
            status: dispute.status || 'unknown'
          });
        }
      }

      else if (event.type === 'charge.dispute.closed') {
        const dispute = event.data.object as Stripe.Dispute;
        const status = dispute.status as 'won' | 'lost';
        
        // Buscar chargeback
        const chargebackRef = db.collection('chargebacks').doc(dispute.id);
        const chargebackSnap = await transaction.get(chargebackRef);
        
        if (chargebackSnap.exists) {
          const chargebackData = chargebackSnap.data();

          // Atualizar status para fechado
          await updateChargebackStatus(dispute.id, status);

          // Se temos registration, resolver a disputa
          if (chargebackData?.registrationId) {
            await closeChargebackDispute(
              chargebackData.registrationId,
              dispute.id,
              status
            );
          }

          // Auditoria
          await auditChargebackEvent({
            stripeDisputeId: dispute.id,
            organizationId: chargebackData?.organizationId || 'unknown',
            registrationId: chargebackData?.registrationId,
            eventId: chargebackData?.eventId,
            amount: dispute.amount || 0,
            action: 'chargeback_closed',
            reason: dispute.reason || 'unknown',
            reasonCode: dispute.reason || 'unknown',
            status,
            outcome: status
          });
        }
      }

      transaction.set(eventLogRef, { processedAt: admin.firestore.FieldValue.serverTimestamp(), type: event.type });
    });

    console.log(`[Webhook Success] Event ${event.id} processed successfully. Emails to send: ${emailsToSend.length}`);

    // ✅ Dispara emails FORA da transação (seguro e não bloqueia webhook)
    for (const emailData of emailsToSend) {
      sendTicketEmail(emailData).catch(err => {
        console.error("[Webhook Email Error]", err);
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    if (error.message === "ALREADY_PROCESSED") {
      console.log(`[Webhook Skip] Event already processed: ${event.id}`);
      return NextResponse.json({ received: true });
    }
    console.error(`[Webhook Failed] Error: ${error.message}`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
