import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase/admin';
import { hasEventEnded } from '@/lib/ticket-expiry';
import { recordAuditLog } from '@/app/actions/audit';
import { logSystemError } from '@/lib/error-manager';

export type RefundRequestStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'refunded' | 'failed' | 'cancelled';

export interface RefundRequestAuditEvent {
  type: string;
  timestamp: admin.firestore.FieldValue | Date | string;
  responsible: string;
  responsibleType: 'user' | 'system' | 'admin';
  observations?: string;
}

export interface RefundRequestAttachment {
  id: string;
  name: string;
  mimeType?: string;
  url?: string;
  uploadedAt?: admin.firestore.FieldValue | Date | string;
}

export type RefundRequestPolicy = 'automatic' | 'manual' | 'none';

export interface RefundRequestEligibilityResult {
  eligible: boolean;
  policy: RefundRequestPolicy;
  message?: string;
  reason?: string;
  request?: any | null;
  status?: RefundRequestStatus | null;
}

export interface RefundRequestCreateResult {
  success: boolean;
  message: string;
  error?: string;
  requestId?: string;
  requestCode?: string;
}

export interface RefundRequestActionResult {
  success: boolean;
  message: string;
  error?: string;
  requestId?: string;
  refundId?: string;
}

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

async function resolvePaymentIntentId(db: admin.firestore.Firestore, registration: any) {
  if (registration?.stripeSessionId) {
    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(registration.stripeSessionId);
    const paymentIntentId = session.payment_intent as string | null;
    if (paymentIntentId) return paymentIntentId;
  }

  const orderId = registration?.orderId;
  if (orderId) {
    const orderSnap = await db.collection('orders').doc(orderId).get();
    const orderData = orderSnap.data();
    const paymentIntentId = orderData?.paymentIntentId || orderData?.payment_intent_id || orderData?.stripePaymentIntentId;
    if (paymentIntentId) return paymentIntentId as string;
  }

  return null;
}

function isCancelledRegistration(registration: any) {
  return registration?.status === 'cancelled' || registration?.status === 'refunded' ||
    registration?.status === 'Cancelado' || registration?.paymentStatus === 'Estornado' ||
    registration?.paymentStatus === 'Cancelado';
}

function normalizeDate(value: any) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    if (isDateOnly) {
      // Interpretar datas sem horário como meia-noite em Brasília (UTC-3),
      // evitando que `new Date('YYYY-MM-DD')` seja tratado como meia-noite UTC.
      const dateObj = new Date(trimmed);
      const utcTime = dateObj.getTime();
      const brazilOffsetMs = -3 * 60 * 60 * 1000;
      return new Date(utcTime - brazilOffsetMs);
    }

    return new Date(trimmed);
  }

  return new Date(value);
}

function calculateAutoRefundWindowEnd(purchaseDate: Date, eventStartDate: Date) {
  const sevenDaysEnd = new Date(purchaseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventBoundary = new Date(eventStartDate.getTime() - 48 * 60 * 60 * 1000);
  return sevenDaysEnd < eventBoundary ? sevenDaysEnd : eventBoundary;
}

function determineRefundPolicy(params: {
  purchaseDate: Date;
  eventStartDate: Date;
  now: Date;
}): { policy: RefundRequestPolicy; message: string; reason?: string } {
  const { purchaseDate, eventStartDate, now } = params;
  const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
  const hoursUntilEvent = (eventStartDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const eventStarted = now.getTime() >= eventStartDate.getTime();

  if (eventStarted) {
    return {
      policy: 'none',
      message: 'O evento já começou. Não é possível solicitar reembolso.',
      reason: 'event_started'
    };
  }

  if (hoursUntilEvent < 48) {
    return {
      policy: 'manual',
      message: 'Faltam menos de 48 horas para o evento. A solicitação será enviada para análise do organizador.',
      reason: 'last_48_hours'
    };
  }

  if (daysSincePurchase <= 7) {
    return {
      policy: 'automatic',
      message: 'Este ingresso está elegível para reembolso automático.',
      reason: 'automatic_refund_window'
    };
  }

  return {
    policy: 'manual',
    message: 'O período de reembolso automático terminou, mas ainda é possível solicitar reembolso para análise do organizador.',
    reason: 'manual_review'
  };
}

function buildAuditTimelineEvent(params: {
  type: string;
  responsible: string;
  responsibleType: 'user' | 'system' | 'admin';
  observations?: string;
}) {
  const { type, responsible, responsibleType, observations } = params;
  return {
    type,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    responsible,
    responsibleType,
    observations
  } as RefundRequestAuditEvent;
}

async function findExistingRefundRequest(db: admin.firestore.Firestore, registrationId: string, transaction?: admin.firestore.Transaction) {
  const query = db.collection('refund_requests')
    .where('registrationId', '==', registrationId)
    .where('status', 'in', ['pending', 'processing', 'approved'])
    .limit(1);

  const snapshot = transaction ? await transaction.get(query as any) : await query.get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function generateRefundRequestCode(db: admin.firestore.Firestore, transaction?: admin.firestore.Transaction) {
  const counterRef = db.collection('counters').doc('refund_requests');
  const counterSnap = transaction ? await transaction.get(counterRef) : await counterRef.get();
  const currentSeq = Number(counterSnap.data()?.seq || 0);
  const nextSeq = currentSeq + 1;
  const year = new Date().getFullYear();
  const code = `REF-${year}-${String(nextSeq).padStart(6, '0')}`;

  const payload = {
    seq: nextSeq,
    lastCode: code,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (transaction) {
    transaction.set(counterRef, payload, { merge: true });
  } else {
    await counterRef.set(payload, { merge: true });
  }

  return code;
}

async function appendAuditEvent(params: {
  db: admin.firestore.Firestore;
  requestRef: admin.firestore.DocumentReference;
  transaction?: admin.firestore.Transaction;
  event: RefundRequestAuditEvent;
}) {
  const { db, requestRef, transaction, event } = params;
  if (transaction) {
    transaction.update(requestRef, {
      auditTimeline: admin.firestore.FieldValue.arrayUnion(event),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    await requestRef.update({
      auditTimeline: admin.firestore.FieldValue.arrayUnion(event),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function createNotification(params: {
  db: admin.firestore.Firestore;
  targetUid: string;
  senderId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  const { db, targetUid, senderId, title, message, type, link } = params;
  await db.collection('notifications').add({
    targetUid,
    senderId,
    senderName: 'Viby',
    type,
    title,
    message,
    link: link || null,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function ensureOrganizerAccess(db: admin.firestore.Firestore, actorId: string, organizationId: string) {
  const userSnap = await db.collection('users').doc(actorId).get();
  if (userSnap.exists && userSnap.data()?.role === 'admin') return true;
  const memberSnap = await db.collection('organizations').doc(organizationId).collection('members').doc(actorId).get();
  const memberRole = memberSnap.data()?.role;
  return ['owner', 'admin'].includes(memberRole);
}

export async function getRefundRequestEligibility(params: {
  db: admin.firestore.Firestore;
  registration: any;
  registrationId?: string;
  userId?: string;
}): Promise<RefundRequestEligibilityResult> {
  const { db, registration, registrationId, userId } = params;

  if (!registration) {
    return { eligible: false, policy: 'none', reason: 'not_found', message: 'Ingresso não localizado.' };
  }

  if (userId && registration.userId && registration.userId !== userId) {
    return { eligible: false, policy: 'none', reason: 'forbidden', message: 'Acesso negado para este ingresso.' };
  }

  if (registration.checkedIn === true) {
    return { eligible: false, policy: 'none', reason: 'already_checked_in', message: 'Não é possível solicitar reembolso para um ingresso já utilizado.' };
  }

  if (isCancelledRegistration(registration)) {
    return { eligible: false, policy: 'none', reason: 'already_refunded', message: 'Este ingresso já foi cancelado ou reembolsado.' };
  }

  const totalPaid = registration.price || 0;
  if (totalPaid <= 0) {
    return { eligible: false, policy: 'none', reason: 'free_ticket', message: 'Reembolso disponível apenas para ingressos pagos.' };
  }

  const existingRegistrationId = registrationId || registration.id || registration.registrationId || '';
  const existingRequest = await findExistingRefundRequest(db, existingRegistrationId);
  if (existingRequest) {
    return {
      eligible: false,
      policy: 'none',
      reason: 'existing_request',
      message: 'Já existe uma solicitação de reembolso em andamento para este ingresso.',
      request: existingRequest,
      status: existingRequest.status as RefundRequestStatus
    };
  }

  const purchaseDateCandidates = [
    registration?.paidAt,
    registration?.paymentConfirmedAt,
    registration?.purchaseDate,
    registration?.boughtAt,
    registration?.createdAt,
    registration?.timestamp,
    registration?.purchasedAt,
  ];

  const createdAt = normalizeDate(
    purchaseDateCandidates.find((value: any) => Boolean(value)) || registration?.orderCreatedAt || null
  );
  const eventStartDate = normalizeDate(registration.eventDate || registration.eventDateTime || registration.eventStartDate);
  const now = new Date();

  if (!createdAt || !eventStartDate || Number.isNaN(createdAt.getTime()) || Number.isNaN(eventStartDate.getTime())) {
    return { eligible: false, policy: 'none', reason: 'invalid_dates', message: 'Não foi possível validar a elegibilidade deste ingresso.' };
  }

  const policyResult = determineRefundPolicy({ purchaseDate: createdAt, eventStartDate, now });
  const eventEndDate = registration.eventEndDate || registration.eventDate;
  const eventEndTime = registration.eventEndTime;
  if (eventEndDate && hasEventEnded(eventEndDate, eventEndTime)) {
    return { eligible: false, policy: 'none', reason: 'event_ended', message: 'Este evento já foi encerrado.' };
  }

  if (policyResult.policy === 'automatic') {
    const paymentIntentId = await resolvePaymentIntentId(db, registration);
    if (!paymentIntentId) {
      return {
        eligible: true,
        policy: 'manual',
        reason: 'automatic_not_available',
        message: 'O reembolso automático não pôde ser iniciado porque os dados de pagamento Stripe estão incompletos. A solicitação será enviada para análise do organizador.'
      };
    }
  }

  return {
    eligible: policyResult.policy !== 'none',
    policy: policyResult.policy,
    reason: policyResult.reason,
    message: policyResult.message
  };
}

export async function createRefundRequest(params: {
  registrationId: string;
  userId: string;
  reason?: string;
}): Promise<RefundRequestCreateResult> {
  const db = getAdminDb();
  const { registrationId, userId, reason } = params;

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      return { success: false, message: 'Ingresso não localizado.', error: 'not_found' };
    }

    const registration = regSnap.data()!;
    const eligibility = await getRefundRequestEligibility({ db, registration, registrationId, userId });

    if (!eligibility.eligible) {
      return { success: false, message: eligibility.message || 'Não foi possível criar a solicitação.', error: eligibility.reason };
    }

    const paymentIntentId = await resolvePaymentIntentId(db, registration);
    const canProcessAutomatically = eligibility.policy === 'automatic' && Boolean(paymentIntentId);

    const requestRef = db.collection('refund_requests').doc();
    const transactionResult = await db.runTransaction(async (transaction) => {
      const liveRegistrationSnap = await transaction.get(regRef);
      if (!liveRegistrationSnap.exists) {
        throw new Error('not_found');
      }

      const existingRequest = await findExistingRefundRequest(db, registrationId, transaction);
      if (existingRequest) {
        throw new Error('existing_request');
      }

      const requestCode = await generateRefundRequestCode(db, transaction);
      const now = admin.firestore.FieldValue.serverTimestamp();
      const initialTimeline = [
        buildAuditTimelineEvent({
          type: canProcessAutomatically ? 'refund_auto_requested' : 'refund_request_created',
          responsible: userId,
          responsibleType: 'user',
          observations: reason
            ? canProcessAutomatically
              ? `Reembolso automático iniciado pelo comprador. Motivo: ${reason}`
              : `Solicitação de reembolso criada pelo comprador. Motivo: ${reason}`
            : canProcessAutomatically
              ? 'Reembolso automático iniciado pelo comprador.'
              : 'Solicitação de reembolso criada pelo comprador.'
        })
      ];

      transaction.set(requestRef, {
        code: requestCode,
        registrationId,
        orderId: registration.orderId || '',
        eventId: registration.eventId,
        organizerId: registration.organizerId || registration.organizationId || '',
        eventTitle: registration.eventTitle || registration.title || '',
        buyerName: registration.userName || registration.buyerName || '',
        buyerEmail: registration.userEmail || registration.email || '',
        ticketCode: registration.ticketCode || registration.code || '',
        paidAmount: registration.price || 0,
        purchasedAt: registration.createdAt || registration.timestamp || now,
        userId,
        paymentIntentId: paymentIntentId || null,
        refundPolicy: eligibility.policy,
        status: canProcessAutomatically ? 'processing' : 'pending',
        reason: reason || 'Solicitação do comprador',
        requestedAt: now,
        processedAt: null,
        processedBy: null,
        stripeRefundId: null,
        createdAt: now,
        updatedAt: now,
        source: 'buyer',
        auditTimeline: initialTimeline,
        attachments: [],
        attachmentConfig: {
          uploadEnabled: false,
          maxAttachments: 0,
          allowedMimeTypes: []
        }
      });

      return { requestCode };
    });

    if (canProcessAutomatically && paymentIntentId) {
      try {
        const stripe = await getStripeInstance(db);
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reverse_transfer: true,
          refund_application_fee: true
        });

        await db.runTransaction(async (transaction) => {
          const latestRequestSnap = await transaction.get(requestRef);
          if (!latestRequestSnap.exists) return;

          transaction.update(requestRef, {
            status: 'refunded',
            stripeRefundId: refund.id,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            auditTimeline: admin.firestore.FieldValue.arrayUnion(buildAuditTimelineEvent({
              type: 'refund_completed',
              responsible: userId,
              responsibleType: 'user',
              observations: `Reembolso automático processado no Stripe. Refund ID: ${refund.id}`
            }))
          });

          transaction.update(regRef, {
            status: 'refunded',
            paymentStatus: 'Estornado',
            refundType: 'automatic',
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundStripeId: refund.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
      } catch (refundError: any) {
        await logSystemError({ context: 'createRefundRequest.autoRefund', error: refundError.message, registrationId, userId });
      }
    }

    await recordAuditLog({
      userId,
      ticketId: registrationId,
      organizationId: registration.organizationId,
      eventId: registration.eventId,
      action: 'buyer_refund_request',
      category: 'ticket',
      success: true,
      metadata: {
        refundRequestId: requestRef.id,
        refundRequestCode: transactionResult.requestCode,
        status: canProcessAutomatically ? 'processing' : 'pending',
        reason: reason || 'Solicitação do comprador',
        autoProcessed: canProcessAutomatically
      }
    });

    return {
      success: true,
      message: canProcessAutomatically
        ? 'Reembolso automático iniciado com sucesso.'
        : 'Solicitação de reembolso enviada com sucesso. O organizador analisará o pedido.',
      requestId: requestRef.id,
      requestCode: transactionResult.requestCode
    };
  } catch (error: any) {
    if (error.message === 'existing_request') {
      return {
        success: false,
        message: 'Já existe uma solicitação de reembolso em andamento para este ingresso.',
        error: 'existing_request'
      };
    }

    console.error('[Refund Request Service] Error:', error);
    await logSystemError({
      context: 'createRefundRequest',
      error: error.message,
      registrationId,
      userId
    });

    return {
      success: false,
      message: 'Não foi possível enviar a solicitação de reembolso.',
      error: error.message
    };
  }
}

export async function approveRefundRequest(params: {
  requestId: string;
  actorId: string;
  organizationId: string;
  actorEmail?: string;
  actorName?: string;
  reason?: string;
}): Promise<RefundRequestActionResult> {
  const db = getAdminDb();
  const { requestId, actorId, organizationId, actorEmail, actorName, reason } = params;

  try {
    const requestRef = db.collection('refund_requests').doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return { success: false, message: 'Solicitação não localizada.', error: 'not_found' };
    }

    const request = requestSnap.data()!;
    if (request.status === 'refunded') {
      return { success: false, message: 'Esta solicitação já foi reembolsada.', error: 'already_refunded' };
    }
    if (request.status === 'rejected') {
      return { success: false, message: 'Esta solicitação já foi rejeitada.', error: 'already_rejected' };
    }
    if (request.status === 'processing') {
      return { success: false, message: 'O reembolso já está sendo processado.', error: 'processing' };
    }

    const canManage = await ensureOrganizerAccess(db, actorId, organizationId);
    if (!canManage) {
      return { success: false, message: 'Acesso negado.', error: 'forbidden' };
    }

    if (request.organizerId && request.organizerId !== organizationId) {
      return { success: false, message: 'Esta solicitação não pertence à sua organização.', error: 'forbidden' };
    }

    const regRef = db.collection('registrations').doc(request.registrationId);
    const regSnap = await regRef.get();
    if (!regSnap.exists) {
      return { success: false, message: 'Ingresso não localizado.', error: 'not_found' };
    }

    const registration = regSnap.data()!;
    const eligibility = await getRefundRequestEligibility({ db, registration, registrationId: request.registrationId, userId: request.userId });

    if (!eligibility.eligible) {
      return { success: false, message: eligibility.message || 'A solicitação não é mais elegível para reembolso.', error: eligibility.reason };
    }

    const processingEvent = buildAuditTimelineEvent({
      type: 'processing_started',
      responsible: actorId,
      responsibleType: 'admin',
      observations: reason ? `Aprovado pelo organizador. Motivo: ${reason}` : 'Reembolso iniciado após aprovação do organizador.'
    });

    await db.runTransaction(async (transaction) => {
      const latestRequestSnap = await transaction.get(requestRef);
      if (!latestRequestSnap.exists) {
        throw new Error('not_found');
      }
      const latestRequest = latestRequestSnap.data()!;
      if (latestRequest.status === 'refunded' || latestRequest.status === 'rejected' || latestRequest.status === 'processing') {
        throw new Error('terminal_state');
      }

      transaction.update(requestRef, {
        status: 'processing',
        processedBy: actorId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvalReason: reason || null,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: actorId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        auditTimeline: admin.firestore.FieldValue.arrayUnion(processingEvent)
      });
    });

    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(registration.stripeSessionId);
    const paymentIntentId = session.payment_intent as string;
    if (!paymentIntentId) {
      throw new Error('no_payment_intent');
    }

    const existingRefunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 10 });
    const existingSucceeded = existingRefunds.data.find((refund: Stripe.Refund) => refund.status === 'succeeded' && refund.payment_intent === paymentIntentId);
    const refundId = existingSucceeded?.id || (await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true
    })).id;

    if (!refundId) {
      throw new Error('refund_not_created');
    }

    await db.runTransaction(async (transaction) => {
      const latestRequestSnap = await transaction.get(requestRef);
      if (!latestRequestSnap.exists) {
        throw new Error('not_found');
      }

      const latestRequest = latestRequestSnap.data()!;
      if (latestRequest.status === 'refunded') {
        return;
      }

      const completedEvent = buildAuditTimelineEvent({
        type: 'refund_completed',
        responsible: actorId,
        responsibleType: 'admin',
        observations: `Reembolso concluído no Stripe. Refund ID: ${refundId}`
      });

      transaction.update(requestRef, {
        status: 'refunded',
        stripeRefundId: refundId,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        auditTimeline: admin.firestore.FieldValue.arrayUnion(completedEvent)
      });

      transaction.update(regRef, {
        status: 'refunded',
        paymentStatus: 'Estornado',
        refundType: 'organizer_approval',
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundStripeId: refundId,
        refundApprovedBy: actorId,
        refundApprovalReason: reason || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const occurrenceId = registration.occurrenceId;
      const productType = registration.productType || 'event';
      const isExp = productType === 'experience';
      if (occurrenceId) {
        const occRef = isExp
          ? db.collection('experiences').doc(registration.eventId).collection('slots').doc(occurrenceId)
          : db.collection('recurring_occurrences').doc(occurrenceId);
        transaction.update(occRef, {
          sold: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const sourceColl = isExp ? 'experiences' : 'events';
      const eventRef = db.collection(sourceColl).doc(registration.eventId);
      if (isExp) {
        transaction.update(eventRef, {
          sold: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(eventRef, {
          ingressosVendidos: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    await createNotification({
      db,
      targetUid: request.userId,
      senderId: actorId,
      title: 'Reembolso aprovado',
      message: 'Sua solicitação de reembolso foi aprovada e está sendo processada.',
      type: 'refund_approved',
      link: `/dashboard/ingressos`
    });

    await recordAuditLog({
      userId: actorId,
      userEmail: actorEmail || 'unknown',
      organizationId,
      eventId: registration.eventId,
      ticketId: request.registrationId,
      action: 'refund_request_approved',
      category: 'finance',
      success: true,
      metadata: {
        refundRequestId: requestId,
        stripeRefundId: refundId,
        reason: reason || null
      }
    });

    return { success: true, message: 'Reembolso aprovado e processado com sucesso.', requestId, refundId };
  } catch (error: any) {
    if (error.message === 'terminal_state') {
      return { success: false, message: 'Esta solicitação já foi processada.', error: 'terminal_state' };
    }
    if (error.message === 'not_found') {
      return { success: false, message: 'Solicitação não localizada.', error: 'not_found' };
    }

    try {
      const requestRef = db.collection('refund_requests').doc(requestId);
      const failedEvent = buildAuditTimelineEvent({
        type: 'processing_failed',
        responsible: actorId,
        responsibleType: 'admin',
        observations: error.message
      });
      await requestRef.update({
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        failureReason: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        auditTimeline: admin.firestore.FieldValue.arrayUnion(failedEvent)
      });

      await createNotification({
        db,
        targetUid: actorId,
        senderId: actorId,
        title: 'Falha no processamento de reembolso',
        message: 'O reembolso não pôde ser concluído. Verifique os detalhes da solicitação.',
        type: 'refund_failed',
        link: `/dashboard/organizacoes/${organizationId}/reembolsos`
      });

      await recordAuditLog({
        userId: actorId,
        userEmail: actorEmail || 'unknown',
        organizationId,
        eventId: undefined,
        ticketId: requestId,
        action: 'refund_request_failed',
        category: 'finance',
        success: false,
        metadata: { refundRequestId: requestId, error: error.message }
      });
    } catch (innerError: any) {
      console.error('[Refund Request Service] Failure audit error:', innerError);
    }

    return { success: false, message: 'Não foi possível concluir o reembolso.', error: error.message };
  }
}

export async function rejectRefundRequest(params: {
  requestId: string;
  actorId: string;
  organizationId: string;
  actorEmail?: string;
  actorName?: string;
  reason: string;
}): Promise<RefundRequestActionResult> {
  const db = getAdminDb();
  const { requestId, actorId, organizationId, actorEmail, actorName, reason } = params;

  try {
    if (!reason?.trim()) {
      return { success: false, message: 'O motivo da rejeição é obrigatório.', error: 'missing_reason' };
    }

    const requestRef = db.collection('refund_requests').doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return { success: false, message: 'Solicitação não localizada.', error: 'not_found' };
    }

    const request = requestSnap.data()!;
    if (request.status === 'refunded') {
      return { success: false, message: 'Esta solicitação já foi reembolsada.', error: 'already_refunded' };
    }
    if (request.status === 'rejected') {
      return { success: false, message: 'Esta solicitação já foi rejeitada.', error: 'already_rejected' };
    }

    const canManage = await ensureOrganizerAccess(db, actorId, organizationId);
    if (!canManage) {
      return { success: false, message: 'Acesso negado.', error: 'forbidden' };
    }

    if (request.organizerId && request.organizerId !== organizationId) {
      return { success: false, message: 'Esta solicitação não pertence à sua organização.', error: 'forbidden' };
    }

    const rejectedEvent = buildAuditTimelineEvent({
      type: 'rejected',
      responsible: actorId,
      responsibleType: 'admin',
      observations: reason
    });

    await db.runTransaction(async (transaction) => {
      transaction.update(requestRef, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedBy: actorId,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        auditTimeline: admin.firestore.FieldValue.arrayUnion(rejectedEvent)
      });
    });

    await createNotification({
      db,
      targetUid: request.userId,
      senderId: actorId,
      title: 'Solicitação de reembolso rejeitada',
      message: `Sua solicitação de reembolso foi rejeitada. Motivo: ${reason}`,
      type: 'refund_rejected',
      link: `/dashboard/ingressos`
    });

    await recordAuditLog({
      userId: actorId,
      userEmail: actorEmail || 'unknown',
      organizationId,
      eventId: request.eventId,
      ticketId: request.registrationId,
      action: 'refund_request_rejected',
      category: 'finance',
      success: true,
      metadata: { refundRequestId: requestId, reason }
    });

    return { success: true, message: 'Solicitação rejeitada com sucesso.', requestId };
  } catch (error: any) {
    return { success: false, message: 'Não foi possível rejeitar a solicitação.', error: error.message };
  }
}

export async function getRefundRequestStateForRegistration(params: {
  registrationId: string;
  userId?: string;
}) {
  const db = getAdminDb();
  const { registrationId, userId } = params;

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      return {
        eligible: false,
        hasRequest: false,
        request: null,
        status: null,
        message: 'Ingresso não localizado.'
      };
    }

    const registration = regSnap.data()!;
    const eligibility = await getRefundRequestEligibility({ db, registration, registrationId, userId });
    const existingRequest = await findExistingRefundRequest(db, registrationId);

    return {
      eligible: eligibility.eligible,
      policy: eligibility.policy,
      hasRequest: Boolean(existingRequest),
      request: existingRequest,
      status: existingRequest?.status || null,
      message: existingRequest ? `Solicitação ${existingRequest.status}` : eligibility.message || null
    };
  } catch (error: any) {
    console.error('[Refund Request State] Error:', error);
    return {
      eligible: false,
      policy: 'none',
      hasRequest: false,
      request: null,
      status: null,
      message: 'Não foi possível consultar o estado da solicitação.'
    };
  }
}
