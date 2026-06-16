'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { normalizeEventDates } from '@/lib/utils';

/**
 * @fileOverview Server Actions para gestão de eventos com logs de auditoria e persistência correta de tipos.
 */

async function validateStripeAccount(db: admin.firestore.Firestore, orgId: string, eventData: any) {
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

/**
 * Garante unicidade GLOBAL de slugs para a nova estrutura de rotas /eventos/[slug]
 */
async function generateUniqueSlug(db: admin.firestore.Firestore, title: string, currentEventId?: string, manualSlug?: string) {
  const baseSlug = manualSlug ? slugify(manualSlug) : slugify(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    // Busca global por slug para evitar colisões
    const snap = await db.collection('events')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty || (currentEventId && snap.docs[0].id === currentEventId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
    if (counter > 20) return `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
  }
}

export async function createEventAction(params: {
  orgId: string;
  userId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  
  try {
    const { eventData } = params;
    
    // Normalização rigorosa de datas para evitar erros de visibilidade
    const dateNormalization = normalizeEventDates(eventData.startDate, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    await validateStripeAccount(db, params.orgId, eventData);

    const slug = await generateUniqueSlug(db, eventData.title);
    const eventRef = db.collection('events').doc();
    
    const startDate = new Date(dateNormalization.startDate);
    const endDate = new Date(dateNormalization.endDate);

    const { 
      id: _id, 
      createdAt: _ca, 
      updatedAt: _ua, 
      date: _d, 
      startDate: _sd, 
      endDate: _ed,
      organizer: _orgInput,
      ...sanitizedData 
    } = eventData;

    // Buscar dados atualizados da organização para desnormalização garantida
    const orgSnap = await db.collection('organizations').doc(params.orgId).get();
    const orgData = orgSnap.data();

    if (!orgSnap.exists) {
      throw new Error("Organização não localizada para o vínculo.");
    }

    // CORREÇÃO: Sincronização explícita de coordenadas no save
    const finalLat = sanitizedData.latitude !== undefined && sanitizedData.latitude !== null ? sanitizedData.latitude : (sanitizedData.address?.latitude || null);
    const finalLng = sanitizedData.longitude !== undefined && sanitizedData.longitude !== null ? sanitizedData.longitude : (sanitizedData.address?.longitude || null);

    console.log("[Viby-Action] Criando evento com coordenadas:", { lat: finalLat, lng: finalLng });

    const finalData = {
      ...sanitizedData,
      id: eventRef.id,
      slug,
      // Persistência EXPLICITA como Timestamp para garantir indexação correta
      date: admin.firestore.Timestamp.fromDate(startDate),
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      latitude: finalLat,
      longitude: finalLng,
      organizationId: params.orgId,
      organizerId: params.userId,
      organizer: {
        id: params.orgId,
        name: orgData?.name || "Organizador",
        username: orgData?.username || "evento",
        avatar: orgData?.avatar || ""
      },
      interestedCount: 0,
      ingressosVendidos: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.set(finalData);
    return { success: true, id: eventRef.id, slug, username: orgData?.username };
  } catch (e: any) {
    console.error(`[createEventAction] Critical Failure:`, e.message);
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
    if (!params.eventId) throw new Error("ID do evento é obrigatório.");

    const { eventData } = params;
    const dateNormalization = normalizeEventDates(eventData.startDate, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    await validateStripeAccount(db, params.orgId, eventData);

    const eventRef = db.collection('events').doc(params.eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error("Evento não localizado.");
    
    const oldData = eventSnap.data()!;

    let slug = oldData.slug;
    if (slugify(eventData.title) !== slugify(oldData.title)) {
      slug = await generateUniqueSlug(db, eventData.title, params.eventId);
    }

    const startDate = new Date(dateNormalization.startDate);
    const endDate = new Date(dateNormalization.endDate);

    const { 
      id: _id, 
      createdAt: _ca, 
      updatedAt: _ua, 
      date: _d, 
      startDate: _sd, 
      endDate: _ed, 
      organizer: _orgInput,
      ...sanitizedData 
    } = eventData;

    const orgSnap = await db.collection('organizations').doc(params.orgId).get();
    const orgData = orgSnap.data();

    // CORREÇÃO: Sincronização explícita de coordenadas no update
    const finalLat = sanitizedData.latitude !== undefined && sanitizedData.latitude !== null ? sanitizedData.latitude : (sanitizedData.address?.latitude || null);
    const finalLng = sanitizedData.longitude !== undefined && sanitizedData.longitude !== null ? sanitizedData.longitude : (sanitizedData.address?.longitude || null);

    console.log("[Viby-Action] Atualizando evento com coordenadas:", { id: params.eventId, lat: finalLat, lng: finalLng });

    const updatePayload = {
      ...sanitizedData,
      slug,
      date: admin.firestore.Timestamp.fromDate(startDate),
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      latitude: finalLat,
      longitude: finalLng,
      organizer: {
        id: params.orgId,
        name: orgData?.name || oldData.organizer?.name || "Organizador",
        username: orgData?.username || oldData.organizer?.username || "evento",
        avatar: orgData?.avatar || oldData.organizer?.avatar || ""
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.update(updatePayload);
    return { success: true, slug, username: orgData?.username || oldData.organizer?.username };
  } catch (e: any) {
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
    const slug = await generateUniqueSlug(db, source, params.eventId, params.manualSlug);

    await eventRef.update({
      slug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, slug };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
