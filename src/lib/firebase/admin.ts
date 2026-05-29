import { getApps, initializeApp, credential, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização ultra-robusta do Firebase Admin SDK.
 * Configurada para acessar o banco de dados nomeado 'eventosviby'.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = 'ong-desafios-3942a';

  try {
    // Tenta inicialização padrão (funciona no GCP/App Hosting)
    return initializeApp({
      projectId
    }, 'admin-app');
  } catch (error: any) {
    console.warn('[Admin SDK Fallback]:', error.message);
    return apps.length > 0 ? apps[0] : initializeApp({ projectId }, 'admin-app');
  }
}

export const getAdminAuth = () => getAuth(getAdminApp());

/**
 * Retorna a instância do Firestore Admin para o banco 'eventosviby'.
 */
export const getAdminDb = () => {
  const app = getAdminApp();
  return getAdminFirestore(app, 'eventosviby');
};
