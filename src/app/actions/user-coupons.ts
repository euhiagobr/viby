
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { revalidatePath } from 'next/cache';

export async function upsertUserCoupon(params: {
  userId: string;
  username: string;
  eventId: string;
  discountValue: number;
  active: boolean;
}) {
  const db = getAdminDb();
  const { userId, username, eventId, discountValue, active } = params;

  try {
    const couponRef = db.collection('user_coupons').doc(userId);
    const snap = await couponRef.get();

    const data: any = {
      userId,
      code: username.toUpperCase(),
      eventId,
      discountValue,
      status: active ? 'active' : 'inactive',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!snap.exists) {
      data.uses = 0;
      data.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await couponRef.set(data);
    } else {
      await couponRef.update(data);
    }

    // Sincroniza flag no usuário para facilitar queries
    await db.collection('users').doc(userId).update({
      hasUserCoupon: active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteUserCoupon(userId: string) {
  const db = getAdminDb();
  try {
    await db.collection('user_coupons').doc(userId).delete();
    await db.collection('users').doc(userId).update({
      hasUserCoupon: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
