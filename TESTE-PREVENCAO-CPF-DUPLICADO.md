# ✅ Teste - Prevenção de CPF Duplicado

## 🎯 Objetivo
Validar que CPFs duplicados são prevenidos ANTES de criar usuários no Firebase Auth e Firestore.

---

## 📋 Cenários de Teste

### Cenário 1: CPF Inexistente ✅
**Objetivo**: Usuário deve ser criado normalmente

```
Email: teste1@viby.com
Senha: Senha123!
Nome: Usuário Teste 1
Username: @usuario_teste_1
CPF: 123.456.789-09
Gênero: Masculino

Resultado esperado:
✅ Usuário criado no Firebase Auth
✅ Usuário salvo em /users com cpfHash
✅ Identidade criada em /user_identities (BR:CPF)
✅ Redirecionado para /dashboard
```

---

### Cenário 2: CPF Existente (Sem Formatação) ❌
**Objetivo**: Cadastro bloqueado com mensagem específica

```
Email: teste2@viby.com
Senha: Senha123!
Nome: Usuário Teste 2
Username: @usuario_teste_2
CPF: 12345678909  // Mesma pessoa do Cenário 1

Resultado esperado:
❌ Error: "Este CPF já está cadastrado. Faça login ou recupere sua senha."
❌ NÃO criado em Firebase Auth
❌ NÃO criado em /users
❌ Nenhum registro de identidade criado
```

---

### Cenário 3: CPF Existente (Com Formatação Diferente) ❌
**Objetivo**: Sistema reconhece como duplicado mesmo com formatação diferente

```
Email: teste3@viby.com
Senha: Senha123!
Nome: Usuário Teste 3
Username: @usuario_teste_3
CPF: 123.456.789-09  // Formatação diferente de 12345678909

Resultado esperado:
❌ Error: "Este CPF já está cadastrado. Faça login ou recupere sua senha."
❌ Reconhece como duplicado (normalizou 123.456.789-09 → 12345678909)
```

---

### Cenário 4: Email Duplicado ❌
**Objetivo**: Email duplicado bloqueado

```
Email: teste1@viby.com  // Mesmo do Cenário 1
Senha: Senha123!
Nome: Usuário Teste 4
Username: @usuario_teste_4
CPF: 111.222.333-44

Resultado esperado:
❌ Error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha."
❌ code: EMAIL_ALREADY_EXISTS
```

---

### Cenário 5: Username Duplicado ❌
**Objetivo**: Username duplicado bloqueado

```
Email: teste5@viby.com
Senha: Senha123!
Nome: Usuário Teste 5
Username: @usuario_teste_1  // Mesmo do Cenário 1
CPF: 222.333.444-55

Resultado esperado:
❌ Error: "Este @username já está sendo usado."
❌ code: USERNAME_ALREADY_EXISTS
```

---

## 🔍 Verificações Técnicas

### Após cada teste bem-sucedido (Cenário 1):

1. **Verificar Firebase Auth**:
   ```bash
   # No Firebase Console:
   - Autenticação > Usuários
   - Confirmar que teste1@viby.com foi criado
   ```

2. **Verificar /users**:
   ```
   db.collection("users").where("email", "==", "teste1@viby.com").get()
   
   Esperado:
   {
     uid: "auto-generated",
     email: "teste1@viby.com",
     name: "Usuário Teste 1",
     username: "usuario_teste_1",
     cpfHash: "sha256(...)", // Hash do CPF
     cpfMasked: "123.456.789-09",
     cpf: "123.456.789-09"
   }
   ```

3. **Verificar /user_identities**:
   ```
   db.collection("user_identities").where("userId", "==", uid).get()
   
   Esperado:
   {
     userId: uid,
     country: "BR",
     documentType: "CPF",
     documentHash: "sha256(...)", // Hash do documento
     documentMasked: "123.456.789-09",
     verificationStatus: "pending"
   }
   ```

---

## 🛡️ Fluxo de Prevenção de Duplicação

```
Usuário preenche formulário
         ↓
[CLIENTE] Envia para createUserWithValidation()
         ↓
[SERVIDOR] Normaliza CPF: 123.456.789-09 → 12345678909
         ↓
[SERVIDOR] Valida CPF (algoritmo mod11)
         ↓
[SERVIDOR] ⚠️  VALIDAÇÃO CRÍTICA: Procura cpfHash em /users
         ├─ Encontrado? ❌ Retorna erro (CPF_ALREADY_EXISTS)
         └─ Não encontrado? Continua...
         ↓
[SERVIDOR] ⚠️  VALIDAÇÃO CRÍTICA: Procura documentHash em /user_identities
         ├─ Encontrado? ❌ Retorna erro (DOCUMENT_ALREADY_EXISTS)
         └─ Não encontrado? Continua...
         ↓
[SERVIDOR] ⚠️  VALIDAÇÃO CRÍTICA: Procura email em Firebase Auth
         ├─ Encontrado? ❌ Retorna erro (EMAIL_ALREADY_EXISTS)
         └─ Não encontrado? Continua...
         ↓
[SERVIDOR] ⚠️  VALIDAÇÃO CRÍTICA: Procura username em /usernames
         ├─ Encontrado? ❌ Retorna erro (USERNAME_ALREADY_EXISTS)
         └─ Não encontrado? Continua...
         ↓
✅ TODAS AS VALIDAÇÕES PASSARAM
         ↓
[ADMIN AUTH] Cria usuário em Firebase Auth
         ↓
[FIRESTORE TRANSACTION] Salva em /users e /user_identities
         ↓
✅ Usuário criado com sucesso
```

---

## 🔐 Código-Chave

### Normalização de CPF
```typescript
function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");  // Remove tudo exceto dígitos
}

// Exemplos:
normalizeCPF("123.456.789-09")  // → "12345678909"
normalizeCPF("12345678909")      // → "12345678909"
normalizeCPF("123 456 789-09")   // → "12345678909"
```

### Hash para Comparação
```typescript
const cpfHash = hashCPF("12345678909");  // SHA256 hash

// Sempre retorna o MESMO hash para o MESMO CPF
hashCPF("123.456.789-09")  // → mesmo hash
hashCPF("12345678909")     // → mesmo hash
```

### Verificação de Duplicação
```typescript
async function cpfExists(db, cpf: string): Promise<boolean> {
  const cleanCPF = normalizeCPF(cpf);
  const cpfHash = hashCPF(cleanCPF);
  
  // Busca em /users
  const usersQuery = db.collection("users")
    .where("cpfHash", "==", cpfHash)
    .limit(1);
  if (!usersQuery.empty) return true;
  
  // Busca em /user_identities
  const docHash = hashDocument(cleanCPF, 'BR', 'CPF');
  const identitiesQuery = db.collection("user_identities")
    .where("documentHash", "==", docHash)
    .limit(1);
  
  return !identitiesQuery.empty;
}
```

---

## 📊 Resultado Esperado

| Cenário | Descrição | Status | Código |
|---------|-----------|--------|--------|
| 1 | CPF inexistente | ✅ Criado | 201 |
| 2 | CPF duplicado (sem formatação) | ❌ Bloqueado | CPF_ALREADY_EXISTS |
| 3 | CPF duplicado (formatação diferente) | ❌ Bloqueado | CPF_ALREADY_EXISTS |
| 4 | Email duplicado | ❌ Bloqueado | EMAIL_ALREADY_EXISTS |
| 5 | Username duplicado | ❌ Bloqueado | USERNAME_ALREADY_EXISTS |

---

## 🚀 Como Testar

### 1. Iniciar servidor local
```bash
npm run dev
# Acessa http://localhost:3000
```

### 2. Abrir em dois navegadores
- **Navegador A**: Faz login
- **Navegador B**: Tenta cadastrar com dados duplicados

### 3. Verificar console do servidor
```
[createUserWithValidation] Erro: Este CPF já está cadastrado...
```

### 4. Verificar Firebase Console
- **Autenticação**: Confirma quantos usuários foram criados
- **Firestore**: Valida estrutura de dados

---

## ✅ Correções Implementadas

### ❌ ANTES (Inseguro)
```typescript
// SignUpForm.tsx - OLD (INSEGURO)
const user = await createUserWithEmailAndPassword(auth, email, password);
// ⚠️ Usuário criado no Firebase Auth!
const result = await finalizeUserRegistration({ uid: user.uid, ... });
// Se isto falhar: usuário fica órfão no Auth
```

### ✅ DEPOIS (Seguro)
```typescript
// SignUpForm.tsx - NEW (SEGURO)
const result = await createUserWithValidation({
  email, password, username, cpf, ...
});
// Todas as validações ANTES de criar no Auth
// Transação atômica: tudo ou nada
```

### Mudanças nos Arquivos

1. **src/app/actions/user.ts**
   - ✅ Adicionadas: `normalizeCPF()`, `cpfExists()`, `documentExists()`
   - ✅ Adicionada: `createUserWithValidation()` (nova função principal)
   - ✅ Mantida: `finalizeUserRegistration()` para compatibilidade

2. **src/components/auth/SignUpForm.tsx**
   - ❌ Removido: `createUserWithEmailAndPassword()` direct call
   - ✅ Adicionado: Import de `createUserWithValidation`
   - ✅ Modificado: `onSubmit()` para usar nova função
   - ❌ Removido: Import desnecessário de `createUserWithEmailAndPassword`

---

## 🎓 Conceitos-Chave

### Hash vs Criptografia
- **Hash**: Não reversível, sempre gera MESMO hash para MESMO input
- **Criptografia**: Reversível, pode descriptografar

### CPF vs documentHash
- **CPF**: Muito sensível, armazenado ENCRIPTADO
- **documentHash**: Hash do CPF, usado APENAS para buscar duplicatas
- **cpfHash**: Legado, mantido para compatibilidade

### Transação Firestore
- Garante atomicidade: ou tudo é salvo ou nada é
- Se houver erro, rollback automático
- Evita estado inconsistente

---

## 📞 Support

Se algo não funcionar, verificar:
1. ✅ O `.env` tem as credenciais Firebase corretas?
2. ✅ Firebase Rules permitem escrita em `/users` e `/user_identities`?
3. ✅ Admin SDK está inicializado corretamente?
4. ✅ Funções de hash estão retornando valores consistentes?

