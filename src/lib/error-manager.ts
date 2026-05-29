'use client';

/**
 * @fileOverview ErrorManager robusto.
 * Migrado para utilizar exclusivamente o Client SDK para evitar falhas de token do Admin SDK no servidor.
 */

import { db } from '@/firebase/database';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
  if (typeof window === 'undefined') return { device: 'server', os: 'linux', pathname: 'server-action' };
  
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
    browser: context.userAgent || 'Server',
    os: context.os || 'Server',
    device: context.device || 'server',
    resolved: false,
    status: 'pendente',
    createdAt: new Date()
  };

  try {
    // Usamos o db singleton que agora é estável no servidor também
    await addDoc(collection(db, 'system_logs'), {
      ...logData,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error('[ErrorManager Fallback]', code, logData);
  }

  return code;
}
