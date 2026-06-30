
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { revalidatePath } from 'next/cache';

/**
 * Utilitário para serialização segura para o Next.js 15.
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

export async function getOrCreateExperienceDraftAction(userId: string, orgId: string) {
  const db = getAdminDb();
  try {
    const draftQuery = await db.collection('experiences')
      .where('createdBy', '==', userId)
      .where('organizationId', '==', orgId)
      .where('status', '==', 'draft')
      .limit(1)
      .get();

    if (!draftQuery.empty) {
      const draft = draftQuery.docs[0];
      return serializeData({ success: true, id: draft.id, ...draft.data() });
    }

    const newDraftRef = db.collection('experiences').doc();
    const initialData = {
      id: newDraftRef.id,
      title: "",
      slug: "",
      shortDescription: "",
      description: "",
      image: "",
      gallery: [],
      price: 0,
      capacity: 100,
      additionalInfo: "",
      usagePolicy: "",
      status: 'draft',
      organizationId: orgId,
      createdBy: userId,
      address: {
        country: "Brasil",
        countryCode: "BR"
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

export async function saveExperienceAction(id: string, data: any) {
  const db = getAdminDb();
  try {
    const updateData = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (data.title && !data.slug) {
      updateData.slug = slugify(data.title);
    }

    if (data.address) {
      updateData.city = data.address.city || "";
      updateData.state = data.address.stateRegion || "";
      updateData.latitude = data.address.latitude || null;
      updateData.longitude = data.address.longitude || null;
    }

    await db.collection('experiences').doc(id).update(updateData);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function publishExperienceAction(id: string, finalData: any) {
  const db = getAdminDb();
  try {
    const expRef = db.collection('experiences').doc(id);
    const orgSnap = await db.collection('organizations').doc(finalData.organizationId).get();
    const org = orgSnap.exists ? orgSnap.data() : null;

    const slug = finalData.slug || slugify(finalData.title);

    if (!finalData.address?.latitude || !finalData.address?.longitude) {
      throw new Error("A localização geográfica é obrigatória para publicar uma experiência.");
    }

    const updatePayload = {
      ...finalData,
      slug,
      status: 'active',
      organizer: {
        id: finalData.organizationId,
        name: org?.name || "Organizador",
        username: org?.username || "marca",
        avatar: org?.avatar || ""
      },
      city: finalData.address.city || "",
      state: finalData.address.stateRegion || "",
      latitude: finalData.address.latitude,
      longitude: finalData.address.longitude,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await expRef.update(updatePayload);
    revalidatePath('/');
    return { success: true, slug, username: org?.username };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteExperienceAction(id: string) {
  const db = getAdminDb();
  try {
    // Delete slots too
    const slotsSnap = await db.collection('experiences').doc(id).collection('slots').get();
    const batch = db.batch();
    slotsSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('experiences').doc(id));
    await batch.commit();
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function duplicateExperienceAction(id: string, userId: string) {
  const db = getAdminDb();
  try {
    const sourceSnap = await db.collection('experiences').doc(id).get();
    if (!sourceSnap.exists) throw new Error("Fonte não encontrada.");
    
    const sourceData = sourceSnap.data()!;
    const newRef = db.collection('experiences').doc();
    
    const duplicateData = {
      ...sourceData,
      id: newRef.id,
      title: `${sourceData.title} (Cópia)`,
      slug: `${sourceData.slug}-copia-${Date.now().toString().slice(-4)}`,
      status: 'draft',
      createdBy: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newRef.set(duplicateData);
    return { success: true, id: newRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * ACTIONS DE SLOTS (ETAPA 3)
 */

export async function createExperienceSlotAction(experienceId: string, data: any) {
  const db = getAdminDb();
  try {
    const slotRef = db.collection('experiences').doc(experienceId).collection('slots').doc();
    const slotData = {
      ...data,
      id: slotRef.id,
      experienceId,
      sold: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await slotRef.set(slotData);
    return { success: true, id: slotRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateExperienceSlotAction(experienceId: string, slotId: string, data: any) {
  const db = getAdminDb();
  try {
    await db.collection('experiences').doc(experienceId).collection('slots').doc(slotId).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteExperienceSlotAction(experienceId: string, slotId: string) {
  const db = getAdminDb();
  try {
    await db.collection('experiences').doc(experienceId).collection('slots').doc(slotId).delete();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
