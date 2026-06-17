'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { normalizeEventDates } from '@/lib/utils';
import { slugifyLocation, buildRegionParam } from '@/lib/city-utils';
import { revalidatePath } from 'next/cache';
import { generateAndPersistCityCover } from './city-pages';
import { recordAuditLog } from './audit';

/**
 * Server Actions para gestão de eventos Viby.
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

  // Garante o registro da cidade no banco para visibilidade administrativa
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

export async function createEventAction(params: {
  orgId: string;
  userId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  
  try {
    const { eventData } = params;
    const dateNormalization = normalizeEventDates(eventData.startDate, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    await validateStripeAccount(db, params.orgId, eventData);

    const slug = await generateUniqueSlug(db, eventData.title);
    const eventRef = db.collection('events').doc();
    
    const startDate = new Date(dateNormalization.startDate);
    const endDate = new Date(dateNormalization.endDate);

    const citySlug = slugifyLocation(eventData.address.city);
    const stateSlug = slugifyLocation(eventData.address.stateRegion);
    const countrySlug = slugifyLocation(eventData.address.countryCode || "br");
    const regionSlug = buildRegionParam(countrySlug, eventData.address.stateRegion);

    const orgSnap = await db.collection('organizations').doc(params.orgId).get();
    const orgData = orgSnap.data();

    if (!orgSnap.exists) throw new Error("Organização não localizada.");

    const finalData = {
      ...eventData,
      id: eventRef.id,
      slug,
      citySlug,
      stateSlug,
      countrySlug,
      regionSlug,
      date: admin.firestore.Timestamp.fromDate(startDate),
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      organizationId: params.orgId,
      organizerId: params.userId,
      organizer: {
        id: params.orgId,
        name: orgData?.name || "Organizador",
        username: orgData?.username || "evento",
        avatar: orgData?.avatar || ""
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.set(finalData);
    
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
  
  try {
    const { eventData } = params;
    const dateNormalization = normalizeEventDates(eventData.startDate, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    await validateStripeAccount(db, params.orgId, eventData);

    const eventRef = db.collection('events').doc(params.eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error("Evento não localizado.");
    
    const oldData = eventSnap.data()!;
    const oldRegionSlug = oldData.regionSlug;
    const oldCitySlug = oldData.citySlug;

    let slug = oldData.slug;
    if (slugify(eventData.title) !== slugify(oldData.title)) {
      slug = await generateUniqueSlug(db, eventData.title, params.eventId);
    }

    const startDate = new Date(dateNormalization.startDate);
    const endDate = new Date(dateNormalization.endDate);

    const citySlug = slugifyLocation(eventData.address.city);
    const stateSlug = slugifyLocation(eventData.address.stateRegion);
    const countrySlug = slugifyLocation(eventData.address.countryCode || "br");
    const regionSlug = buildRegionParam(countrySlug, eventData.address.stateRegion);

    const updatePayload = {
      ...eventData,
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

    await eventRef.update(updatePayload);
    
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

/**
 * Manutenção: Atualiza slugs de localização e registra cidades no cityPages.
 */
export async function backfillEventLocationSlugsAction() {
  const db = getAdminDb();
  try {
    const snap = await db.collection('events').where('status', '==', 'Ativo').get();
    let count = 0;
    const batch = db.batch();
    const cityPagesRef = db.collection('cityPages');
    const processedCities = new Set<string>();

    for (const doc of snap.docs) {
      const data = doc.data();
      const city = data.city || data.address?.city;
      const state = data.state || data.address?.stateRegion;
      const country = data.country || data.address?.country || "Brasil";
      const countryCode = (data.countryCode || data.address?.countryCode || "br").toLowerCase();

      if (city && state) {
        const citySlug = slugifyLocation(city);
        const stateSlug = slugifyLocation(state);
        const regionSlug = `${countryCode}-${stateSlug}`;
        const cityId = `${regionSlug}-${citySlug}`;

        batch.update(doc.ref, {
          citySlug,
          stateSlug,
          countrySlug: countryCode,
          regionSlug,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Registrar a cidade se ainda não processada neste loop
        if (!processedCities.has(cityId)) {
          batch.set(cityPagesRef.doc(cityId), {
            slug: cityId,
            city,
            state,
            country,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          processedCities.add(cityId);
        }

        count++;
      }
    }

    if (count > 0) await batch.commit();
    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
