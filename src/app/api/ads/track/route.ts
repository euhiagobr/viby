import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

/**
 * @fileOverview API de Rastreamento de Ads.
 * Processa consumo de saldo e métricas exclusivamente no servidor.
 */

export async function POST(req: Request) {
  try {
    const { adId, eventType, userId, sessionId } = await req.json();
    const db = getAdminDb();

    if (!adId || !eventType) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const adRef = db.collection('ads').doc(adId);
    const adSnap = await adRef.get();

    if (!adSnap.exists) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    const ad = adSnap.data()!;

    // 1. Validação de Vigência e Orçamento
    const now = new Date();
    const end = ad.endDate.toDate();
    if (ad.status !== 'Ativo' || ad.remainingBudget <= 0 || now > end) {
       // Se expirado e ainda marcado como Ativo, aproveitamos para encerrar (Lazy Cleanup)
       if (ad.status === 'Ativo') {
          await finalizeAd(adId, db);
       }
       return NextResponse.json({ status: "skipped", reason: "inactive_or_expired" });
    }

    // 2. Buscar Preços
    const settingsSnap = await db.collection('settings').doc('ads').get();
    const settings = settingsSnap.data() || { cpcValue: 0.50, cpmValue: 10.00 };
    
    const cost = eventType === 'click' ? settings.cpcValue : (settings.cpmValue / 1000);
    const totalDeduction = cost * 1.11; // Incluindo provisionamento de imposto se necessário

    // 3. Atualização Transacional de Métricas e Saldo
    await db.runTransaction(async (transaction) => {
      const freshAdSnap = await transaction.get(adRef);
      const freshAd = freshAdSnap.data()!;
      
      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        remainingBudget: admin.firestore.FieldValue.increment(-cost)
      };

      if (eventType === 'click') {
        updateData.clicks = admin.firestore.FieldValue.increment(1);
      } else {
        updateData.reach = admin.firestore.FieldValue.increment(1);
      }

      // Lógica de alcance único (Unique Reach)
      if (userId) {
        const viewerRef = adRef.collection('viewers').doc(userId);
        const viewerSnap = await transaction.get(viewerRef);
        
        if (!viewerSnap.exists) {
          transaction.set(viewerRef, { timestamp: admin.firestore.FieldValue.serverTimestamp() });
          updateData.uniqueReach = admin.firestore.FieldValue.increment(1);
          
          // Captura demográfica anônima no servidor
          const userSnap = await transaction.get(db.collection('users').doc(userId));
          if (userSnap.exists) {
            const userData = userSnap.data()!;
            const genderKey = (userData.gender || 'outro').toLowerCase().replace(/\s+/g, '_');
            updateData[`stats_gender_${genderKey}`] = admin.firestore.FieldValue.increment(1);
          }
        }
      }

      transaction.update(adRef, updateData);
      
      // Dedução do Saldo Bloqueado da Organização
      const orgRef = db.collection('organizations').doc(ad.organizationId);
      transaction.update(orgRef, {
        blockedBalance: admin.firestore.FieldValue.increment(-totalDeduction),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[Ads Track API] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function finalizeAd(adId: string, db: admin.firestore.Firestore) {
  const adRef = db.collection('ads').doc(adId);
  const adSnap = await adRef.get();
  const ad = adSnap.data()!;
  
  const remaining = Math.max(0, ad.remainingBudget || 0);
  
  const batch = db.batch();
  batch.update(adRef, { 
    status: 'Finalizado', 
    remainingBudget: 0, 
    updatedAt: admin.firestore.FieldValue.serverTimestamp() 
  });
  
  if (remaining > 0) {
    const orgRef = db.collection('organizations').doc(ad.organizationId);
    batch.update(orgRef, {
      adBalance: admin.firestore.FieldValue.increment(remaining),
      blockedBalance: admin.firestore.FieldValue.increment(-remaining),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  await batch.commit();
}
