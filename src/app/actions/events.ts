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
 * Publica um evento a partir de um rascunho.
 * Valida obrigatoriedade de Stripe Connect para eventos pagos.
 */
export async function publishEventAction(eventId: string, finalData: any) {
  const db = getAdminDb();
  try {
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) throw new Error("Rascunho não encontrado.");
    
    const draftData = eventSnap.data() || {};
    const orgId = finalData.organizationId || draftData.organizationId;
    
    // Buscar dados reais da organização
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const orgData = orgSnap.exists ? orgSnap.data() : null;

    // Validação de paridade: Exige Stripe Connect para publicação de itens pagos
    const isPaid = (finalData.type === 'interno') && (finalData.batches?.some((b: any) => b.ticketTypes?.some((t: any) => (t.price || 0) > 0)) || false);
    if (isPaid && !orgData?.stripeAccountId) {
      throw new Error("Para publicar eventos pagos, é necessário concluir a configuração da sua conta Stripe Connect para receber pagamentos.");
    }

    const title = finalData.title || "";
    const baseSlug = slugify(title);
    
    const city = finalData.city || finalData.address?.city || "";
    const state = finalData.address?.stateRegion || "";
    const countryCode = (finalData.address?.countryCode || "br").toLowerCase();
    
    const citySlug = slugifyLocation(city);
    const regionSlug = buildRegionParam(countryCode, state);

    const startStr = finalData.startDate || finalData.date || null;
    const eventDate = startStr ? admin.firestore.Timestamp.fromDate(new Date(startStr)) : null;

    const updatePayload: any = {
      ...finalData,
      organizationId: orgId,
      organizer: {
        id: orgId,
        name: orgData?.name || "Organizador",
        username: orgData?.username || "evento",
        avatar: orgData?.avatar || ""
      },
      title,
      city,
      date: eventDate, 
      status: finalData.status || 'Ativo',
      slug: baseSlug,
      citySlug,
      regionSlug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Limpeza de rascunho
      data: admin.firestore.FieldValue.delete(),
      step: admin.firestore.FieldValue.delete()
    };

    await eventRef.update(updatePayload);
    
    revalidatePath('/');
    return { 
      success: true, 
      id: eventId, 
      slug: baseSlug, 
      username: orgData?.username || 'evento' 
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Atualiza um evento existente.
 */
export async function updateEventAction(params: {
  eventId: string;
  orgId: string;
  eventData: any;
}) {
  const db = getAdminDb();
  try {
    const { eventId, orgId, eventData } = params;
    
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const orgData = orgSnap.exists ? orgSnap.data() : null;

    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error("Evento não localizado.");

    const oldData = eventSnap.data()!;

    // Validação de paridade: Exige Stripe Connect para publicação de itens pagos
    const isPaid = (eventData.type === 'interno') && (eventData.batches?.some((b: any) => b.ticketTypes?.some((t: any) => (t.price || 0) > 0)) || false);
    if (isPaid && !orgData?.stripeAccountId) {
      throw new Error("Para publicar eventos pagos, é necessário concluir a configuração da sua conta Stripe Connect para receber pagamentos.");
    }

    let slug = eventData.slug || oldData.slug || slugify(eventData.title);
    
    const startStr = eventData.startDate || eventData.date;
    const eventDate = startStr ? admin.firestore.Timestamp.fromDate(new Date(startStr)) : null;

    const updatePayload = {
      ...eventData,
      organizer: {
        id: orgId,
        name: orgData?.name || oldData.organizer?.name,
        username: orgData?.username || oldData.organizer?.username,
        avatar: orgData?.avatar || oldData.organizer?.avatar
      },
      date: eventDate, 
      status: eventData.status || oldData.status || 'Ativo',
      slug,
      // Sincroniza campos de endereço para facilitar consumo pelo Frontend
      location: eventData.location || (eventData.address?.venueName || eventData.address?.addressLine1) || oldData.location,
      city: eventData.city || eventData.address?.city || oldData.city,
      state: eventData.state || eventData.address?.stateRegion || oldData.state,
      countryCode: eventData.countryCode || eventData.address?.countryCode || oldData.countryCode,
      latitude: (eventData.address && eventData.address.latitude) || oldData.latitude,
      longitude: (eventData.address && eventData.address.longitude) || oldData.longitude,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await eventRef.update(updatePayload);
    
    revalidatePath('/');
    return serializeData({ success: true, slug, username: orgData?.username || oldData.organizer?.username });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function backfillEventLocationSlugsAction() {
  const db = getAdminDb();
  try {
    const snap = await db.collection('events').where('status', '==', 'Ativo').get();
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
