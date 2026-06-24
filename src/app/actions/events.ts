
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { normalizeEventDates } from '@/lib/utils';
import { slugifyLocation, buildRegionParam } from '@/lib/city-utils';
import { revalidatePath } from 'next/cache';

/**
 * Utilitário para converter objetos complexos (Timestamps) em tipos primitivos
 * para tráfego seguro entre Server e Client Components no Next.js 15.
 */
function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) return String(data);
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }
  return data;
}

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
      return serializeData({ success: true, id: draft.id, ...draft.data() });
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
    return serializeData({ success: true, ...initialData });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Salva o estado atual do rascunho de forma incremental.
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
 * Publica um evento a partir de um rascunho, "achatando" os dados no nível raiz do documento.
 * Normaliza a data para um Timestamp real do Firestore.
 */
export async function publishEventAction(eventId: string, finalData: any) {
  const db = getAdminDb();
  try {
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) throw new Error("Rascunho não encontrado.");
    
    const draftData = eventSnap.data()?.data || {};

    const title = finalData.title || draftData.title || "";
    const baseSlug = slugify(title);
    
    const city = finalData.address?.city || draftData.address?.city || "";
    const state = finalData.address?.stateRegion || draftData.address?.stateRegion || "";
    const countryCode = (finalData.address?.countryCode || draftData.address?.countryCode || "br").toLowerCase();
    
    const citySlug = slugifyLocation(city);
    const regionSlug = buildRegionParam(countryCode, state);

    // Normalização de Data: Converter String ISO do formulário para Timestamp do Firestore
    const startStr = finalData.startDate || finalData.date || draftData.startDate || draftData.date || null;
    const eventDate = startStr ? admin.firestore.Timestamp.fromDate(new Date(startStr)) : null;

    const updatePayload: any = {
      ...finalData,
      date: eventDate, 
      status: 'published',
      slug: baseSlug,
      citySlug,
      regionSlug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Limpeza de campos de rascunho
      data: admin.firestore.FieldValue.delete(),
      step: admin.firestore.FieldValue.delete()
    };

    await eventRef.update(updatePayload);
    
    revalidatePath('/');
    return { success: true, id: eventId, slug: baseSlug };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Utilitário de manutenção para popular slugs de localização em eventos antigos.
 */
export async function backfillEventLocationSlugsAction() {
  const db = getAdminDb();
  try {
    const snap = await db.collection('events').where('status', 'in', ['Ativo', 'published']).get();
    const batch = db.batch();
    let count = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.citySlug || !data.regionSlug) {
        const city = data.city || data.address?.city || "";
        const state = data.state || data.address?.stateRegion || "";
        const countryCode = (data.countryCode || data.address?.countryCode || "br").toLowerCase();
        
        const citySlug = slugifyLocation(city);
        const regionSlug = buildRegionParam(countryCode, state);
        
        batch.update(docSnap.ref, { citySlug, regionSlug });
        count++;
      }
    });

    if (count > 0) await batch.commit();
    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Atualiza o slug de um evento manualmente.
 */
export async function updateEventSlugAction(params: { eventId: string, orgId: string, manualSlug: string }) {
  const db = getAdminDb();
  try {
    const slug = slugify(params.manualSlug);
    const eventRef = db.collection('events').doc(params.eventId);
    
    await eventRef.update({ 
      slug, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    
    return { success: true, slug };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Transfere a propriedade de um evento para outra organização.
 */
export async function transferEventAction(params: { eventId: string, targetOrgUsername: string, adminUid: string, adminName: string }) {
  const db = getAdminDb();
  try {
    const orgSnap = await db.collection('organizations').where('username', '==', params.targetOrgUsername).limit(1).get();
    if (orgSnap.empty) throw new Error("Organização destino não encontrada.");
    
    const targetOrg = orgSnap.docs[0].data();
    const eventRef = db.collection('events').doc(params.eventId);
    const oldSnap = await eventRef.get();
    const oldData = oldSnap.data()!;

    const batch = db.batch();
    
    batch.update(eventRef, {
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

    const logRef = db.collection('event_transfer_audit').doc();
    batch.set(logRef, {
      eventId: params.eventId,
      eventName: oldData.title,
      oldOrganizationId: oldData.organizationId,
      oldOrganizationName: oldData.organizer?.name || "N/A",
      oldOrganizationUsername: oldData.organizer?.username || "N/A",
      newOrganizationId: targetOrg.id,
      newOrganizationName: targetOrg.name,
      newOrganizationUsername: targetOrg.username,
      adminUid: params.adminUid,
      adminName: params.adminName,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return { success: true };
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
    const dateNormalization = normalizeEventDates(eventData.startDate || eventData.date, eventData.endDate);
    if (!dateNormalization.isValid) throw new Error(dateNormalization.error);

    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error("Evento não localizado.");

    const oldData = eventSnap.data()!;
    let slug = oldData.slug;
    
    // Normalização de Data para Timestamp
    const startStr = eventData.startDate || eventData.date;
    const eventDate = startStr ? admin.firestore.Timestamp.fromDate(new Date(startStr)) : null;

    const updatePayload = {
      ...eventData,
      date: eventDate, 
      status: oldData.status === 'draft' ? 'published' : oldData.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.update(eventRef, updatePayload);
    await batch.commit();
    
    revalidatePath('/');
    return serializeData({ success: true, slug, username: oldData.organizer?.username });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
