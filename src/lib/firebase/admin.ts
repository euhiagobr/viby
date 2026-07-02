import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização oficial do Firebase Admin SDK.
 * Implementa padrão Singleton robusto para evitar erros de inicialização duplicada.
 */

const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Interface para estender o objeto global do Node.js
interface GlobalAdmin {
  adminDb?: admin.firestore.Firestore;
  adminApp?: admin.app.App;
}

const globalAdmin = global as unknown as GlobalAdmin;

export const getAdminApp = () => {
  if (globalAdmin.adminApp) return globalAdmin.adminApp;

  const apps = admin.apps;
  if (apps.length > 0) {
    globalAdmin.adminApp = apps[0]!;
    return globalAdmin.adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const formattedKey = privateKey?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !formattedKey) {
    throw new Error("Credenciais do Firebase Admin ausentes ou incompletas.");
  }

  try {
    globalAdmin.adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
      projectId
    });
    return globalAdmin.adminApp;
  } catch (e: any) {
    console.error("[Admin SDK] Erro fatal de inicialização:", e.message);
    throw e;
  }
};

export const getAdminDb = () => {
  if (globalAdmin.adminDb) return globalAdmin.adminDb;

  const app = getAdminApp();
  const db = app.firestore();

  // Configurações aplicadas apenas uma vez na criação da instância singleton
  db.settings({ ignoreUndefinedProperties: true });
  
  globalAdmin.adminDb = db;
  return globalAdmin.adminDb;
};

export const getAdminAuth = () => {
  return getAdminApp().auth();
};
