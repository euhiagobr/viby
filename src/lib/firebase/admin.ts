import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Singleton para inicialização segura do Firebase Admin SDK.
 * Exclusivo para ambiente server-side.
 */

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error({
      step: 'admin-sdk-init',
      error: 'Missing environment variables for Firebase Admin',
      variables: {
        projectId: !!projectId,
        clientEmail: !!clientEmail,
        privateKey: !!privateKey
      }
    });
    throw new Error("O serviço de redefinição exige configuração de Service Account ou permissões administrativas.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const adminApp = getAdminApp();

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
