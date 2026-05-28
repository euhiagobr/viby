import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Corrige erros de "Invalid PEM formatted message" tratando a chave privada de forma agressiva.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    // Durante o build, as variáveis podem estar ausentes. 
    // Retornamos um erro controlado que as Server Actions capturam.
    throw new Error('FIREBASE_ADMIN_CONFIG_MISSING');
  }

  try {
    // Tratamento agressivo para o formato PEM da chave privada
    // 1. Remove aspas duplas no início e fim (comum em alguns dashboards)
    // 2. Converte a string literal "\n" em quebras de linha reais
    const privateKey = privateKeyRaw
      .replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    }, 'admin-app');
  } catch (error) {
    console.error('FAILED_TO_INITIALIZE_ADMIN_SDK:', error);
    throw error;
  }
}

/**
 * Getters dinâmicos para garantir inicialização preguiçosa (Lazy)
 */
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp(), 'eventosviby');

/**
 * Proxies para compatibilidade com código legado
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
