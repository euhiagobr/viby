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
      category: "",
      image: "",
      gallery: [],
      price: 0,
      capacity: 100,
      additionalInfo: "",
      usagePolicy: "",
      status: 'draft',
      organizationId: orgId,
      createdBy: userId,
      averageRating: 5.0,
      reviewCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendationStats: { sim: 0, talvez: 0, nao: 0 },
      availability: {
        startDate: "",
        endDate: "",
        allowedDays: [0, 1, 2, 3, 4, 5, 6],
        allowHolidays: true,
        baseWindows: []
      },
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
    
    if (!finalData.category) throw new Error("A categoria é obrigatória.");
    if (!finalData.address?.latitude || !finalData.address?.longitude) {
      throw new Error("A localização geográfica é obrigatória para publicar.");
    }
    if (!finalData.availability?.startDate) throw new Error("A data de início é obrigatória.");

    const slotsSnap = await expRef.collection('slots').where('status', '==', 'active').limit(1).get();
    if (slotsSnap.empty) {
      throw new Error("Adicione pelo menos um horário disponível na aba 'Horários' para publicar.");
    }

    const orgSnap = await db.collection('organizations').doc(finalData.organizationId).get();
    const org = orgSnap.exists ? orgSnap.data() : null;

    const slug = finalData.slug || slugify(finalData.title);

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
      averageRating: 5.0,
      reviewCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendationStats: { sim: 0, talvez: 0, nao: 0 },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newRef.set(duplicateData);
    return { success: true, id: newRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

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

export async function createExperienceReservationAction(params: {
  experienceId: string;
  slotId: string;
  userId: string;
  quantity: number;
}) {
  const db = getAdminDb();
  const { experienceId, slotId, userId, quantity } = params;

  try {
    return await db.runTransaction(async (transaction) => {
      const slotRef = db.collection('experiences').doc(experienceId).collection('slots').doc(slotId);
      
      const slotSnap = await transaction.get(slotRef);
      if (!slotSnap.exists) throw new Error("Horário não localizado.");
      const slot = slotSnap.data()!;
      if (slot.status !== 'active') throw new Error("Este horário não está mais disponível.");

      const now = new Date();
      const activeReservationsQuery = db.collection('experience_reservations')
        .where('slotId', '==', slotId)
        .where('status', '==', 'reserved')
        .where('expiresAt', '>', admin.firestore.Timestamp.fromDate(now));
      
      const activeReservationsSnap = await transaction.get(activeReservationsQuery);

      const currentlyReserved = activeReservationsSnap.docs.reduce((acc, doc) => acc + (doc.data().quantity || 0), 0);
      const sold = slot.sold || 0;
      const capacity = slot.capacity || 0;

      if (sold + currentlyReserved + quantity > capacity) {
        throw new Error("Desculpe, este horário acabou de esgotar ou está sendo reservado por outros usuários.");
      }

      const reservationRef = db.collection('experience_reservations').doc();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); 

      const reservationData = {
        id: reservationRef.id,
        experienceId,
        slotId,
        userId,
        quantity,
        status: 'reserved',
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(reservationRef, reservationData);

      return serializeData({ success: true, reservationId: reservationRef.id, expiresAt });
    });
  } catch (e: any) {
    console.error("[Reservation Action] Failure:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Submete uma avaliação detalhada de experiência.
 * Agora atualiza estatísticas de recomendação e distribuição de notas.
 */
export async function submitExperienceReviewAction(params: {
  registrationId: string;
  experienceId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  generalRating: number;
  detailedRatings: {
    org: number;
    service: number;
    quality: number;
    price: number;
    environment: number;
  };
  recommend: string;
  match: string;
  return: string;
  targets: string[];
  title: string;
  likedMost: string;
  canImprove: string;
  fullExperience: string;
  photos: string[];
  video?: string;
}) {
  const db = getAdminDb();
  const { registrationId, experienceId, generalRating, recommend } = params;

  try {
    return await db.runTransaction(async (transaction) => {
      const regRef = db.collection('registrations').doc(registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists) throw new Error("Voucher não encontrado.");
      if (regSnap.data()?.ratingSubmitted) throw new Error("Este voucher já foi avaliado.");

      const expRef = db.collection('experiences').doc(experienceId);
      const expSnap = await transaction.get(expRef);
      if (!expSnap.exists) throw new Error("Experiência não encontrada.");

      const expData = expSnap.data()!;
      const currentAvg = expData.averageRating || 5.0;
      const currentCount = expData.reviewCount || 0;
      const currentDist = expData.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const currentRec = expData.recommendationStats || { sim: 0, talvez: 0, nao: 0 };

      // 1. Geração de Badges Automáticas
      const badges = [];
      const dr = params.detailedRatings;
      if (dr.service >= 4.5) badges.push("✨ Excelente atendimento");
      if (dr.price >= 4.5) badges.push("💰 Ótimo custo-benefício");
      if (recommend === 'sim') badges.push("🔥 Muito recomendado");
      if (dr.environment >= 4.5) badges.push("🌿 Ambiente agradável");
      if (dr.quality >= 4.5) badges.push("🎯 Cumpre o que promete");
      if (generalRating === 5) badges.push("⭐ Experiência premium");
      if (dr.org >= 4.5) badges.push("🏆 Organização impecável");

      // 2. Cálculo de Média e Distribuição
      const newCount = currentCount + 1;
      const newAvg = Number(((currentAvg * currentCount + generalRating) / newCount).toFixed(1));
      
      const newDist = { ...currentDist };
      const ratingKey = generalRating.toString();
      newDist[ratingKey] = (newDist[ratingKey] || 0) + 1;

      // 3. Atualizar Recomendações
      const newRec = { ...currentRec };
      const recKey = recommend as keyof typeof currentRec;
      if (newRec[recKey] !== undefined) {
        newRec[recKey] = (newRec[recKey] || 0) + 1;
      }

      // 4. Salvar Review
      const reviewRef = db.collection('experience_reviews').doc(registrationId);
      transaction.set(reviewRef, {
        ...params,
        badges,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Atualizar Experiência
      transaction.update(expRef, {
        averageRating: newAvg,
        reviewCount: newCount,
        ratingDistribution: newDist,
        recommendationStats: newRec,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 6. Marcar Voucher como avaliado
      transaction.update(regRef, {
        ratingSubmitted: true,
        ratingValue: generalRating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    });
  } catch (e: any) {
    console.error("[Review Action] Error:", e.message);
    return { success: false, error: e.message };
  }
}
