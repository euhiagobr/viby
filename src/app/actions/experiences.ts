'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { slugify } from '@/lib/slug-utils';
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
 * Busca um rascunho ativo ou cria um novo para a experiência.
 */
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
      duration: { value: 1, unit: 'horas' },
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

/**
 * Salva o estado atual da experiência.
 */
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

/**
 * Publica uma experiência garantindo que tenha pelo menos um slot ativo.
 */
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

/**
 * Cria uma reserva temporária (lock) de vaga para o checkout.
 */
export async function createExperienceReservationAction(params: {
  experienceId: string;
  slotId: string;
  userId: string;
  quantity: number;
}) {
  const db = getAdminDb();
  try {
    return await db.runTransaction(async (transaction) => {
      const slotRef = db.collection('experiences').doc(params.experienceId).collection('slots').doc(params.slotId);
      const slotSnap = await transaction.get(slotRef);
      
      if (!slotSnap.exists) throw new Error("Horário não encontrado.");
      const slotData = slotSnap.data()!;

      // 1. Calcular reservas ativas (não expiradas e não convertidas)
      const activeResSnap = await db.collection('experience_reservations')
        .where('slotId', '==', params.slotId)
        .where('status', '==', 'reserved')
        .where('expiresAt', '>', admin.firestore.Timestamp.now())
        .get();
      
      const reservedCount = activeResSnap.docs.reduce((acc, d) => acc + (d.data().quantity || 0), 0);
      const available = (slotData.capacity || 0) - (slotData.sold || 0) - reservedCount;

      if (available < params.quantity) {
        throw new Error("Não há vagas suficientes para este horário.");
      }

      // 2. Criar reserva (Lock de 10 minutos)
      const resRef = db.collection('experience_reservations').doc();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const reservationData = {
        id: resRef.id,
        experienceId: params.experienceId,
        slotId: params.slotId,
        userId: params.userId,
        quantity: params.quantity,
        status: 'reserved',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(resRef, reservationData);
      return { success: true, reservationId: resRef.id };
    });
  } catch (e: any) {
    console.error("[Reservation Action Error]", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Processa o envio de uma avaliação real de experiência.
 */
export async function submitExperienceReviewAction(params: any) {
  const db = getAdminDb();
  try {
    // 1. Moderação Automática
    const { validateReviewContent } = await import('@/lib/moderation/service');
    const moderation = validateReviewContent({
       title: params.title,
       text: params.fullExperience,
       likedMost: params.likedMost,
       canImprove: params.canImprove
    });

    if (!moderation.isValid) {
      return { success: false, error: moderation.reason };
    }

    // 2. Salvar Review
    const reviewRef = db.collection('experience_reviews').doc();
    await reviewRef.set({
      ...params,
      id: reviewRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Atualizar Metadados da Experiência (Ranking e Média)
    const expRef = db.collection('experiences').doc(params.experienceId);
    await db.runTransaction(async (transaction) => {
      const expSnap = await transaction.get(expRef);
      if (expSnap.exists()) {
        const data = expSnap.data()!;
        const oldCount = data.reviewCount || 0;
        const oldAvg = data.averageRating || 5.0;
        const newCount = oldCount + 1;
        const newAvg = Number(((oldAvg * oldCount + params.generalRating) / newCount).toFixed(1));
        
        const dist = data.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        dist[params.generalRating.toString()] = (dist[params.generalRating.toString()] || 0) + 1;

        transaction.update(expRef, {
          reviewCount: newCount,
          averageRating: newAvg,
          ratingDistribution: dist,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    // 4. Marcar ingresso como avaliado
    await db.collection('registrations').doc(params.registrationId).update({
      ratingSubmitted: true,
      ratingValue: params.generalRating,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
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

/**
 * Processa a exclusão de uma experiência.
 * REGRA: Se houver vendas, apenas oculta para preservar vouchers. Se não houver, apaga permanentemente.
 */
export async function deleteExperienceAction(id: string) {
  const db = getAdminDb();
  try {
    // 1. Verificar se existem vendas (incluindo confirmadas e pendentes)
    const salesSnap = await db.collection('registrations')
      .where('eventId', '==', id)
      .where('productType', '==', 'experience')
      .limit(1)
      .get();
    
    const expRef = db.collection('experiences').doc(id);

    if (!salesSnap.empty) {
      // Caso 1: Vendas detectadas. Soft Delete.
      await expRef.update({ 
        status: 'deleted', 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      revalidatePath('/');
      return { success: true, mode: 'soft' };
    } else {
      // Caso 2: Sem vendas. Hard Delete (Limpeza profunda).
      const slotsSnap = await expRef.collection('slots').get();
      const batch = db.batch();
      
      // Limpar todos os slots vinculados
      slotsSnap.forEach(s => batch.delete(s.ref));
      // Apagar o documento principal
      batch.delete(expRef);
      
      await batch.commit();
      revalidatePath('/');
      return { success: true, mode: 'hard' };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function duplicateExperienceAction(id: string, userId: string) {
  const db = getAdminDb();
  try {
    const originalSnap = await db.collection('experiences').doc(id).get();
    if (!originalSnap.exists) throw new Error("Original not found.");
    
    const data = originalSnap.data()!;
    const newRef = db.collection('experiences').doc();
    
    const duplicateData = {
      ...data,
      id: newRef.id,
      title: `${data.title} (Cópia)`,
      slug: slugify(`${data.title} (Cópia)`),
      status: 'draft',
      createdBy: userId,
      reviewCount: 0,
      averageRating: 5.0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newRef.set(duplicateData);
    return { success: true, id: newRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
