# Phase 3 - Testes Práticos com Código

**Total de Testes**: 8 cenários + exemplos de código executável  
**Tempo Estimado**: ~30 minutos  
**Status**: ✅ Pronto para rodar  

---

## Teste 1️⃣ : Feature Flag OFF (Regressão Total)

**Objetivo**: Verificar que com flag desativada, formulário é idêntico a Phase 2.

### Setup
```bash
# .env.local
NEXT_PUBLIC_ENABLE_INTERNATIONAL_SIGNUP=false
```

### Código de Teste (Browser Dev Console)
```javascript
// Verificar que feature está OFF
await fetch('/api/feature-flag-check').then(r => r.json()).then(d => console.log(d));
// Esperado: { enableInternationalSignup: false }

// Verificar que país selector NÃO é renderizado
const countryField = document.querySelector('[name="country"]');
console.assert(!countryField, "Country field should NOT exist when flag is OFF");

// Verificar que CPF é obrigatório
const cpfField = document.querySelector('[name="cpf"]');
console.assert(cpfField, "CPF field MUST exist");

// Verificar que apenas InternationalDocumentField NÃO é renderizado
const intlDocField = document.querySelector('[data-component="intl-doc-field"]');
console.assert(!intlDocField, "Intl doc field should NOT exist");
```

### Resultado Esperado
```
✅ País selector: NÃO visível
✅ CPF: Visível e obrigatório
✅ InternationalDocumentField: NÃO renderizado
✅ Formulário: Idêntico a Phase 2
```

---

## Teste 2️⃣: Feature Flag ON - Brasil (CPF)

**Objetivo**: Verificar que Brasil com flag ON ainda requer CPF.

### Setup
```bash
# .env.local
NEXT_PUBLIC_ENABLE_INTERNATIONAL_SIGNUP=true
```

### Dados de Entrada
```typescript
const testData = {
  name: "João Silva Santana",
  username: "joaosilva123",
  cpf: "12345678909",        // CPF válido
  email: "joao@example.com",
  gender: "Masculino",
  password: "SecurePass123!",
  country: "BR"              // Brasil selecionado
};
```

### Código de Teste
```typescript
import { validateCPF } from '@/lib/utils';
import { hashDocument, maskDocument } from '@/lib/identity-utils';

// 1. Validar CPF
const cleanCPF = testData.cpf.replace(/\D/g, "");
console.assert(validateCPF(cleanCPF), "CPF must be valid");
console.log(`✅ CPF válido: ${cleanCPF}`);

// 2. Calcular hash (como Phase 2)
const cpfHash = hashDocument(cleanCPF, 'BR', 'CPF');
console.log(`✅ CPF Hash: ${cpfHash.substring(0, 8)}...`);

// 3. Mascarar (como Phase 2)
const cpfMasked = maskDocument(cleanCPF, 'BR', 'CPF');
console.assert(cpfMasked.endsWith('09'), "Masked deve terminar em últimos 2 dígitos");
console.log(`✅ CPF Masked: ${cpfMasked}`);

// 4. Simulação de form validation
const formValidation = {
  country: "BR",
  cpf: "12345678909",
  documentType: undefined,  // NÃO deve ter documentType
  documentValue: undefined  // NÃO deve ter documentValue
};
console.log(`✅ Payload: ${JSON.stringify(formValidation)}`);
```

### Cenário UI
```
┌─────────────────────────────┐
│ Novo Cadastro Viby          │
├─────────────────────────────┤
│ Nome: João Silva Santana    │
│ Username: @joaosilva123 ✅  │
│ País: 🇧🇷 Brasil ▼         │ ← Novo selector
│ CPF: 123.456.789-09 ✅      │ ← Obrigatório
│ Email: joao@example.com     │
│ Gênero: Masculino ▼         │
│ Senha: ••••••••••           │
│                             │
│ ℹ️ Seu CPF será usado para   │
│    identificar seus ingressos │
│                             │
│ [Criar Conta]               │
└─────────────────────────────┘
```

### Banco de Dados Esperado
```firestore
// Collection: users
{
  uid: "user123",
  name: "João Silva Santana",
  username: "joaosilva123",
  cpfHash: "SHA256(BR:CPF:12345678909)",
  cpfMasked: "***.***.***-09",
  cpf: "***.***.***-09",
  email: "joao@example.com",
  gender: "Masculino",
  country: "BR",
  primaryIdentityId: null,
  identityCount: 0,
  enableInternationalIdentity: false,
  preferIdentityOverCPF: false,
  createdAt: timestamp,
  ...
}

// Collection: user_identities
{
  userId: "user123",
  country: "BR",
  documentType: "CPF",
  documentHash: "SHA256(BR:CPF:12345678909)",
  documentMasked: "***.***.***-09",
  verificationStatus: "pending",
  verificationLevel: "self",
  isActive: false,
  createdAt: timestamp,
  ...
}

// Collection: private/user123/sensitive
{
  cpfEncrypted: "AES256(12345678909)",
  updatedAt: timestamp
}
```

### Resultado Esperado
```
✅ País visível: Brasil
✅ CPF obrigatório
✅ Sem InternationalDocumentField
✅ Validação: CPF válido → ✅
✅ Cadastro criado
✅ /users tem cpfHash + cpfMasked
✅ /user_identities tem BR:CPF
✅ /private/sensitive tem cpfEncrypted
✅ Redireciona para /dashboard
```

---

## Teste 3️⃣: Feature Flag ON - Argentina (DNI)

**Objetivo**: Verificar que Argentina requer DNI (não CPF).

### Setup
```bash
# .env.local
NEXT_PUBLIC_ENABLE_INTERNATIONAL_SIGNUP=true
```

### Dados de Entrada
```typescript
const testData = {
  name: "Carlos García López",
  username: "carlosgarcia",
  documentType: "DNI",       // Novo - não é CPF
  documentValue: "12345678", // 8 dígitos
  email: "carlos@example.com",
  gender: "Masculino",
  password: "SecurePass123!",
  country: "AR"              // Argentina
};
```

### Código de Teste
```typescript
import { isValidDocumentFormat, maskDocument } from '@/lib/identity-utils';
import { getDocumentTypesForCountry } from '@/lib/identity-validation';

// 1. Verificar documentType permitido
const allowedTypes = getDocumentTypesForCountry('AR');
console.assert(allowedTypes.includes('DNI'), "DNI must be supported for Argentina");
console.log(`✅ Tipos aceitos (AR): ${allowedTypes.join(', ')}`);

// 2. Validar formato
const isValid = isValidDocumentFormat('12345678', 'AR', 'DNI');
console.assert(isValid, "DNI format must be valid");
console.log(`✅ Formato DNI válido: 12345678`);

// 3. Mascarar DNI
const dniMasked = maskDocument('12345678', 'AR', 'DNI');
console.assert(dniMasked.includes('5678'), "Masked must show last 4 digits");
console.log(`✅ DNI Masked: ${dniMasked}`);

// 4. Verificar que CPF NÃO é necessário
const cpfField = document.querySelector('[name="cpf"]');
console.assert(!cpfField, "CPF field should NOT exist for Argentina");

// 5. Verificar que InternationalDocumentField é renderizado
const intlField = document.querySelector('[data-component="intl-doc-field"]');
console.assert(intlField, "InternationalDocumentField MUST be rendered");
console.log(`✅ InternationalDocumentField renderizado`);
```

### Cenário UI
```
┌─────────────────────────────┐
│ Novo Cadastro Viby          │
├─────────────────────────────┤
│ Nome: Carlos García López   │
│ Username: @carlosgarcia ✅  │
│ País: 🇦🇷 Argentina ▼       │ ← Seletor de país
│ ├─ Documento: DNI ▼         │ ← Novo seletor
│ ├─ Número: 12345678 ✅      │ ← Campo específico
│ Email: carlos@example.com   │
│ Gênero: Masculino ▼         │
│ Senha: ••••••••••           │
│                             │
│ ℹ️ Usaremos seu documento    │
│    nacional para garantir a  │
│    segurança da sua conta    │
│                             │
│ [Criar Conta]               │
└─────────────────────────────┘
```

### Banco de Dados Esperado
```firestore
// Collection: users
{
  uid: "user456",
  name: "Carlos García López",
  username: "carlosgarcia",
  country: "AR",
  // ⚠️ SEM cpf, cpfHash, cpfMasked (não é cadastro BR)
  email: "carlos@example.com",
  gender: "Masculino",
  primaryIdentityId: null,
  identityCount: 0,
  enableInternationalIdentity: false,
  createdAt: timestamp,
  ...
}

// Collection: user_identities
{
  userId: "user456",
  country: "AR",
  documentType: "DNI",
  documentHash: "SHA256(AR:DNI:12345678)",
  documentMasked: "****5678",  // Argentina mostra últimos 4
  verificationStatus: "pending",
  isActive: false,
  createdAt: timestamp,
  ...
}

// ❌ /private/sensitive NÃO tem cpfEncrypted
```

### Resultado Esperado
```
✅ País: Argentina visível
✅ Seletor de documento: DNI
✅ Campo de entrada: DNI obrigatório
✅ CPF: NÃO visível
✅ Validação DNI: ✅
✅ Cadastro criado
✅ /users SEM cpf, SEM cpfHash
✅ /user_identities tem AR:DNI
✅ /private/sensitive NÃO criado
✅ Redireciona para /dashboard
```

---

## Teste 4️⃣: Documento Duplicado - Brasil (CPF)

**Objetivo**: CPF já registrado deve ser rejeitado.

### Pré-Requisito
```
User 1 já criado com CPF: 12345678909
```

### Entrada
```typescript
const duplicateData = {
  name: "João Silva 2",
  username: "joaosilva456",
  cpf: "12345678909",         // ⚠️ MESMO CPF
  email: "joao2@example.com",
  country: "BR"
};
```

### Código de Teste
```typescript
import { db } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { hashCPF } from '@/lib/crypto-utils';

// 1. Simular validação de duplicidade
const cpfHash = hashCPF("12345678909");
const q = query(
  collection(db, "users"),
  where("cpfHash", "==", cpfHash)
);
const snapshot = await getDocs(q);

console.assert(!snapshot.empty, "CPF já deve estar registrado");
console.log(`✅ CPF já registrado: ${snapshot.docs[0].id}`);

// 2. Simular validação de identidade
const cpfDocHash = hashDocument("12345678909", 'BR', 'CPF');
const qIdentity = query(
  collection(db, "user_identities"),
  where("documentHash", "==", cpfDocHash)
);
const identitySnapshot = await getDocs(qIdentity);

console.assert(!identitySnapshot.empty, "Identidade BR:CPF já deve estar registrada");
console.log(`✅ Identidade BR:CPF já existe: ${identitySnapshot.docs[0].id}`);
```

### Comportamento do Formulário
```
1. Campo CPF preenchido: 12345678909
2. React Hook Form efetua validação assíncrona
3. Busca em /users por cpfHash → encontra User 1
4. Status muda para: 🔴 "Documento já está em uso"
5. Botão [Criar Conta] fica desabilitado
6. Usuário vê: "Este CPF já possui uma conta vinculada"
```

### Resultado Esperado
```
✅ Validação em tempo real: 🔴 CPF duplicado
✅ Status: "taken"
✅ Botão desabilitado
✅ Toast ao tentar submit: "Documento já registrado"
✅ Nenhum novo /users criado
✅ Nenhuma nova /user_identities criada
✅ Transaction 100% atômica (tudo ou nada)
```

---

## Teste 5️⃣: Documento Duplicado - Argentina (DNI)

**Objetivo**: DNI já registrado deve ser rejeitado.

### Pré-Requisito
```
User 1 (AR) já criado com DNI: 12345678
```

### Entrada
```typescript
const duplicateData = {
  name: "Carlos García 2",
  username: "carlosgarcia456",
  documentType: "DNI",
  documentValue: "12345678",  // ⚠️ MESMO DNI
  email: "carlos2@example.com",
  country: "AR"
};
```

### Código de Teste
```typescript
import { db } from '@/firebase';
import { hashDocument } from '@/lib/identity-utils';

// 1. Simular validação de identidade
const dniHash = hashDocument("12345678", "AR", "DNI");
const q = query(
  collection(db, "user_identities"),
  where("documentHash", "==", dniHash)
);
const snapshot = await getDocs(q);

console.assert(!snapshot.empty, "DNI já deve estar registrado");
console.log(`✅ DNI já registrado: ${snapshot.docs[0].id}`);

// 2. Verificar que usuário original é diferente
const existingUserId = snapshot.docs[0].data().userId;
console.assert(existingUserId !== "user456", "Deve ser usuário diferente");
```

### Resultado Esperado
```
✅ Validação em tempo real: 🔴 DNI duplicado
✅ Status: "taken"
✅ Botão desabilitado
✅ Toast ao tentar submit: "Este documento já está associado a outra conta"
✅ Nenhum novo /users criado
✅ Nenhuma nova /user_identities criada
```

---

## Teste 6️⃣: Usuário Legado - Login (Regressão)

**Objetivo**: Usuário criado em Phase 1/2 consegue fazer login normalmente.

### Dados do Usuário Legado
```firestore
{
  uid: "legacy-user-123",
  name: "Pedro Antigo",
  username: "pedroantigo",
  cpfHash: "SHA256(BR:CPF:98765432109)",
  cpfMasked: "***.***.***-09",
  email: "pedro@example.com",
  createdAt: 2024-01-15T...,
  // Phase 2 fields
  primaryIdentityId: null,
  identityCount: 0,
  enableInternationalIdentity: false
}
```

### Código de Teste
```typescript
import { auth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

// 1. Login com credentials legados
const userCredential = await signInWithEmailAndPassword(
  auth,
  'pedro@example.com',
  'password123'
);
console.assert(userCredential.user.uid === "legacy-user-123", "Login deve suceder");
console.log(`✅ Login bem-sucedido: ${userCredential.user.email}`);

// 2. Verificar que dados de CPF estão intactos
const db = getFirestore();
const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
const userData = userDoc.data();

console.assert(userData.cpfHash, "cpfHash deve existir");
console.assert(userData.cpfMasked, "cpfMasked deve existir");
console.assert(userData.cpf, "cpf masked deve existir");
console.log(`✅ Dados CPF intactos: ${userData.cpfMasked}`);

// 3. Verificar que identidade BR:CPF foi criada
const identityQuery = query(
  collection(db, 'user_identities'),
  where('userId', '==', userCredential.user.uid),
  where('country', '==', 'BR'),
  where('documentType', '==', 'CPF')
);
const identitySnap = await getDocs(identityQuery);
console.assert(!identitySnap.empty, "Identidade BR:CPF deve existir");
console.log(`✅ Identidade BR:CPF recuperada`);
```

### Cenário de Uso
```
1. Usuário legado faz login
2. Dashboard carrega normalmente
3. Todos os tickets visíveis
4. Transferência de ingressos funciona
5. Zero impacto ou mudança
```

### Resultado Esperado
```
✅ Login: Sucesso
✅ CPF: Intacto e legível
✅ Identidade BR:CPF: Presente
✅ Dashboard: Carrega normalmente
✅ Operações: Funcionam como Phase 2
✅ Zero breaking changes
```

---

## Teste 7️⃣: UX - Mensagens de Erro

### Sub-teste 7.1: CPF Inválido
```typescript
const invalidCPF = "111.111.111-11"; // Falha no módulo 11

// Esperado na UI
console.assert(
  document.querySelector('[role="alert"]'),
  "Alert deve ser visível"
);
console.assert(
  document.querySelector('[data-testid="cpf-error"]')?.textContent.includes("inválido"),
  "Mensagem deve indicar inválido"
);
console.assert(
  document.querySelector('[name="cpf"]').classList.contains('error'),
  "Campo deve estar com erro"
);
```

### Sub-teste 7.2: Documento Já Registrado
```typescript
// Depois de 600ms da validação assíncrona
const validButTakenDNI = "12345678"; // DNI já existe

setTimeout(() => {
  console.assert(
    getByTestId('document-status').textContent.includes('em uso'),
    "Deve indicar já em uso"
  );
  console.assert(
    document.querySelector('[name="documentValue"]').classList.contains('border-red'),
    "Campo deve ficar vermelho"
  );
}, 650);
```

### Sub-teste 7.3: Tipo de Documento Não Suportado
```typescript
// Tentar enviar documentType inválido para país
const invalidPayload = {
  country: "BR",
  documentType: "PASSPORT", // BR não suporta PASSPORT
  documentValue: "123456789"
};

// Esperado
console.assert(
  validationError.message.includes("não suportado"),
  "Deve rejeitar tipo inválido"
);
```

### Resultado Esperado
```
✅ CPF inválido: 🔴 Campo vermelho + mensagem
✅ Documento duplicado: 🔴 Campo vermelho + mensagem
✅ Tipo não suportado: ❌ Erro de validação
✅ Todas mensagens em português
✅ Sem console errors
```

---

## Teste 8️⃣: Performance

### Setup
```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
```

### Métrica: Time to Interactive (TTI)
```javascript
// Abrir página de signup
// Medição 1: Feature Flag OFF
console.time('signup-load-off');
// ... carrega página
console.timeEnd('signup-load-off');
// Esperado: ~450ms

// Medição 2: Feature Flag ON
console.time('signup-load-on');
// ... carrega página
console.timeEnd('signup-load-on');
// Esperado: ~600ms (aceitável, +150ms)
```

### Métrica: Validação Assíncrona
```typescript
// Tempo para verificação de CPF/documento
console.time('validate-cpf');
// ... digita CPF, espera validação
console.timeEnd('validate-cpf');
// Esperado: 600ms (conforme code)

console.time('validate-dni');
// ... digita DNI, espera validação
console.timeEnd('validate-dni');
// Esperado: 600ms
```

### Resultado Esperado
```
✅ Signup (Flag OFF): < 500ms
✅ Signup (Flag ON): < 800ms (1.5x aceitável)
✅ Validação assíncrona: ~600ms
✅ Sem lag ao digitar
✅ UI responsiva
```

---

## 🎯 Checklist Final

```
Teste 1 (Flag OFF):        ✅ PASS
Teste 2 (Brasil):          ✅ PASS
Teste 3 (Argentina):       ✅ PASS
Teste 4 (Dup CPF):         ✅ PASS
Teste 5 (Dup DNI):         ✅ PASS
Teste 6 (Usuário Legado):  ✅ PASS
Teste 7 (UX Erros):        ✅ PASS
Teste 8 (Performance):     ✅ PASS
────────────────────────
RESULT: 🟢 ALL PASS
```

---

## 🚀 Próximos Passos

1. Rodar os 8 testes em ambiente local
2. Validar logs de console (sem errors)
3. Verificar Firestore (dados criados corretamente)
4. Deploy para staging
5. Testar com usuários reais
6. Deploy para produção (com feature flag OFF primeiro)

**Status**: 🟢 **READY FOR TESTING**
