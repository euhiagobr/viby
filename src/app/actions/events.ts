'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { normalizeEventDates } from '@/lib/utils';

/**
 * @fileOverview Server Actions para gestão de eventos com geração de slug único e validação Stripe.
 */

async function validateStripeAccount(db: admin.firestore.Firestore, orgId: string, eventData: any) {
  // A regra de obrigatoriedade do Stripe aplica-se apenas a eventos com venda interna de ingressos pagos
  const isPaidOnViby = eventData.type === 'interno' && 
    eventData.batches?.some((b: any) => b.ticketTypes?.some((t: any) => (t.price || 0) > 0));

  if (!isPaidOnViby) return true;

  const orgSnap = await db.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) throw new Error("Organização não encontrada.");
  
  const orgData = orgSnap.data();
  if (!orgData?.stripeAccountId) {
    throw new Error("Para vender ingressos é necessário configurar sua conta de recebimento Stripe.");
  }
  return true;
}

async function generateUniqueSlug(db: admin.firestore.Firestore, orgId: string, title: string, currentEventId?: string, manualSlug?: string) {
  const baseSlug = manualSlug ? slugify(manualSlug) : slugify(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const snap = await db.collection('events')
      .where('organizationId', '==', orgId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty || (currentEventId && snap.docs[0].id === currentEventId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function createEventAction(params: {
  orgId: string;
  userId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  
  try {
    // Normalização e Validação de Datas
    const dateNormalization = normalizeEventDates(params.eventData.startDate, params.eventData.endDate);
    if (!dateNormalization.isValid) {
      throw new Error(dateNormalization.error);
    }

    // Validação Condicional de Conta Connect
    await validateStripeAccount(db, params.orgId, params.eventData);

    const slug = await generateUniqueSlug(db, params.orgId, params.eventData.title);
    
    const eventRef = db.collection('events').doc();
    const finalData = {
      ...params.eventData,
      id: eventRef.id,
      slug,
      date: dateNormalization.startDate, // Início normalizado
      endDate: dateNormalization.endDate, // Fim normalizado
      startDate: dateNormalization.startDate,
      organizationId: params.orgId,
      organizerId: params.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.set(finalData);

    return { success: true, id: eventRef.id, slug };
  } catch (e: any) {
    console.error("[Events Action] Create Failure:", e.message);
    return { success: false, error: e.message };
  }
}

export async function updateEventAction(params: {
  eventId: string;
  orgId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  
  try {
    // Normalização e Validação de Datas
    const dateNormalization = normalizeEventDates(params.eventData.startDate, params.eventData.endDate);
    if (!dateNormalization.isValid) {
      throw new Error(dateNormalization.error);
    }

    // Validação Condicional de Conta Connect (Mesmo para edições/ativações)
    await validateStripeAccount(db, params.orgId, params.eventData);

    const eventRef = db.collection('events').doc(params.eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) throw new Error("Evento não localizado.");
    const oldData = eventSnap.data()!;

    let slug = oldData.slug;
    if (slugify(params.eventData.title) !== slugify(oldData.title)) {
      slug = await generateUniqueSlug(db, params.orgId, params.eventData.title, params.eventId);
    }

    const updatePayload = {
      ...params.eventData,
      slug,
      date: dateNormalization.startDate,
      endDate: dateNormalization.endDate,
      startDate: dateNormalization.startDate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.update(updatePayload);

    return { success: true, slug };
  } catch (e: any) {
    console.error("[Events Action] Update Failure:", e.message);
    return { success: false, error: e.message };
  }
}

export async function updateEventSlugAction(params: {
  eventId: string;
  orgId: string;
  newTitle?: string;
  manualSlug?: string;
}) {
  const db = getAdminDb();
  try {
    const eventRef = db.collection('events').doc(params.eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) throw new Error("Evento não encontrado.");
    const eventData = eventSnap.data()!;

    const source = params.manualSlug || params.newTitle || eventData.title;
    const slug = await generateUniqueSlug(db, params.orgId, source, params.eventId, params.manualSlug);

    await eventRef.update({
      slug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, slug };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
