import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização oficial do Firebase Admin SDK.
 * Focado exclusivamente na resolução do erro de parser ASN.1.
 */

const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Auditoria de segurança e diagnóstico (Apenas no Servidor)
if (typeof window === 'undefined') {
  console.log('[FIREBASE ADMIN AUDIT]', {
    length: privateKey?.length || 0,
    prefix: privateKey?.substring(0, 30),
    suffix: privateKey?.substring((privateKey?.length || 0) - 30),
    hasHeader: privateKey?.includes('-----BEGIN PRIVATE KEY-----'),
    hasFooter: privateKey?.includes('-----END PRIVATE KEY-----'),
    envProjectId: !!process.env.FIREBASE_PROJECT_ID,
    envClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
  });
}

export const getAdminApp = () => {
  const apps = admin.apps;
  if (apps.length > 0) return apps[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  // Tratamento obrigatório para quebras de linha em variáveis de ambiente RSA
  const formattedKey = privateKey?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !formattedKey) {
    throw new Error("Credenciais do Firebase Admin ausentes ou incompletas no ambiente.");
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
      projectId
    });
  } catch (e: any) {
    console.error("[Admin SDK] Erro fatal de inicialização:", e.message);
    throw e;
  }
};

export const getAdminAuth = () => {
  return getAdminApp().auth();
};

export const getAdminDb = () => {
  return getAdminApp().firestore();
};
