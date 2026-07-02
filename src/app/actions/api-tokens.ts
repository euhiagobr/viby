
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';

/**
 * @fileOverview Server Actions para gestão de Tokens de API.
 */

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createApiTokenAction(params: {
  name: string;
  description?: string;
  adminUid: string;
}) {
  const db = getAdminDb();
  
  try {
    // 1. Gerar token seguro
    const randomPart = crypto.randomBytes(32).toString('hex');
    const fullToken = `viby_live_${randomPart}`;
    const hashedToken = hashToken(fullToken);
    const suffix = fullToken.slice(-4);

    // 2. Persistir Hash no Firestore
    const tokenRef = db.collection('api_tokens').doc();
    const tokenData = {
      id: tokenRef.id,
      name: params.name,
      description: params.description || "",
      hash: hashedToken,
      prefix: "viby_live_",
      suffix: suffix,
      status: 'active',
      requestCount: 0,
      lastUsedAt: null,
      permissions: {
        "tickets.find": true
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: params.adminUid
    };

    await tokenRef.set(tokenData);

    // Retorna o token em texto puro apenas desta vez
    return { success: true, token: fullToken, id: tokenRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function toggleTokenStatusAction(tokenId: string, status: 'active' | 'revoked') {
  const db = getAdminDb();
  try {
    await db.collection('api_tokens').doc(tokenId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteApiTokenAction(tokenId: string) {
  const db = getAdminDb();
  try {
    await db.collection('api_tokens').doc(tokenId).delete();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
