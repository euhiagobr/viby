import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Singleton para inicialização do Firebase Admin SDK.
 * Restrito exclusivamente ao ambiente Server-Side (Server Actions e API Routes).
 */

let adminApp: App;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.error("ERRO: Variáveis de ambiente do Firebase Admin não configuradas.");
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
} else {
  adminApp = getApps()[0];
}

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
