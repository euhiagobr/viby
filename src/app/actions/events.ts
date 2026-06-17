'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { normalizeEventDates } from '@/lib/utils';
import { slugifyLocation, buildRegionParam } from '@/lib/city-utils';
import { revalidatePath } from 'next/cache';

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

    await eventRef.update({ slug, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
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
  const { eventId, targetOrgUsername, adminUid, adminName } = params;

  try {
    const cleanUsername = targetOrgUsername.toLowerCase().trim().replace('@', '');
    return await db.runTransaction(async (transaction) => {
      const orgRef = db.collection('organizations').where('username', '==', cleanUsername).limit(1);
      const orgSnap = await transaction.get(orgRef);
      if (orgSnap.empty) throw new Error("Organização destino não localizada.");
      const targetOrg = { id: orgSnap.docs[0].id, ...orgSnap.docs[0].data() } as any;

      const eventRef = db.collection('events').doc(eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) throw new Error("Evento não localizado.");
      const eventData = eventSnap.data()!;

      transaction.update(eventRef, {
        organizationId: targetOrg.id,
        organizerId: targetOrg.ownerId || eventData.organizerId,
        organizer: {
          id: targetOrg.id,
          name: targetOrg.name,
          username: targetOrg.username,
          avatar: targetOrg.avatar || ""
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, newUrl: `/${targetOrg.username}/${eventData.slug}` };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Manutenção: Atualiza os campos regionSlug e citySlug de todos os eventos ativos.
 * Essencial para habilitar SEO em registros legados.
 */
export async function backfillEventLocationSlugsAction() {
  const db = getAdminDb();
  try {
    const snap = await db.collection('events').where('status', '==', 'Ativo').get();
    let count = 0;
    const batch = db.batch();

    for (const doc of snap.docs) {
      const data = doc.data();
      const city = data.city || data.address?.city;
      const state = data.state || data.address?.stateRegion;
      const countryCode = (data.countryCode || data.address?.countryCode || "br").toLowerCase();

      if (city && state) {
        const citySlug = slugifyLocation(city);
        const stateSlug = slugifyLocation(state);
        const regionSlug = `${countryCode}-${stateSlug}`;

        batch.update(doc.ref, {
          citySlug,
          stateSlug,
          countrySlug: countryCode,
          regionSlug,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
      }
    }

    if (count > 0) await batch.commit();
    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
