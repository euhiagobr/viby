/**
 * @fileOverview Serviço centralizado para gerenciar identidades internacionais
 * Fornece operações CRUD, validação e gerenciamento de identidades de usuários.
 * NUNCA armazena ou loga documento completo.
 */

import {
  hashDocument,
  maskDocument,
  normalizeDocument,
  isValidDocumentFormat,
  isSupportedCountry,
  isSupportedDocumentType,
} from './identity-utils';
import {
  getValidationRule,
} from './identity-validation';

// ============================================================================
// TIPOS
// ============================================================================

export interface Identity {
  id?: string;
  userId: string;
  country: string;
  documentType: string;
  documentHash: string;
  documentMasked: string;
  verificationStatus: 'pending' | 'verified' | 'expired' | 'revoked';
  verificationLevel: 'self' | 'document_upload' | 'kyc';
  isActive: boolean;
  expiresAt?: any | null;
  createdAt?: any;
  updatedAt?: any;
  verifiedAt?: any | null;
}

export interface CreateIdentityParams {
  userId: string;
  country: string;
  documentType: string;
  documentValue: string;
  verificationLevel?: 'self' | 'document_upload' | 'kyc';
  transaction?: any;
}

export interface IdentityServiceError {
  code: string;
  message: string;
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Valida parâmetros de entrada antes de operações.
 * NUNCA retorna o documento no erro.
 */
function validateCreateParams(params: CreateIdentityParams): IdentityServiceError | null {
  if (!params.userId || typeof params.userId !== 'string') {
    return { code: 'INVALID_USER_ID', message: 'userId inválido' };
  }

  if (!isSupportedCountry(params.country)) {
    return { code: 'UNSUPPORTED_COUNTRY', message: `País não suportado: ${params.country}` };
  }

  if (!isSupportedDocumentType(params.country, params.documentType)) {
    return {
      code: 'UNSUPPORTED_DOCUMENT_TYPE',
      message: `Tipo de documento não suportado para ${params.country}`,
    };
  }

  if (!params.documentValue || typeof params.documentValue !== 'string') {
    return { code: 'INVALID_DOCUMENT', message: 'Documento inválido' };
  }

  if (!isValidDocumentFormat(params.documentValue, params.country, params.documentType)) {
    return { code: 'INVALID_FORMAT', message: 'Formato de documento inválido' };
  }

  return null;
}

// ============================================================================
// OPERAÇÕES PRINCIPAIS
// ============================================================================

/**
 * Cria uma nova identidade para um usuário.
 * 
 * Fluxo:
 * 1. Valida entrada
 * 2. Normaliza documento
 * 3. Gera hash
 * 4. Gera masked
 * 5. Verifica duplicidade
 * 6. Cria documento
 * 
 * NUNCA armazena documento completo.
 * NUNCA loga documento.
 * 
 * @returns Identity criada (com id gerado)
 */
export async function createIdentity(
  params: CreateIdentityParams,
  db?: any
): Promise<{ identity: Identity; id: string } | { error: IdentityServiceError }> {
  // Validação
  const validationError = validateCreateParams(params);
  if (validationError) {
    return { error: validationError };
  }

  const { userId, country, documentType, documentValue, verificationLevel = 'self' } = params;
  const database = db || require('@/lib/firebase/admin').getAdminDb();

  try {
    // Normalizar e gerar hash
    const normalized = normalizeDocument(documentValue, country, documentType);
    const hash = hashDocument(documentValue, country, documentType);
    const masked = maskDocument(documentValue, country, documentType);

    // Usar transaction fornecida ou criar nova
    const executeCreate = async (transaction?: any) => {
      const txn = transaction || (await database.runTransaction(() => Promise.resolve(database.batch())));
      const isExplicitTransaction = !!transaction;

      // Verificar duplicidade via hash
      const duplicateQuery = database
        .collection('user_identities')
        .where('documentHash', '==', hash)
        .limit(1);

      const duplicateSnap = await (isExplicitTransaction 
        ? txn.get(duplicateQuery) 
        : database.getAll(duplicateQuery));

      if (!Array.isArray(duplicateSnap) ? !duplicateSnap.empty : duplicateSnap.length > 0) {
        throw new Error('DUPLICATE_DOCUMENT');
      }

      // Criar novo documento
      const identityRef = database.collection('user_identities').doc();
      const now = { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 };

      const identity: Identity = {
        userId,
        country,
        documentType,
        documentHash: hash,
        documentMasked: masked,
        verificationStatus: 'pending',
        verificationLevel,
        isActive: false,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        verifiedAt: null,
      };

      if (isExplicitTransaction) {
        txn.set(identityRef, identity);
      } else {
        txn.set(identityRef, identity);
      }

      return { identity: { ...identity, id: identityRef.id }, id: identityRef.id };
    };

    // Se não passou transaction, executar nova
    if (!params.transaction) {
      return await database.runTransaction(async (txn) => {
        return await executeCreate(txn);
      });
    }

    // Se passou transaction, usar direto
    return await executeCreate(params.transaction);
  } catch (error: any) {
    if (error.message === 'DUPLICATE_DOCUMENT') {
      return {
        error: {
          code: 'DUPLICATE_DOCUMENT',
          message: 'Este documento já está registrado no sistema',
        },
      };
    }

    return {
      error: {
        code: 'CREATION_FAILED',
        message: 'Erro ao criar identidade',
      },
    };
  }
}

/**
 * Busca uma identidade existente pelo documento.
 * 
 * @returns Identity encontrada ou null
 */
export async function findIdentityByDocument(
  country: string,
  documentType: string,
  documentValue: string,
  db?: any
): Promise<Identity | null> {
  if (!isSupportedCountry(country) || !isSupportedDocumentType(country, documentType)) {
    return null;
  }

  try {
    const hash = hashDocument(documentValue, country, documentType);
    const database = db || require('@/lib/firebase/admin').getAdminDb();

    const query = database
      .collection('user_identities')
      .where('documentHash', '==', hash)
      .limit(1);

    const snap = await database.getAll(query);

    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    return { ...doc.data(), id: doc.id } as Identity;
  } catch (error) {
    return null;
  }
}

/**
 * Retorna todas as identidades de um usuário.
 */
export async function getUserIdentities(
  userId: string,
  db?: any
): Promise<Identity[]> {
  if (!userId) return [];

  try {
    const database = db || require('@/lib/firebase/admin').getAdminDb();

    const snap = await database
      .collection('user_identities')
      .where('userId', '==', userId)
      .get();

    return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Identity));
  } catch (error) {
    return [];
  }
}

/**
 * Retorna a identidade ativa (isActive=true) de um usuário.
 */
export async function getPrimaryIdentity(
  userId: string,
  db?: any
): Promise<Identity | null> {
  if (!userId) return null;

  try {
    const database = db || require('@/lib/firebase/admin').getAdminDb();

    const snap = await database
      .collection('user_identities')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    return { ...doc.data(), id: doc.id } as Identity;
  } catch (error) {
    return null;
  }
}

/**
 * Define uma identidade como primária (isActive=true).
 * Desativa a identidade primária anterior automaticamente.
 * 
 * Regras:
 * - Apenas uma identidade pode ser isActive=true
 * - Desativa a anterior automaticamente
 * - Atualiza users.primaryIdentityId
 */
export async function setPrimaryIdentity(
  userId: string,
  identityId: string,
  db?: any,
  transaction?: any
): Promise<{ success: boolean; error?: IdentityServiceError }> {
  if (!userId || !identityId) {
    return {
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'userId e identityId obrigatórios' },
    };
  }

  try {
    const database = db || require('@/lib/firebase/admin').getAdminDb();

    const executeSetPrimary = async (txn?: any) => {
      const isExplicitTransaction = !!txn;
      const finalTxn = txn || await database.runTransaction(() => Promise.resolve(database.batch()));

      // Verificar que a identidade pertence ao usuário
      const identityRef = database.collection('user_identities').doc(identityId);
      const identitySnap = isExplicitTransaction
        ? await finalTxn.get(identityRef)
        : await database.doc(`user_identities/${identityId}`).get();

      if (!identitySnap.exists) {
        throw new Error('IDENTITY_NOT_FOUND');
      }

      const identity = identitySnap.data() as Identity;
      if (identity.userId !== userId) {
        throw new Error('UNAUTHORIZED');
      }

      // Desativar todas as identidades deste usuário
      const allIdentitiesQuery = database
        .collection('user_identities')
        .where('userId', '==', userId)
        .where('isActive', '==', true);

      const allIdentitiesSnap = isExplicitTransaction
        ? await finalTxn.get(allIdentitiesQuery)
        : await allIdentitiesQuery.get();

      allIdentitiesSnap.docs.forEach((doc: any) => {
        finalTxn.update(doc.ref, { isActive: false });
      });

      // Ativar nova
      finalTxn.update(identityRef, { isActive: true });

      // Atualizar users.primaryIdentityId
      const userRef = database.collection('users').doc(userId);
      finalTxn.update(userRef, { primaryIdentityId: identityId });

      return { success: true };
    };

    if (!transaction) {
      return await database.runTransaction((txn: any) => executeSetPrimary(txn));
    }

    return await executeSetPrimary(transaction);
  } catch (error: any) {
    if (error.message === 'IDENTITY_NOT_FOUND') {
      return {
        success: false,
        error: { code: 'IDENTITY_NOT_FOUND', message: 'Identidade não encontrada' },
      };
    }

    if (error.message === 'UNAUTHORIZED') {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Esta identidade não pertence ao usuário' },
      };
    }

    return {
      success: false,
      error: { code: 'UPDATE_FAILED', message: 'Erro ao atualizar identidade primária' },
    };
  }
}

// ============================================================================
// UTILITÁRIOS INTERNOS
// ============================================================================

/**
 * Inicializa campos de identidade em um novo usuário.
 * Chamado automaticamente em finalizeUserRegistration.
 * 
 * NUNCA deve ser chamado em usuários existentes.
 */
export function getInitialIdentityFields(): {
  primaryIdentityId: null;
  identityMigrationStatus: string;
  country: null;
  identityCount: number;
  enableInternationalIdentity: boolean;
  preferIdentityOverCPF: boolean;
} {
  return {
    primaryIdentityId: null,
    identityMigrationStatus: 'not_started',
    country: null,
    identityCount: 0,
    enableInternationalIdentity: false,
    preferIdentityOverCPF: false,
  };
}

/**
 * Incrementa o contador de identidades de um usuário.
 * Usado internamente após criar nova identidade.
 */
export async function incrementIdentityCount(
  userId: string,
  db?: any,
  transaction?: any
): Promise<void> {
  const database = db || require('@/lib/firebase/admin').getAdminDb();
  const userRef = database.collection('users').doc(userId);

  if (transaction) {
    transaction.update(userRef, {
      identityCount: 1,
    });
  } else {
    return userRef.update({
      identityCount: 1,
    });
  }
}

/**
 * Alias para getUserIdentities - apenas retorna identidades do usuário.
 * Phase 4: Usado para listar identidades na UI.
 */
export async function listUserIdentities(
  userId: string,
  db?: any
): Promise<Identity[]> {
  return getUserIdentities(userId, db);
}

/**
 * Remove uma identidade (remoção lógica).
 * 
 * NÃO deleta o documento.
 * Altera: verificationStatus = 'revoked', isActive = false
 * 
 * Regras:
 * - Usuário consegue revogar suas identidades
 * - Não consegue revogar identidade primária
 * - Após revogação, não pode ser reativada
 * 
 * @returns Sucesso ou erro
 */
export async function removeIdentity(
  userId: string,
  identityId: string,
  db?: any,
  transaction?: any
): Promise<{ success: boolean; error?: IdentityServiceError }> {
  if (!userId || !identityId) {
    return {
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'userId e identityId obrigatórios' },
    };
  }

  try {
    const database = db || require('@/lib/firebase/admin').getAdminDb();

    const executeRemove = async (txn?: any) => {
      const isExplicitTransaction = !!txn;
      const finalTxn = txn || await database.runTransaction(() => Promise.resolve(database.batch()));

      // Verificar que identidade existe e pertence ao usuário
      const identityRef = database.collection('user_identities').doc(identityId);
      const identitySnap = isExplicitTransaction
        ? await finalTxn.get(identityRef)
        : await database.doc(`user_identities/${identityId}`).get();

      if (!identitySnap.exists) {
        throw new Error('IDENTITY_NOT_FOUND');
      }

      const identity = identitySnap.data() as Identity;
      if (identity.userId !== userId) {
        throw new Error('UNAUTHORIZED');
      }

      // Não permitir revogar identidade ativa
      if (identity.isActive) {
        throw new Error('CANNOT_REVOKE_PRIMARY');
      }

      // Revogar: alterar status e desativar
      const now = { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 };
      finalTxn.update(identityRef, {
        verificationStatus: 'revoked',
        isActive: false,
        updatedAt: now,
      });

      return { success: true };
    };

    if (!transaction) {
      return await database.runTransaction((txn: any) => executeRemove(txn));
    }

    return await executeRemove(transaction);
  } catch (error: any) {
    if (error.message === 'IDENTITY_NOT_FOUND') {
      return {
        success: false,
        error: { code: 'IDENTITY_NOT_FOUND', message: 'Identidade não encontrada' },
      };
    }

    if (error.message === 'UNAUTHORIZED') {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Esta identidade não pertence ao usuário' },
      };
    }

    if (error.message === 'CANNOT_REVOKE_PRIMARY') {
      return {
        success: false,
        error: {
          code: 'CANNOT_REVOKE_PRIMARY',
          message: 'Não é possível revogar a identidade primária',
        },
      };
    }

    return {
      success: false,
      error: { code: 'REMOVAL_FAILED', message: 'Erro ao revogar identidade' },
    };
  }
}
