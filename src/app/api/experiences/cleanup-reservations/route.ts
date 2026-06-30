
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

/**
 * @fileOverview Reservation Expiration Worker with Global Job Lock
 * Executa a limpeza de reservas expiradas garantindo que não haja execuções paralelas.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const now = admin.firestore.Timestamp.now();
  const lockRef = db.collection('system_job_locks').doc('expire_experience_reservations');
  
  try {
    // 1. ADQUIRIR JOB LOCK (ATÔMICO)
    const canRun = await db.runTransaction(async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists) {
        const lockData = lockSnap.data();
        // Se o lock ainda não expirou (janela de 5 min), aborta
        if (lockData?.expires_at.toDate() > new Date()) {
          return false;
        }
      }
      
      // Cria ou renova o lock para os próximos 5 minutos
      transaction.set(lockRef, {
        job_name: 'expire_experience_reservations',
        locked_at: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
        locked_by: 'cron_worker_instance'
      });
      return true;
    });

    if (!canRun) {
      return NextResponse.json({ status: "skipped", reason: "job_already_locked" });
    }

    // 2. PROCESSAR EXPIRAÇÕES
    const expiredSnap = await db.collection('experience_reservations')
      .where('status', '==', 'reserved')
      .where('expiresAt', '<=', now)
      .limit(500)
      .get();

    if (expiredSnap.empty) {
      await lockRef.delete(); // Libera o lock antecipadamente se nada para fazer
      return NextResponse.json({ count: 0, message: "No expired reservations." });
    }

    let expiredCount = 0;
    for (const resDoc of expiredSnap.docs) {
      await db.runTransaction(async (transaction) => {
        const freshSnap = await transaction.get(resDoc.ref);
        if (freshSnap.exists && freshSnap.data()?.status === 'reserved') {
          transaction.update(resDoc.ref, {
            status: 'expired',
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          expiredCount++;
        }
      });
    }

    // 3. LIBERAR JOB LOCK
    await lockRef.delete();

    console.log(`[CLEANUP-WORKER] Processed ${expiredCount} expired reservations.`);

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[CLEANUP-WORKER-CRITICAL]", error.message);
    await lockRef.delete().catch(() => {}); // Tenta liberar lock em erro
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
