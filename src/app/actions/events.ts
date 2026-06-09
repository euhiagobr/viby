'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';

/**
 * @fileOverview Server Actions para gestão de eventos com geração de slug único.
 */

async function generateUniqueSlug(db: admin.firestore.Firestore, orgId: string, title: string, currentEventId?: string) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const snap = await db.collection('events')
      .where('organizationId', '==', orgId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    // Se não encontrou nada, ou o que encontrou é o próprio evento (em caso de update), o slug está livre
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
    const slug = await generateUniqueSlug(db, params.orgId, params.eventData.title);
    
    const eventRef = db.collection('events').doc();
    const finalData = {
      ...params.eventData,
      id: eventRef.id,
      slug,
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
    const eventRef = db.collection('events').doc(params.eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) throw new Error("Evento não localizado.");
    const oldData = eventSnap.data()!;

    // Só recalcula slug se o título mudar
    let slug = oldData.slug;
    if (slugify(params.eventData.title) !== slugify(oldData.title)) {
      slug = await generateUniqueSlug(db, params.orgId, params.eventData.title, params.eventId);
    }

    const updatePayload = {
      ...params.eventData,
      slug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.update(updatePayload);

    return { success: true, slug };
  } catch (e: any) {
    console.error("[Events Action] Update Failure:", e.message);
    return { success: false, error: e.message };
  }
}
