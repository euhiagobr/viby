import { getApps, initializeApp, credential, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Prioriza credenciais de ambiente, mas funciona com inicialização padrão
 * em ambientes Google Cloud (como App Hosting / Cloud Run).
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ong-desafios-3942a';

  try {
    // Tenta inicialização com variáveis de ambiente se disponíveis
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw
        .replace(/^"|"$/g, '') 
        .replace(/\\n/g, '\n')
        .trim();

      return initializeApp({
        credential: credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      }, 'admin-app');
    }
    
    // Fallback: Inicialização simples (funciona automaticamente em ambientes Google Cloud)
    return initializeApp({
      projectId
    }, 'admin-app');
  } catch (error: any) {
    console.error('[Admin SDK] Erro crítico na inicialização:', error.message);
    throw new Error('Falha na autenticação administrativa do servidor.');
  }
}

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getAdminFirestore(getAdminApp(), 'eventosviby');
