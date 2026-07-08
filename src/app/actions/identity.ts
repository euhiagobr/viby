'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { hashDocument, maskDocument, normalizeDocument } from '@/lib/identity-utils';

interface CreateIdentityParams {
  uid: string;
  country: string;
  documentType: string;
  documentValue: string;
  verificationLevel: 'self' | 'document_upload' | 'kyc';
}

/**
 * Cria uma nova identidade para o usuário no servidor.
 * Usa transação Firestore para atomicidade.
 */
export async function serverCreateIdentity(params: CreateIdentityParams) {
  try {
    const db = getAdminDb();
    
    const normalized = normalizeDocument(params.documentValue, params.country, params.documentType);
    const documentHash = hashDocument(params.documentValue, params.country, params.documentType);
    const documentMasked = maskDocument(params.documentValue, params.country, params.documentType);

    // Verificar duplicidade
    const existing = await db
      .collection('user_identities')
      .where('documentHash', '==', documentHash)
      .limit(1)
      .get();

    if (!existing.empty) {
      return {
        success: false,
        error: { code: 'DUPLICATE', message: 'Documento já cadastrado' },
      };
    }

    // Criar identidade
    const docRef = await db.collection('user_identities').add({
      userId: params.uid,
      country: params.country,
      documentType: params.documentType,
      documentHash,
      documentMasked,
      normalized,
      verificationStatus: 'pending',
      verificationLevel: params.verificationLevel,
      isActive: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      data: { id: docRef.id },
    };
  } catch (error: any) {
    console.error('Erro ao criar identidade:', error);
    return {
      success: false,
      error: { code: 'ERROR', message: error.message },
    };
  }
}

/**
 * Define identidade como principal (ativa).
 * Desativa todas as outras identidades do mesmo usuário.
 */
export async function serverSetPrimaryIdentity(userId: string, identityId: string) {
  try {
    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
      // Buscar todas as identidades do usuário
      const allIdentities = await transaction.get(
        db
          .collection('user_identities')
          .where('userId', '==', userId)
      );

      // Desativar todas
      for (const doc of allIdentities.docs) {
        transaction.update(doc.ref, { isActive: false });
      }

      // Ativar a selecionada
      const selectedRef = db.collection('user_identities').doc(identityId);
      transaction.update(selectedRef, { isActive: true });

      // Atualizar user.primaryIdentityId
      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, { primaryIdentityId: identityId });

      return { success: true };
    });
  } catch (error: any) {
    console.error('Erro ao definir identidade principal:', error);
    return {
      success: false,
      error: { code: 'ERROR', message: error.message },
    };
  }
}

/**
 * Remove (revoga) identidade com soft delete.
 * Não permite revogar identidade ativa.
 */
export async function serverRemoveIdentity(userId: string, identityId: string) {
  try {
    const db = getAdminDb();

    const identity = await db.collection('user_identities').doc(identityId).get();

    if (!identity.exists) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Identidade não encontrada' },
      };
    }

    const data = identity.data();

    if (data?.isActive) {
      return {
        success: false,
        error: { code: 'CANNOT_REVOKE_ACTIVE', message: 'Não é possível revogar identidade ativa' },
      };
    }

    // Soft delete
    await db.collection('user_identities').doc(identityId).update({
      verificationStatus: 'revoked',
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao revogar identidade:', error);
    return {
      success: false,
      error: { code: 'ERROR', message: error.message },
    };
  }
}

/**
 * Lista todas as identidades do usuário.
 */
export async function serverListUserIdentities(userId: string) {
  try {
    const db = getAdminDb();

    const snapshot = await db
      .collection('user_identities')
      .where('userId', '==', userId)
      .orderBy('isActive', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    const identities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
    }));

    return {
      success: true,
      data: identities,
    };
  } catch (error: any) {
    console.error('Erro ao listar identidades:', error);
    return {
      success: false,
      error: { code: 'ERROR', message: error.message },
      data: [],
    };
  }
}
