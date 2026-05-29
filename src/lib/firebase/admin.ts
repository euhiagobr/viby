import { getApps, initializeApp, credential, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização ultra-robusta do Firebase Admin SDK.
 * Configurada para acessar o banco de dados nomeado 'eventosviby' e funcionar 
 * tanto em produção (App Hosting) quanto em ambientes de desenvolvimento.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  // Prioriza o Project ID do ambiente ou o padrão da Viby
  const projectId = process.env.FIREBASE_PROJECT_ID || 'ong-desafios-3942a';

  try {
    // Tenta inicialização com credenciais de ambiente (se disponíveis)
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
    
    // Fallback: Inicialização padrão (funciona automaticamente no Google Cloud / Firebase App Hosting)
    return initializeApp({
      projectId
    }, 'admin-app');
  } catch (error: any) {
    console.error('[Admin SDK Error]:', error.message);
    // Se falhar, tenta retornar o app padrão se existir como última alternativa
    return apps.length > 0 ? apps[0] : initializeApp({ projectId }, 'admin-app');
  }
}

export const getAdminAuth = () => getAuth(getAdminApp());

/**
 * Retorna a instância do Firestore Admin para o banco 'eventosviby'.
 */
export const getAdminDb = () => {
  const app = getAdminApp();
  // No Firebase Admin SDK, passamos o databaseId como segundo argumento
  return getAdminFirestore(app, 'eventosviby');
};
