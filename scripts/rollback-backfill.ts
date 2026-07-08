/**
 * Script de Reversão (Rollback) - Backfill de Identidades
 * 
 * CUIDADO: Este script deleta identidades migradas e reverte o status dos usuários
 * Use apenas em caso de emergência ou após validar problema crítico
 * 
 * Execução:
 *   npx ts-node scripts/rollback-backfill.ts --dry-run
 *   npx ts-node scripts/rollback-backfill.ts --execute [--batch-size=50]
 */

import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './backfill-utils.ts';

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
// Rollback Logic
// ============================================================================

interface RollbackResult {
  userId: string;
  identityId: string;
  status: 'success' | 'error';
  error?: string;
}

async function rollbackUser(
  db: admin.firestore.Firestore,
  userDoc: admin.firestore.DocumentSnapshot,
  dryRun: boolean
): Promise<RollbackResult> {
  try {
    const user = userDoc.data();
    const userId = userDoc.id;

    if (!user?.primaryIdentityId) {
      return {
        userId,
        identityId: 'N/A',
        status: 'error',
        error: 'primaryIdentityId não definido',
      };
    }

    const identityId = user.primaryIdentityId;

    if (!dryRun) {
      // Deletar identidade
      await db.collection('user_identities').doc(identityId).delete();

      // Reverter dados do usuário
      await userDoc.ref.update({
        primaryIdentityId: admin.firestore.FieldValue.delete(),
        identityCount: admin.firestore.FieldValue.delete(),
        country: admin.firestore.FieldValue.delete(),
        identityMigrationStatus: admin.firestore.FieldValue.delete(),
        enableInternationalIdentity: admin.firestore.FieldValue.delete(),
        lastIdentityUpdate: admin.firestore.FieldValue.delete(),
      });
    }

    return {
      userId,
      identityId,
      status: 'success',
    };
  } catch (error) {
    return {
      userId: userDoc.id,
      identityId: userDoc.data()?.primaryIdentityId || 'unknown',
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
  userDocs: admin.firestore.DocumentSnapshot[],
  dryRun: boolean
): Promise<RollbackResult[]> {
  const results: RollbackResult[] = [];

  for (const userDoc of userDocs) {
    const result = await rollbackUser(db, userDoc, dryRun);
    results.push(result);
  }

  return results;
}

// ============================================================================
// Report
// ============================================================================

interface RollbackReport {
  dryRun: boolean;
  timestamp: string;
  durationMs: number;
  totalProcessed: number;
  successful: number;
  failed: number;
  results: RollbackResult[];
}

function generateReport(
  results: RollbackResult[],
  dryRun: boolean,
  durationMs: number
): RollbackReport {
  return {
    dryRun,
    timestamp: new Date().toISOString(),
    durationMs,
    totalProcessed: results.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  };
}

function printReport(report: RollbackReport) {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  ROLLBACK BACKFILL - RELATÓRIO');
  console.log('═'.repeat(60));

  console.log(`\n📋 Modo: ${report.dryRun ? 'DRY-RUN' : 'EXECUÇÃO'}`);
  console.log(`⏱️  Duração: ${report.durationMs}ms`);
  console.log(`\n📊 Estatísticas:`);
  console.log(`   Total processado: ${report.totalProcessed}`);
  console.log(`   ✅ Sucesso: ${report.successful}`);
  console.log(`   ❌ Falha: ${report.failed}`);

  if (report.failed > 0) {
    console.log('\n❌ Erros:');
    report.results
      .filter(r => r.status === 'error')
      .slice(0, 5)
      .forEach(r => {
        console.log(`   • ${r.userId}: ${r.error}`);
      });
    if (report.failed > 5) {
      console.log(`   ... e ${report.failed - 5} mais`);
    }
  }

  console.log('\n' + '═'.repeat(60));

  if (report.dryRun) {
    console.log('\n💡 Para executar o rollback de verdade: --execute');
  }
}

function saveReport(report: RollbackReport) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(process.cwd(), 'reports');

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const filepath = path.join(reportDir, `rollback-report-${timestamp}.json`);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  logger.success(`Relatório salvo: ${filepath}`);
}

// ============================================================================
// Confirmation
// ============================================================================

function requireConfirmation(): boolean {
  console.log('\n⚠️  AVISO CRÍTICO ⚠️');
  console.log('Este comando irá:');
  console.log('  1. Deletar TODAS as identidades migradas');
  console.log('  2. Reverter o status de migração dos usuários');
  console.log('  3. Esta operação é destrutiva!');
  console.log('\nPara confirmar, digite "ENTENDO OS RISCOS": ');

  // Em ambiente não-interativo (CI/CD), usar --force-confirm
  if (process.argv.includes('--force-confirm')) {
    logger.warning('Confirmação forçada via --force-confirm');
    return true;
  }

  // Em ambiente interativo, pedir input
  const answer = require('prompt-sync')()('');
  return answer === 'ENTENDO OS RISCOS';
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;
  const forceConfirm = args.includes('--force-confirm');

  if (!dryRun && !execute) {
    console.log(`
❌ Uso inválido. Escolha um modo:

  npx ts-node scripts/rollback-backfill.ts --dry-run
    → Simula o rollback sem fazer alterações

  npx ts-node scripts/rollback-backfill.ts --execute
    → Executa o rollback realmente (CUIDADO!)

Opções:
  --batch-size=50       → Tamanho do lote
  --force-confirm       → Pular confirmação (para CI/CD)

Exemplo:
  npx ts-node scripts/rollback-backfill.ts --dry-run --batch-size=100
    `);
    process.exit(1);
  }

  if (!dryRun && !forceConfirm) {
    if (!requireConfirmation()) {
      logger.error('Rollback cancelado pelo usuário');
      process.exit(1);
    }
  }

  logger.step('Iniciando rollback...');
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'EXECUÇÃO'}`);
  console.log(`Tamanho do lote: ${batchSize}`);

  const db = initializeFirebase();
  const startTime = Date.now();

  try {
    // Buscar usuários migrados
    logger.info('Buscando usuários migrados...');
    const query = db.collection('users')
      .where('identityMigrationStatus', '==', 'completed');
    
    const snapshot = await query.get();
    logger.success(`${snapshot.size} usuários encontrados`);

    // Processar em lotes
    logger.step('Processando rollback...');
    const allResults: RollbackResult[] = [];
    const userDocs = snapshot.docs;

    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      const batchResults = await processBatch(db, batch, dryRun);
      allResults.push(...batchResults);

      const progress = Math.min(i + batchSize, userDocs.length);
      console.log(`   ${progress}/${userDocs.length}`);
    }

    // Gerar e exibir relatório
    const durationMs = Date.now() - startTime;
    const report = generateReport(allResults, dryRun, durationMs);

    printReport(report);
    saveReport(report);

    process.exit(0);
  } catch (error) {
    logger.error(`Erro durante rollback: ${error}`);
    process.exit(1);
  }
}

main();
