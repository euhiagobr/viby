
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { headers } from 'next/headers';

export async function recordQrScan(params: {
  organizationId: string;
  eventId?: string;
  scanType: 'organization' | 'event';
}) {
  try {
    const db = getAdminDb();
    const head = await headers();
    
    const userAgent = head.get('user-agent') || 'unknown';
    const referrer = head.get('referer') || 'direct';

    await db.collection('qr_scans').add({
      organizationId: params.organizationId,
      eventId: params.eventId || null,
      scanType: params.scanType,
      scannedAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: userAgent.substring(0, 500),
      referrer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      platform: 'viby'
    });

    return { success: true };
  } catch (error) {
    console.error("[QR Track Action] Failed:", error);
    return { success: false };
  }
}
