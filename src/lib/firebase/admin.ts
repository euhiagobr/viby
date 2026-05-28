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
    console.error('[Admin SDK] Erro: Faltam variáveis de ambiente no .env');
    throw new Error('MISSING_ADMIN_CREDENTIALS');
  }

  try {
    // Sanitização profunda para lidar com caracteres de escape vindo do .env
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '')      // Remove aspas externas caso existam
      .replace(/\\n/g, '\n')      // Converte \n literal (string) em quebra de linha real
      .trim();

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    }, 'admin-app');
  } catch (error) {
    console.error('[Admin SDK] Falha crítica no parsing PEM da chave privada:', error);
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
