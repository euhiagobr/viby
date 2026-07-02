import * as admin from 'firebase-admin';

/**
 * @fileOverview Padrão Singleton para Firebase Admin SDK.
 * CORREÇÃO: Removida a chamada db.settings() de dentro do getter para evitar erro de inicialização duplicada.
 * O estado da instância agora é persistido no objeto global do Node.js.
 */

const globalAdmin = global as any;

export const getAdminApp = () => {
  if (globalAdmin.adminApp) return globalAdmin.adminApp;

  const apps = admin.apps;
  if (apps.length > 0) {
    globalAdmin.adminApp = apps[0];
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Credenciais do Firebase Admin ausentes no ambiente.");
    }

    globalAdmin.adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId
    });
  }
  return globalAdmin.adminApp;
};

export const getAdminDb = () => {
  if (globalAdmin.adminDb) return globalAdmin.adminDb;

  const app = getAdminApp();
  const db = app.firestore();
  
  // Nota: ignoreUndefinedProperties deve ser tratado via serialização (utils.ts)
  // ou configurado uma única vez na raiz se suportado pela versão, mas nunca dentro do getter.
  
  globalAdmin.adminDb = db;
  return globalAdmin.adminDb;
};

export const getAdminAuth = () => {
  if (globalAdmin.adminAuth) return globalAdmin.adminAuth;
  globalAdmin.adminAuth = getAdminApp().auth();
  return globalAdmin.adminAuth;
};
