import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização definitiva e resiliente do Firebase Admin SDK.
 * Resolve erros PEM e credenciais inválidas através de sanitização agressiva.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('[Admin SDK] Variáveis críticas ausentes no .env');
    throw new Error('MISSING_ADMIN_ENV_VARS');
  }

  try {
    // Sanitização profunda da chave privada
    // Remove aspas, trata \n literal e garante delimitadores PEM
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    }, 'admin-app');
  } catch (error: any) {
    console.error('[Admin SDK] Falha Crítica na Chave Privada:', error.message);
    throw error;
  }
}

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getAdminFirestore(getAdminApp(), 'eventosviby');

// Proxies para compatibilidade legada
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
