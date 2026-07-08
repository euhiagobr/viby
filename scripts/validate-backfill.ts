/**
 * Script de Validação Pós-Migração
 * 
 * Verifica integridade e consistência da migração de identidades
 * Detecta órfãos, mismatches e inconsistências
 */

import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { logger, generateMigrationStats } from './backfill-utils.ts';

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
// Validation Checks
// ============================================================================

interface ValidationResult {
  totalMigrated: number;
  orphaned: number;
  hashMismatches: number;
  statusMismatches: number;
  validIdentities: number;
  details: {
    orphans: string[];
    mismatches: string[];
    statusIssues: string[];
  };
}

async function validateAllMigrations(
  db: admin.firestore.Firestore
): Promise<ValidationResult> {
  const result: ValidationResult = {
    totalMigrated: 0,
    orphaned: 0,
    hashMismatches: 0,
    statusMismatches: 0,
    validIdentities: 0,
    details: {
      orphans: [],
      mismatches: [],
      statusIssues: [],
    },
  };

  logger.step('Validando migrações completadas...');

  // Buscar todos os usuários com migração completada
  const usersSnapshot = await db.collection('users')
    .where('identityMigrationStatus', '==', 'completed')
    .get();

  result.totalMigrated = usersSnapshot.size;
  logger.info(`${result.totalMigrated} usuários com migração completada`);

  // Validar cada um
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const userId = userDoc.id;

    // Check 1: Identidade existe?
    if (!user.primaryIdentityId) {
      result.statusMismatches++;
      result.details.statusIssues.push(
        `${userId}: primaryIdentityId não definido`
      );
      continue;
    }

    const identityDoc = await db.collection('user_identities')
      .doc(user.primaryIdentityId)
      .get();

    if (!identityDoc.exists) {
      result.orphaned++;
      result.details.orphans.push(
        `${userId} → ${user.primaryIdentityId} (não encontrada)`
      );
      continue;
    }

    // Check 2: Hashes correspondem?
    const identity = identityDoc.data();
    if (user.cpfHash !== identity.documentHash) {
      result.hashMismatches++;
      result.details.mismatches.push(
        `${userId}: cpfHash ${user.cpfHash} !== documentHash ${identity.documentHash}`
      );
      continue;
    }

    // Check 3: Status consistente?
    if (identity.verificationStatus !== 'pending' && 
        identity.verificationStatus !== 'verified') {
      result.statusMismatches++;
      result.details.statusIssues.push(
        `${userId}: verificationStatus inválido: ${identity.verificationStatus}`
      );
      continue;
    }

    // Tudo válido
    result.validIdentities++;
  }

  return result;
}

// ============================================================================
// Consistency Checks
// ============================================================================

interface ConsistencyResult {
  duplicateIdentities: string[];
  multipleIdentitiesPerUser: string[];
  invalidCountries: string[];
  inactiveIdentities: string[];
  orphanIdentities: string[];
}

async function checkConsistency(
  db: admin.firestore.Firestore
): Promise<ConsistencyResult> {
  const result: ConsistencyResult = {
    duplicateIdentities: [],
    multipleIdentitiesPerUser: [],
    invalidCountries: [],
    inactiveIdentities: [],
    orphanIdentities: [],
  };

  logger.step('Verificando consistência das identidades...');

  // Check 1: Identidades órfãs (usuário não existe)
  const identitiesSnapshot = await db.collection('user_identities').get();
  const userIds = new Set<string>();

  const usersSnapshot = await db.collection('users').get();
  usersSnapshot.forEach(doc => userIds.add(doc.id));

  for (const identityDoc of identitiesSnapshot.docs) {
    const identity = identityDoc.data();

    if (!userIds.has(identity.userId)) {
      result.orphanIdentities.push(
        `${identityDoc.id}: userId ${identity.userId} não existe`
      );
    }

    if (identity.country !== 'BR') {
      result.invalidCountries.push(
        `${identityDoc.id}: país inesperado: ${identity.country}`
      );
    }

    if (identity.isActive === false) {
      result.inactiveIdentities.push(identityDoc.id);
    }
  }

  // Check 2: Múltiplas identidades por usuário
  const identitiesByUser = new Map<string, string[]>();
  identitiesSnapshot.forEach(doc => {
    const userId = doc.data().userId;
    if (!identitiesByUser.has(userId)) {
      identitiesByUser.set(userId, []);
    }
    identitiesByUser.get(userId)!.push(doc.id);
  });

  for (const [userId, identities] of identitiesByUser.entries()) {
    if (identities.length > 1) {
      result.multipleIdentitiesPerUser.push(
        `${userId}: ${identities.length} identidades (${identities.join(', ')})`
      );
    }
  }

  return result;
}

// ============================================================================
// Report Generation
// ============================================================================

function printValidationReport(
  validation: ValidationResult,
  consistency: ConsistencyResult,
  stats: any
) {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     VALIDAÇÃO PÓS-MIGRAÇÃO - RELATÓRIO COMPLETO           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n📊 ESTATÍSTICAS GERAIS:');
  console.log(`   Total de usuários: ${stats.totalUsers}`);
  console.log(`   Usuários migrados: ${stats.migratedUsers}`);
  console.log(`   Usuários pendentes: ${stats.pendingUsers}`);
  console.log(`   Percentual: ${stats.percentageMigrated}%`);

  console.log('\n✅ VALIDAÇÃO DE MIGRAÇÕES:');
  console.log(`   Total processado: ${validation.totalMigrated}`);
  console.log(`   ✅ Válidas: ${validation.validIdentities}`);
  console.log(`   ❌ Órfãs: ${validation.orphaned}`);
  console.log(`   ❌ Hash mismatch: ${validation.hashMismatches}`);
  console.log(`   ❌ Status inválido: ${validation.statusMismatches}`);

  if (validation.details.orphans.length > 0) {
    console.log('\n   Órfãs detectadas:');
    validation.details.orphans.slice(0, 3).forEach(o => {
      console.log(`      • ${o}`);
    });
    if (validation.details.orphans.length > 3) {
      console.log(`      ... e ${validation.details.orphans.length - 3} mais`);
    }
  }

  if (validation.details.mismatches.length > 0) {
    console.log('\n   Mismatches de hash:');
    validation.details.mismatches.slice(0, 3).forEach(m => {
      console.log(`      • ${m}`);
    });
    if (validation.details.mismatches.length > 3) {
      console.log(`      ... e ${validation.details.mismatches.length - 3} mais`);
    }
  }

  console.log('\n🔍 VERIFICAÇÃO DE CONSISTÊNCIA:');
  console.log(`   Identidades órfãs: ${consistency.orphanIdentities.length}`);
  console.log(`   Múltiplas identidades por usuário: ${consistency.multipleIdentitiesPerUser.length}`);
  console.log(`   Países inválidos: ${consistency.invalidCountries.length}`);
  console.log(`   Identidades inativas: ${consistency.inactiveIdentities.length}`);

  // Status geral
  console.log('\n' + '═'.repeat(60));
  
  const hasErrors = 
    validation.orphaned > 0 || 
    validation.hashMismatches > 0 || 
    validation.statusMismatches > 0 ||
    consistency.orphanIdentities.length > 0 ||
    consistency.multipleIdentitiesPerUser.length > 0;

  if (!hasErrors && stats.migratedUsers === stats.totalUsers) {
    console.log('✅ VALIDAÇÃO COMPLETA - SEM ERROS');
    console.log('   Todas as migrações estão íntegras e consistentes!');
  } else if (!hasErrors && stats.pendingUsers > 0) {
    console.log('⚠️  VALIDAÇÃO PARCIAL - SUCESSO');
    console.log(`   ${stats.migratedUsers}/${stats.totalUsers} usuários migrados sem erros`);
    console.log(`   ${stats.pendingUsers} usuários ainda pendentes`);
  } else {
    console.log('❌ VALIDAÇÃO FALHOU - ERROS DETECTADOS');
    console.log('   Revise os detalhes acima e investigue os problemas');
  }

  console.log('═'.repeat(60));
}

function saveValidationReport(
  validation: ValidationResult,
  consistency: ConsistencyResult,
  stats: any
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    validation,
    consistency,
  };

  const reportDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const filepath = path.join(reportDir, `validation-report-${timestamp}.json`);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  logger.success(`Relatório salvo em: ${filepath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  logger.step('Iniciando validação pós-migração...');

  const db = initializeFirebase();

  try {
    // Coletar dados
    const validation = await validateAllMigrations(db);
    const consistency = await checkConsistency(db);
    const stats = await generateMigrationStats(db);

    // Exibir relatório
    printValidationReport(validation, consistency, stats);

    // Salvar relatório
    saveValidationReport(validation, consistency, stats);

    process.exit(0);
  } catch (error) {
    logger.error(`Erro durante validação: ${error}`);
    process.exit(1);
  }
}

main();
