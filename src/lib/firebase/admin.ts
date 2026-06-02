import { getApps, initializeApp, credential, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Utiliza o banco de dados 'eventosviby'.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  const projectId = 'vibyeventos';

  try {
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
  // Especifica o banco de dados para o Admin SDK
  return getAdminFirestore(app, 'eventosviby');
};
