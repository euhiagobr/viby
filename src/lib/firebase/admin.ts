import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização segura do Firebase Admin SDK.
 * Requer a variável de ambiente FIREBASE_SERVICE_ACCOUNT contendo o JSON da chave privada.
 */

function getServiceAccount() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.error("[Admin SDK] FIREBASE_SERVICE_ACCOUNT não definida no .env");
    return null;
  }
  
  try {
    const config = JSON.parse(sa);
    // Garantir tratamento correto das quebras de linha na chave privada
    if (config.private_key) {
      config.private_key = config.private_key.replace(/\\n/g, '\n');
    }
    return config;
  } catch (e) {
    console.error("[Admin SDK] Erro ao parsear FIREBASE_SERVICE_ACCOUNT. Verifique o formato JSON.");
    return null;
  }
}

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;
  
  const serviceAccount = getServiceAccount();
  
  if (serviceAccount) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (e) {
      console.error("[Admin SDK] Falha ao inicializar com service account:", e);
    }
  }

  // Fallback para ambientes com Application Default Credentials (ADC)
  return admin.initializeApp();
}

// Inicializa preguiçosamente para evitar erros durante a build se as variáveis não estiverem lá
export const getAdminAuth = () => getAdminApp().auth();
export const getAdminDb = () => getAdminApp().firestore();
