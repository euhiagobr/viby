/**
 * Backfill Script: Migração de usuários legados para o novo sistema de identidades
 * 
 * Migra todos os usuários da coleção `/users` para `/user_identities`
 * Preservando total compatibilidade e sem descriptografar dados sensíveis.
 * 
 * Execução:
 *   npx ts-node scripts/backfill-user-identities.ts --dry-run
 *   npx ts-node scripts/backfill-user-identities.ts --execute
 *   npx ts-node scripts/backfill-user-identities.ts --batch-size=100
 */

import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface LegacyUser {
  uid: string;
  cpfHash?: string;
  cpfMasked?: string;
  cpfEncrypted?: string;
  identityMigrationStatus?: string;
  primaryIdentityId?: string;
  [key: string]: any;
}

interface MigrationResult {
  userId: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  identityId?: string;
  error?: string;
}

interface MigrationReport {
  startTime: number;
  endTime: number;
  durationMs: number;
  dryRun: boolean;
  batchSize: number;
  totalProcessed: number;
  migrated: number;
  skipped: number;
  errors: number;
  results: MigrationResult[];
  summary: {
    migratedDetails: string[];
    skippedDetails: string[];
    errorDetails: string[];
  };
}

// ============================================================================
// Config
// ============================================================================

const DEFAULT_BATCH_SIZE = 50;
const FIRESTORE_BATCH_LIMIT = 500;

// ============================================================================
// Initialize Firebase
// ============================================================================

function initializeFirebase() {
  if (!admin.apps || admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId
      });
    } else {
      // Fallback: tentar arquivo local
      const credentialsPath = path.join(process.cwd(), 'firebase', 'admin-sdk-config.json');
      if (fs.existsSync(credentialsPath)) {
        const serviceAccount = JSON.parse(
          fs.readFileSync(credentialsPath, 'utf-8')
        );
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        console.warn('⚠️  Credenciais do Firebase não encontradas. Usando credenciais padrão...');
        admin.initializeApp();
      }
    }
  }
  return admin.firestore();
}

// ============================================================================
// Validation Functions
// ============================================================================

function shouldMigrateUser(user: LegacyUser): boolean {
  // Usuário já foi migrado?
  if (user.identityMigrationStatus === 'completed') {
    return false;
  }

  // Já possui primaryIdentityId?
  if (user.primaryIdentityId) {
    return false;
  }

  // Possui cpfHash válido?
  if (!user.cpfHash || typeof user.cpfHash !== 'string' || user.cpfHash.length === 0) {
    return false;
  }

  return true;
}

function validateCPFHash(cpfHash: string): boolean {
  // Validação básica: SHA256 hex é 64 caracteres
  return /^[a-f0-9]{64}$/i.test(cpfHash);
}

// ============================================================================
// Migration Logic
// ============================================================================

async function migrateUser(
  db: admin.firestore.Firestore,
  user: LegacyUser,
  dryRun: boolean
): Promise<MigrationResult> {
  try {
    // Validações
    if (!shouldMigrateUser(user)) {
      return {
        userId: user.uid,
        status: 'skipped',
        reason: user.identityMigrationStatus === 'completed' 
          ? 'Já migrado' 
          : user.primaryIdentityId
          ? 'Já possui primaryIdentityId'
          : 'Sem cpfHash válido',
      };
    }

    if (!validateCPFHash(user.cpfHash!)) {
      return {
        userId: user.uid,
        status: 'error',
        error: `cpfHash inválido: ${user.cpfHash}`,
      };
    }

    if (!dryRun) {
      // Criar documento em /user_identities
      const identityId = `${user.uid}:BR:CPF`;
      const identityRef = db.collection('user_identities').doc(identityId);

      const identityData = {
        userId: user.uid,
        country: 'BR',
        documentType: 'CPF',
        documentHash: user.cpfHash,
        documentMasked: user.cpfMasked || 'xxx.xxx.xxx-xx',
        cpfEncrypted: user.cpfEncrypted || null,
        verificationStatus: 'pending',
        verificationLevel: 'self',
        isActive: true,
        createdAt: user.createdAt || new Date(),
        verifiedAt: null,
        migratedFrom: 'legacy_users',
        migrationTimestamp: new Date(),
      };

      await identityRef.set(identityData);

      // Atualizar /users
      const userRef = db.collection('users').doc(user.uid);
      await userRef.update({
        primaryIdentityId: identityId,
        identityCount: 1,
        country: 'BR',
        identityMigrationStatus: 'completed',
        enableInternationalIdentity: true,
        lastIdentityUpdate: new Date(),
      });
    }

    return {
      userId: user.uid,
      status: 'success',
      identityId: `${user.uid}:BR:CPF`,
    };
  } catch (error) {
    return {
      userId: user.uid,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processBatch(
  db: admin.firestore.Firestore,
  users: LegacyUser[],
  dryRun: boolean
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const user of users) {
    const result = await migrateUser(db, user, dryRun);
    results.push(result);
  }

  return results;
}

async function fetchAllUsers(
  db: admin.firestore.Firestore,
  batchSize: number
): Promise<LegacyUser[]> {
  const users: LegacyUser[] = [];
  let query = db.collection('users').limit(batchSize);
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;

  while (true) {
    let snapshot;
    if (lastDoc) {
      query = db.collection('users').startAfter(lastDoc).limit(batchSize);
    }
    snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    snapshot.forEach((doc) => {
      users.push({ uid: doc.id, ...doc.data() } as LegacyUser);
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return users;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(
  results: MigrationResult[],
  dryRun: boolean,
  durationMs: number,
  batchSize: number
): MigrationReport {
  const migrated = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  return {
    startTime: Date.now() - durationMs,
    endTime: Date.now(),
    durationMs,
    dryRun,
    batchSize,
    totalProcessed: results.length,
    migrated: migrated.length,
    skipped: skipped.length,
    errors: errors.length,
    results,
    summary: {
      migratedDetails: migrated.map(r => `✅ ${r.userId} → ${r.identityId}`),
      skippedDetails: skipped.map(r => `⏭️  ${r.userId}: ${r.reason}`),
      errorDetails: errors.map(r => `❌ ${r.userId}: ${r.error}`),
    },
  };
}

function printReport(report: MigrationReport) {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  BACKFILL USER IDENTITIES - RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📋 Modo: ${report.dryRun ? 'DRY-RUN (sem alterações)' : 'EXECUÇÃO REAL'}`);
  console.log(`⏱️  Duração: ${report.durationMs}ms (${(report.durationMs / 1000).toFixed(2)}s)`);
  console.log(`📦 Tamanho do lote: ${report.batchSize}`);
  console.log(`\n📊 Estatísticas:`);
  console.log(`   Total processado: ${report.totalProcessed}`);
  console.log(`   ✅ Migrados: ${report.migrated}`);
  console.log(`   ⏭️  Ignorados: ${report.skipped}`);
  console.log(`   ❌ Erros: ${report.errors}`);

  if (report.summary.migratedDetails.length > 0) {
    console.log(`\n✅ Migrados (${report.migrated}):`);
    report.summary.migratedDetails.slice(0, 5).forEach(d => console.log(`   ${d}`));
    if (report.summary.migratedDetails.length > 5) {
      console.log(`   ... e ${report.summary.migratedDetails.length - 5} mais`);
    }
  }

  if (report.summary.skippedDetails.length > 0) {
    console.log(`\n⏭️  Ignorados (${report.skipped}):`);
    report.summary.skippedDetails.slice(0, 5).forEach(d => console.log(`   ${d}`));
    if (report.summary.skippedDetails.length > 5) {
      console.log(`   ... e ${report.summary.skippedDetails.length - 5} mais`);
    }
  }

  if (report.summary.errorDetails.length > 0) {
    console.log(`\n❌ Erros (${report.errors}):`);
    report.summary.errorDetails.slice(0, 5).forEach(d => console.log(`   ${d}`));
    if (report.summary.errorDetails.length > 5) {
      console.log(`   ... e ${report.summary.errorDetails.length - 5} mais`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

function saveReportToFile(report: MigrationReport) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backfill-report-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'reports', filename);

  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  console.log(`📁 Relatório salvo em: ${filepath}`);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg 
    ? parseInt(batchSizeArg.split('=')[1], 10)
    : DEFAULT_BATCH_SIZE;

  if (!dryRun && !execute) {
    console.log(`
❌ Uso inválido. Escolha um modo:

  npx ts-node scripts/backfill-user-identities.ts --dry-run
    → Simula a migração sem fazer alterações

  npx ts-node scripts/backfill-user-identities.ts --execute
    → Executa a migração realmente

Opções adicionais:
  --batch-size=100    → Tamanho do lote (padrão: 50)

Exemplo completo:
  npx ts-node scripts/backfill-user-identities.ts --dry-run --batch-size=100
    `);
    process.exit(1);
  }

  console.log(`
🚀 Iniciando backfill de identidades...
   Modo: ${dryRun ? 'DRY-RUN' : 'EXECUÇÃO'}
   Tamanho do lote: ${batchSize}
  `);

  const db = initializeFirebase();
  const startTime = Date.now();

  try {
    // Buscar todos os usuários
    console.log('📖 Buscando usuários legados...');
    const users = await fetchAllUsers(db, 1000);
    console.log(`✅ ${users.length} usuários encontrados`);

    // Processar em lotes
    console.log(`\n🔄 Processando em lotes de ${batchSize}...`);
    const allResults: MigrationResult[] = [];

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const batchResults = await processBatch(db, batch, dryRun);
      allResults.push(...batchResults);

      const progress = Math.min(i + batchSize, users.length);
      console.log(`   ${progress}/${users.length}`);
    }

    // Gerar relatório
    const durationMs = Date.now() - startTime;
    const report = generateReport(allResults, dryRun, durationMs, batchSize);

    printReport(report);
    saveReportToFile(report);

    if (dryRun) {
      console.log('💡 Para executar a migração de verdade, use: --execute');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    process.exit(1);
  }
}

main();
