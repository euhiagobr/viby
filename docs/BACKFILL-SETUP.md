# Backfill User Identities - Setup & Preparação

## ✅ Pré-Requisitos

### 1. Dependências Instaladas
```bash
# Verificar
npm list firebase-admin ts-node vitest

# Se faltar algo:
npm install firebase-admin ts-node vitest -D
```

### 2. Credenciais Firebase Configuradas
```bash
# Verificar arquivo existe
ls -la firebase/admin-sdk-config.json

# Ou definir variável:
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/firebase/admin-sdk-config.json"
```

### 3. Ambiente Pronto
```bash
# Verificar Node version
node --version  # >= 18 recomendado

# Verificar npm
npm --version   # >= 8 recomendado

# Verificar Firebase conecta
npm run build   # Compilar TypeScript
```

---

## 📋 Checklist Pré-Execução

### Antes de Qualquer Coisa

- [ ] **Backup Firestore**
  ```bash
  # Informar ao DevOps para fazer backup
  # Ou verificar que backup automático está ativo
  ```

- [ ] **Verificar Volume de Dados**
  ```bash
  # Estimar quanto tempo levará
  # ~50 documentos por segundo
  # Se 100k usuários: ~33 minutos
  ```

- [ ] **Janela de Manutenção Planejada**
  ```bash
  # Informar time
  # Reduzir tráfego (opcional)
  # Notificar suporte
  ```

### Preparação Técnica

- [ ] **Atualizar Código Local**
  ```bash
  git pull origin main
  npm install
  ```

- [ ] **Compilar Scripts**
  ```bash
  npm run build
  ```

- [ ] **Testar Conexão Firebase**
  ```bash
  npm run backfill:validate
  # Deve retornar estatísticas atuais
  ```

- [ ] **Criar Diretório de Relatórios**
  ```bash
  mkdir -p reports
  ```

### Executar Testes

- [ ] **Testes Unitários**
  ```bash
  npm run backfill:test
  # Deve passar 100%
  ```

- [ ] **Dry-Run Local**
  ```bash
  npm run backfill:dry-run
  # Deve completar sem erro
  ```

---

## 🔍 Validações Pré-Execução

### 1. Validar Estrutura de Dados Legados

```bash
# Script de validação
cat > /tmp/validate-legacy.js << 'EOF'
const admin = require('firebase-admin');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert(
    require('./firebase/admin-sdk-config.json')
  ),
});

const db = admin.firestore();

async function main() {
  const users = await db.collection('users')
    .limit(5)
    .get();

  console.log('📋 Amostra de usuários legados:');
  users.forEach(doc => {
    const { cpfHash, cpfMasked, cpfEncrypted, uid } = doc.data();
    console.log(`\n${uid}:`);
    console.log(`  cpfHash: ${cpfHash ? '✅' : '❌'} (${String(cpfHash).length} chars)`);
    console.log(`  cpfMasked: ${cpfMasked ? '✅' : '❌'}`);
    console.log(`  cpfEncrypted: ${cpfEncrypted ? '✅' : '❌'}`);
  });

  process.exit(0);
}

main();
EOF

node /tmp/validate-legacy.js
```

### 2. Validar Coleção de Destino

```bash
cat > /tmp/validate-destination.js << 'EOF'
const admin = require('firebase-admin');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert(
    require('./firebase/admin-sdk-config.json')
  ),
});

const db = admin.firestore();

async function main() {
  const identities = await db.collection('user_identities').get();
  console.log(`📊 Identidades existentes: ${identities.size}`);
  
  if (identities.size > 0) {
    console.log('⚠️  Coleção não está vazia!');
    console.log('Primeiras 3:');
    identities.docs.slice(0, 3).forEach(doc => {
      console.log(`  ${doc.id}: ${doc.data().documentType}`);
    });
  }

  process.exit(0);
}

main();
EOF

node /tmp/validate-destination.js
```

### 3. Validar Permissões Firestore

```bash
# Verificar security rules permitem escrita em user_identities
cat firebase/security-rules.md | grep -A 5 "user_identities"
```

---

## 🚀 Execução Passo-a-Passo

### Passo 1: Simular (DRY-RUN)

```bash
echo "🔄 Iniciando dry-run..."
npm run backfill:dry-run 2>&1 | tee backfill-dry-run.log

# Revisar output
echo "📊 Resultado do dry-run:"
tail -20 backfill-dry-run.log
```

**Esperado:**
- ✅ Sem erros críticos
- ✅ Mostra quantos usuários seriam migrados
- ✅ Arquivo de relatório criado em `reports/`

### Passo 2: Revisar Relatório

```bash
# Ver último relatório
ls -lt reports/backfill-report-*.json | head -1 | awk '{print $NF}' | xargs cat | jq '.'

# Particularmente, verificar:
# - "totalProcessed": deve ser > 0
# - "errors": deve ser = 0
# - "migrated": deve ser = totalProcessed
```

### Passo 3: Executar

```bash
echo "⏳ Executando migração real..."
npm run backfill:execute 2>&1 | tee backfill-execute.log

# NÃO INTERROMPER! Deixar completar
echo "✅ Migração concluída"
```

**Esperado:**
- ✅ Sem erros críticos
- ✅ Confirma X usuários migrados
- ✅ Arquivo de relatório criado

### Passo 4: Validar

```bash
echo "🔍 Validando integridade..."
npm run backfill:validate 2>&1 | tee backfill-validate.log

# Ver resultado
cat backfill-validate.log
```

**Esperado:**
- ✅ "VALIDAÇÃO COMPLETA - SEM ERROS"
- ✅ Identidades válidas = usuários migrados
- ✅ Zero órfãos
- ✅ Zero mismatches

---

## 📊 Exemplos de Output

### Dry-Run Bem-Sucedido

```
🔹 Iniciando backfill com modo: dry-run
ℹ️  Conexão com Firebase inicializada
ℹ️  Buscando usuários para migrar...
ℹ️  3,456 usuários encontrados
🔹 Processando em lotes de 50...
✅ Lote 1/70 processado
✅ Lote 2/70 processado
...
✅ Lote 70/70 processado

╔════════════════════════════════════════╗
║      BACKFILL USER IDENTITIES         ║
║        RELATÓRIO FINAL                 ║
╚════════════════════════════════════════╝

📋 Modo: DRY-RUN (sem alterações)
⏱️  Duração: 12543ms (12.54s)
📦 Tamanho do lote: 50

📊 Estatísticas:
   Total processado: 3456
   ✅ Migrados: 3456
   ⏭️  Ignorados: 0
   ❌ Erros: 0

Taxa de sucesso: 100.0%

✅ Relatório salvo em: reports/backfill-report-2024-07-07T...json
```

### Execute Bem-Sucedido

```
[Similar ao dry-run, mas com]

📋 Modo: EXECUÇÃO REAL
✅ Documentos criados em /user_identities
✅ Usuários atualizados em /users
```

### Validação Bem-Sucedida

```
╔════════════════════════════════════════╗
║   VALIDAÇÃO PÓS-MIGRAÇÃO - COMPLETA   ║
╚════════════════════════════════════════╝

📊 ESTATÍSTICAS GERAIS:
   Total de usuários: 5000
   Usuários migrados: 3456
   Usuários pendentes: 1544
   Percentual: 69.1%

✅ VALIDAÇÃO DE MIGRAÇÕES:
   Total processado: 3456
   ✅ Válidas: 3456
   ❌ Órfãs: 0
   ❌ Hash mismatch: 0
   ❌ Status inválido: 0

════════════════════════════════════════
✅ VALIDAÇÃO COMPLETA - SEM ERROS
   Todas as migrações estão íntegras!
════════════════════════════════════════
```

---

## 🆘 Troubleshooting

### ❌ "Permission denied" ao iniciar Firebase

**Solução:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/firebase/admin-sdk-config.json"
npm run backfill:dry-run
```

### ❌ "ts-node: command not found"

**Solução:**
```bash
npm install -g ts-node
# Ou
npx ts-node scripts/backfill-user-identities.ts --dry-run
```

### ❌ Dry-run muito lento

**Solução:**
```bash
# Aumentar batch size
ts-node scripts/backfill-user-identities.ts --dry-run --batch-size=200
```

### ❌ Erros durante execução

**Solução:**
```bash
# Ver detalhes do erro
cat reports/backfill-report-*.json | jq '.details.errors'

# Rollback se necessário
npm run backfill:rollback:dry-run  # Simular
npm run backfill:rollback:execute  # Executar
```

---

## 📞 Suporte Durante Execução

**Contatos:**
- Erro geral → DevOps
- Erro de dados → Backend
- Erro de permissões → SRE

---

**Próximo**: Ler [BACKFILL-IDENTITIES.md](BACKFILL-IDENTITIES.md) para documentação completa
