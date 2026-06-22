
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { normalizeEventDates, generateRecurrenceDates } from '@/lib/utils';
import { slugifyLocation, buildRegionParam } from '@/lib/city-utils';
import { revalidatePath } from 'next/cache';
import { generateAndPersistCityCover } from './city-pages';
import { recordAuditLog } from './audit';

/**
 * Server Actions para gestão de eventos Viby.
 */

async function validateStripeAccount(db: admin.firestore.Firestore, orgId: string, eventData: any, occurrences: any[]) {
  const isPaidOnViby = eventData.type === 'interno' && 
    (
      eventData.batches?.some((b: any) => b.ticketTypes?.some((t: any) => (t.price || 0) > 0)) ||
      occurrences.some(occ => occ.batches?.some((b: any) => (b.price || 0) > 0))
    );

  if (!isPaidOnViby) return true;

  const orgSnap = await db.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) throw new Error("Organização não encontrada.");
  
  const orgData = orgSnap.data();
  if (!orgData?.stripeAccountId) {
    throw new Error("Para vender ingressos é necessário configurar sua conta de recebimento Stripe.");
  }
  return true;
}

async function generateUniqueSlug(db: admin.firestore.Firestore, title: string, currentEventId?: string, manualSlug?: string) {
  const baseSlug = manualSlug ? slugify(manualSlug) : slugify(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
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

async function triggerCityCoverGeneration(eventData: any) {
  const city = eventData.address?.city || eventData.city;
  const state = eventData.address?.stateRegion || eventData.state;
  const country = eventData.address?.country || eventData.country || "Brasil";
  const countryCode = (eventData.address?.countryCode || eventData.countryCode || "br").toLowerCase();

  if (!city || !state) return;

  const citySlug = slugifyLocation(city);
  const stateSlug = slugifyLocation(state);
  const regionSlug = `${countryCode}-${stateSlug}`;
  const cityPageId = `${regionSlug}-${citySlug}`;

  const db = getAdminDb();
  const cityPageRef = db.collection('cityPages').doc(cityPageId);
  const cityPageSnap = await cityPageRef.get();

  if (!cityPageSnap.exists) {
    await cityPageRef.set({
      slug: cityPageId,
      city,
      state,
      country,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  if (!cityPageSnap.exists || !cityPageSnap.data()?.coverImage) {
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('citySlug', '==', citySlug)
      .limit(5)
      .get();
    
    const categories = Array.from(new Set(eventsSnap.docs.map(d => d.data().categoryName).filter(Boolean)));

    generateAndPersistCityCover({
      slug: cityPageId,
      city,
      state,
      country,
      categories: categories as string[]
    }).catch(err => console.error("[Background City Cover Error]", err));
  }
}

async function manageEventOccurrences(db: admin.firestore.Firestore, eventId: string, organizationId: string, eventData: any, batch: admin.firestore.WriteBatch) {
  const isRecurring = eventData.recurrency && eventData.recurrency.freq;
  
  if (!isRecurring) {
    // Para eventos não recorrentes, não fazemos nada aqui.
    return;
  }
  
  // 1. Limpar ocorrências antigas para este evento
  const oldOccurrencesSnap = await db.collection('recurring_occurrences').where('eventId', '==', eventId).get();
  oldOccurrencesSnap.docs.forEach(doc => batch.delete(doc.ref));

  // 2. Gerar novas datas de ocorrência
  const recurrenceDates = generateRecurrenceDates(eventData.recurrency);

  // 3. Preparar a estrutura de lotes que servirá como template
  const batchTemplate = (eventData.batches || []).flatMap((batchGroup: any) => 
    (batchGroup.ticketTypes || []).map((ticket: any) => ({
      id: db.collection('recurring_occurrences').doc().id, // ID único para o lote
      name: ticket.name,
      price: Number(ticket.price || 0),
      quantity: Number(ticket.quantity || 0),
      isFree: (ticket.price || 0) === 0,
      sold: 0,
      currency: ticket.currency || 'BRL',
    }))
  );

  // 4. Criar um novo documento de ocorrência para cada data gerada
  recurrenceDates.forEach(date => {
    const occurrenceRef = db.collection('recurring_occurrences').doc();
    const capacity = Number(eventData.capacity) || batchTemplate.reduce((acc, b) => acc + b.quantity, 0);

    batch.set(occurrenceRef, {
      eventId: eventId,
      organizationId: organizationId,
      start_date: admin.firestore.Timestamp.fromDate(date.startDate),
      end_date: admin.firestore.Timestamp.fromDate(date.endDate),
      capacity: capacity,
      sales: {
        totalSold: 0,
        totalValue: 0,
      },
      batches: batchTemplate,
    });
  });

  // Remove os lotes e capacidade do evento principal, pois agora são gerenciados por sessão
  delete eventData.batches;
  delete eventData.capacity;
}

export async function createEventAction(params: {
  orgId: string;
  userId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  const batch = db.batch();

  try {
    const { orgId, userId, eventData } = params;
    const dateNormalization = normalizeEventDates(eventData.startDate, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    const isRecurring = eventData.recurrency && eventData.recurrency.freq;
    const occurrences: any[] = []; // Este array será populado em manageEventOccurrences se necessário

    await validateStripeAccount(db, orgId, eventData, occurrences);

    const slug = await generateUniqueSlug(db, eventData.title);
    const eventRef = db.collection('events').doc();
    
    await manageEventOccurrences(db, eventRef.id, orgId, eventData, batch);
    
    const startDate = new Date(dateNormalization.startDate);
    const endDate = new Date(dateNormalization.endDate);

    const citySlug = slugifyLocation(eventData.address.city);
    const stateSlug = slugifyLocation(eventData.address.stateRegion);
    const countrySlug = slugifyLocation(eventData.address.countryCode || "br");
    const regionSlug = buildRegionParam(countrySlug, eventData.address.stateRegion);

    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const orgData = orgSnap.data();

    if (!orgSnap.exists) throw new Error("Organização não localizada.");

    const finalData = {
      ...eventData,
      id: eventRef.id,
      isRecurring: !!isRecurring, // Adiciona o flag
      slug,
      citySlug,
      stateSlug,
      countrySlug,
      regionSlug,
      date: admin.firestore.Timestamp.fromDate(startDate),
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      organizationId: orgId,
      organizerId: userId,
      organizer: {
        id: orgId,
        name: orgData?.name || "Organizador",
        username: orgData?.username || "evento",
        avatar: orgData?.avatar || ""
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.set(eventRef, finalData);

    await batch.commit();
    
    triggerCityCoverGeneration(finalData);

    revalidatePath('/');
    revalidatePath(`/o-que-fazer-em/${regionSlug}/${citySlug}`);
    
    return { success: true, id: eventRef.id, slug, username: orgData?.username };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateEventAction(params: {
  eventId: string;
  orgId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  const batch = db.batch();

  try {
    const { eventId, orgId, eventData } = params;
    const dateNormalization = normalizeEventDates(eventData.startDate, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    const isRecurring = eventData.recurrency && eventData.recurrency.freq;
    const occurrences: any[] = [];

    await validateStripeAccount(db, orgId, eventData, occurrences);

    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error("Evento não localizado.");
    
    await manageEventOccurrences(db, eventId, orgId, eventData, batch);

    const oldData = eventSnap.data()!;
    const oldRegionSlug = oldData.regionSlug;
    const oldCitySlug = oldData.citySlug;

    let slug = oldData.slug;
    if (slugify(eventData.title) !== slugify(oldData.title)) {
      slug = await generateUniqueSlug(db, eventData.title, eventId);
    }

    const startDate = new Date(dateNormalization.startDate);
    const endDate = new Date(dateNormalization.endDate);

    const citySlug = slugifyLocation(eventData.address.city);
    const stateSlug = slugifyLocation(eventData.address.stateRegion);
    const countrySlug = slugifyLocation(eventData.address.countryCode || "br");
    const regionSlug = buildRegionParam(countrySlug, eventData.address.stateRegion);

    const updatePayload = {
      ...eventData,
      isRecurring: !!isRecurring,
      slug,
      citySlug,
      stateSlug,
      countrySlug,
      regionSlug,
      date: admin.firestore.Timestamp.fromDate(startDate),
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.update(eventRef, updatePayload);
    
    await batch.commit();
    
    triggerCityCoverGeneration(updatePayload);

    revalidatePath('/');
    revalidatePath(`/o-que-fazer-em/${regionSlug}/${citySlug}`);
    if (oldRegionSlug !== regionSlug || oldCitySlug !== citySlug) {
      revalidatePath(`/o-que-fazer-em/${oldRegionSlug}/${oldCitySlug}`);
    }

    return { success: true, slug, username: oldData.organizer?.username };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}


// Manter as funções abaixo inalteradas, pois não são diretamente afetadas pela mudança na bilheteria

export async function updateEventSlugAction(params: {
  eventId: string;
  orgId: string;
  manualSlug: string;
}) {
  const db = getAdminDb();
  try {
    const slug = await generateUniqueSlug(db, "", params.eventId, params.manualSlug);
    await db.collection('events').doc(params.eventId).update({
      slug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, slug };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function transferEventAction(params: {
  eventId: string;
  targetOrgUsername: string;
  adminUid: string;
  adminName: string;
}) {
  const db = getAdminDb();
  try {
    const orgSnap = await db.collection('organizations')
      .where('username', '==', params.targetOrgUsername.toLowerCase().trim())
      .limit(1)
      .get();
    
    if (orgSnap.empty) throw new Error("Organização destino não localizada.");
    const targetOrg = orgSnap.docs[0].data();

    await db.collection('events').doc(params.eventId).update({
      organizationId: targetOrg.id,
      organizerId: targetOrg.ownerId,
      organizer: {
        id: targetOrg.id,
        name: targetOrg.name,
        username: targetOrg.username,
        avatar: targetOrg.avatar || ""
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await recordAuditLog({
      action: 'admin_change',
      category: 'event',
      eventId: params.eventId,
      userId: params.adminUid,
      success: true,
      metadata: { 
        type: 'transfer_ownership', 
        targetOrg: targetOrg.id,
        adminName: params.adminName 
      }
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function cancelEventAction(eventId: string) {
  const db = getAdminDb();
  try {
    const eventRef = db.collection('events').doc(eventId);
    const snap = await eventRef.get();
    if (!snap.exists) return { success: false };
    const data = snap.data()!;
    
    await eventRef.update({ status: 'Oculto', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    
    revalidatePath(`/o-que-fazer-em/${data.regionSlug}/${data.citySlug}`);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function backfillEventLocationSlugsAction() {
  const db = getAdminDb();
  try {
    const snap = await db.collection('events').get();
    let count = 0;
    
    const cityPagesRef = db.collection('cityPages');
    const processedCities = new Set<string>();
    
    let batch = db.batch();
    let opCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.status === 'Excluído') continue;

      const city = data.city || data.address?.city || data.location;
      const state = data.state || data.address?.stateRegion || data.address?.state;
      const country = data.country || data.address?.country || "Brasil";
      const countryCode = (data.countryCode || data.address?.countryCode || "br").toLowerCase();

      if (city && state) {
        const citySlug = slugifyLocation(city);
        const stateSlug = slugifyLocation(state);
        const regionSlug = `${countryCode}-${stateSlug}`;
        const cityId = `${regionSlug}-${citySlug}`

        batch.update(docSnap.ref, {
          citySlug,
          stateSlug,
          countrySlug: countryCode,
          regionSlug,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        opCount++;

        if (!processedCities.has(cityId)) {
          batch.set(cityPagesRef.doc(cityId), {
            slug: cityId,
            city: city.trim(),
            state: state.trim().toUpperCase(),
            country: country.trim(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          processedCities.add(cityId);
          opCount++;
        }

        if (opCount >= 450) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }

        count++;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return { success: true, count };
  } catch (e: any) {
    console.error("[Backfill Slugs Error]", e);
    return { success: false, error: e.message };
  }
}
