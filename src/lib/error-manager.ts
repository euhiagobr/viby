import { db } from '@/firebase/database';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * @fileOverview ErrorManager Isomórfico.
 * Removida a diretiva 'use client' para permitir chamadas do lado do servidor.
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export function generateErrorCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'ERR-VIBY-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getClientContext() {
  if (typeof window === 'undefined') {
    return { 
      device: 'server', 
      os: 'linux', 
      pathname: 'server-action',
      userAgent: 'Server-Side-Action',
      browser: 'Node.js'
    };
  }
  
  const ua = window.navigator.userAgent;
  return {
    pathname: window.location.pathname,
    browser: window.navigator.appName,
    userAgent: ua,
    device: /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop',
    os: window.navigator.platform
  };
}

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
    pathname: context.pathname,
    component: component || 'N/A',
    metadata: metadata || null,
    userId: user?.uid || null,
    userEmail: user?.email || null,
    browser: context.browser,
    os: context.os,
    device: context.device,
    resolved: false,
    status: 'pendente'
  };

  try {
    // Gravação segura no Firestore usando o Client SDK no servidor
    await addDoc(collection(db, 'system_logs'), {
      ...logData,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error('[ErrorManager Fallback]', code, logData);
  }

  return code;
}
