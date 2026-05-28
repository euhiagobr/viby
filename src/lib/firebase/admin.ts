import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Singleton robusto para o Firebase Admin SDK.
 * Utiliza inicialização preguiçosa (Lazy) para evitar erros de configuração
 * durante o tempo de build ou em ambientes com variáveis parciais.
 */

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('CRITICAL: Firebase Admin credentials missing in environment.');
    throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  }

  try {
    // Tratamento robusto para chaves PEM (corrige erros comuns de escape \n e aspas)
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '') // Remove aspas no início/fim
      .replace(/\\n/g, '\n'); // Converte \n literais para quebras de linha reais

    // Garante que a chave comece e termine corretamente
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}`;
    }
    if (!privateKey.includes('-----END PRIVATE KEY-----')) {
      privateKey = `${privateKey}\n-----END PRIVATE KEY-----\n`;
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error('FAILED_TO_INITIALIZE_ADMIN_SDK:', error);
    throw error;
  }
}

/**
 * Getters protegidos para garantir que o SDK esteja pronto antes do uso.
 */
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp(), 'eventosviby');

/**
 * Proxies para manter compatibilidade com o código existente.
 */
export const adminAuth = {
  getUserByEmail: (email: string) => getAdminAuth().getUserByEmail(email),
  generatePasswordResetLink: (email: string) => getAdminAuth().generatePasswordResetLink(email),
  updateUser: (uid: string, data: any) => getAdminAuth().updateUser(uid, data),
} as unknown as Auth;

export const adminDb = {
  collection: (path: string) => getAdminDb().collection(path),
  batch: () => getAdminDb().batch(),
  doc: (path: string) => getAdminDb().doc(path),
  runTransaction: (updateFunction: (transaction: any) => Promise<any>) => getAdminDb().runTransaction(updateFunction),
} as unknown as Firestore;
