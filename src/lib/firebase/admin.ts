import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Resolve erros PEM e credenciais inválidas tratando escapes de string.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(`Configurações Admin ausentes no .env: ${[!projectId && 'ID', !clientEmail && 'Email', !privateKeyRaw && 'Key'].filter(Boolean).join(', ')}`);
  }

  try {
    // Sanitização profunda da chave privada para tratar escapes de \n e aspas residuais
    const privateKey = privateKeyRaw
      .replace(/^"|"$/g, '') // remove aspas no início/fim
      .replace(/\\n/g, '\n') // substitui \n literal por quebra de linha real
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
    console.error('[Admin SDK] Falha Crítica na Inicialização:', error.message);
    throw error;
  }
}

/**
 * Getters dinâmicos para garantir inicialização preguiçosa (lazy) no servidor.
 */
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getAdminFirestore(getAdminApp(), 'eventosviby');

// Proxies para compatibilidade com código legado
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
