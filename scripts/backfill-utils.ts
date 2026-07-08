/**
 * Utilitários para backfill de identidades
 * 
 * Funções reutilizáveis e helpers para validação, transformação e auditoria
 */

import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Valida se um hash SHA256 é válido
 * @param hash Hash hex string
 * @returns true se é um SHA256 válido
 */
export function isValidSHA256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Valida se um CPF mascarado está em formato válido
 * @param maskedCPF Formato: XXX.XXX.XXX-XX
 * @returns true se é um formato válido
 */
export function isValidMaskedCPF(maskedCPF: string): boolean {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(maskedCPF);
}

/**
 * Extrai apenas os dígitos de um CPF mascarado
 * @param maskedCPF Formato: XXX.XXX.XXX-XX
 * @returns String com 11 dígitos
 */
export function extractCPFDigits(maskedCPF: string): string {
  return maskedCPF.replace(/\D/g, '');
}

// ============================================================================
// Transformation Helpers
// ============================================================================

/**
 * Converte dados legados para nova estrutura de identidade
 */
export function transformLegacyUserToIdentity(
  user: any,
  identityId: string
): any {
  return {
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
}

/**
 * Gera dados de atualização para o documento de usuário legado
 */
export function generateUserUpdateData(identityId: string): any {
  return {
    primaryIdentityId: identityId,
    identityCount: 1,
    country: 'BR',
    identityMigrationStatus: 'completed',
    enableInternationalIdentity: true,
    lastIdentityUpdate: new Date(),
  };
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Busca usuários que precisam ser migrados
 */
export async function fetchUsersNeedingMigration(
  db: admin.firestore.Firestore,
  limit: number = 1000
): Promise<any[]> {
  const snapshot = await db.collection('users')
    .where('cpfHash', '!=', '')
    .where('identityMigrationStatus', '!=', 'completed')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data()
  }));
}

/**
 * Busca usuários já migrados
 */
export async function fetchMigratedUsers(
  db: admin.firestore.Firestore,
  limit: number = 1000
): Promise<any[]> {
  const snapshot = await db.collection('users')
    .where('identityMigrationStatus', '==', 'completed')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data()
  }));
}

/**
 * Verifica se um usuário já foi migrado
 */
export async function isUserMigrated(
  db: admin.firestore.Firestore,
  userId: string
): Promise<boolean> {
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) return false;
  
  const user = userDoc.data();
  return user?.identityMigrationStatus === 'completed' && user?.primaryIdentityId;
}

// ============================================================================
// Audit Helpers
// ============================================================================

/**
 * Verifica integridade de uma migração
 */
export async function verifyMigration(
  db: admin.firestore.Firestore,
  userId: string,
  identityId: string
): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Verificar que a identidade existe
  const identityDoc = await db.collection('user_identities').doc(identityId).get();
  if (!identityDoc.exists) {
    errors.push(`Identidade não encontrada: ${identityId}`);
  }

  // Verificar que o usuário foi atualizado
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    errors.push(`Usuário não encontrado: ${userId}`);
  } else {
    const user = userDoc.data();
    if (user?.primaryIdentityId !== identityId) {
      errors.push(`primaryIdentityId mismatch: ${user?.primaryIdentityId} vs ${identityId}`);
    }
    if (user?.identityMigrationStatus !== 'completed') {
      errors.push(`identityMigrationStatus não é 'completed': ${user?.identityMigrationStatus}`);
    }
  }

  // Verificar que hashes correspondem
  if (identityDoc.exists && userDoc.exists) {
    const identity = identityDoc.data();
    const user = userDoc.data();
    
    if (identity?.documentHash !== user?.cpfHash) {
      errors.push(`documentHash mismatch com cpfHash`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gera estatísticas de migração
 */
export async function generateMigrationStats(
  db: admin.firestore.Firestore
): Promise<{
  totalUsers: number;
  migratedUsers: number;
  pendingUsers: number;
  percentageMigrated: number;
}> {
  const allUsersSnapshot = await db.collection('users').get();
  const migratedSnapshot = await db.collection('users')
    .where('identityMigrationStatus', '==', 'completed')
    .get();

  const totalUsers = allUsersSnapshot.size;
  const migratedUsers = migratedSnapshot.size;
  const pendingUsers = totalUsers - migratedUsers;
  const percentageMigrated = totalUsers > 0 
    ? Math.round((migratedUsers / totalUsers) * 100) 
    : 0;

  return {
    totalUsers,
    migratedUsers,
    pendingUsers,
    percentageMigrated,
  };
}

// ============================================================================
// Batch Helpers
// ============================================================================

/**
 * Divide um array em lotes
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Executa batches sequencialmente com delay
 */
export async function executeBatchesWithDelay<T>(
  batches: T[][],
  executor: (batch: T[]) => Promise<any>,
  delayMs: number = 100
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const result = await executor(batch);
    results.push(result);

    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// ============================================================================
// Report Helpers
// ============================================================================

/**
 * Formata relatório para console
 */
export function formatReportForConsole(report: any): string {
  return `
╔════════════════════════════════════════════════════════════╗
║        BACKFILL USER IDENTITIES - RELATÓRIO FINAL          ║
╚════════════════════════════════════════════════════════════╝

📋 Modo: ${report.dryRun ? 'DRY-RUN (sem alterações)' : 'EXECUÇÃO REAL'}
⏱️  Duração: ${report.durationMs}ms (${(report.durationMs / 1000).toFixed(2)}s)
📦 Tamanho do lote: ${report.batchSize}

📊 Estatísticas:
   Total processado: ${report.totalProcessed}
   ✅ Migrados: ${report.migrated}
   ⏭️  Ignorados: ${report.skipped}
   ❌ Erros: ${report.errors}

Taxa de sucesso: ${report.totalProcessed > 0 
  ? ((report.migrated / report.totalProcessed) * 100).toFixed(1) 
  : 'N/A'}%
`;
}

/**
 * Salva relatório em arquivo JSON e CSV
 */
export async function saveReportToFiles(report: any, baseDir: string): Promise<string[]> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const files: string[] = [];

  // JSON
  const jsonFile = path.join(baseDir, `backfill-report-${timestamp}.json`);
  await fs.writeFile(jsonFile, JSON.stringify(report, null, 2));
  files.push(jsonFile);

  // CSV (resumo)
  const csvFile = path.join(baseDir, `backfill-report-${timestamp}.csv`);
  const csvContent = `
Timestamp,Mode,Duration (ms),Total,Migrated,Skipped,Errors,Success Rate
${timestamp},${report.dryRun ? 'DRY-RUN' : 'EXECUTE'},${report.durationMs},${report.totalProcessed},${report.migrated},${report.skipped},${report.errors},${((report.migrated / report.totalProcessed) * 100).toFixed(1)}%
`.trim();
  
  await fs.writeFile(csvFile, csvContent);
  files.push(csvFile);

  return files;
}

// ============================================================================
// Logging Helpers
// ============================================================================

export const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warning: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  step: (msg: string) => console.log(`\n🔹 ${msg}`),
};

export default {
  validation: {
    isValidSHA256Hash,
    isValidMaskedCPF,
    extractCPFDigits,
  },
  transformation: {
    transformLegacyUserToIdentity,
    generateUserUpdateData,
  },
  queries: {
    fetchUsersNeedingMigration,
    fetchMigratedUsers,
    isUserMigrated,
  },
  audit: {
    verifyMigration,
    generateMigrationStats,
  },
  batch: {
    chunkArray,
    executeBatchesWithDelay,
  },
  report: {
    formatReportForConsole,
    saveReportToFiles,
  },
  logger,
};
