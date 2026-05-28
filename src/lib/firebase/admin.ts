import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Resolve erros de "Invalid PEM formatted message" e garante seleção do DB correto.
 */

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('FATAL: Variáveis de ambiente do Firebase Admin ausentes.');
    throw new Error('FIREBASE_ADMIN_CONFIG_MISSING');
  }

  try {
    // Limpeza profunda da chave privada para evitar erros PEM
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '') // Remove aspas nas extremidades
      .replace(/\\n/g, '\n'); // Converte strings "\n" em quebras reais

    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error('ERRO_AO_INICIALIZAR_FIREBASE_ADMIN:', error);
    throw error;
  }
}

// Getters exportados para garantir inicialização preguiçosa (Lazy)
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp(), 'eventosviby');

// Objetos proxy para manter compatibilidade com o código existente
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
