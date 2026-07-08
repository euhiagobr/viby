# Sistema de Identidades Internacionais - Viby

**Phase**: 1 (Foundation)  
**Status**: Foundation - Schema and utilities only  
**Last Updated**: 2026-07-07

## Objetivo

Criar uma fundação segura para substituir a dependência exclusiva de CPF por um sistema internacional de identidade que suporte múltiplos documentos por país.

## Por Quê?

- 🌍 **Internacionalização**: Viby opera em múltiplos países (Brasil, Argentina, EUA, Espanha, Portugal)
- 📋 **Flexibilidade**: Cada país tem seus próprios documentos (CPF, DNI, Passport, etc)
- 🔄 **Escalabilidade**: Padrão preparado para futuras expansões
- 🎫 **Ingressos Nominais**: Identificação precisa do titular

## Arquitetura

### Collections Firestore

#### 1. `user_identities` (NOVA)

Armazena identidades internacionais de usuários.

```
/user_identities/{identityId}
├── userId              // Firebase Auth UID
├── country             // "BR", "AR", "US", "ES", "PT"
├── documentType        // "CPF", "DNI", "PASSPORT", ...
├── documentHash        // SHA256 (único, irreversível)
├── documentMasked      // Exibição segura: "***.***.789-00"
├── verificationStatus  // "pending" | "verified" | "expired" | "revoked"
├── verificationLevel   // "self" | "document_upload" | "kyc"
├── isActive           // Identidade primária?
├── expiresAt          // Null ou timestamp (para documentos com validade)
├── createdAt, updatedAt, verifiedAt
```

**Índices**:
- `documentHash` (único)
- `(userId, isActive)`
- `(userId, verificationStatus)`
- `(country, verificationStatus)`

#### 2. `ticket_transfers` (NOVA - Structure only)

Estrutura preparada para futuras transferências. **Vazia na Phase 1** (sem lógica).

```
/ticket_transfers/{transferId}
├── ticketId, eventId
├── fromUserId, fromIdentityId
├── toUserId (null até aceitar), toIdentityId (null até aceitar)
├── status    // "pending" | "accepted" | "rejected" | "expired"
├── requestedAt, respondedAt, acceptedAt, expiresAt
└── auditTrail
```

**Índices**:
- `(fromUserId, status)`
- `(toUserId, status)`
- `ticketId`

## Documentos Suportados (Phase 1)

### 🇧🇷 Brasil (BR)

| Tipo | Exemplo | Min | Max | Checksum |
|------|---------|-----|-----|----------|
| CPF | 123.456.789-00 | 11 | 11 | Sim |
| RG | 12.345.678 | 7 | 9 | Não |

### 🇦🇷 Argentina (AR)

| Tipo | Exemplo | Min | Max | Checksum |
|------|---------|-----|-----|----------|
| DNI | 12.345.678 | 8 | 8 | Não |

### 🇺🇸 Estados Unidos (US)

| Tipo | Exemplo | Min | Max | Checksum |
|------|---------|-----|-----|----------|
| PASSPORT | C12345ABC | 6 | 9 | Não |
| SSN | 123-45-6789 | 9 | 9 | Não |
| DRIVER_LICENSE | ABC12345 | 5 | 20 | Não |

### 🇪🇸 Espanha (ES)

| Tipo | Exemplo | Min | Max | Checksum |
|------|---------|-----|-----|----------|
| NIE | X1234567L | 9 | 9 | Sim |

### 🇵🇹 Portugal (PT)

| Tipo | Exemplo | Min | Max | Checksum |
|------|---------|-----|-----|----------|
| CARTAO_CIDADAO | 12345678 | 8 | 8 | Não |

## Segurança

### Princípios

```
❌ NUNCA FAZER
├─ Armazenar documento completo
├─ Armazenar documento em texto claro
├─ Armazenar documento criptografado
├─ Transmitir documento pela rede
├─ Logar documento em traces
└─ Expor documento ao admin

✅ SEMPRE FAZER
├─ Usar hash (SHA256) para busca/validação
├─ Usar masked para exibição ao usuário
├─ Auditar acesso e alterações
├─ Proteger via Firestore Rules
└─ Usar HTTPS para comunicação
```

### Hash: Irreversível

```
Hash = SHA256("BR:CPF:12345678900")
Resultado: 0a1b2c3d4e5f6g7h...

⚠️ Nunca pode voltar a "12345678900"
✅ Permite validar unicidade
✅ Permite encontrar usuário
```

### Masked: Safe para UI

```
maskDocument("12345678900", "BR", "CPF")
Resultado: "***.***.789-00"

✅ Seguro exibir ao usuário
✅ Mostra apenas últimos dígitos
✅ Zero exposição do documento real
```

### Admin: Sem Acesso Direto

- ❌ Admin NÃO pode visualizar documento completo via UI
- ✅ Admin pode verificar unicidade via `documentHash`
- 🔮 **Futuro (Phase 6)**: Cloud Function para admin com auditoria completa

## Compatibilidade com CPF Legado

### ✅ O CPF NÃO foi removido

O sistema mantém **100% de compatibilidade** com código existente:

```
/users/{uid}
├── cpfHash      ✅ Funcional
├── cpfMasked    ✅ Funcional
├── cpf          ✅ Funcional
├── needsCPFUpdate ✅ Funcional
├── primaryIdentityId ✨ NOVO (opcional)
└── identityMigrationStatus ✨ NOVO (opcional)
```

### ✅ Funcionalidades Não Alteradas

- ✅ **Cadastro** (SignUpForm): CPF obrigatório (ainda)
- ✅ **Onboarding**: CPF obrigatório (ainda)
- ✅ **Compra de ingressos**: Usa CPF existente (sem mudanças)
- ✅ **API /integrations/tickets/find**: Usa `cpfHash` (sem mudanças)
- ✅ **Perfil**: Exibe CPF masked (sem mudanças)
- ✅ **Admin**: Protege CPF (sem mudanças)

### Wrappers de Compatibilidade

Funções antigas continuam funcionando:

```typescript
// OLD (legado)
hashCPF(cpf)      → hashDocument(cpf, "BR", "CPF")
maskCPF(cpf)      → maskDocument(cpf, "BR", "CPF")
validateCPF(cpf)  → isValidDocumentFormat(cpf, "BR", "CPF")

// NEW (novos documentos)
hashDocument("12345678", "AR", "DNI")
maskDocument("ABC123", "US", "PASSPORT")
isValidDocumentFormat("ABC123", "US", "PASSPORT")
```

## Utilitários Disponíveis

### `src/lib/identity-utils.ts`

```typescript
// Normalização
normalizeDocument(value, country, type)

// Hashing
hashDocument(value, country, type)
hashCPF(cpf)  // Compatibilidade

// Masking
maskDocument(value, country, type)
maskCPF(cpf)  // Compatibilidade

// Validação
isValidDocumentFormat(value, country, type)
validateCPF(cpf)  // Compatibilidade

// Utilitários
getDefaultDocumentTypeForCountry(country)
isSupportedCountry(country)
isSupportedDocumentType(country, type)
getDocumentTypesForCountry(country)
```

### `src/lib/identity-validation.ts`

```typescript
// Constante: COUNTRY_DOCUMENTS
COUNTRY_DOCUMENTS['BR']['CPF']  // { name, regex, minLength, ... }

// Funções
getDocumentTypesForCountry(countryCode)
getSupportedCountries()
getValidationRule(countryCode, documentType)
isSupportedCountry(countryCode)
isSupportedDocumentType(countryCode, documentType)
```

## Fases de Implementação

### ✅ Phase 1: Fundações (ATUAL)

- [x] Collections `user_identities`, `ticket_transfers` criadas
- [x] Schema em `firebase/user-identities-schema.json`
- [x] Schema em `firebase/ticket-transfers-schema.json`
- [x] Firestore Rules (novos acessos)
- [x] Índices criados
- [x] Utilitários `identity-utils.ts`
- [x] Validação `identity-validation.ts`
- [x] Documentação `user-identities.md`

### ⏳ Phase 2: Backend

- [ ] Cloud Functions (onIdentityCreated, etc)
- [ ] Lógica de dual-write em `finalizeUserRegistration`

### ⏳ Phase 3: Signup

- [ ] SignUpForm: seletor de país
- [ ] Validação em tempo real por país

### ⏳ Phase 4: Perfil

- [ ] Tela para gerenciar identidades
- [ ] UI para adicionar identidade

### ⏳ Phase 5: Transferência

- [ ] Feature completa de transferência
- [ ] Aceitação + validação

### ⏳ Phase 6+: Admin & Migração

- [ ] Admin visualizar identidades
- [ ] Migração de usuários legados

## FAQ

### P: O CPF será removido?

**R**: Não. CPF continua funcional por 12+ meses mínimo. Phase 1 é apenas fundação.

### P: Qual é o impacto no sistema atual?

**R**: Zero. Signup, onboarding, compras e ingressos funcionam exatamente como antes.

### P: Posso migrar meus usuários agora?

**R**: Não. Migração automática será Phase 6. Usuários podem adicionar identidades voluntariamente em Phase 4.

### P: Como fica a transferência de ingressos?

**R**: Estrutura criada agora. Lógica implementada em Phase 5.

### P: Documentos internacionais funcionam já?

**R**: Infraestrutura está pronta. Novo signup com identidades será Phase 3.

## Próximos Passos

1. **Phase 2** (Semana 3-4): Backend - Cloud Functions
2. **Phase 3** (Semana 5-6): Frontend - Novo signup
3. **Phase 4** (Semana 7-9): Frontend - Gerenciar identidades
4. **Phase 5** (Semana 10-12): Feature - Transferência de ingressos
5. **Phase 6+** (Semana 13+): Admin & Migração

## Conclusão

Phase 1 criou a fundação segura e escalável para identidades internacionais, **sem quebrar nada do sistema atual**. CPF continua funcionando, novo código está pronto para as próximas fases.
