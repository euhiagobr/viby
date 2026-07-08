# Phase 2 - Guia de Testes Executáveis

Este documento contém testes que devem ser executados para validar Phase 2.

## Teste 1: Usuário Brasil - Fluxo Legado Completo ✅

**Objetivo**: Validar que fluxo CPF continua funcionando sem alterações

**Passos**:
```typescript
// 1. Chamar finalizeUserRegistration com CPF válido
const result = await finalizeUserRegistration({
  uid: 'test-user-legado',
  email: 'legado@example.com',
  name: 'Usuário Legado',
  username: 'usuariolegado123',
  cpf: '123.456.789-09', // CPF válido (passa no módulo 11)
  gender: 'M',
  referredBy: null,
});

// Esperado:
// result.success === true

// 2. Verificar que dados legados foram criados
const user = await db.collection('users').doc('test-user-legado').get();
console.assert(user.data().cpfHash !== undefined, 'cpfHash não criado');
console.assert(user.data().cpfMasked !== undefined, 'cpfMasked não criado');
console.assert(user.data().affiliateCode !== undefined, 'affiliateCode não criado');

// 3. Verificar que dados sensíveis foram salvos
const sensitive = await db
  .collection('users')
  .doc('test-user-legado')
  .collection('private')
  .doc('sensitive')
  .get();
console.assert(sensitive.data().cpfEncrypted !== undefined, 'cpfEncrypted não criado');

// 4. Verificar que affiliate foi criado
const affCode = await db.collection('affiliateCodes').doc(user.data().affiliateCode).get();
console.assert(affCode.exists, 'affiliateCode documento não existe');

// 5. Verificar que stats foram criados
const stats = await db.collection('affiliate_stats').doc('test-user-legado').get();
console.assert(stats.exists, 'affiliate_stats não criado');
```

**Esperado**: ✅ Todos assertions passam

---

## Teste 2: Usuário Brasil - Phase 2 Dual-Write ✅

**Objetivo**: Validar que identidade BR:CPF foi criada em paralelo

**Passos**:
```typescript
// Após Teste 1...

// 1. Verificar que campos de identidade foram inicializados
const user = await db.collection('users').doc('test-user-legado').get();
console.assert(user.data().primaryIdentityId === null, 'primaryIdentityId não é null');
console.assert(user.data().identityMigrationStatus === 'not_started', 'identityMigrationStatus incorreto');
console.assert(user.data().identityCount === 0, 'identityCount não é 0');
console.assert(user.data().enableInternationalIdentity === false, 'enableInternationalIdentity não é false');
console.assert(user.data().preferIdentityOverCPF === false, 'preferIdentityOverCPF não é false');

// 2. Verificar que identidade BR:CPF foi criada
const identities = await db
  .collection('user_identities')
  .where('userId', '==', 'test-user-legado')
  .where('country', '==', 'BR')
  .where('documentType', '==', 'CPF')
  .get();

console.assert(!identities.empty, 'Nenhuma identidade BR:CPF encontrada');
console.assert(identities.docs.length === 1, 'Mais de uma identidade BR:CPF criada');

const identity = identities.docs[0].data();
console.assert(identity.documentHash !== undefined, 'documentHash não criado');
console.assert(identity.documentMasked === '***.***.***-09', 'documentMasked incorreto');
console.assert(identity.verificationStatus === 'pending', 'verificationStatus não é pending');
console.assert(identity.isActive === false, 'isActive não é false');
console.assert(identity.verificationLevel === 'self', 'verificationLevel não é self');

// 3. Verificar que hash é determinístico
const hash1 = require('@/lib/identity-utils').hashDocument('123.456.789-09', 'BR', 'CPF');
console.assert(identity.documentHash === hash1, 'Hash não é determinístico');
```

**Esperado**: ✅ Todos assertions passam

---

## Teste 3: Validação de Duplicação CPF ✅

**Objetivo**: Validar que segunda tentativa com mesmo CPF é bloqueada

**Passos**:
```typescript
// 1. Criar primeiro usuário (já feito em Teste 1)
// 2. Tentar criar segundo usuário com mesmo CPF
const result = await finalizeUserRegistration({
  uid: 'test-user-duplo',
  email: 'duplo@example.com',
  name: 'Usuário Duplo',
  username: 'usuarioduplo123',
  cpf: '123.456.789-09', // MESMO CPF do Teste 1
  gender: 'M',
});

// Esperado:
console.assert(result.success === false, 'CPF duplicado não foi bloqueado');
console.assert(result.error.includes('CPF'), 'Mensagem de erro não menciona CPF');

// 3. Verificar que nenhum documento foi criado
const duploUser = await db.collection('users').doc('test-user-duplo').get();
console.assert(!duploUser.exists, 'Usuário duplicado foi criado');
```

**Esperado**: ✅ Bloqueio funciona + nenhum doc parcial criado

---

## Teste 4: Validação de Duplicação de Identidade ✅

**Objetivo**: Validar que hash de identidade impede duplicação

**Passos**:
```typescript
// 1. Criar segundo usuário com CPF diferente mas mesmo documento
// (Isto seria testado via identity-service.createIdentity diretamente)

const { createIdentity } = require('@/lib/identity-service');

// Primeiro: criar com um usuario
const result1 = await createIdentity({
  userId: 'user-1',
  country: 'BR',
  documentType: 'CPF',
  documentValue: '111.222.333-44',
});
console.assert(!result1.error, 'Primeira identidade falhou');

// Segundo: tentar criar com mesmo documento + usuário diferente
const result2 = await createIdentity({
  userId: 'user-2',
  country: 'BR',
  documentType: 'CPF',
  documentValue: '111.222.333-44', // MESMO DOCUMENTO
});

console.assert(result2.error !== undefined, 'Identidade duplicada não foi bloqueada');
console.assert(result2.error.code === 'DUPLICATE_DOCUMENT', 'Erro code incorreto');
```

**Esperado**: ✅ Bloqueio de duplicação funciona

---

## Teste 5: Identity Service - getPrimaryIdentity ✅

**Objetivo**: Validar que getPrimaryIdentity retorna corretamente

**Passos**:
```typescript
const { getPrimaryIdentity } = require('@/lib/identity-service');

// Inicialmente, nenhuma primária (isActive=false)
let primary = await getPrimaryIdentity('test-user-legado');
console.assert(primary === null, 'Deveria retornar null, pois nenhuma está ativa');

// Depois de Phase 3/4, quando setPrimaryIdentity for chamado:
// primary.isActive === true
```

**Esperado**: ✅ Retorna null para usuário novo (nenhuma primária)

---

## Teste 6: Cloud Function onIdentityCreated ✅

**Objetivo**: Validar que Cloud Function dispara sem erros

**Passos**:
```typescript
// 1. Monitorar logs do Firebase Cloud Functions
// 2. Criar nova identidade:

const { createIdentity } = require('@/lib/identity-service');
await createIdentity({
  userId: 'test-cf-user',
  country: 'AR',
  documentType: 'DNI',
  documentValue: '12345678',
});

// 3. Verificar que logs aparecem em cloud_functions:
// [Identity] Nova identidade criada { ... }

// 4. Verificar que nenhuma exceção foi lançada
// 5. Verificar que documento não foi marcado como 'revoked'
```

**Esperado**: ✅ Cloud Function dispara sem erros + logs aparecem

---

## Teste 7: Regressão - updateUserCPF() Funciona ✅

**Objetivo**: Validar que onboarding CPF não foi quebrado

**Passos**:
```typescript
const { updateUserCPF } = require('@/lib/firebase/admin');

// 1. Criar usuário com CPF inicial (via finalizeUserRegistration)
// 2. Depois, tentar atualizar CPF (onboarding flow)
const result = await updateUserCPF('test-user-legado', '999.888.777-66');

console.assert(result.success === true, 'updateUserCPF falhou');

// 3. Verificar que dados foram atualizados
const user = await db.collection('users').doc('test-user-legado').get();
console.assert(user.data().cpfHash !== undefined, 'cpfHash não foi atualizado');
console.assert(user.data().cpfMasked === '***.***.***-66', 'cpfMasked incorreto');

// 4. Verificar dados sensíveis
const sensitive = await db
  .collection('users')
  .doc('test-user-legado')
  .collection('private')
  .doc('sensitive')
  .get();
console.assert(sensitive.data().cpfEncrypted !== undefined, 'cpfEncrypted não foi atualizado');
```

**Esperado**: ✅ updateUserCPF funciona sem quebras

---

## Teste 8: Regressão - getUserCPF() Funciona ✅

**Objetivo**: Validar que leitura de CPF criptografado funciona

**Passos**:
```typescript
const { getUserCPF } = require('@/lib/firebase/admin');

// 1. Recuperar CPF de usuário (admin ou owner)
const result = await getUserCPF('test-user-legado', 'test-user-legado');

console.assert(result.success === true, 'getUserCPF falhou');
console.assert(result.cpf === '999.888.777-66', 'CPF descriptografado incorreto');
```

**Esperado**: ✅ Descriptografia funciona

---

## Teste 9: Performance - Nenhuma Queda em Signup ⚡

**Objetivo**: Validar que Phase 2 não degradou performance

**Passos**:
```typescript
const start = Date.now();
await finalizeUserRegistration({
  uid: 'perf-test-user',
  email: 'perf@example.com',
  name: 'Performance Test',
  username: 'perftest123',
  cpf: '555.666.777-88',
  gender: 'M',
});
const elapsed = Date.now() - start;

console.log(`Tempo de signup: ${elapsed}ms`);
console.assert(elapsed < 3000, 'Signup demorou mais de 3s (era ~1-1.5s antes)');
```

**Esperado**: ✅ < 3 segundos (idealmente < 2s, no máximo 2x do anterior)

---

## Teste 10: Atomicidade - Tudo ou Nada ✅

**Objetivo**: Validar que transaction é 100% atômica

**Passos**:
```typescript
// Simular erro durante transaction (mock)
// E verificar que nenhum documento parcial é criado

// 1. Bloquear colecao 'affiliateCodes' temporariamente
// 2. Chamar finalizeUserRegistration
// 3. Verificar que:
//    - /users não foi criado
//    - /user_identities não foi criado
//    - /usernames não foi atualizado
//    - NADA foi criado

// 4. Desbloquear e tentar novamente - deve funcionar
```

**Esperado**: ✅ Transação é 100% atômica (tudo ou nada)

---

## Checklist de Validação

- [ ] Teste 1: Fluxo legado CPF completo
- [ ] Teste 2: Phase 2 dual-write funciona
- [ ] Teste 3: Bloqueio de duplicação CPF
- [ ] Teste 4: Bloqueio de duplicação identidade
- [ ] Teste 5: getPrimaryIdentity retorna null
- [ ] Teste 6: Cloud Functions disparam
- [ ] Teste 7: updateUserCPF funciona
- [ ] Teste 8: getUserCPF funciona
- [ ] Teste 9: Performance aceitável
- [ ] Teste 10: Transação é atômica

---

## Próximos Passos

**Phase 3**: Implementar seletor de país em SignUpForm + suporte a documentos internacionais
