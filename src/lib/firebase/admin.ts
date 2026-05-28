import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Singleton para inicialização segura do Firebase Admin SDK.
 * Exclusivo para ambiente server-side.
 */

function getAdminApp(): App | null {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    // Durante o build ou se faltar env, não inicializamos para evitar quebra do processo
    return null;
  }

  try {
    // Remove aspas se existirem e processa quebras de linha literais (\n)
    const privateKey = privateKeyRaw
      .replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n');

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error('Falha crítica ao inicializar Firebase Admin:', error);
    return null;
  }
}

const adminApp = getAdminApp();

// Exportamos proxies ou instâncias seguras. Se adminApp for null, chamadas falharão no runtime
// mas não impedirão a análise estática (build).
export const adminAuth = adminApp ? getAuth(adminApp) : ({} as Auth);
export const adminDb = adminApp ? getFirestore(adminApp) : ({} as Firestore);
