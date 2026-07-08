# Backfill de Identidades - Migração de Usuários Legados

## 📋 Visão Geral

Este documento descreve como migrar todos os usuários existentes da coleção legada `/users` para o novo sistema de identidades em `/user_identities`, com total segurança e reversibilidade.

**Status**: Produção Pronto | **Modo**: Administrativo | **Reversível**: Sim

---

## 🎯 Objetivo

Migrar usuários legados preservando:
- ✅ Total compatibilidade com sistema legado
- ✅ Segurança de dados (sem descriptografar CPF)
- ✅ Idempotência (pode ser executado múltiplas vezes)
- ✅ Recuperação de falhas (retomada parcial)
- ✅ Auditoria completa (relatório detalhado)

---

## 🔍 O que será Migrado

### Estrutura Legada (`/users`)
```json
{
  "uid": "user123",
  "cpfHash": "abc123...",
  "cpfMasked": "123.456.789-00",
  "cpfEncrypted": "encrypted_value",
  "createdAt": "2024-01-01T10:00:00Z"
}
```

### Estrutura Nova (`/user_identities`)
```json
{
  "userId": "user123",
  "country": "BR",
  "documentType": "CPF",
  "documentHash": "abc123...",        // Reaproveitado de cpfHash
  "documentMasked": "123.456.789-00", // Reaproveitado de cpfMasked
  "cpfEncrypted": "encrypted_value",  // Reaproveitado se existir
  "verificationStatus": "pending",
  "verificationLevel": "self",
  "isActive": true,
  "createdAt": "2024-01-01T10:00:00Z",
  "verifiedAt": null,
  "migratedFrom": "legacy_users",
  "migrationTimestamp": "2024-07-07T21:30:00Z"
}
```

### Atualização em `/users`
```json
{
  "primaryIdentityId": "user123:BR:CPF",
  "identityCount": 1,
  "country": "BR",
  "identityMigrationStatus": "completed",
  "enableInternationalIdentity": true,
  "lastIdentityUpdate": "2024-07-07T21:30:00Z"
}
```

---

## ⚡ Execução Rápida

### 1. Modo Dry-Run (Recomendado Primeiro)

```bash
# Simula a migração sem fazer alterações
npx ts-node scripts/backfill-user-identities.ts --dry-run

# Simulação com tamanho de lote customizado
npx ts-node scripts/backfill-user-identities.ts --dry-run --batch-size=100
```

**Saída esperada:**
```
🚀 Iniciando backfill de identidades...
   Modo: DRY-RUN
   Tamanho do lote: 50

📖 Buscando usuários legados...
✅ 1,234 usuários encontrados

🔄 Processando em lotes de 50...
   50/1234
   100/1234
   ...

═══════════════════════════════════════════════════════════
  BACKFILL USER IDENTITIES - RELATÓRIO FINAL
═══════════════════════════════════════════════════════════

📋 Modo: DRY-RUN (sem alterações)
⏱️  Duração: 4532ms (4.53s)
📦 Tamanho do lote: 50

📊 Estatísticas:
   Total processado: 1234
   ✅ Migrados: 1200
   ⏭️  Ignorados: 30
   ❌ Erros: 4

✅ Migrados (1200):
   ✅ user_123 → user_123:BR:CPF
   ✅ user_456 → user_456:BR:CPF
   ...

⏭️  Ignorados (30):
   ⏭️  user_789: Já migrado
   ⏭️  user_012: Sem cpfHash válido
   ...

❌ Erros (4):
   ❌ user_345: cpfHash inválido: invalid...
   ...

═══════════════════════════════════════════════════════════

💡 Para executar a migração de verdade, use: --execute
```

### 2. Execução Real

```bash
# Executa a migração de verdade
npx ts-node scripts/backfill-user-identities.ts --execute

# Com tamanho de lote otimizado para seu banco
npx ts-node scripts/backfill-user-identities.ts --execute --batch-size=200
```

**Saída esperada:** Mesma do dry-run, mas indicando modo `EXECUÇÃO REAL`.

---

## 🛡️ Validação da Migração

### Após Executar

#### 1. Verificar Estatísticas Globais

```sql
-- Quantos usuários foram migrados?
SELECT COUNT(*) as total_migrados
FROM users
WHERE identityMigrationStatus = 'completed';

-- Quantos usuarios ainda não foram migrados?
SELECT COUNT(*) as pendente
FROM users
WHERE identityMigrationStatus IS NULL 
   OR identityMigrationStatus != 'completed';
```

#### 2. Verificar Integridade das Identidades

```sql
-- Verificar que cada usuário migrado tem uma identidade
SELECT u.uid, 
       COUNT(i.documentHash) as identity_count
FROM users u
LEFT JOIN user_identities i ON i.userId = u.uid
WHERE u.identityMigrationStatus = 'completed'
GROUP BY u.uid
HAVING COUNT(i.documentHash) = 0;

-- Resultado esperado: 0 linhas (nenhum órfão)
```

#### 3. Validar Hashes Foram Preservados

```sql
-- Verificar que documentHash foi copiado de cpfHash
SELECT u.uid, u.cpfHash, i.documentHash,
       CASE 
           WHEN u.cpfHash = i.documentHash THEN 'OK'
           ELSE 'ERRO'
       END as status
FROM users u
JOIN user_identities i ON i.userId = u.uid
WHERE u.identityMigrationStatus = 'completed'
LIMIT 10;

-- Resultado esperado: Todos 'OK'
```

#### 4. Script de Validação Completa

```typescript
// scripts/validate-backfill.ts
import * as admin from 'firebase-admin';

async function validateMigration() {
  const db = admin.firestore();
  
  const usersSnapshot = await db.collection('users')
    .where('identityMigrationStatus', '==', 'completed')
    .get();

  let orphaned = 0;
  let mismatched = 0;
  let valid = 0;

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const identityDoc = await db.collection('user_identities')
      .doc(user.primaryIdentityId)
      .get();

    if (!identityDoc.exists) {
      orphaned++;
      console.warn(`❌ Órfão: ${user.uid} → ${user.primaryIdentityId}`);
      continue;
    }

    const identity = identityDoc.data();
    if (user.cpfHash !== identity.documentHash) {
      mismatched++;
      console.warn(`❌ Hash mismatch: ${user.uid}`);
      continue;
    }

    valid++;
  }

  console.log(`
✅ Validação Completa:
   Total migrado: ${usersSnapshot.size}
   ✅ Válidos: ${valid}
   ❌ Órfãos: ${orphaned}
   ❌ Hash mismatch: ${mismatched}
  `);
}

validateMigration().catch(console.error);
```

Executar:
```bash
npx ts-node scripts/validate-backfill.ts
```

---

## 🔄 Retomada e Re-execução

### Cenário: Falha Parcial

Se a migração for interrompida (crash, timeout, etc):

1. **Verificar o relatório:**
   ```bash
   cat reports/backfill-report-*.json
   ```

2. **Re-executar em modo dry-run:**
   ```bash
   npx ts-node scripts/backfill-user-identities.ts --dry-run
   ```
   
   O script é idempotente e identificará automaticamente:
   - ✅ Usuários já migrados (será pulado)
   - ❌ Usuários parcialmente processados (será retomado)

3. **Re-executar a migração:**
   ```bash
   npx ts-node scripts/backfill-user-identities.ts --execute
   ```

### Teste de Idempotência

```bash
# Primeira execução
npx ts-node scripts/backfill-user-identities.ts --dry-run

# Segunda execução (deve indicar 0 novos migrados)
npx ts-node scripts/backfill-user-identities.ts --dry-run
```

**Resultado esperado:**
```
📊 Estatísticas:
   Total processado: 1234
   ✅ Migrados: 0        ← Nenhum novo
   ⏭️  Ignorados: 1234    ← Todos já processados
   ❌ Erros: 0
```

---

## ⚙️ Otimização de Performance

### Tamanho do Lote

- **Padrão:** `50` (recomendado)
- **Produção Alto Volume:** `100-200`
- **Limite Firestore:** `500`

```bash
# Otimizado para volumetria alta
npx ts-node scripts/backfill-user-identities.ts --execute --batch-size=150
```

### Executar em Horário de Baixa Atividade

```bash
# Exemplo: 3 AM UTC (off-peak)
0 3 * * * cd /app && npx ts-node scripts/backfill-user-identities.ts --execute
```

---

## 🔙 Reversão de Emergência

### Se Descobrir Problema

#### 1. Parar o Script
- `Ctrl+C` se ainda estiver em execução

#### 2. Analisar Problema
```bash
# Revisar relatório de erro
cat reports/backfill-report-*.json | jq '.summary.errorDetails'
```

#### 3. Opção A: Corrigir e Re-executar
```bash
# Se o erro for identificado e corrigido
npx ts-node scripts/backfill-user-identities.ts --dry-run
npx ts-node scripts/backfill-user-identities.ts --execute
```

#### Opção B: Reverter Manualmente
```typescript
// scripts/rollback-backfill.ts
import * as admin from 'firebase-admin';

async function rollback() {
  const db = admin.firestore();
  
  const usersSnapshot = await db.collection('users')
    .where('identityMigrationStatus', '==', 'completed')
    .get();

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    
    // Deletar identidade
    await db.collection('user_identities')
      .doc(user.primaryIdentityId)
      .delete();

    // Reverter marcação de migração
    await userDoc.ref.update({
      primaryIdentityId: admin.firestore.FieldValue.delete(),
      identityCount: admin.firestore.FieldValue.delete(),
      country: admin.firestore.FieldValue.delete(),
      identityMigrationStatus: admin.firestore.FieldValue.delete(),
      enableInternationalIdentity: admin.firestore.FieldValue.delete(),
      lastIdentityUpdate: admin.firestore.FieldValue.delete(),
    });
  }

  console.log('✅ Reversão completa');
}

rollback().catch(console.error);
```

Executar:
```bash
npx ts-node scripts/rollback-backfill.ts
```

---

## 📊 Monitoramento

### Logs Importantes

```bash
# Ver relatórios de migração
ls -lah reports/

# Filtrar apenas erros
cat reports/backfill-report-*.json | jq '.summary.errorDetails'

# Contar migrações por dia
ls -lah reports/ | grep $(date +%Y-%m-%d)
```

### Métricas

- **Taxa de Migração:** Total migrado / Tempo total
- **Taxa de Erro:** Erros / Total processado
- **Usuários Órfãos:** COUNT(*) onde `primaryIdentityId` não existe em `user_identities`

---

## ⚠️ Casos de Uso Especiais

### Apenas Usuários Específicos

Se precisar migrar apenas um subconjunto:

```typescript
// Modificar fetchAllUsers() para filtrar
const users = await db.collection('users')
  .where('country', '==', 'BR')  // Apenas Brasil
  .where('cpfHash', '!=', '')    // Que têm CPF
  .limit(1000)
  .get();
```

### Migração Agendada

```bash
# Via Cloud Scheduler
gcloud scheduler jobs create http backfill-identities \
  --schedule="0 3 * * *" \
  --uri="https://your-project.cloudfunctions.net/backfill-identities" \
  --http-method=POST \
  --oidc-service-account-email=your-sa@project.iam.gserviceaccount.com
```

### Integração com CI/CD

```yaml
# .github/workflows/backfill-identities.yml
name: Backfill Identities

on:
  workflow_dispatch:  # Manual trigger
    inputs:
      mode:
        description: 'dry-run ou execute'
        required: true
        default: 'dry-run'

jobs:
  backfill:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: |
          npx ts-node scripts/backfill-user-identities.ts --${{ github.event.inputs.mode }}
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.FIREBASE_CONFIG }}
```

---

## 📝 Checklist Pré-Migração

- [ ] Backup do Firestore realizado
- [ ] Modo dry-run executado com sucesso
- [ ] Equipe notificada sobre a janela de migração
- [ ] Monitoramento de alertas ativo
- [ ] Script de reversão testado
- [ ] Plano de contingência documentado
- [ ] Horário de baixa atividade escolhido

---

## 📞 Suporte e Troubleshooting

### Problema: `GCP Authentication Error`

**Solução:**
```bash
# Verificar credenciais
echo $GOOGLE_APPLICATION_CREDENTIALS

# Ou usar Application Default Credentials
gcloud auth application-default login
```

### Problema: `Timeout: Firestore Read/Write exceeded`

**Solução:**
```bash
# Reduzir tamanho do lote
npx ts-node scripts/backfill-user-identities.ts --execute --batch-size=25
```

### Problema: `Relatório não salvo`

**Solução:**
```bash
# Criar diretório reports
mkdir -p reports/
chmod 755 reports/
```

---

## 📚 Referências

- [Documentação Phase 3 - Identity System](../docs/PHASE-3-IMPLEMENTATION.md)
- [Schema User Identities](../firebase/user-identities-schema.json)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)

---

## ✅ Conclusão

A migração é:
- **Segura**: Sem descriptografia de dados
- **Reversível**: Pode ser desfeita completamente
- **Idempotente**: Pode ser executada múltiplas vezes
- **Auditável**: Relatório detalhado de cada operação
- **Monitorável**: Métricas e validações

Execute com confiança! 🚀
