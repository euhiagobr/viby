
import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização segura do Firebase Admin SDK.
 * Utiliza variáveis de ambiente segmentadas para evitar erros de escape no JSON.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n').replace(/"/g, ''),
        }),
        projectId
      });
    } catch (e) {
      console.error("[Admin SDK] Erro ao inicializar com credenciais explícitas:", e);
    }
  }

  // Fallback para variáveis de ambiente padrão do GCP
  return admin.initializeApp();
}

export const getAdminAuth = () => getAdminApp().auth();
export const getAdminDb = () => getAdminApp().firestore();
