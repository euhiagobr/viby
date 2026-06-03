
'use server';

import { headers } from 'next/headers';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/database';

/**
 * @fileOverview Serviço de Auditoria Centralizado (Audit Log Engine).
 * Captura metadados de rede e contexto para rastreabilidade total.
 */

export type AuditAction = 
  | 'login' | 'logout' | 'signup' 
  | 'password_recovery_request' | 'password_reset_success' 
  | 'email_change' | 'account_deletion' 
  | 'profile_update' | 'cpf_update' | 'cpf_view'
  | 'organization_create' | 'organization_update'
  | 'event_create' | 'event_update' | 'event_delete'
  | 'coupon_create' | 'coupon_update' | 'coupon_delete'
  | 'ticket_purchase' | 'ticket_transfer' | 'ticket_cancel' | 'ticket_checkin'
  | 'admin_access' | 'admin_change' | 'permission_change' | 'finance_change'
  | 'payout_request' | 'stripe_operation'
  | 'ad_topup_init' | 'ad_topup_success';

export interface AuditLogParams {
  userId?: string | null;
  userEmail?: string | null;
  organizationId?: string | null;
  eventId?: string | null;
  ticketId?: string | null;
  action: AuditAction;
  category: 'auth' | 'profile' | 'org' | 'event' | 'ticket' | 'admin' | 'finance' | 'system';
  success?: boolean;
  errorMessage?: string | null;
  metadata?: any;
  route?: string;
  sessionId?: string;
}

/**
 * Registra uma entrada no log de auditoria de forma assíncrona e isolada.
 */
export async function recordAuditLog(params: AuditLogParams) {
  try {
    const head = await headers();
    
    // Captura de IP Real (Suporte a Vercel, Firebase App Hosting e Proxy)
    const ip = head.get('x-forwarded-for')?.split(',')[0] || 
               head.get('x-real-ip') || 
               head.get('x-apphosting-ip') || 
               '0.0.0.0';
               
    const userAgent = head.get('user-agent') || 'unknown';
    
    // Metadados Geográficos (Vercel/AppHosting Headers)
    const city = head.get('x-vercel-ip-city') || head.get('x-apphosting-city') || 'unknown';
    const country = head.get('x-vercel-ip-country') || head.get('x-apphosting-country') || 'unknown';
    const state = head.get('x-vercel-ip-country-region') || head.get('x-apphosting-region') || 'unknown';

    // Detecção simplificada de dispositivo/browser
    const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
    const device = isMobile ? 'mobile' : 'desktop';
    
    let browser = 'other';
    if (userAgent.includes('Chrome')) browser = 'chrome';
    else if (userAgent.includes('Firefox')) browser = 'firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'safari';

    const cleanIp = ip.replace(/^(::ffff:)/, '');

    await addDoc(collection(db, 'audit_logs'), {
      ...params,
      ip: cleanIp,
      userAgent: userAgent.substring(0, 500), // Proteção contra logs gigantes
      device,
      browser,
      city,
      country,
      state,
      platform: 'viby',
      requestId: crypto.randomUUID(),
      createdAt: serverTimestamp()
    });

    console.log(`[Audit] Action logged: ${params.action} by ${params.userEmail || 'Anonymous'}`);
  } catch (e) {
    // Falha silenciosa para não interromper o fluxo principal do usuário
    console.warn("[Audit Log] Failed to record entry:", e);
  }
}
