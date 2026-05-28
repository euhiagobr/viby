import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Trata erros de autenticação e garante que as credenciais do .env sejam aplicadas corretamente.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('[Admin SDK] Erro: Variáveis de ambiente FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY ausentes.');
    throw new Error('FIREBASE_ADMIN_CONFIG_MISSING');
  }

  try {
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
      projectId, // Garante que o SDK saiba exatamente qual projeto acessar
    }, 'admin-app');
  } catch (error) {
    console.error('[Admin SDK] Falha crítica na inicialização:', error);
    throw error;
  }
}

/**
 * Getters para instâncias administrativas.
 * O Firestore utiliza o banco de dados 'eventosviby'.
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
