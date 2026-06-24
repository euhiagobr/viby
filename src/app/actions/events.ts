
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
 * Busca um rascunho ativo para o usuário ou cria um novo se não existir.
 */
export async function getOrCreateDraftAction(userId: string, orgId: string) {
  const db = getAdminDb();
  try {
    const draftQuery = await db.collection('events')
      .where('userId', '==', userId)
      .where('status', '==', 'draft')
      .limit(1)
      .get();

    if (!draftQuery.empty) {
      const draft = draftQuery.docs[0];
      return { success: true, id: draft.id, ...draft.data() };
    }

    // Criar novo rascunho
    const newDraftRef = db.collection('events').doc();
    const initialData = {
      id: newDraftRef.id,
      userId,
      organizationId: orgId,
      status: 'draft',
      step: 1,
      data: {
        title: "",
        description: "",
        tags: [],
        address: { country: "Brasil", countryCode: "BR" }
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newDraftRef.set(initialData);
    return { success: true, ...initialData };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Salva o estado atual do rascunho.
 */
export async function saveDraftAction(eventId: string, step: number, data: any) {
  const db = getAdminDb();
  try {
    await db.collection('events').doc(eventId).update({
      step,
      data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Publica um evento a partir de um rascunho.
 */
export async function publishEventAction(eventId: string, finalData: any) {
  const db = getAdminDb();
  try {
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) throw new Error("Rascunho não encontrado.");
    
    const { data: draftData } = eventSnap.data() as any;
    const orgId = eventSnap.data()?.organizationId;

    // Normalização para compatibilidade com sistema atual
    const title = finalData.title || draftData.title;
    const baseSlug = slugify(title);
    
    const city = finalData.address?.city || "";
    const state = finalData.address?.stateRegion || "";
    const countryCode = (finalData.address?.countryCode || "br").toLowerCase();
    
    const citySlug = slugifyLocation(city);
    const regionSlug = buildRegionParam(countryCode, state);

    const updatePayload = {
      ...finalData,
      status: 'published', // Transição de estado
      slug: baseSlug,
      citySlug,
      regionSlug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.update(updatePayload);
    
    revalidatePath('/');
    return { success: true, id: eventId, slug: baseSlug };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Mantendo funções legadas para compatibilidade de edição direta
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

    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error("Evento não localizado.");

    const oldData = eventSnap.data()!;
    let slug = oldData.slug;
    
    const updatePayload = {
      ...eventData,
      status: oldData.status === 'draft' ? 'published' : oldData.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.update(eventRef, updatePayload);
    await batch.commit();
    
    revalidatePath('/');
    return { success: true, slug, username: oldData.organizer?.username };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
