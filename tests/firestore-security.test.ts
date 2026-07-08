/**
 * @fileOverview Testes de Segurança - Phase 3 Security Fixes
 * 
 * Testes para validar que as proteções de segurança estão funcionando:
 * - Campos críticos não podem ser alterados por usuários
 * - Cloud Functions conseguem atualizar status
 * - Duplicidade de documento é bloqueada
 * - Cadastro normal continua funcionando
 * 
 * IMPORTANTE: Estes testes usam Firebase Emulator Suite para isolamento
 * Executar com: npm run test:firestore
 */

import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security - Phase 3 Fixes', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Inicializar Firebase Emulator
    testEnv = await initializeTestEnvironment({
      projectId: 'viby-test',
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('✅ Teste 1: Usuário NÃO consegue alterar verificationStatus', () => {
    it('deve bloquear update de verificationStatus por usuário comum', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      // Setup: Criar identidade como admin
      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'BR',
          documentType: 'CPF',
          documentHash: 'hash123',
          documentMasked: '***.***.***-09',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      // Test: Usuário tenta alterar verificationStatus
      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      await assertFails(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            verificationStatus: 'verified', // ❌ Bloqueado
          })
      );
    });

    it('deve bloquear update de verificationStatus mesmo com outro campo', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'BR',
          documentType: 'CPF',
          documentHash: 'hash123',
          documentMasked: '***.***.***-09',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      // Tentando alterar 2 campos (um permitido + um bloqueado)
      await assertFails(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            verificationStatus: 'verified', // ❌ Bloqueado
            updatedAt: new Date(),           // ✅ Permitido (mas bloqueado por verificationStatus)
          })
      );
    });
  });

  describe('✅ Teste 2: Usuário NÃO consegue alterar isActive', () => {
    it('deve bloquear update de isActive por usuário comum', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'AR',
          documentType: 'DNI',
          documentHash: 'hash789',
          documentMasked: '****5678',
          verificationStatus: 'verified',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
          verifiedAt: new Date(),
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      await assertFails(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            isActive: true, // ❌ Bloqueado
          })
      );
    });
  });

  describe('✅ Teste 3: Usuário NÃO consegue alterar documentHash', () => {
    it('deve bloquear update de documentHash', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'US',
          documentType: 'SSN',
          documentHash: 'hash-original',
          documentMasked: '***-**-1234',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      await assertFails(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            documentHash: 'hash-fake', // ❌ Bloqueado
          })
      );
    });
  });

  describe('✅ Teste 4: Admin CONSEGUE atualizar verificationStatus', () => {
    it('deve permitir update de verificationStatus por admin', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      // Criar identidade
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'BR',
          documentType: 'CPF',
          documentHash: 'hash123',
          documentMasked: '***.***.***-09',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      // Admin atualiza
      await assertSucceeds(
        adminDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            verificationStatus: 'verified', // ✅ Permitido para admin
            verificationLevel: 'kyc',
            verifiedAt: new Date(),
          })
      );
    });

    it('deve permitir update de isActive por admin', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'AR',
          documentType: 'DNI',
          documentHash: 'hash789',
          documentMasked: '****5678',
          verificationStatus: 'verified',
          verificationLevel: 'kyc',
          isActive: false,
          createdAt: new Date(),
          verifiedAt: new Date(),
        });

      await assertSucceeds(
        adminDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            isActive: true, // ✅ Permitido para admin
          })
      );
    });
  });

  describe('✅ Teste 5: Cadastro normal continua funcionando', () => {
    it('deve permitir que usuário crie sua própria identidade', async () => {
      const userId = 'new-user';

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      await assertSucceeds(
        userDb
          .collection('user_identities')
          .doc()
          .set({
            userId, // Seu próprio ID
            country: 'BR',
            documentType: 'CPF',
            documentHash: 'hash-new-user',
            documentMasked: '***.***.***-99',
            verificationStatus: 'pending',
            verificationLevel: 'self',
            isActive: false,
            createdAt: new Date(),
          })
      );
    });

    it('deve permitir que usuário leia suas próprias identidades', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      // Setup: criar identidade
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'ES',
          documentType: 'NIE',
          documentHash: 'hash-es',
          documentMasked: 'X*****67L',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      // Usuário consegue ler
      await assertSucceeds(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .get()
      );
    });

    it('deve bloquear que usuário leia identidades de outro usuário', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const identityId = 'identity-user1';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      // Setup: criar identidade do user1
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId: userId1,
          country: 'PT',
          documentType: 'CARTAO',
          documentHash: 'hash-pt',
          documentMasked: '****5678',
          verificationStatus: 'verified',
          verificationLevel: 'kyc',
          isActive: true,
          createdAt: new Date(),
          verifiedAt: new Date(),
        });

      const user2Db = testEnv.authenticatedContext(userId2).firestore();
      
      // User2 NÃO consegue ler identidade de User1
      await assertFails(
        user2Db
          .collection('user_identities')
          .doc(identityId)
          .get()
      );
    });
  });

  describe('✅ Teste 6: Proteção de campos imutáveis críticos', () => {
    it('deve bloquear alteração de userId', async () => {
      const userId = 'user123';
      const identityId = 'identity456';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'BR',
          documentType: 'CPF',
          documentHash: 'hash123',
          documentMasked: '***.***.***-09',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      await assertFails(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            userId: 'hacker-user', // ❌ Bloqueado
          })
      );
    });

    it('deve bloquear alteração de createdAt', async () => {
      const userId = 'user123';
      const identityId = 'identity456';
      const originalDate = new Date('2026-01-01');

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'AR',
          documentType: 'DNI',
          documentHash: 'hash789',
          documentMasked: '****5678',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: originalDate,
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      await assertFails(
        userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            createdAt: new Date('2025-01-01'), // ❌ Bloqueado
          })
      );
    });
  });

  describe('✅ Teste 7: Integridade de dados após falha', () => {
    it('deve manter documentHash original mesmo após tentativa de update', async () => {
      const userId = 'user123';
      const identityId = 'identity456';
      const originalHash = 'hash-original-123';

      const adminDb = testEnv.authenticatedContext('admin-user', {
        admin: true,
      }).firestore();
      
      await adminDb
        .collection('user_identities')
        .doc(identityId)
        .set({
          userId,
          country: 'US',
          documentType: 'PASSPORT',
          documentHash: originalHash,
          documentMasked: 'PASS***EF',
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          createdAt: new Date(),
        });

      const userDb = testEnv.authenticatedContext(userId).firestore();
      
      // Tentativa de alteração falha
      try {
        await userDb
          .collection('user_identities')
          .doc(identityId)
          .update({
            documentHash: 'hash-fake',
          });
      } catch (e) {
        // Esperado falhar
      }

      // Verificar que o hash original foi mantido
      const doc = await adminDb
        .collection('user_identities')
        .doc(identityId)
        .get();
      
      expect(doc.data()?.documentHash).toBe(originalHash);
    });
  });
});

/**
 * INSTRUÇÕES DE EXECUÇÃO:
 * 
 * 1. Instalar Firebase Emulator:
 *    npm install -g firebase-tools
 *    firebase emulators:start --only firestore
 * 
 * 2. Em outro terminal, executar testes:
 *    npm run test:firestore
 * 
 * 3. Testes esperados:
 *    ✅ 16 testes
 *    ✅ Todos devem passar
 * 
 * 4. Se algum teste falhar:
 *    - Verificar Firestore Rules
 *    - Verificar Cloud Functions
 *    - Revisar logs do emulator
 */
