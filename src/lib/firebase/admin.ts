import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Trata erros de PEM e garante que as credenciais do .env sejam aplicadas corretamente.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('[Admin SDK] Erro: Faltam variáveis de ambiente no .env');
    throw new Error('MISSING_ADMIN_CREDENTIALS');
  }

  try {
    // Limpeza profunda da chave privada para lidar com aspas e escapes de ambiente
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '') 
      .replace(/\\n/g, '\n')
      .trim();

    // Garante que a chave tenha as quebras de linha corretas se estiver vindo como uma única linha
    if (!privateKey.includes('\n')) {
      privateKey = privateKey.replace(/ /g, '\n');
      // Repara os cabeçalhos que foram quebrados pelo replace de espaços
      privateKey = privateKey
        .replace('BEGIN\nPRIVATE\nKEY', 'BEGIN PRIVATE KEY')
        .replace('END\nPRIVATE\nKEY', 'END PRIVATE KEY');
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    }, 'admin-app');
  } catch (error) {
    console.error('[Admin SDK] Falha crítica na inicialização da chave privada:', error);
    throw error;
  }
}

/**
 * Getters para instâncias administrativas com seleção explícita de database.
 */
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp(), 'eventosviby');

/**
 * Proxies para compatibilidade legada.
 */
export const adminAuth = {
  getUserByEmail: (email: string) => getAdminAuth().getUserByEmail(email),
  generatePasswordResetLink: (email: string) => getAdminAuth().generatePasswordResetLink(email),
  updateUser: (uid: string, data: any) => getAdminAuth().updateUser(uid, data),
} as any;

export const adminDb = {
  collection: (path: string) => getAdminDb().collection(path),
  batch: () => getAdminDb().batch(),
  doc: (path: string) => getAdminDb().doc(path),
  runTransaction: (fn: any) => getAdminDb().runTransaction(fn),
} as any;
