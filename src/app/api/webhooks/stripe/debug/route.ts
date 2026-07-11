import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * Endpoint para debug: lista todas as ordens recentes
 * Acesse: http://localhost:9002/api/webhooks/stripe/debug?limit=5
 */
export async function GET(req: Request) {
  const db = getAdminDb();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');

  try {
    // Listar ordens recentes
    const ordersSnap = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const orders = ordersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Para cada ordem, listar registrations
    const result = [];
    for (const order of orders) {
      const regsSnap = await db.collection('registrations')
        .where('orderId', '==', order.id)
        .get();

      const registrations = regsSnap.docs.map(doc => ({
        id: doc.id,
        status: doc.data().status,
        ticketCode: doc.data().ticketCode,
        paymentStatus: doc.data().paymentStatus
      }));

      result.push({
        orderId: order.id,
        orderStatus: order.status,
        orderEmail: order.userEmail,
        itemsCount: order.items?.length || 0,
        registrationsCount: registrations.length,
        registrations: registrations,
        createdAt: order.createdAt?.toDate?.() || order.createdAt
      });
    }

    // Listar eventos processados pelo webhook
    const webhookEventsSnap = await db.collection('stripe_processed_events')
      .orderBy('processedAt', 'desc')
      .limit(10)
      .get();

    const webhookEvents = webhookEventsSnap.docs.map(doc => ({
      id: doc.id,
      type: doc.data().type,
      processedAt: doc.data().processedAt?.toDate?.() || doc.data().processedAt
    }));

    return NextResponse.json({
      recentOrders: result,
      webhookEvents: webhookEvents,
      totalRecentOrders: result.length
    });
  } catch (error: any) {
    console.error('[Debug Error]', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
