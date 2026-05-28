import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização ultra-robusta do Firebase Admin SDK.
 * Resolve erros de "Invalid PEM formatted message" e garante seleção do DB 'eventosviby'.
 */

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.warn('Firebase Admin variables missing. This is expected during some build phases.');
    // Retornamos uma inicialização parcial ou lançamos erro controlado se for em runtime
    throw new Error('FIREBASE_ADMIN_CONFIG_MISSING');
  }

  try {
    // Limpeza profunda e agressiva da chave privada
    let privateKey = privateKeyRaw
      .replace(/^"|"$/g, '') // Remove aspas externas
      .replace(/\\n/g, '\n') // Converte strings "\n" em quebras reais
      .trim();

    // Garante cabeçalho e rodapé PEM
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
    });
  } catch (error) {
    console.error('CRITICAL_ADMIN_INIT_ERROR:', error);
    throw error;
  }
}

// Proxies para garantir inicialização preguiçosa (Lazy)
export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp(), 'eventosviby');

// Objetos exportados para compatibilidade legada
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
