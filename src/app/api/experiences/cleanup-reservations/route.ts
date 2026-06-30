
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

/**
 * @fileOverview Reservation Expiration Worker
 * Este worker deve ser acionado periodicamente (ex: a cada 1-5 minutos) via Cron Job.
 * Objetivo: Liberar capacidade de slots ocupados por reservas que não concluíram o pagamento.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Proteção simples contra disparos externos não autorizados
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const now = admin.firestore.Timestamp.now();
  
  let expiredCount = 0;
  let errorCount = 0;
  const processedIds: string[] = [];

  try {
    // 1. Buscar reservas pendentes que já passaram do tempo de expiração
    const expiredSnap = await db.collection('experience_reservations')
      .where('status', '==', 'reserved')
      .where('expires_at', '<=', now)
      .limit(500) // Limite por execução para evitar timeout
      .get();

    if (expiredSnap.empty) {
      return NextResponse.json({ 
        success: true, 
        message: "Nenhuma reserva expirada para processar.",
        count: 0 
      });
    }

    console.log(`[RESERVATION WORKER] Identificadas ${expiredSnap.size} reservas expiradas.`);

    // 2. Processar expirações de forma atômica
    for (const resDoc of expiredSnap.docs) {
      try {
        await db.runTransaction(async (transaction) => {
          const freshSnap = await transaction.get(resDoc.ref);
          if (!freshSnap.exists) return;

          const data = freshSnap.data();
          
          // SEGURANÇA CONTRA RACE CONDITION:
          // Só expira se o status ainda for 'reserved'. 
          // Se o webhook de pagamento confirmou a reserva no meio tempo, ignoramos.
          if (data?.status === 'reserved') {
            transaction.update(resDoc.ref, {
              status: 'expired',
              expiredAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            expiredCount++;
            processedIds.push(resDoc.id);
          }
        });
      } catch (err) {
        console.error(`[RESERVATION WORKER] Erro ao processar reserva ${resDoc.id}:`, err);
        errorCount++;
      }
    }

    console.log(`[RESERVATION WORKER] Cleanup concluído. Efetivadas: ${expiredCount}, Falhas: ${errorCount}`);

    return NextResponse.json({
      success: true,
      summary: {
        analyzed: expiredSnap.size,
        expired: expiredCount,
        errors: errorCount,
        processedIds
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[RESERVATION WORKER] Falha crítica na execução:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
