import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização segura do Firebase Admin SDK.
 * Requer a variável de ambiente FIREBASE_SERVICE_ACCOUNT contendo o JSON da chave privada.
 */

function getServiceAccount() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return null;
  try {
    const config = JSON.parse(sa);
    // Garantir tratamento correto das quebras de linha na chave privada
    if (config.private_key) {
      config.private_key = config.private_key.replace(/\\n/g, '\n');
    }
    return config;
  } catch (e) {
    console.error("[Admin SDK] Erro ao parsear FIREBASE_SERVICE_ACCOUNT");
    return null;
  }
}

export function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;
  
  const serviceAccount = getServiceAccount();
  
  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  // Fallback para ambientes com Application Default Credentials (ADC)
  return admin.initializeApp();
}

export const adminAuth = getAdminApp().auth();
export const adminDb = getAdminApp().firestore();
