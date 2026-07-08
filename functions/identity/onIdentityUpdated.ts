/**
 * @fileOverview Cloud Function: onIdentityUpdated
 * Disparado quando uma identidade é atualizada em /user_identities
 * 
 * Phase 2: Estrutura preparada, sem lógica ainda
 * Phase 3+: Verificação de campos immutáveis, validação, etc
 * 
 * IMPORTANTE:
 * - NUNCA logar documento completo
 * - NUNCA logar hash completo
 * - NUNCA permitir alteração de userId, documentHash, documentMasked
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Disparado quando um documento em /user_identities é atualizado
 * 
 * Fluxo (Phase 3):
 * 1. Validar que campos críticos não foram alterados
 * 2. Registrar auditoria de mudanças
 * 3. Se verificationStatus mudou: processar verificação
 * 4. Detectar tentativas de manipulação
 */
export const onIdentityUpdated = functions.firestore
  .document('/user_identities/{identityId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const { identityId } = context.params;

    try {
      // Phase 3: SEGURANÇA CRÍTICA - Validar imutabilidade de campos sensíveis
      const immutableFields = [
        'userId',               // Nunca mover identidade entre usuários
        'documentHash',         // Nunca alterar identificador
        'documentMasked',       // Nunca alterar masked (auditoria)
        'country',              // Nunca alterar país
        'documentType',         // Nunca alterar tipo de documento
        'createdAt',            // Nunca alterar data de criação
      ];

      for (const field of immutableFields) {
        if (beforeData[field] !== afterData[field]) {
          console.error(`[Identity] VIOLAÇÃO CRÍTICA - Tentativa de alterar campo imutável: ${field}`, {
            identityId,
            userId: beforeData.userId,
            fieldBefore: field === 'documentHash' ? beforeData[field]?.substring(0, 8) : beforeData[field],
            fieldAfter: field === 'documentHash' ? afterData[field]?.substring(0, 8) : afterData[field],
          });
          // Revert: restaurar valor anterior
          await change.after.ref.update({ [field]: beforeData[field] });
          return;
        }
      }

      // Phase 3: Detectar mudanças e registrar auditoria
      const changedFields = Object.keys(afterData)
        .filter((key) => beforeData[key] !== afterData[key])
        .filter((key) => key !== 'updatedAt'); // Não contar updatedAt como mudança

      if (changedFields.length > 0) {
        console.log(`[Identity] Identidade atualizada com segurança`, {
          identityId,
          userId: beforeData.userId,
          changedFields,
          documentHashPrefix: beforeData.documentHash.substring(0, 8),
        });
      }

      // Phase 3: Se verificationStatus mudou
      if (beforeData.verificationStatus !== afterData.verificationStatus) {
        console.log(`[Identity] Status de verificação alterado`, {
          identityId,
          userId: afterData.userId,
          statusBefore: beforeData.verificationStatus,
          statusAfter: afterData.verificationStatus,
          country: afterData.country,
          documentType: afterData.documentType,
        });

        // Phase 3+: Se foi verificado, incrementar contador, notificar usuário
        if (afterData.verificationStatus === 'verified') {
          console.log(`[Identity] Nova identidade verificada`, {
            identityId,
            userId: afterData.userId,
            verificationLevel: afterData.verificationLevel,
          });
          // TODO: Incrementar identityCount do usuário
          // TODO: Notificar usuário
        }
      }

    } catch (error) {
      console.error(`[Identity] Erro ao processar identidade atualizada:`, error);
    }
  });
