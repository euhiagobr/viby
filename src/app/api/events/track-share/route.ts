import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

/**
 * @fileOverview API Server-Side para rastreamento de compartilhamentos de eventos.
 * Incrementa o contador sharesCount de forma atômica.
 */

export async function POST(req: Request) {
  try {
    const { eventId } = await req.json();
    const db = getAdminDb();

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const eventRef = db.collection('events').doc(eventId);
    
    await eventRef.update({
      sharesCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Event Share API] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
