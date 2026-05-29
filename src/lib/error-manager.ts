
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

  const logData: Omit<ErrorLog, 'createdAt'> & { createdAt: any } = {
    code,
    message: error?.message || String(error),
    stack: error?.stack || null,
    type,
    severity,
    pathname: context.pathname,
    component,
    metadata: metadata || null,
    userId: user?.uid || null,
    userEmail: user?.email || null,
    browser: context.userAgent,
    os: context.os,
    device: context.device,
    resolved: false,
    status: 'pendente',
    createdAt: serverTimestamp()
  };

  try {
    // Tenta salvar no Firestore do banco 'eventosviby'
    if (db) {
      await addDoc(collection(db, 'system_logs'), logData);
    }
  } catch (e) {
    console.error('[ErrorManager Critical Failure]', e);
    // Fallback: log no console se o Firestore falhar
    console.error('[Logged Error Code]', code, logData);
  }

  return code;
}
