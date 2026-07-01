
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
import { revalidatePath } from 'next/cache';

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
      category: "",
      shortDescription: "",
      description: "",
      image: "",
      gallery: [],
      characteristics: [],
      inclusions: [],
      exclusions: [],
      rules: [],
      faqs: [],
      duration: "",
      maxGroupSize: null,
      confirmationType: 'immediate',
      voucherType: 'qrcode',
      digitalVoucher: true,
      status: 'draft',
      organizationId: orgId,
      createdBy: userId,
      averageRating: 5.0,
      reviewCount: 0,
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
    
    if (data.title) {
      updateData.slug = slugify(data.title);
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
    
    const slotsSnap = await expRef.collection('slots').where('status', '==', 'active').limit(1).get();
    if (slotsSnap.empty) {
      throw new Error("Adicione pelo menos um horário na agenda para publicar.");
    }

    const orgSnap = await db.collection('organizations').doc(finalData.organizationId).get();
    const org = orgSnap.exists ? orgSnap.data() : null;

    const updatePayload = {
      ...finalData,
      status: 'active',
      organizer: {
        id: finalData.organizationId,
        name: org?.name || "Organizador",
        username: org?.username || "marca",
        avatar: org?.avatar || ""
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await expRef.update(updatePayload);
    revalidatePath('/');
    return { success: true, slug: finalData.slug, username: org?.username };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createExperienceSlotAction(experienceId: string, data: any) {
  const db = getAdminDb();
  try {
    const slotRef = db.collection('experiences').doc(experienceId).collection('slots').doc();
    await slotRef.set({
      ...data,
      id: slotRef.id,
      experienceId,
      sold: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: slotRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
