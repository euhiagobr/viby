'use server';

import { headers } from 'next/headers';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

export type AuditAction = 
  | 'login' | 'logout' | 'signup' 
  | 'password_recovery_request' | 'password_reset_success' 
  | 'email_change' | 'account_deletion' 
  | 'profile_update' | 'cpf_update' | 'cpf_view'
  | 'organization_create' | 'organization_update'
  | 'event_create' | 'event_update' | 'event_delete'
  | 'coupon_create' | 'coupon_update' | 'coupon_delete'
  | 'ticket_purchase' | 'ticket_transfer' | 'ticket_cancel' | 'ticket_checkin'
  | 'cdc_refund_auto' | 'org_cancellation' | 'manual_refund_approval'
  | 'chargeback_created' | 'chargeback_updated' | 'chargeback_closed'
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

export async function recordAuditLog(params: AuditLogParams) {
  try {
    const db = getAdminDb();
    const head = await headers();
    
    const ip = head.get('x-forwarded-for')?.split(',')[0] || 
               head.get('x-real-ip') || 
               head.get('x-apphosting-ip') || 
               '0.0.0.0';
               
    const userAgent = head.get('user-agent') || 'unknown';
    const city = head.get('x-vercel-ip-city') || head.get('x-apphosting-city') || 'unknown';
    const country = head.get('x-vercel-ip-country') || head.get('x-apphosting-country') || 'unknown';
    const state = head.get('x-vercel-ip-country-region') || head.get('x-apphosting-region') || 'unknown';

    const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
    const device = isMobile ? 'mobile' : 'desktop';
    
    let browser = 'other';
    if (userAgent.includes('Chrome')) browser = 'chrome';
    else if (userAgent.includes('Firefox')) browser = 'firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'safari';

    const cleanIp = ip.replace(/^(::ffff:)/, '');

    await db.collection('audit_logs').add({
      ...params,
      ip: cleanIp,
      userAgent: userAgent.substring(0, 500),
      device,
      browser,
      city,
      country,
      state,
      platform: 'viby',
      requestId: crypto.randomUUID(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Audit] Action logged: ${params.action} by ${params.userEmail || 'Anonymous'}`);
  } catch (e) {
    console.warn("[Audit Log] Failed to record entry:", e);
  }
}