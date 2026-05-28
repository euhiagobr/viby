import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Tratamento avançado de PEM para evitar erros de autenticação.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('[Admin SDK] Variáveis de ambiente faltando:', {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKeyRaw
    });
    throw new Error('MISSING_ADMIN_ENV_VARS');
  }

  try {
    // Tratamento radical da chave privada
    const privateKey = privateKeyRaw
      .replace(/^"|"$/g, '')          // Remove aspas externas
      .replace(/\\n/g, '\n')          // Converte \n literal em quebra de linha real
      .trim();

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    }, 'admin-app');
  } catch (error: any) {
    console.error('[Admin SDK] Falha ao parsear Private Key:', error.message);
    throw error;
  }
}

/**
 * Getters para instâncias administrativas reais.
 */
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getAdminFirestore(getAdminApp(), 'eventosviby');

/**
 * Proxies para compatibilidade com código legado que usa adminAuth.xxx
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
