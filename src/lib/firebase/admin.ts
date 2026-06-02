import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Aponta para o banco de dados padrão do projeto para garantir integridade após migração.
 */

function getAdminApp(): App {
  const apps = getApps();
  const existingAdmin = apps.find(a => a.name === 'admin-app');
  if (existingAdmin) return existingAdmin;

  // O Admin SDK utilizará as credenciais de ambiente ou o projeto padrão configurado
  try {
    return initializeApp({}, 'admin-app');
  } catch (error: any) {
    console.warn('[Admin SDK Fallback]:', error.message);
    return apps.length > 0 ? apps[0] : initializeApp({}, 'admin-app');
  }
}

export const getAdminAuth = () => getAuth(getAdminApp());

/**
 * Retorna a instância do Firestore Admin para o banco padrão.
 */
export const getAdminDb = () => {
  const app = getAdminApp();
  return getAdminFirestore(app);
};