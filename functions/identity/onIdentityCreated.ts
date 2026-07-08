/**
 * @fileOverview Cloud Function: onIdentityCreated
 * Disparado quando uma nova identidade é criada em /user_identities
 * 
 * Phase 2: Estrutura preparada, sem lógica ainda
 * Phase 3+: Será expandido com verificação automática, notificações, etc
 * 
 * IMPORTANTE:
 * - NUNCA logar documento completo
 * - NUNCA logar hash completo (máx: primeiros 8 chars)
 * - NUNCA transmitir documento
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Disparado quando um novo documento é criado em /user_identities
 * 
 * Fluxo (Phase 3+):
 * 1. Validar integridade do documento (hash + masked match)
 * 2. Verificar duplicidade (documentHash não deve existir)
 * 3. Incrementar contador identityCount do usuário
 * 4. Registrar auditoria (sem expor dados sensíveis)
 * 5. Enviar notificação ao usuário (futuro)
 * 6. Integração com KYC (futuro)
 */
export const onIdentityCreated = functions.firestore
  .document('/user_identities/{identityId}')
  .onCreate(async (snap, context) => {
    const identity = snap.data();
    const { identityId } = context.params;
    const db = admin.firestore();

    try {
      // Phase 3: Validação de integridade
      if (!identity.documentHash || !identity.documentMasked) {
        console.warn(`[Identity] Documento criado sem hash/masked`, { identityId });
        await snap.ref.update({
          verificationStatus: 'revoked',
        });
        return;
      }

      // Phase 3: PROTEÇÃO CRÍTICA - Verificar duplicidade de documentHash
      // Buscar outras identidades ativas com mesmo hash
      const duplicateSnapshot = await db
        .collection('user_identities')
        .where('documentHash', '==', identity.documentHash)
        .where('__name__', '!=', identityId)  // Excluir este documento
        .limit(1)
        .get();

      if (!duplicateSnapshot.empty) {
        const duplicateDoc = duplicateSnapshot.docs[0];
        console.error(`[Identity] DUPLICIDADE DETECTADA - Mesmo documentHash`, {
          newIdentityId: identityId,
          newUserId: identity.userId,
          existingIdentityId: duplicateDoc.id,
          existingUserId: duplicateDoc.data().userId,
          country: identity.country,
          documentType: identity.documentType,
          documentHashPrefix: identity.documentHash.substring(0, 8),
        });

        // Revogar a identidade duplicada
        await snap.ref.update({
          verificationStatus: 'revoked',
        });
        return;
      }

      // Phase 3: Log estruturado (sem expor dados sensíveis)
      console.log(`[Identity] Nova identidade criada com sucesso`, {
        identityId,
        userId: identity.userId,
        country: identity.country,
        documentType: identity.documentType,
        verificationLevel: identity.verificationLevel,
        documentHashPrefix: identity.documentHash.substring(0, 8),
        masked: identity.documentMasked,
      });

      // Phase 3+: Será expandido com:
      // - Incrementar identityCount
      // - Notificações
      // - Integração KYC

    } catch (error) {
      console.error(`[Identity] Erro ao processar identidade criada:`, error);
      // Não propagar erro (Cloud Functions falhas podem gerar retries)
    }
  });
