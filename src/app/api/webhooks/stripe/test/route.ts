import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * Endpoint de teste para simular um webhook de pagamento bem-sucedido
 * Acesse: http://localhost:9002/api/webhooks/stripe/test
 */
export async function GET(req: Request) {
  const db = getAdminDb();

  try {
    // Criar uma ordem de teste
    const testOrder = {
      userId: 'test-user-id',
      userEmail: 'teste@viby.club',
      userName: 'Testador Viby',
      currency: 'BRL',
      status: 'pending',
      items: [
        {
          eventId: 'test-event-id',
          eventTitle: 'Evento Teste',
          ticketTypeName: 'Ingresso VIP',
          productType: 'event',
          quantity: 1,
          price: 100,
          currency: 'BRL',
          administrativeFeeAmount: 5,
          organizationId: 'test-org-id',
          eventDate: new Date(),
          eventCity: 'São Paulo'
        }
      ],
      totals: { total: 105 },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const orderRef = await db.collection('orders').add(testOrder);
    console.log('[Test Webhook] Created test order:', orderRef.id);

    // Simular o processamento do webhook
    const orderId = orderRef.id;
    const registrationIds: string[] = [];

    const items = testOrder.items || [];
    for (const item of items) {
      for (let j = 0; j < item.quantity; j++) {
        const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const regRef = db.collection('registrations').doc();
        
        await regRef.set({
          ...item,
          userId: testOrder.userId,
          userName: testOrder.userName,
          userEmail: testOrder.userEmail,
          paymentStatus: "Pago",
          status: "active",
          ticketCode,
          orderId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        registrationIds.push(regRef.id);
        console.log('[Test Webhook] Created registration:', regRef.id, 'Ticket:', ticketCode);
      }
    }

    // Atualizar ordem para paid
    await orderRef.update({ 
      status: 'paid', 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    return NextResponse.json({ 
      success: true,
      message: 'Ordem de teste criada com sucesso',
      orderId,
      registrationIds,
      testEmail: testOrder.userEmail
    });
  } catch (error: any) {
    console.error('[Test Webhook Error]', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}
