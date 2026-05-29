
/**
 * @fileOverview Core do sistema ErrorManager da Viby.
 * Responsável por processar erros, gerar códigos únicos e enviar logs para o Firestore.
 */

import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLog {
  code: string;
  message: string;
  stack?: string;
  type: string;
  severity: ErrorSeverity;
  pathname?: string;
  component?: string;
  metadata?: any;
  userId?: string;
  userEmail?: string;
  browser?: string;
  os?: string;
  device?: string;
  resolved: boolean;
  status: 'pendente' | 'em_analise' | 'resolvido' | 'ignorado';
}

/**
 * Gera um código de erro único e rastreável.
 */
export function generateErrorCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'ERR-VIBY-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Captura informações do ambiente do cliente.
 */
function getClientContext() {
  if (typeof window === 'undefined') return {};
  
  const ua = window.navigator.userAgent;
  return {
    pathname: window.location.pathname,
    browser: window.navigator.appName,
    userAgent: ua,
    device: /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop',
    os: window.navigator.platform
  };
}

/**
 * Função principal para logar erros no Firestore.
 * Detecta automaticamente o ambiente (Client ou Server) e usa o método apropriado.
 */
export async function logSystemError(params: {
  error: any;
  type: string;
  severity?: ErrorSeverity;
  component?: string;
  metadata?: any;
  user?: { uid: string; email: string | null } | null;
}) {
  const { error, type, severity = 'error', component, metadata, user } = params;
  const code = generateErrorCode();
  const context = getClientContext();

  const logData = {
    code,
    message: error?.message || String(error),
    stack: error?.stack || null,
    type,
    severity,
    pathname: context.pathname || 'server-action',
    component: component || 'N/A',
    metadata: metadata || null,
    userId: user?.uid || null,
    userEmail: user?.email || null,
    browser: context.userAgent || 'Server',
    os: context.os || 'Server',
    device: context.device || 'server',
    resolved: false,
    status: 'pendente',
    createdAt: new Date() // Usar Date() em vez de serverTimestamp() para garantir compatibilidade imediata
  };

  try {
    // Se estiver rodando no servidor, tenta usar o Admin SDK para evitar erros de permissão
    if (typeof window === 'undefined') {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const adminDb = getAdminDb();
      await adminDb.collection('system_logs').add(logData);
    } else {
      // No cliente, usa o SDK padrão (as regras de segurança agora permitem gravação)
      if (db) {
        await addDoc(collection(db, 'system_logs'), {
          ...logData,
          createdAt: serverTimestamp()
        });
      }
    }
  } catch (e) {
    console.error('[ErrorManager Critical Failure]', e);
    // Fallback: log no console se o Firestore falhar
    console.error('[Logged Error Code]', code, logData);
  }

  return code;
}
