import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { sendReviewInviteEmail } from '@/app/actions/email';

/**
 * @fileOverview Worker para disparar convites de avaliação de experiências.
 * Filtra ingressos utilizados (check-in) há mais de 24h e envia o e-mail de feedback.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const pendingSnap = await db.collection('registrations')
      .where('productType', '==', 'experience')
      .where('checkedIn', '==', true)
      .where('checkedInAt', '<=', admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
      .where('reviewInviteSent', '==', false)
      .limit(50)
      .get();

    if (pendingSnap.empty) {
      return NextResponse.json({ count: 0, message: "No pending review invites." });
    }

    let sentCount = 0;
    for (const doc of pendingSnap.docs) {
      const reg = doc.data();
      
      try {
        const res = await sendReviewInviteEmail({
          to: reg.userEmail,
          userName: reg.userName || "Membro Viby",
          experienceTitle: reg.eventTitle,
          reviewUrl: `https://viby.club/dashboard/ingressos`
        });

        if (res.success) {
          await doc.ref.update({
            reviewInviteSent: true,
            reviewInviteSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sentCount++;
        }
      } catch (err) {
        console.error(`[Review Worker] Failed for registration ${doc.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processed: sentCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
