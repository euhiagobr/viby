import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

/**
 * @fileOverview API Server-Side para rastreamento de visualizações de perfis (Usuários e Organizações).
 * Incrementa o contador viewsCount de forma atômica.
 */

export async function POST(req: Request) {
  try {
    const { profileId, type } = await req.json();
    const db = getAdminDb();

    if (!profileId || !type) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const collectionName = type === 'organization' ? 'organizations' : 'users';
    const ref = db.collection(collectionName).doc(profileId);
    
    await ref.update({
      viewsCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Profile View API] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
