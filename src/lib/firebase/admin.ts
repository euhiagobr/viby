import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Tratamento radical para garantir que a chave PEM do .env funcione.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('[Admin SDK] Erro: Faltam variáveis de ambiente no .env', {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKeyRaw
    });
    throw new Error('MISSING_ADMIN_CREDENTIALS');
  }

  try {
    // Sanitização profunda para lidar com caracteres de escape vindo do .env
    // Remove aspas, trata aspas duplas internas e converte \n em quebras de linha reais
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '')      // Remove aspas externas
      .replace(/\\n/g, '\n')      // Converte \n literal em quebra de linha real
      .trim();

    // Garante que a chave comece e termine corretamente
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
       privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}`;
    }
    if (!privateKey.includes('-----END PRIVATE KEY-----')) {
       privateKey = `${privateKey}\n-----END PRIVATE KEY-----`;
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
    console.error('[Admin SDK] Falha crítica no parsing PEM da chave privada:', error.message);
    throw error;
  }
}

/**
 * Getters para instâncias administrativas com database isolado.
 */
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp(), 'eventosviby');

/**
 * Proxies para compatibilidade legada em Server Actions.
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
