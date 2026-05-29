import { getApps, initializeApp, credential, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização segura do Firebase Admin SDK.
 * Ajustado para tentar credenciais de ambiente ou configuração padrão.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ong-desafios-3942a';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  try {
    // Se as chaves estiverem no ambiente, usa Service Account
    if (projectId && clientEmail && privateKeyRaw) {
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
    
    // Caso contrário, tenta inicialização simples (funciona em alguns ambientes Cloud)
    return initializeApp({
      projectId
    }, 'admin-app');
  } catch (error: any) {
    console.error('[Admin SDK] Erro na inicialização');
    throw new Error('Falha na autenticação do servidor administrativo.');
  }
}

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getAdminFirestore(getAdminApp(), 'eventosviby');
